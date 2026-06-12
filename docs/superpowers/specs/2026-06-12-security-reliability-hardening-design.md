# TASK-050: Security and Reliability Hardening Design

## Goal

Устранить найденные риски доступа, хранения, логирования, расчетов и тестирования без изменения пользовательских сценариев DNS SimCenter.

## Scope

Изменения охватывают:

- авторизацию persisted simulation sessions;
- авторизацию live WebSocket;
- доступ к PDF/XLSX-экспорту;
- безопасное API-логирование и CSP;
- целостность SQLite и legacy live-session persistence;
- единый расчет результатов;
- production bundle reference-assets;
- тестовую архитектуру;
- точечное разделение крупных runtime-модулей.

Разрешены изменения в `client/`, `server/`, `shared/`, `script/`, `.github/workflows/`, `migrations/`, `package.json` и `package-lock.json`. Изменения не должны затрагивать тексты сценариев, кейсы, медиаконтент, API-смысл симуляции, CRUD-поведение администратора или визуальные пропорции экранов.

## Access Model

### Staff

Администратор и оценщик используют существующую staff-сессию.

- Оба имеют полный доступ ко всем текущим и прошлым simulation sessions и результатам.
- Оба могут читать результаты, просматривать live-сессии и выполнять экспорт без participant-token и повторного ввода пароля.
- Только администратор сохраняет права на удаление результатов, управление контентом, настройками и сотрудниками.
- Переход оценщика в административную область по-прежнему требует существующую процедуру elevation.

### Participant

При создании `/api/sessions` сервер генерирует криптографически случайный participant-token.

- Клиент получает исходный токен только в ответе создания сессии.
- В SQLite хранится только SHA-256 hash токена.
- Клиент хранит токен в `sessionStorage`, отдельно от состояния, отправляемого по WebSocket.
- Все последующие participant-запросы передают токен в `X-Simulation-Token`.
- Токен разрешает доступ только к session ID, для которого сохранен соответствующий hash.
- Токен не включается в URL, reducer state, live snapshot, audit payload или console log.

### Legacy sessions

Существующие записи без token hash считаются legacy.

- Admin/evaluator имеют к ним полный доступ.
- Анонимное чтение и изменение запрещено.
- Незавершенное legacy-прохождение нельзя продолжить как participant; оно запускается заново.
- Миграция не удаляет существующие результаты.

## HTTP Authorization

Middleware `requireSimulationAccess` принимает режим доступа и выполняет:

1. Проверку существования simulation session.
2. Разрешение полного доступа для любой действующей staff-сессии.
3. Для participant-запроса проверку `X-Simulation-Token` через timing-safe comparison hash.
4. Запрет participant-доступа к legacy session без hash.

Middleware применяется к:

- `GET /api/sessions/:id`;
- `PATCH /api/sessions/:id`;
- `POST /api/sessions/:id/answers`;
- `POST /api/sessions/:id/metrics`;
- `PUT /api/sessions/:id/result`.

Создание `/api/sessions` остается публичным и возвращает `{ ...session, sessionToken }`.

## Export Authorization

`POST /api/export-pdf` и `POST /api/export-xlsx` разрешены:

- любой действующей admin/evaluator staff-сессии;
- participant с корректным `X-Simulation-Token` и `sessionId` в валидированном payload.

Participant может экспортировать только текущую принадлежащую ему session. Staff может экспортировать текущие и прошлые результаты без дополнительных кодов или запросов пароля.

Экспорт остается rate-limited. PDF generation переводится с блокирующего `spawnSync` на асинхронный child process с тем же timeout и ограничением буфера.

## WebSocket Authorization

Handshake `/ws/live` больше не доверяет только query-параметрам.

### Student socket

- Требует `liveSessionId`, `role=student` и соответствующий `accessCode`.
- Код проверяется до `handleUpgrade`.
- Может отправлять только `snapshot`.
- Server derives status `waiting/running/completed` из snapshot; student не отправляет управляющий `status`.

### Assessor socket

- Требует `liveSessionId`, `role=assessor` и действующую staff-cookie session.
- Express session parser используется во время upgrade.
- Admin и evaluator допускаются одинаково.
- Может отправлять `reset` и разрешенные status transitions.

Недопустимое сообщение возвращает socket error и не меняет live session.

## Logging and CSP

API access log содержит только:

- HTTP method;
- normalized path;
- status code;
- duration;
- request ID.

Полные JSON responses, CSRF tokens, participant tokens, access codes, пароли и report payloads не логируются.

Audit records сохраняют бизнес-события, но sensitive fields удаляются рекурсивным sanitizer перед записью. В частности, `accessCode`, `sessionToken`, `csrfToken`, password fields и authorization headers не должны попадать в `before`, `after` или metadata.

Production CSP использует `script-src 'self'`. `unsafe-eval` допускается только в development, если он требуется Vite. `style-src 'unsafe-inline'` сохраняется из-за существующих React inline styles.

## SQLite Integrity

Новая миграция:

- добавляет nullable `participant_token_hash` в `simulation_sessions`;
- пересоздает `session_answers`, `session_metrics` и `session_results` с foreign key на `simulation_sessions(id) ON DELETE CASCADE`;
- копирует только строки, имеющие существующую parent session;
- восстанавливает индексы и unique constraint результатов.

Удаление session выполняется одним `DELETE FROM simulation_sessions`; каскад обеспечивает удаление ответов, метрик и результата.

## Live Persistence

SQLite `app_live_sessions` становится единственным штатным хранилищем.

- Новые изменения записываются только в SQLite.
- `live-sessions.json` читается только если SQLite-store пуст.
- После успешного импорта legacy JSON данные немедленно сохраняются в SQLite, а JSON удаляется.
- Ошибка импорта не удаляет legacy JSON.

## Shared Scoring

Чистые функции расчета выносятся в `shared/simulation-scoring.ts`.

Модуль отвечает за:

- case weight normalization;
- time coefficient;
- weighted total and average score;
- competency accumulation and averages;
- common clamping and rounding.

Его используют:

- `SimulationProviderRuntime`;
- `client/src/lib/report-data.tsx`;
- server-side recovery calculation.

UI-specific verdicts, formatting и React nodes остаются на клиенте. Существующие формулы и результаты не меняются; устраняется только дублирование.

## Runtime Module Boundaries

Полный переписанный UI не входит в scope. Разделяются только зоны, затронутые исправлениями:

- persisted session credentials and authorized request helpers;
- simulation session synchronization hook;
- live WebSocket transport and authorization parameters;
- report export client helpers;
- shared score calculation.

Admin and assessor workspaces сохраняют текущую разметку и поведение. Из них выносятся только export/live transport handlers, если они меняются в рамках этой задачи.

## Bundle Assets

Reference mockups удаляются из статических imports `BRAND_ASSETS`.

- Production build не должен копировать `reference_main_screen_mockup_liked_by_user.png`.
- Production build не должен копировать `reference_full_project_mockup_rejected_direction.png`.
- Исходные reference-файлы могут остаться в repository для дизайнерской документации.

## Testing Strategy

Работа выполняется TDD: каждый дефект сначала получает failing regression test.

### Server integration

Тестовый app/server запускается на ephemeral port с временной SQLite DB.

Проверяется:

- запрос session без token получает 401;
- неправильный token получает 403;
- правильный token работает только для своей session;
- evaluator/admin получают все sessions без participant-token;
- legacy session доступна staff и недоступна participant;
- participant export требует token и matching session ID;
- staff export не требует participant-token;
- anonymous/student-invalid/assessor-invalid WebSocket handshake отклоняется;
- student snapshot принимается;
- student reset/status не меняет session;
- staff assessor reset/status принимается;
- API logs не содержат sensitive values;
- audit sanitizer удаляет sensitive fields;
- cascade delete не оставляет orphan records;
- legacy JSON импортируется один раз.

### Scoring

Одинаковый fixture проходит runtime/report/server adapters. Total, average и competency averages должны совпадать.

### Browser smoke

Playwright Chromium проверяет:

- `/`, `/student`, `/staff-login`;
- dark/light theme;
- instruction dialog;
- маршрутизацию CTA;
- отсутствие horizontal overflow на 1920x1080, 1366x768 и 390x844;
- отсутствие console errors.

### Bundle

Build acceptance проверяет отсутствие reference mockup filenames в `dist/public/assets`.

## Verification

Обязательные команды:

```text
npm run check
npm run test
npm run test:ui
npm run test:ops
npm run build
node script/check-docker-safety.mjs
docker compose build app
```

Если Docker отсутствует локально, это фиксируется как environment skip; остальные команды должны пройти.

Дополнительно запускаются новые security integration, scoring parity и browser smoke tests отдельно во время red-green циклов.

## Acceptance Criteria

- Participant не может читать или изменять чужую либо legacy session.
- Admin/evaluator имеют полный доступ к текущим и прошлым sessions/results без дополнительных credentials.
- WebSocket role нельзя подделать query-параметром.
- Student не управляет reset/status.
- Экспорт недоступен анонимному пользователю.
- Sensitive data отсутствует в console и audit logs.
- CSP production не содержит `unsafe-eval`.
- SQLite не допускает orphan session records.
- Live persistence не расходится между SQLite и JSON.
- Все три потребителя scoring используют один общий модуль и дают одинаковый результат.
- Reference mockups отсутствуют в production bundle.
- Публичные экраны сохраняют маршруты, тексты, темы и адаптивность.
- Все доступные проверки проходят.

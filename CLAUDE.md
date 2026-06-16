# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

> **СТОП. Читается первым в каждой сессии.**
> AUTOPILOT.md: `completed: true` — онбординг пройден, продолжай работу.

---

## Что это за проект

**DNS SimCenter** — симуляция управленческих ситуаций для оценки компетенций менеджеров в розничных магазинах DNS.

Продукт позволяет асессору запустить живую симуляцию для участника, наблюдать прогресс, управлять кейсами и событиями каналов, просматривать результаты по компетенциям и экспортировать PDF-отчёт.

**Контекст:** DNS, Дивизион Урал. Используется для кадровой оценки в рознице.

> `.business/` — «второй мозг» проекта: бизнес-контекст, модель компетенций, методология оценки. Читай `.business/INDEX.md` при любой бизнес-задаче, `.business/GLOSSARY.md` — при незнакомом термине DNS/РРС или ассессмента.

---

## Стек

- **Frontend:** React 18, Vite, Tailwind CSS, TanStack Query, wouter (роутинг)
- **Backend:** Express 5, TypeScript, SQLite (better-sqlite3), Drizzle ORM
- **Auth:** Passport.js + express-session (Helmet, rate-limit, CSRF)
- **Live-сессии:** WebSocket (ws) — синхронизация состояния симуляции
- **PDF:** Python-скрипт (`server/generate_pdf.py`) через backend
- **Deploy:** Docker + Nginx, PM2 (`ecosystem.config.cjs`)

---

## Команды

```bash
npm run dev              # dev-сервер (tsx server/index.ts + Vite HMR)
npm run build            # production build → dist/
npm run start            # запуск production (node dist/index.cjs)
npm run check            # TypeScript-проверка (= lint)
npm run test             # CI smoke-тесты (script/ci-smoke.ts)
npm run test:browser     # Playwright browser acceptance
npm run test:ui          # UI acceptance checks

npm run db:push          # применить схему Drizzle к БД
npm run db:migrate       # запустить миграции (script/migrate-db.ts)
npm run db:seed-simulation   # заполнить контент симуляции
npm run staff:reset      # сбросить учётные записи персонала
npm run media:import     # импортировать медиа в uploads/
```

**Полный цикл проверки перед PR:**
```bash
npm run check && npm run test && npm run build && npm run test:browser
```

**Docker:**
```bash
docker compose build app
curl -fsS http://127.0.0.1:5001/api/health   # smoke после старта
```

---

## Архитектура

### Поток запроса

```
Browser → Express (static Vite build) → /api/* → storage modules → SQLite
                                      ↓
                               WebSocket (ws) — live-session sync
```

### Frontend — `client/src/`

| Папка | Назначение |
|---|---|
| `pages/` | Тонкие роутинг-энтри (не бизнес-логика) |
| `features/admin/` | Воркспейс администратора: кейсы, каналы, настройки |
| `features/assessor/` | Воркспейс асессора: создание сессии, мониторинг |
| `features/simulation/` | Воркспейс участника (UI симуляции) |
| `features/simulation-engine/` | Провайдер + таймеры, планировщик, логика действий |
| `context/SimulationContext.tsx` | Совместимостный re-export из simulation-engine |
| `components/` | Переиспользуемые UI-компоненты (cross-feature) |
| `styles/` | CSS в фиксированном порядке: base → admin → assessor → simulation → responsive |
| `data/` | Статические данные кейсов, компетенций, маппинги аудио/сигналов |
| `lib/` | Утилиты: scoring, session-access, report-data, queryClient |

**Правило стилей:** новые большие блоки CSS — **не в `index.css`**, а в отдельный модуль в `styles/`.

### Backend — `server/`

| Файл | Назначение |
|---|---|
| `index.ts` | Express app: регистрация middleware и маршрутов |
| `routes.ts` | Все `/api/*` маршруты |
| `storage.ts` | Основной storage (сессии симуляции, результаты) |
| `staff-storage.ts` | CRUD учётных записей персонала |
| `content-storage.ts` | CRUD контента (кейсы, компетенции, медиа) |
| `session-storage.ts` | Хранение состояния сессий |
| `live-session-service.ts` | Бизнес-логика живых сессий |
| `audit-storage.ts` | Журнал аудита действий |
| `auth.ts` | Passport стратегии |
| `pdf-export.ts` | Генерация PDF-отчётов |
| `middleware/` | CSRF, rate-limit, error-handler, validation |

### Shared — `shared/`

| Файл | Назначение |
|---|---|
| `schema.ts` | Drizzle-схема SQLite (единый источник типов) |
| `simulation-scoring.ts` | Алгоритм подсчёта компетенций |
| `simulation-content.ts` | Типы контента симуляции |
| `live-session.ts` | Контракты WebSocket-событий |

---

## Роли и страницы

В системе **3 роли** (staff в `schema.ts`: `admin`, `evaluator`).

| Роль | Маршруты | Описание |
|---|---|---|
| Администратор (`admin`) | `/staff-login` → `/admin` | Управление контентом, кейсами, медиа, персоналом |
| Оценщик (`evaluator`) | `/staff-login` → `/assessor`, `/evaluator`, `/results` | Запуск/мониторинг сессии (экран «Асессор») + просмотр результатов |
| Участник (`participant`) | `/` → `/student` → `/simulation` | Прохождение симуляции |

> «Асессор» (`/assessor`) — это экран/функция роли Оценщик, а не отдельная роль.

---

## Правила работы

### Git и задачи

- Ветки: `feature/task-NNN-название`
- Коммиты: `TASK-NNN: короткое описание`
- `git add` — только поимённо, никогда `git add .`
- PR: `feature/task-NNN` → `dev` (не напрямую в `main`)
- Перед push: `npm run check && npm run test && npm run build`

### Запрещено без явного одобрения

`.env`, `Dockerfile`, `docker-compose*.yml`, `package.json`, `package-lock.json`, `migrations/`, `scripts/deploy-prod.sh`, `scripts/backup.sh`, `nginx.conf`, контент симуляции (кейсы, scoring, медиа) — если задача не требует явно.

### Безопасность

- Не читать `.env` целиком → `grep "^VAR=" .env`
- Пароли — только bcrypt-хэши
- Мутирующие запросы — только через CSRF-aware логику клиента
- Перед Bypass Permissions — git-коммит

---

## Рабочие документы

| Файл | Назначение |
|---|---|
| `docs/ARCHITECTURE.md` | Архитектурные решения |
| `docs/MODULE_MAP.md` | Карта модулей |
| `docs/TASK_RULES.md` | Правила задач и PR |
| `docs/TEST_PLAN.md` | Полный план тестирования |
| `docs/DEPLOY_PLAN.md` | Инструкция по деплою |
| `plans/` | Технические планы (1 план = 1 задача) |
| `retrospectives/` | Рефлексии сессий |
| `prompts/INDEX.md` | Индекс промптов — читай перед созданием нового |

---

## Общая база знаний и история (Claude + Codex)

Над проектом работают два агента: **Claude Code** (вход — этот `CLAUDE.md`) и **Codex** (вход — `AGENTS.md`). Оба обязаны держать единую картину проекта.

**`CLAUDE.md` и `AGENTS.md` — близнецы.** Меняешь правила/архитектуру/команды в одном — зеркаль во втором. Они не должны расходиться.

### Перед работой — прочитать канон
1. `CLAUDE.md` (этот файл) — гайд проекта.
2. `.business/INDEX.md` — бизнес-контекст; `.business/methodology/` — модель компетенций; `.business/GLOSSARY.md` — термины.
3. `docs/ARCHITECTURE.md`, `docs/MODULE_MAP.md`, `docs/TASK_RULES.md` — при задачах по коду.

### После изменений — обновить знания
- Если поменялись стек/архитектура/роли/процесс — обнови `CLAUDE.md` **и** `AGENTS.md`.
- Если поменялся бизнес-контекст/методология — обнови соответствующий файл в `.business/`.

### История изменений — обязательна
- Каждое значимое изменение → запись в **`docs/CHANGELOG.md`** (дата, что сделано, почему; при наличии — номер задачи/PR).
- Формат и ветки/коммиты — по `docs/TASK_RULES.md` (`TASK-NNN: ...`).
- Доказательная база крупных серий — `docs/CHANGE_EVIDENCE.md`.
- `.business/`, `plans/`, `retrospectives/` — **в git** (общий приватный репозиторий), чтобы напарник видел весь ход работы.

### Локальное, НЕ в git
`.claude/` (конфиг Claude Code), `tmp/`-артефакты, сгенерированные PDF — у каждого своё, в репозиторий не идёт.

---

**Язык:** всегда русский. Термины DNS/РРС — без перевода.

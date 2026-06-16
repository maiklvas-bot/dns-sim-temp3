# AGENT INSTRUCTIONS (Codex)

> Это вход для Codex. Claude Code работает через `CLAUDE.md`. **`AGENTS.md` и `CLAUDE.md` — близнецы:** правила, архитектура и команды в них должны совпадать. Меняешь в одном — зеркаль во втором.

---

## 0. Перед началом любой работы

1. Обнови репозиторий:
   - `git fetch --all --prune`
   - `git pull --ff-only`
2. **Прочитай канон проекта** (не пропускай — здесь все знания):
   - `CLAUDE.md` — основной гайд: что за проект, стек, архитектура, роли, команды, запреты.
   - `.business/INDEX.md` — бизнес-контекст; `.business/methodology/` — модель компетенций и scoring; `.business/GLOSSARY.md` — термины DNS/РРС и ассессмента.
   - `docs/ARCHITECTURE.md`, `docs/MODULE_MAP.md`, `docs/TASK_RULES.md` — при задачах по коду.
   - `docs/CHANGELOG.md`, `docs/CHANGE_EVIDENCE.md` — что и зачем уже менялось.

> Если в `CLAUDE.md` и `AGENTS.md` встретишь расхождение — это баг: останови работу и синхронизируй файлы.

## 1. Что за проект (кратко; полная версия — в `CLAUDE.md`)

**DNS SimCenter** — симуляция для оценки управленческих компетенций менеджеров розницы DNS (найм, оценка перед назначением, развитие, аттестация). Главная цель — помощь в кадровых решениях.

- **Стек:** React 18 + Vite + TypeScript (front) · Express 5 + SQLite + Drizzle (back) · WebSocket (live-сессии) · Python (PDF) · Docker + Nginx + PM2 (деплой).
- **Роли (3):** Администратор, Оценщик (включая экран «Асессор»), Участник.
- **Команды:** `npm run dev` · `npm run check` (= lint) · `npm run test` · `npm run build` · `npm run test:browser` · `npm run db:migrate`.

## 2. Зона ответственности Codex
Развёртывание и сервер (Docker). При работе с деплоем сверяйся с `docs/DEPLOY_PLAN.md`, `docs/TEST_PLAN.md`, `docker-compose*.yml`, `nginx.conf`, `scripts/`.

## 3. Правила изменений (как у Claude — единые)

- Ветки: `feature/task-NNN-название`; коммиты: `TASK-NNN: короткое описание` (см. `docs/TASK_RULES.md`).
- `git add` — только поимённо, **никогда** `git add .`.
- Перед push: `npm run check && npm run test && npm run build` (+ Docker-проверка по `docs/TEST_PLAN.md`).
- **Запрещено без явного одобрения:** `.env`, `package.json`, `package-lock.json`, `migrations/`, контент симуляции (кейсы, scoring, медиа). Docker/`nginx.conf`/`scripts/deploy-*` — твоя зона, но меняй осознанно и фиксируй в истории.

## 4. Обновление знаний и история (обязательно)

- Поменялись стек/архитектура/роли/процесс → обнови **`CLAUDE.md` и `AGENTS.md`** (оба).
- Поменялся бизнес-контекст/методология → обнови файл в `.business/`.
- **Каждое значимое изменение → запись в `docs/CHANGELOG.md`** (дата, что сделано, почему; номер задачи/PR). Крупные серии — в `docs/CHANGE_EVIDENCE.md`.
- `.business/`, `plans/`, `retrospectives/` — в общем приватном репозитории; не теряй их при работе.

## 5. Pull Request

1. Всегда спрашивай подтверждение пользователя перед созданием PR.
2. Не создавай PR без явного согласия в текущем диалоге.

## 6. Локальное, НЕ в git
`.claude/` — конфиг Claude Code (тебе не нужен). `tmp/`-артефакты и сгенерированные PDF — локальные.

---

**Язык:** всегда русский. Термины DNS/РРС — без перевода.

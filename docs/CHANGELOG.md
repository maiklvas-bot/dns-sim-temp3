# Changelog

## 2026-06-16 — База знаний агентов и коррекция идентичности проекта

- Исправлена ошибочная идентичность проекта: `.business/`, `CLAUDE.md`, `AUTOPILOT.md` переписаны под DNS SimCenter (было — дашборд «Пульс РРС Тюмень»); старые материалы перенесены в `.business/_archive/` (локально).
- `.business/` переструктурирована: `context/`, `product/`, `methodology/` (модель 14 компетенций, scoring, дизайн кейсов), `audience/`, `strategy/`, `assets/`; `GLOSSARY.md` дополнен терминами ассессмента.
- Введена единая база знаний для двух агентов: `CLAUDE.md` (Claude Code) и `AGENTS.md` (Codex) — «близнецы»; оба читают канон и ведут историю в этом файле.
- `.gitignore`: `.business/`, `plans/`, `retrospectives/` — в git (общий приватный репо); `.claude/`, `.business/_archive/`, локальные артефакты — исключены.

- Кабинет оценщика переведен на постоянную навигацию: кандидаты, настройка запуска, активные сессии, результаты и Wiki.
- Добавлены карточка текущего кандидата, готовность запуска, проверка настройки и единая панель действий.
- Активные и завершенные сессии разделены; в мониторинге отображается текущий средний балл.
- Обновлены компактная сетка, адаптивность и светлая тема кабинета оценщика.
- Исправлена готовность запуска: корректно заполненные кейсы и каналы больше не требуют скрытых подтверждений старого мастера.

## 2026-06-06

- TASK-035: added verified backups, two-copy retention, guarded restore, staging/production override support and CI operational checks.
- TASK-036: added repeatable UI acceptance contracts without changing the agreed interface.
- TASK-037: documented current content source chain and approval requirements; runtime content was not changed.

## 2026-05-25

- Added GitHub-ready project documentation.
- Added staging and production Docker Compose overrides.
- Added CI workflow for dependency install, lint, tests, build and Docker build.
- Added operational scripts for backup, deploy and healthcheck.
- Added task rules and release process documentation.
# 2026-06-06 — Structural dynamics admin workspace

- Админ-панель получила постоянную компактную навигацию, единый рабочий холст и правую панель статуса/быстрых действий.
- В правой панели кейса добавлены заполненность, ошибки настройки, количество циклов и переходов, сохранение, предпросмотр, проверка логики, Wiki и публикация.
- Цикл кейса расширен до полноценной вложенной сущности: название, описание, источник, зоны, тайминг, статус, финальность, приоритет и критичность сохраняются в SQLite.
- Финальный цикл завершает кейс при отсутствии явно заданного перехода; связь `ответ → цикл` сохранена.
- Добавлен smoke-тест сохранения и повторного чтения метаданных вложенного цикла.

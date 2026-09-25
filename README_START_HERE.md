# DNS SimCenter — Hermes project entry point

Проектная Hermes-архитектура развёрнута для репозитория `D:\MyProject\Simulacia Claude`.

## Привязка

- Hermes Project: `hermes-dns-sim`
- Kanban board: `hermes-dns-sim`
- Primary repo: `D:\MyProject\Simulacia Claude`
- Project rules: `.hermes.md`
- Local skill: `.hermes/skills/project-development/SKILL.md`
- State: `docs/project/HERMES_STATE.md`
- Roadmap: `docs/project/HERMES_ROADMAP.md`
- Automation: `docs/project/HERMES_AUTOMATION.md`
- Obsidian log: `D:\MyProject\Obsidian\Pedro78\01-projects\simcenter\WORKLOG.md`

## Перед любой работой

1. Прочитать `PROJECT_BRIEF.md`, `.hermes.md`, STATE и ROADMAP.
2. Загрузить project-local skill.
3. Сверить `origin/main`, текущую ветку, dirty state, PR, CI и Kanban.
4. Учесть, что primary checkout уже содержит незакоммиченный UI/тематический пакет: не перезаписывать и не смешивать его с новой работой.
5. После каждого материального шага обновлять Obsidian worklog.

## Основные правила

- substantial coding — в project-bound worktree;
- один writer на worktree;
- Codex — реализация/тесты; Claude Code — архитектура, сложная диагностика или один независимый review;
- никаких сторонних/анонимных fallback-провайдеров;
- push, PR, merge, release/deploy, destructive/data/content activation — только после явного разрешения;
- production data/content and uploads are preserved;
- CI считается зелёным только для точного текущего commit.

## Проверка установки

```bash
hermes project show hermes-dns-sim
hermes kanban boards list
hermes kanban --board hermes-dns-sim stats
hermes skills trust "D:/MyProject/Simulacia Claude"
```

## Следующий запрос владельца

Дополнительный root task заранее не создан. Следующая инструкция владельца определит первую Kanban-задачу. Для автономного продолжения можно использовать `prompts/CONTINUE_PROJECT.md`; команда и границы описаны в `docs/project/HERMES_AUTOMATION.md`.

Выделенная Telegram-тема **DNS SimCenter** проверена для отправки уведомлений и привязана к каноническому репозиторию. Детали и ограничения — в `docs/project/HERMES_TELEGRAM_CONTROL.md`.

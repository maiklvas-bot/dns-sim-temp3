# AGENT INSTRUCTIONS

## Before starting any work
1. Always update the local repository before making changes:
   - `git fetch --all --prune`
   - `git pull --ff-only`

## Before opening a new PR
1. Always ask the user for confirmation before creating a new pull request.
2. Do not create a PR until explicit user approval is received in the current conversation.

## Единый маршрут разработки и CI

Этот раздел обязателен для всех coding agents и имеет приоритет над менее строгими локальными инструкциями.

- Пользовательский язык — русский; английский допустим в коде, командах, путях, идентификаторах и точных логах.
- Основной маршрут: GPT-5.6 Luna через ChatGPT/Codex OAuth. Не использовать anonymous, community, free-tier и сторонние provider-маршруты.
- Codex: реализация, focused fixes, повторяемые рефакторинги и только targeted tests изменённого участка. Claude Code: архитектура, сложная диагностика либо один важный независимый review. При недоступности Codex или Claude сообщить ограничение, не переключаться на другого provider.
- Для генерации визуальных материалов использовать GPT-5.6 Sol через ChatGPT/Codex OAuth независимо от Economy/Maximum mode.
- Один worktree — один writer. Параллельные agents допустимы только при read-only review либо в разных worktree/ветках.
- Перед изменениями выполнить `git fetch --all --prune`, проверить текущую ветку, upstream и dirty state. Не делать `pull`, merge или rebase поверх dirty worktree без отдельной оценки.
- Новая работа ведётся в `feature/<задача>` или `codex/<задача>`, если более строгое локальное правило не задаёт интеграционную ветку.
- До отдельного разрешения пользователя не выполнять push, PR, merge, release, deploy, force-push, удаление ветки/важных данных или изменение secrets.
- Полный suite, build, Playwright и Docker выполняются GitHub Actions на `ubuntu-latest`. Если GHA недоступен, Hermes запускает их отдельным OS-process, сохраняет stdout/stderr в logfile и проверяет exit code.
- Не запускать один и тот же полный набор повторно другим AI-agent и не заставлять Codex/Claude ждать его завершения или читать полный лог. При CI failure передавать агенту только упавший job/test и короткий релевантный excerpt; при success продолжать без повторного вызова AI.
- Linux-специфичные проверки и Docker запускать через WSL, когда это требуется. Docker не считать доступным, пока он не обнаружен и не проверен.
- Не заявлять о зелёной проверке, если current commit не green либо есть незакоммиченные изменения, не вошедшие в этот commit.

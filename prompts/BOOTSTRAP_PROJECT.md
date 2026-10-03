# Bootstrap verification — DNS SimCenter

Hermes-архитектура проекта уже материализована. Этот prompt используется для повторной проверки, а не для повторного развёртывания шаблонов.

Проверь:

1. `PROJECT_BRIEF.md`, `.hermes.md`, local skill, STATE, ROADMAP, automation и Telegram docs согласованы.
2. Hermes Project `hermes-dns-sim` имеет primary `<REPO_ROOT>` и связан с board `hermes-dns-sim`.
3. `origin/main`, current branch/HEAD, dirty worktree, open PRs и latest CI отражены в STATE.
4. Правила `AGENTS.md` сохранены: push/PR/merge/release/deploy только после явного разрешения.
5. Новый substantial coding направляется в project-bound worktree; текущий dirty primary checkout не изменяется.
6. Runtime content, DB, uploads, live sessions и historical result comparability защищены.
7. Каждый материальный шаг фиксируется в `<OBSIDIAN_WORKLOG>`, а канонический статус — в `claude-kb/wiki/proekt-simcenter.md`.
8. В документах нет секретов, выдуманного production status или ложных green-CI claims.

Не менять production-код, не создавать PR и не начинать roadmap implementation в bootstrap-проверке. При расхождении обновить только project/Hermes docs и Obsidian worklog, затем вернуть перечень изменений и оставшихся human checkpoints.

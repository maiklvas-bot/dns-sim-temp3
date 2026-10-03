# DNS SimCenter — Hermes autonomous workflow

## Binding

```text
Project: hermes-dns-sim
Board: hermes-dns-sim
Primary: <REPO_ROOT>
GitHub: maiklvas-bot/dns-sim-temp3
Skill: project-development
Obsidian log: <OBSIDIAN_WORKLOG>
```

Verify:

```bash
hermes project show hermes-dns-sim
hermes kanban boards list
hermes kanban --board hermes-dns-sim stats
```

## Operating model

The owner provides goals and decisions at genuine checkpoints. Hermes owns bounded discovery, specification, decomposition, local implementation, tests, review preparation, state logging and status reporting.

Because `AGENTS.md` requires approval, push, PR creation, merge, release and deploy are never automatic. The root task may prepare them, then stops at the corresponding authorization boundary.

## Root-task template

Do not create a roadmap task until the owner gives the next instruction. For a substantial instruction, create the root with:

```bash
hermes kanban --board hermes-dns-sim create "DNS SimCenter: <goal>" --triage --assignee default --workspace worktree --project hermes-dns-sim --max-runtime 8h --max-retries 3 --goal --goal-max-turns 40 --body "Read .hermes.md, PROJECT_BRIEF.md, project-development skill, HERMES_STATE, HERMES_ROADMAP and Obsidian WORKLOG. Verify origin/main, dirty primary worktree, open PRs, CI and board. Specify/decompose safely. Use Codex for implementation/tests and Claude Code only for architecture, difficult debugging or one independent final-HEAD review. Record every material step in Obsidian. Do not push/create PR/merge/release/deploy or perform destructive/content-activation actions without explicit owner authorization."
```

## Delivery graph

```text
root
 -> discovery/specification
 -> implementation (isolated worktree)
 -> targeted/relevant tests
 -> independent final-HEAD review
 -> authorization boundary
 -> PR/gates/merge (only when approved)
 -> post-merge verification
 -> STATE/ROADMAP/Obsidian update
 -> cleanup
```

## Monitoring

```bash
hermes kanban --board hermes-dns-sim stats
hermes kanban --board hermes-dns-sim list
hermes kanban --board hermes-dns-sim show <task-id>
hermes kanban --board hermes-dns-sim runs <task-id>
hermes kanban --board hermes-dns-sim tail <task-id>
```

## needs_input policy

Ask only for credentials, material product/methodology choice, destructive/content activation, push/PR/merge/release/deploy authorization, physical/live pilot acceptance, Telegram `thread_id`, or an unavailable external action. Unknown Git/PR/CI/diff state must be inspected.

## Completion

Before marking a task done, record exact files, tests/gates, review verdict, commit/PR/base state, authorization/merge/release state, post-merge verification, cleanup and remaining blockers. Append the same material transition to Obsidian without raw logs or secrets.

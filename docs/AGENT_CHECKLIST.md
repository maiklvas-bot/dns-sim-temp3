# Agent Execution Checklist (mandatory for each task)

This checklist is mandatory for this repository.

## 1) Task framing

- [ ] Task has an ID (or temporary label)
- [ ] Scope is explicit (what to do)
- [ ] Work area/directories are explicit
- [ ] "Must not touch" files are explicit
- [ ] Acceptance criteria are explicit
- [ ] Tests/checks to run are explicit

(Aligned with `docs/TASK_RULES.md`.)

## 2) Ownership gate

- [ ] Verify changes are inside owned scope from `docs/OWNERSHIP.md`
- [ ] If out-of-scope edits are needed, request explicit approval in-task first

## 3) Shared contract gate

- [ ] If `shared/` changes are needed: announce contract delta and sequencing

## 4) Safety gate

- [ ] Reconfirm protected files from `docs/TASK_RULES.md` are untouched unless explicitly approved

## 5) Validation gate

- [ ] Run agreed tests/checks
- [ ] Report outcomes clearly (pass/fail/warn)

## 6) Handoff gate

- [ ] Summarize what changed
- [ ] Mention any dependency for the other side (frontend/backend)

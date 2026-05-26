# Ownership Rules (2-person collaboration)

## Roles

- **User A / Agent A (this agent)**
  - Owns: `client/`
  - May read: all repository files
  - Must not modify outside owned scope without explicit task-level approval

- **User B / Agent B**
  - Owns: `server/`, `shared/`, `script/`, `scripts/`, `docker/`, `docs/`
  - May read: all repository files
  - Must not modify outside owned scope without explicit task-level approval

## Shared Contract Rule (`shared/`)

Any change in `shared/` is treated as a synchronization point:

1. Announce proposed contract change briefly (fields/types/endpoints affected).
2. Backend side is updated to match the contract.
3. Frontend side integrates after backend contract update is confirmed.

## Protected/forbidden files reminder

Before starting a task, both agents must confirm they do not touch protected files unless explicitly approved in the task, including items listed in `docs/TASK_RULES.md`.

Reference: `docs/TASK_RULES.md`.

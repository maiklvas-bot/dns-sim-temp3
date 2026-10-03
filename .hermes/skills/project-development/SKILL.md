---
name: project-development
description: Use when developing DNS SimCenter. Enforce safe delivery.
version: 1.1.0
metadata:
  hermes:
    tags: [dns-simcenter, engineering, kanban, tdd, review, obsidian]
    category: software-development
---

# DNS SimCenter Development

## Orient first

Read `.hermes.md`, `PROJECT_BRIEF.md`, `docs/project/HERMES_STATE.md`, `docs/project/HERMES_ROADMAP.md`, `AGENTS.md`, and the relevant architecture/methodology documents. Fetch remotes and inspect the current worktree, upstream, open PRs, CI and board before editing.

The main checkout is currently dirty. Never overwrite, stash, rebase or absorb unknown local changes without attribution. Use a project-bound worktree for new substantial work.

## Architecture map

- React UI: `client/src/features/{admin,assessor,simulation,zrd}`; pages are route adapters.
- Simulation runtime: `client/src/features/simulation-engine`.
- API/security/storage/live sessions: `server/`.
- Shared schemas/scoring/domain logic: `shared/`.
- Schema evolution: ordered SQL in `migrations/`.
- Kosmonavt methodology: `docs/simulation-*`, `docs/kosmonavtika-*`, `docs/debrief-*`.
- ZRD rules: `docs/zrd-wiki/`; engine `shared/zrd/`; UI `client/src/features/zrd/`.

## Source-of-truth rules

- Existing runtime content and database remain authoritative.
- Never import/replace content from an archive without a specific approved task.
- Mechanics changes update code, tests, relevant methodology docs and ZRD changelog together.
- Scoring/profile/case-set changes must state impact on historical comparability.
- Persisted data/uploads survive updates; destructive seeds/restores require backup and approval.

## Task routing

Use board `hermes-dns-sim`, project `hermes-dns-sim`, and `workspace=worktree` for substantial engineering. GPT-6 Luna / medium orchestrates; deterministic tools handle mechanical checks. Codex is the only writer: GPT-6 Sol / medium for ordinary implementation/tests/focused refactors and GPT-6 Sol / high for complex multi-file, security, concurrency or migration work. Claude Sonnet 5 / high handles difficult architecture or diagnosis; Claude Opus 5.5 / high performs one independent final-HEAD read-only review, with exact first-party `modelUsage` required. GPT-6 Astra / high is a bounded read-only concept evaluator and researcher. Material architecture (changed trust/data/security boundary, lifecycle/acceptance/recovery, shared API/schema/cross-project interface or hard-to-reverse decision) requires stable decision ID/version and Astra conceptual review before implementation, without repository writes or test/CI execution and with an explicit `astra_reason`; only `ACCEPT` opens implementation. Reuse of an accepted pattern with unchanged assumptions requires no new gate. If Astra authored the concept, use a non-author human or a separate Claude Opus 5.5 concept-review execution. No unapproved provider fallback and no concurrent writers in one worktree.

## TDD and gates

For a bug: reproduce, prove RED, make the minimal fix, prove GREEN, then run relevant suites.

Common gates:

```bash
npm run check
npm test
npm run test:ui
npm run test:ops
npm run build
npm run test:browser
node script/check-docker-safety.mjs
docker compose build app
```

CI uses Node 20 on Ubuntu. If Windows Node 24 cannot load `better-sqlite3`, classify it as an environment blocker and verify with Node 20/CI rather than changing assertions.

## Review and delivery

Review final HEAD. A PASS must be real; a provider outage is not PASS. Push/PR/merge/release/deploy require explicit owner approval under `AGENTS.md`. After authorized merge, fetch `origin/main`, verify the merged SHA and run targeted post-merge checks before cleanup.

## Obsidian continuity

After each material step append to:

`<OBSIDIAN_WORKLOG>`

Record timestamp/date, step, evidence, result, next action and links. Update `claude-kb/wiki/proekt-simcenter.md` for canonical status changes and the Kosmonavt/ZRD notes for domain changes. Never copy secrets, raw personal data or full logs.

## Human checkpoints

Stop for credentials/secrets, destructive data action, production/release, push/PR/merge authorization, physical/live pilot acceptance, or material product/methodology choices. Routine read-only uncertainty is not a checkpoint.

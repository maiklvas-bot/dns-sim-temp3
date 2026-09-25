# DNS SimCenter — Hermes state snapshot

Snapshot date: **2026-09-25**

## Repository

- Primary: `D:\MyProject\Simulacia Claude`
- Remote: `https://github.com/maiklvas-bot/dns-sim-temp3.git`
- Default branch: `main`
- `origin/main`: `855bb8bba0e8d9d1ddb15d467c098c667e26aad0`
- Current branch: `feature/methodology-v2`
- Current HEAD: `aa82156380acafa8367b821c3f9ae22f6759ba8b`
- Branch divergence from `origin/main`: main has 2 unique commits; current branch has 4 unique commits.
- Open PRs: #70 `chore/unified-hermes-context` → `main` (only `.hermes.md`), commit `6bde4c31d991908a6dd3bde2672e26a41c2972cb`; `build-test` failed.
- Hermes Project / board: `hermes-dns-sim` / `hermes-dns-sim`.
- Project primary and board binding verified after gateway restart; the board is intentionally empty pending the owner's next instruction.
- Repo-local skills are trusted for this project; `.hermes/skills/project-development/SKILL.md` is present.

## Worktree safety

The primary checkout is not clean: 46 tracked status entries contain uncommitted UI/theme changes and 13 untracked status entries exist. Their ownership and delivery status are not yet proven. New substantial work must use a separate project-bound worktree until these changes are classified.

## Current architecture

- Full-stack TypeScript: React/Vite frontend, Express backend, SQLite/better-sqlite3 and Drizzle contracts.
- Browser calls `/api/*`; backend storage modules own persisted content, sessions and results.
- Live sessions use backend live-session services plus frontend sync/polling.
- Docker deployment persists SQLite and uploads through host mounts.
- Kosmonavt and ZRD share the platform but have separate domain mechanics and methodological sources.

## Recently completed on current feature branch

Commits dated 2026-09-03:

- removed double penalty from competency scoring;
- corrected queue direction for pickup time;
- added validation against assigning one flat score to all competencies in an option.

These commits are not merged into `main`. The 2026-09-16 commit changes agent routing/CI policy only.

## Verification snapshot

Local on 2026-09-21:

- `npm run check` — PASS;
- `npm run test:ui` — PASS;
- `npm run test:ops` — PASS;
- `npm run build` — PASS;
- `npm test` — NOT VERIFIED: local Node 24 cannot load/rebuild `better-sqlite3`; project CI targets Node 20.

Latest GitHub Actions on `main` (`855bb8b`, 2026-09-02) is **failed**. Lint, smoke, build and browser acceptance passed; `Verify Docker data safety` failed because tracked `uploads/M5Ejl7bRyKVNUUWoADWpU.png` was excluded from the Docker build context. CI is not green.

## Active product state

- Kosmonavt: methodological rebuild and technical stabilization; corrected 17-case set has not been activated by migration; historical results are not version-marked; debrief is partial.
- ZRD: multiplayer board/UI and server flows exist; expert validation, assessor completion and live pilot remain.
- Meeting transcripts and summaries for 2026-09-10 and 2026-09-18 are processed and linked from Obsidian. The current business blocker is the missing approved product passport and competency profile; on 2026-09-18 the team stated that the profile would not be ready by 2026-09-30, so no implementation-ready specification exists.
- API-based assessment is a research direction, not an approved implementation. Budget, provider capability, information-security requirements, pseudonymization architecture, appeal/debrief rules and assessment mechanics remain unresolved.

## Current blockers

1. Attribute and isolate the dirty worktree package.
2. Decide whether/how to activate corrected cases and label legacy results.
3. Bring methodology fixes to an authorized PR; reconcile with the two newer `main` commits.
4. Fix Docker data-safety CI failure.
5. Complete a Node 20 smoke run and restore fully green CI.
6. Finish debrief/report consistency and conduct live pilot validation.
7. Before new product implementation, approve the product passport, competency profile and the separation between immutable assessment results and recorded human selection overrides.
8. Validate API budget/provider and data architecture with Finance and Information Security; do not send personal data to an external model during research.

## Production / release state

Production/staging deployment state has not been verified in this bootstrap. Do not infer production state from Git. Deployment requires explicit authorization, staging check, backup and healthcheck.

## Update rule

Update after a material branch/PR/CI/product decision, merge, release or blocker change. Mirror the concise canonical status to Obsidian; never store secrets.

## Control-channel checkpoint

Telegram topic **DNS SimCenter** is available for project control and notification delivery. On 2026-09-21 Telegram acknowledged test message `956`; the topic-workspace registry was corrected to resolve the topic to the canonical repository. Keep notifications opt-in, concise and limited to meaningful lifecycle transitions.

## Hermes runtime checkpoint

- Hermes source is current at `3917c7dd6a`; the default gateway was restarted after update.
- A stale delegation registry incident was cleared; verification reports zero live subagents.
- Delegation safeguards: max 2 concurrent children, 60 iterations per child and a 900-second child timeout.
- After any delegation timeout/cancellation, closure requires an explicit active-child reconciliation (`list`, exact stop, final empty `list`).

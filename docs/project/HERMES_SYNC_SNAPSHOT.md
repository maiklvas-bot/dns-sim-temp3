# DNS SimCenter — Hermes ↔ GitHub ↔ Obsidian snapshot

Snapshot date: **2026-09-25**

## Purpose

This is a selective, provenance-preserving snapshot of the durable Hermes project context. It is not a dump of the whole Hermes profile, vault, runtime store, logs, transcripts or dirty product worktree.

## Canonical stores

- Repository workspace: `D:\\MyProject\\Simulacia Claude`
- GitHub remote: `https://github.com/maiklvas-bot/dns-sim-temp3.git`
- Obsidian vault: `D:\\MyProject\\Obsidian\\Pedro78`
- Obsidian project log: `01-projects/simcenter/WORKLOG.md`
- Obsidian project MOC: `claude-kb/wiki/proekt-simcenter.md`
- Hermes Project / board: `hermes-dns-sim` / `hermes-dns-sim`

## Verified Git state

- Current local branch: `feature/methodology-v2`
- Current local HEAD: `aa82156380acafa8367b821c3f9ae22f6759ba8b`
- `origin/feature/methodology-v2`: same commit; no ahead/behind delta.
- `origin/main`: `855bb8bba0e8d9d1ddb15d467c098c667e26aad0`
- Divergence from `origin/main`: current branch is **4 commits ahead and 2 commits behind**.
- Current worktree: **46 tracked status entries and 13 untracked status entries**. The tracked UI/theme package and unrelated local material were not included in the synchronization commit.
- Remote URL was read from Git, not inferred from project notes.

## Verified GitHub state

- Repository is public: `maiklvas-bot/dns-sim-temp3`.
- Default branch: `main`.
- Open PR #70: `chore/unified-hermes-context` → `main`, commit `6bde4c31d991908a6dd3bde2672e26a41c2972cb`; it contains only `.hermes.md` and its CI `build-test` is failed.
- Latest recorded CI on `main` is failed for commit `855bb8b`; the existing project state attributes the failure to Docker data-safety handling of tracked `uploads/M5Ejl7bRyKVNUUWoADWpU.png`.
- No merge, release or deployment was performed.

## Safe synchronization boundary

Published/synchronized as durable project context:

- `.hermes.md`
- `.hermes/skills/project-development/SKILL.md`
- `PROJECT_BRIEF.md`
- `README_START_HERE.md`
- `docs/project/HERMES_AUTOMATION.md`
- `docs/project/HERMES_ROADMAP.md`
- `docs/project/HERMES_STATE.md`
- `docs/project/HERMES_TELEGRAM_CONTROL.md`
- `docs/project/HERMES_SYNC_SNAPSHOT.md`
- `prompts/BOOTSTRAP_PROJECT.md`
- `prompts/CONTINUE_PROJECT.md`
- `templates/TELEGRAM_CHANNEL_OVERRIDE.yaml`
- `manifest.json`
- `skills-lock.json`

Explicitly excluded:

- modified UI/theme and product files in the primary worktree;
- `.env*`, credentials, tokens, auth registries, state databases and session data;
- raw personal/business exports, full logs and transcripts;
- generic mirrored agent skill trees under `.agents/` and `.claude/skills/`;
- `docs/otvety-na-voprosy-kollegi.md`, because it is not part of the verified Hermes project context package.

## Obsidian counterpart

- Consolidated note: `01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-09-25.md`
- Worklog entry: `01-projects/simcenter/WORKLOG.md`
- Project MOC link: `claude-kb/wiki/proekt-simcenter.md`

## Verification status

- Local source and vault notes were read back after writing.
- GitHub remote refs and PR state were read through `git ls-remote` and `gh`.
- `git diff --check` is required after staging the safe set.
- This snapshot distinguishes local, committed and pushed state; it does not claim that unrelated dirty product files are synchronized.

## Remaining blockers

1. Preserve and classify the dirty primary worktree before any product integration.
2. Decide whether/how to activate corrected Kosmonavt cases and label legacy results.
3. Reconcile methodology fixes with current `main` through an authorized PR.
4. Restore green Docker data-safety CI and verify Node 20 smoke.
5. Obtain approved product passport and competency profile before new assessment/API implementation.

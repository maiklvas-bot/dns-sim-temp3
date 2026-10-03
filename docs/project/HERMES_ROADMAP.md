# DNS SimCenter — autonomous roadmap

Status baseline: 2026-09-21. Select work only after verifying current Git, Kanban, CI and Obsidian state.

## P0 — integrity and recoverable delivery

### P0.0 Close the business-design gate for the digital entrance assessment

**Goal:** turn the 2026-09-10 and 2026-09-18 discussion into an approved product passport and an implementation-ready specification.

**Acceptance:**
- the target role and purpose of entrance assessment are approved with Tatyana and the initiative group;
- the limited competency profile, behavioural indicators and critical criteria are approved;
- immutable assessment output is separated from a recorded human selection override;
- feedback, debrief, disagreement/appeal and repeat-attempt rules are explicit;
- Finance and Information Security approve the API experiment boundaries, provider requirements and pseudonymized data flow;
- methodology owner and technical owner are named;
- only then is the API/product implementation decomposed into development tasks.

**Until accepted:** research may use synthetic/non-personal data; product implementation must not assume an API provider, send employee data externally or hard-code an unfinished competency profile. Technical stabilization items P0.1–P0.3 may proceed independently.

### P0.1 Classify and preserve the dirty primary worktree

**Goal:** determine origin, intent and completeness of the 45 modified files and untracked material without losing work.

**Acceptance:**
- changes grouped by concern and attributed where evidence permits;
- no overwrite/stash/rebase/destructive cleanup without owner approval;
- a safe integration path is documented;
- new unrelated work uses a separate worktree.

### P0.2 Restore green CI on `main`

**Goal:** fix the Docker data-safety failure for tracked uploads without weakening persistence guarantees.

**Acceptance:**
- reproduce contract failure;
- root cause fixed, not ignored;
- targeted safety contract and relevant suites pass;
- exact current commit has green GitHub Actions before any green-CI claim.

### P0.3 Integrate methodology correctness fixes

**Goal:** reconcile `feature/methodology-v2` with current `origin/main` and deliver the scoring, queue and validation fixes.

**Acceptance:**
- preserve the three focused fixes and their tests;
- reconcile the two unique `main` commits;
- independent final-HEAD review;
- push/PR/merge only after explicit owner authorization;
- post-merge verification and Obsidian update.

### P0.4 Decide and safely activate corrected Kosmonavt content

**Human checkpoint:** owner decides activation timing and policy for legacy results.

**Acceptance after approval:**
- corrected cases activated by migration, not ad hoc mutation;
- empty/legacy cases handled without deletion;
- prior results explicitly versioned/marked as non-comparable;
- backup and rollback path documented and tested.

## P1 — methodological completeness

### P1.1 Complete debrief end to end

- persist selected option and participant reasoning;
- participant and assessor debrief flows;
- critical-competency logic consistent with results screen and PDF;
- action plan and completion evidence;
- no contradiction between report, threshold and methodology.

### P1.2 Show evidence reliability

- case coverage per competency;
- thin evidence clearly labelled as a discussion signal, not an automatic refusal;
- resolve the mapping of `decision_making` and uncovered profile competencies with a methodologist checkpoint.

### P1.3 Live pilot and calibration

- approved pilot protocol;
- 3–5 live runs minimum for usability signal, then broader calibration as agreed;
- capture defects and methodology findings separately;
- no publication of personal results beyond authorized scope.

## P1 — ZRD completion

### P1.4 Assessor workflow and expert validation

- verify current multiplayer implementation against `docs/zrd-wiki/`;
- complete assessor monitoring/results gaps;
- expert review of the 12-competency profile and scoring;
- live pilot is the validity gate.

## P2 — maintainability and operations

- run all parity contracts from one command and CI;
- keep Node/runtime requirements explicit and reproducible;
- align upload policy across `.gitignore`, `.dockerignore`, deploy docs and safety tests;
- keep project docs and Obsidian canonical notes synchronized without duplicating secrets or raw logs;
- remove obsolete scratch worktrees only after delivery evidence is propagated.

## Selection rules

When the owner says “продолжай проект”:

1. finish active delivery/review before unrelated work;
2. choose the highest unblocked priority;
3. create a focused Kanban root and children for implementation/tests/review/delivery as needed;
4. use project-bound worktrees and one writer per worktree;
5. do not cross a human checkpoint silently;
6. update `HERMES_STATE.md`, this roadmap and Obsidian after material changes;
7. stop only for genuine `needs_input` or unavailable required provider.

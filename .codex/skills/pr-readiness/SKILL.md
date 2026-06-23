---
name: pr-readiness
description: Use before opening or marking a pull request as ready for review.
---

# PR Readiness Skill

## Purpose

Use this skill before opening a PR or reporting that a PR is ready.

A PR is a verified change package, not a place to dump unfinished work.

## Readiness Checklist

A PR is ready only if:

- the task goal is clear;
- the diff is scoped to the task;
- unrelated changes are absent or clearly explained;
- existing functionality is preserved;
- default checks were run or blockers were explained;
- UI changes were browser-checked when applicable;
- risks are stated honestly;
- the PR description explains changed, preserved, verified, and risky items.

## Required PR Description

Use this structure:

```md
## Goal

## What changed

## What was preserved

## Verification

## Risks / not verified

## PR readiness
```

## Do Not Open PR If

Do not open a PR if:
- the user has not explicitly approved PR creation in the current conversation;
- build or tests fail;
- the diff includes unrelated changes;
- the change removes existing functionality without approval;
- the task is too broad and should be split;
- the report says "done" but no checks were run.

## Small PR Rule

Prefer one task per PR.
If a task touches multiple independent areas, split it or explain why it must remain together.

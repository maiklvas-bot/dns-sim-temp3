---
name: regression-check
description: Use before reporting completion, especially after UI, routing, state, data, or workflow changes.
---

# Regression Check Skill

## Purpose

Use this skill to prevent accidental damage to existing behavior.

The task is not complete just because the requested change is visible. It is complete only when the old flow still works.

## Scope Check

Before verification, list:
- files changed;
- user flows affected;
- routes affected;
- data contracts affected;
- UI states affected.

## Default Commands

Run the relevant project checks:

```bash
npm run check
npm run build
npm run test
```

If a command does not exist or cannot be run, report the exact reason.

## Browser Check For UI Changes

Verify:
- screen opens;
- no console errors;
- no horizontal scroll;
- no obvious layout overlap;
- all original buttons are present;
- active states work;
- empty/loading/error states are not broken;
- the main flow can still be completed.

## Regression Questions

Answer before final report:

1. What could this change accidentally break?
2. Which old behavior did I verify?
3. Which old behavior could not be verified?
4. Are there any unrelated diffs?
5. Is the change small enough for the task?

## Final Wording

Do not write "verified" unless a concrete check was run.

Use:
- `Verified: npm run build passed`
- `Not verified: browser check unavailable in this environment`
- `Risk: flow X was not manually tested`

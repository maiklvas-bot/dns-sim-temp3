# Code Review Rules

Review the change against the user's request, not against personal preference.

## Review Goal

A review must answer one question:

> Does this change solve the requested task with the smallest safe change while preserving existing functionality?

## Reject The Change If

Reject or request changes if:
- unrelated files were modified;
- existing functionality was removed without explicit approval;
- the solution is more complex than necessary;
- tests, build, or checks were not run;
- UI changed without browser verification;
- routes, states, buttons, or flows disappeared accidentally;
- the final report claims completion without proof;
- the change introduces generic visual redesign that does not fit the project.

## Check Specifically

For code changes, check:
- data contracts;
- state transitions;
- route behavior;
- error handling;
- empty states;
- test coverage;
- build output.

For UI changes, check:
- all previous controls are still present;
- buttons and inputs remain usable;
- active, disabled, loading, empty, and error states still work;
- there is no horizontal scroll;
- the screen is readable on FullHD;
- browser console has no new errors;
- visual hierarchy is clearer, not just prettier.

## Review Output

The review result must include:

1. Pass/fail
2. Concrete reasons
3. Required fixes
4. Verification status
5. Whether PR is safe to create or merge

Do not approve a change just because it looks better.
Approve only when behavior, verification, and scope are acceptable.

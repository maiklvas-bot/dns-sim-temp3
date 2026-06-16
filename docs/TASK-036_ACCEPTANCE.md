# TASK-036: UI/UX acceptance without interface redesign

## Scope

This task validates the agreed interface without changing its visual language, content or workflows.

Validated contracts:

- administrator, assessor and participant simulation use the shared DNS product shell;
- all three working interfaces expose the shared light/dark theme toggle;
- administrator case editor retains responsive workspace, cycles, options and media grids;
- dense administrator lists and side panels remain scrollable;
- participant simulation preserves horizontal access to compact navigation and vertical access to content/right panels;
- no fixed 1400px minimum viewport is introduced;
- late light-theme overrides remain after the dark admin review layer.

## Automated acceptance

```text
npm run test:ui
npm run check
npm run test
npm run build
git diff --check
```

Automated UI contracts passed locally. The local application health endpoint also returned `status: ok`.

The embedded visual browser could not be started in the current Windows sandbox, therefore screenshots and the manual viewport matrix remain an explicit staging acceptance step rather than an assumed pass.

## Manual staging matrix

Check both themes at:

- 1920x1080 desktop;
- 1440x900 laptop;
- 1024x768 compact desktop/tablet;
- 390x844 mobile.

Screens:

- administrator: cases, cycles/media, channels, schedule, results, comparison, settings, Wiki and audit history;
- assessor: setup wizard, active sessions and report preview;
- participant: join, all channels, action panel, store map, timers and completion;
- results: summary, competency profile, tables and PDF/XLSX actions.

Acceptance rule: only usability defects may be fixed. No redesign or content/scoring changes are allowed under TASK-036.

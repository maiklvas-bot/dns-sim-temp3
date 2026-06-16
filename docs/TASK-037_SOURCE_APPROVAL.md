# TASK-037: content, cases and competencies source approval

## Status

Waiting for separate source-data approval. No simulation content, cases, competencies, weights, scoring or media were changed.

## Current runtime source chain

1. `script/bootstrap-content.json` is the first-run content source used to seed a new database.
2. The production SQLite database is the runtime source of truth after initialization.
3. `server/content-storage.ts` reads and writes administrator content.
4. `shared/simulation-content.ts` defines the shared content contract.
5. `client/src/data/*` contains client-side fallback/supporting content and must not silently override approved runtime content.

Current bootstrap inventory:

- 14 competencies;
- 14 main cases;
- 8 email signals;
- 8 messenger signals;
- 8 messenger chats;
- 4 video signals;
- 9 registered media assets;
- one runtime settings object.

## Required decision before implementation

Approve exactly one primary source for TASK-037:

- the current production SQLite database;
- a reviewed Excel/JSON content package;
- a named Git revision of `script/bootstrap-content.json`;
- another explicitly provided source.

The approval must also state:

- whether existing production content is replaced or merged;
- identifiers that must remain stable;
- approved competency list and category names;
- approved case/cycle/answer structure;
- approved scoring weights and store-metric effects;
- media ownership and replacement rules.

## Import acceptance criteria

- source is versioned and archived before import;
- import runs first against a copied/staging database;
- validation reports missing links, duplicate IDs and invalid weights;
- before/after counts and changed IDs are documented;
- simulation smoke test and result comparison pass;
- production import requires a fresh backup and explicit approval.

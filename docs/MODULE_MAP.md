# Module Map

`client/` — React frontend.

- `client/src/pages/` — thin route compatibility entrypoints.
- `client/src/features/admin/` — admin workspace, schedule utilities, permissions, drafts and admin UI components.
- `client/src/features/assessor/` — assessor workspace, setup types, constants and participant setup factories.
- `client/src/features/simulation/` — participant simulation workspace and layout components.
- `client/src/features/simulation-engine/` — simulation provider plus independent scheduling, timer and action modules.
- `client/src/components/` — reusable product and UI components shared across features.
- `client/src/styles/` — ordered base, admin, assessor, simulation and responsive style modules.
- `client/src/context/SimulationContext.tsx` — compatibility export for the simulation engine provider.

`server/` — Express backend: routes, storage, live-session persistence, PDF generation, middleware.

`shared/` — shared TypeScript schemas and simulation contracts used by client and server.

`script/` — TypeScript utility scripts for build, migration, content bootstrap and maintenance.

`scripts/` — operational shell scripts for deployment, backups and health checks.

`migrations/` — database migration files.

`attached_assets/` — bundled media/assets required by the app.

`uploads/` — runtime uploaded media. This directory is not committed.

`storage/` — runtime persistent SQLite storage for Docker deployments. This directory is not committed.

`docker/` — container entrypoint and supporting Docker files.

`docs/` — project process, architecture, testing, backup and deploy documentation.

`.github/workflows/` — GitHub Actions CI configuration.

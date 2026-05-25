# Module Map

`client/` — React frontend: pages, UI components, simulation interface, admin and assessor flows.

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

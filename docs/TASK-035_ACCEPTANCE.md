# TASK-035: Docker, backup and restore acceptance

## Scope

- verified Docker data-isolation contract and first-run bootstrap behavior;
- added consistent SQLite snapshot creation for running production;
- added checksums and final archive verification;
- added retention for the latest two archives and expanded directories;
- added guarded restore with pre-restore backup, rollback directory and healthcheck;
- added operational safety checks to CI.

## Production data protection

- `.env`, `.env.prod`, `storage/`, `uploads/` and backups remain outside Git;
- Docker image generation never copies the production database;
- restore requires `CONFIRM_RESTORE=YES`;
- current runtime data is moved to `.restore-rollback-*`, not deleted;
- environment files are restored only with `RESTORE_ENV=YES`.

## Checks

```text
npm run test:ops
node script/check-docker-safety.mjs
npm run check
npm run test
npm run build
git diff --check
```

Docker CLI is not installed in the local Windows environment, so the real container build and destructive restore rehearsal must run on staging.

## Staging rehearsal

```bash
cd /opt/site-staging
chmod +x scripts/*.sh
docker compose -f docker-compose.yml -f docker-compose.staging.yml build app
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
APP_PORT=5002 ./scripts/healthcheck.sh

COMPOSE_OVERRIDE=docker-compose.staging.yml BACKUP_ROOT=/backups/site-staging SITE_ROOT=/opt/site-staging \
  ./scripts/backup.sh

COMPOSE_OVERRIDE=docker-compose.staging.yml VERIFY_ONLY=YES CONFIRM_RESTORE=YES SITE_ROOT=/opt/site-staging \
  ./scripts/restore.sh /backups/site-staging/site-backup-YYYY-MM-DD-HHMMSS.tar.gz

COMPOSE_OVERRIDE=docker-compose.staging.yml RESTORE_ENV=NO APP_PORT=5002 SITE_ROOT=/opt/site-staging CONFIRM_RESTORE=YES \
  ./scripts/restore.sh /backups/site-staging/site-backup-YYYY-MM-DD-HHMMSS.tar.gz
```

Acceptance is complete after the staging restore returns a healthy application and the live-session/data smoke checks pass.

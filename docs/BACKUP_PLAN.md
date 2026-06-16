# Backup Plan

Back up daily:

- SQLite database;
- `uploads`;
- Docker volumes;
- `.env.prod`;
- `docker-compose.prod.yml`;
- current Git commit.

Default backup folder:

```text
/backups/site
```

Cron:

```cron
15 3 * * * /opt/site-prod/scripts/backup.sh >> /var/log/site_backup.log 2>&1
```

Manual backup before every production release:

```bash
cd /opt/site-prod
chmod +x scripts/*.sh
./scripts/backup.sh
```

Storage rule:

If the backup exists only on the same server, it is a weak backup.

Recommended layout:

- local copy: `/backups/site`;
- remote copy: external server, S3, Yandex Disk or another cloud storage.

Restore procedure:

The backup script:

- creates a consistent SQLite snapshot through the running application container when possible;
- preserves the SQLite WAL companions when the container is unavailable;
- records checksums and verifies every file;
- verifies the final `tar.gz` archive;
- keeps the latest two archives and expanded backup directories by default.

Change retention when needed:

```bash
BACKUP_RETENTION_COUNT=7 ./scripts/backup.sh
```

For staging, explicitly select the staging override:

```bash
COMPOSE_OVERRIDE=docker-compose.staging.yml BACKUP_ROOT=/backups/site-staging ./scripts/backup.sh
```

Guarded restore:

```bash
cd /opt/site-prod
CONFIRM_RESTORE=YES ./scripts/restore.sh /backups/site/site-backup-YYYY-MM-DD-HHMMSS.tar.gz
```

The restore script verifies checksums, creates a new pre-restore backup, stops Docker, preserves current runtime data in `.restore-rollback-*`, restores SQLite and uploads, starts Docker and runs healthcheck.

Restore environment files only when explicitly required:

```bash
RESTORE_ENV=YES CONFIRM_RESTORE=YES ./scripts/restore.sh /backups/site/site-backup-YYYY-MM-DD-HHMMSS.tar.gz
```

Staging restore must use its own override:

```bash
COMPOSE_OVERRIDE=docker-compose.staging.yml APP_PORT=5002 CONFIRM_RESTORE=YES \
  ./scripts/restore.sh /backups/site-staging/site-backup-YYYY-MM-DD-HHMMSS.tar.gz
```

Validate an archive without stopping containers or changing runtime data:

```bash
VERIFY_ONLY=YES CONFIRM_RESTORE=YES \
  ./scripts/restore.sh /backups/site/site-backup-YYYY-MM-DD-HHMMSS.tar.gz
```

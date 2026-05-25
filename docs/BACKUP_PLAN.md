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

1. Stop the production container.
2. Copy database and uploads from the selected backup.
3. Restore `.env.prod` if needed.
4. Start Docker.
5. Run `./scripts/healthcheck.sh`.

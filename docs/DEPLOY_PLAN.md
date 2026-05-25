# Deploy Plan

Server folders:

```text
/opt/site-staging
/opt/site-prod
```

Each folder must have local env files that are not committed:

```bash
cp .env.example .env
cp .env.example .env.staging   # only in /opt/site-staging
cp .env.example .env.prod      # only in /opt/site-prod
chmod +x scripts/*.sh
```

Branches:

- staging uses `dev`;
- production uses `main`.

Staging update:

```bash
cd /opt/site-staging
git checkout dev
git pull origin dev
docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
./scripts/healthcheck.sh
```

Production release:

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

On server:

```bash
cd /opt/site-prod
./scripts/backup.sh
git checkout main
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
./scripts/healthcheck.sh
```

Do not deploy production before staging is checked.

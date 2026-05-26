# Test Plan

Minimum local checks:

```bash
npm ci
npm run lint
npm run test
npm run build
docker compose build app
```

If Docker is not installed in the current local environment, write it in the PR as a skipped environment check:

```text
docker compose build app - not run: docker command not found
```

The curator or CI must still run the Docker build before merge/release.

Smoke API checks after Docker start:

```bash
curl -fsS http://127.0.0.1:5001/api/health
```

Manual smoke checks:

- staff login works;
- admin opens and can view cases, channels, settings and results;
- assessor can create a simulation;
- participant can join and complete a simulation;
- live session survives container restart when not completed;
- channel events appear according to selected settings;
- result page shows scores and competency profile;
- PDF export opens and contains Cyrillic text correctly;
- PDF competency radar shows expected line and actual line.

Before production release:

```bash
cd /opt/site-prod
./scripts/backup.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
./scripts/healthcheck.sh
```

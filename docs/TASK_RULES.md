# Task Rules

Every task must have:

- task number;
- what to do;
- where to work;
- files that must not be touched;
- acceptance criteria;
- tests to run.

Branch format:

```text
feature/task-001-main-page
```

Commit format:

```text
TASK-001: update main page layout
```

Executor flow:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/task-001-name
```

After work:

```bash
git add .
git commit -m "TASK-001: short description"
git push origin feature/task-001-name
```

Then create Pull Request:

```text
feature/task-001-name -> dev
```

Files forbidden without explicit approval:

- `.env`
- `.env.prod`
- `.env.staging`
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `package.json`
- `package-lock.json`
- `database/migrations`
- `migrations`
- `scripts/backup.sh`
- `scripts/deploy-prod.sh`
- `nginx/*`
- simulation content, scoring, cases and media unless the task explicitly says to change them.

Curator checks:

- what changed;
- whether forbidden files were touched;
- whether build and tests pass;
- whether Docker starts;
- whether the main site scenario still works;
- whether production data is protected.

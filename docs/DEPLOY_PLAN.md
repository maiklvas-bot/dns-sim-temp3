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

---

## Данные при обновлении

Обновление приложения не трогает содержимое базы:

- база и загруженные файлы лежат на хосте (`./storage/data`, `./uploads`) и переживают пересборку образа;
- миграции применяются автоматически при старте, каждая однократно — они доливают структуру, данные остаются;
- деплой-скрипты сидов не запускают.

**`npm run db:seed-simulation` — только для первого разворачивания на пустой базе.** Команда чистит таблицы контента и заливает их заново из `script/bootstrap-content.json`. На непустой базе она останавливается сама и требует явного `-- --force`. Перед `--force` делайте `./scripts/backup.sh`.

## Загруженные файлы

`uploads/` версионируется: это контент — картинки кейсов и скриншоты материалов справочника. Без них кейсы на новом стенде остаются без медиа.

Синхронизация только на добавление, ничего не удаляется:

```bash
npm run uploads:check   # показать расхождения, ничего не менять
npm run uploads:sync    # добавить новое со стенда, вернуть пропавшее
```

Что делает `uploads:sync`:

| Ситуация | Действие |
|---|---|
| файл есть на стенде, нет в репозитории | добавляет в индекс |
| файл есть в репозитории, пропал с диска | возвращает на диск |
| файл удалён и оттуда, и оттуда (например, влетело с чужим PR) | достаёт из истории и возвращает |

После `uploads:sync` на стенде — закоммитить и запушить новые файлы.

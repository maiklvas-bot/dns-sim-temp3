#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
DB_PATH="${DB_PATH:-}"
TS="$(date +%F_%H-%M-%S)"

mkdir -p "$BACKUP_DIR"

if [[ -z "$DB_PATH" ]]; then
  if [[ -f "$APP_DIR/storage/data/data.db" ]]; then
    DB_PATH="$APP_DIR/storage/data/data.db"
  else
    DB_PATH="$APP_DIR/data.db"
  fi
fi

archive_items=(
  client
  server
  shared
  script
  migrations
  attached_assets
  docker
  Dockerfile
  docker-compose.yml
  package.json
  package-lock.json
  vite.config.ts
  tsconfig.json
  drizzle.config.ts
  tailwind.config.ts
  postcss.config.js
  components.json
  ecosystem.config.cjs
  install.sh
  update.sh
  restart.sh
  README.md
  README_DEPLOY.md
  .env.example
)

existing_items=()
for item in "${archive_items[@]}"; do
  if [[ -e "$APP_DIR/$item" ]]; then
    existing_items+=("$item")
  fi
done

if [[ ${#existing_items[@]} -gt 0 ]]; then
  tar -czf "$BACKUP_DIR/app_${TS}.tar.gz" -C "$APP_DIR" "${existing_items[@]}"
fi

if [[ -f "$DB_PATH" ]]; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/data_${TS}.sqlite'"
  gzip -f "$BACKUP_DIR/data_${TS}.sqlite"
fi

echo "Backup created in $BACKUP_DIR"

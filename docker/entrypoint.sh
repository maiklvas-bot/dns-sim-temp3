#!/usr/bin/env sh
set -eu

SQLITE_PATH="${SQLITE_PATH:-/app/data/data.db}"
SQLITE_DIR="$(dirname "$SQLITE_PATH")"
BUNDLED_DB="/app/bootstrap/data.db"

mkdir -p "$SQLITE_DIR" /app/uploads

if [ ! -f "$SQLITE_PATH" ] && [ -f "$BUNDLED_DB" ]; then
  cp "$BUNDLED_DB" "$SQLITE_PATH"
  echo "Initialized SQLite database from bundled seed: $SQLITE_PATH"
fi

exec "$@"

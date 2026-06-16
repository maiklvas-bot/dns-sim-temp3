#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_ROOT="${BACKUP_ROOT:-/backups/site}"
BACKUP_RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-2}"
COMPOSE_OVERRIDE="${COMPOSE_OVERRIDE:-docker-compose.prod.yml}"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"
ARCHIVE_PATH="${BACKUP_ROOT}/site-backup-${STAMP}.tar.gz"
SQLITE_SOURCE="${SITE_ROOT}/storage/data/data.db"
SQLITE_SNAPSHOT="${SITE_ROOT}/storage/data/.backup-${STAMP}.db"
COMPOSE_ARGS=(-f docker-compose.yml -f "${COMPOSE_OVERRIDE}")

mkdir -p "${BACKUP_DIR}"

cd "${SITE_ROOT}"

echo "Creating backup in ${BACKUP_DIR}"

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git rev-parse HEAD > "${BACKUP_DIR}/commit.txt"
  git status --short > "${BACKUP_DIR}/git-status.txt"
else
  echo "not-a-git-worktree" > "${BACKUP_DIR}/commit.txt"
fi

for file in .env .env.prod docker-compose.yml docker-compose.prod.yml; do
  if [ -f "${file}" ]; then
    cp -a "${file}" "${BACKUP_DIR}/"
  fi
done

cleanup() {
  rm -f "${SQLITE_SNAPSHOT}"
}
trap cleanup EXIT

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  app_container="$(docker compose "${COMPOSE_ARGS[@]}" ps -q app 2>/dev/null || true)"
  if [ -n "${app_container}" ] && [ -f "${SQLITE_SOURCE}" ]; then
    echo "Creating consistent SQLite snapshot through the running application container"
    docker compose "${COMPOSE_ARGS[@]}" exec -T app node -e \
      "const Database=require('better-sqlite3'); const db=new Database(process.env.SQLITE_PATH || '/app/data/data.db'); db.backup('/app/data/.backup-${STAMP}.db').then(() => db.close());"
    cp -a "${SQLITE_SNAPSHOT}" "${BACKUP_DIR}/data.db"
  fi
fi

if [ ! -f "${BACKUP_DIR}/data.db" ] && [ -f "${SQLITE_SOURCE}" ]; then
  echo "Application container is unavailable; copying SQLite database with WAL companions"
  cp -a "${SQLITE_SOURCE}" "${BACKUP_DIR}/data.db"
  [ -f "${SQLITE_SOURCE}-wal" ] && cp -a "${SQLITE_SOURCE}-wal" "${BACKUP_DIR}/data.db-wal"
  [ -f "${SQLITE_SOURCE}-shm" ] && cp -a "${SQLITE_SOURCE}-shm" "${BACKUP_DIR}/data.db-shm"
fi

if [ -f data.db ]; then
  cp -a data.db "${BACKUP_DIR}/data.db.root"
fi

if [ -d storage/data ]; then
  tar --exclude='storage/data/.backup-*.db' -czf "${BACKUP_DIR}/storage-data.tar.gz" storage/data
fi

if [ -d uploads ]; then
  tar -czf "${BACKUP_DIR}/uploads.tar.gz" uploads
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose "${COMPOSE_ARGS[@]}" config --volumes > "${BACKUP_DIR}/docker-volumes.txt" || true
  mkdir -p "${BACKUP_DIR}/docker-volumes"
  while IFS= read -r volume_name; do
    [ -z "${volume_name}" ] && continue
    docker volume inspect "${volume_name}" >/dev/null 2>&1 || continue
    docker run --rm \
      -v "${volume_name}:/volume:ro" \
      -v "${BACKUP_DIR}/docker-volumes:/backup" \
      alpine sh -c "tar -czf /backup/${volume_name}.tar.gz -C /volume ." || true
  done < "${BACKUP_DIR}/docker-volumes.txt"
fi

(
  cd "${BACKUP_DIR}"
  find . -type f ! -name checksums.sha256 -print0 | sort -z | xargs -0 sha256sum > checksums.sha256
  sha256sum -c checksums.sha256
)

tar -czf "${ARCHIVE_PATH}" -C "${BACKUP_ROOT}" "${STAMP}"
tar -tzf "${ARCHIVE_PATH}" >/dev/null

if [ "${BACKUP_RETENTION_COUNT}" -gt 0 ] 2>/dev/null; then
  mapfile -t old_archives < <(find "${BACKUP_ROOT}" -maxdepth 1 -type f -name 'site-backup-*.tar.gz' -printf '%T@ %p\n' | sort -nr | tail -n "+$((BACKUP_RETENTION_COUNT + 1))" | cut -d' ' -f2-)
  if [ "${#old_archives[@]}" -gt 0 ]; then
    echo "Removing ${#old_archives[@]} old backup archive(s); keeping latest ${BACKUP_RETENTION_COUNT}"
    rm -f -- "${old_archives[@]}"
  fi

  mapfile -t old_directories < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??-??????' -printf '%T@ %p\n' | sort -nr | tail -n "+$((BACKUP_RETENTION_COUNT + 1))" | cut -d' ' -f2-)
  if [ "${#old_directories[@]}" -gt 0 ]; then
    echo "Removing ${#old_directories[@]} old expanded backup directorie(s)"
    rm -rf -- "${old_directories[@]}"
  fi
fi

echo "Backup created and verified: ${ARCHIVE_PATH}"

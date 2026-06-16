#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
APP_PORT="${APP_PORT:-5001}"
CONTAINER_UID="${CONTAINER_UID:-1000}"
CONTAINER_GID="${CONTAINER_GID:-1000}"
RESTORE_ENV="${RESTORE_ENV:-NO}"
NO_START="${NO_START:-NO}"
VERIFY_ONLY="${VERIFY_ONLY:-NO}"
SKIP_PRE_RESTORE_BACKUP="${SKIP_PRE_RESTORE_BACKUP:-NO}"
COMPOSE_OVERRIDE="${COMPOSE_OVERRIDE:-docker-compose.prod.yml}"
ARCHIVE_PATH="${1:-}"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
WORK_DIR="$(mktemp -d)"
ROLLBACK_DIR="${SITE_ROOT}/.restore-rollback-${STAMP}"
COMPOSE_ARGS=(-f docker-compose.yml -f "${COMPOSE_OVERRIDE}")

cleanup() {
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

if [ -z "${ARCHIVE_PATH}" ] || [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "Usage: CONFIRM_RESTORE=YES $0 /backups/site/site-backup-YYYY-MM-DD-HHMMSS.tar.gz"
  exit 1
fi

if [ "${CONFIRM_RESTORE:-NO}" != "YES" ]; then
  echo "Restore is destructive. Re-run with CONFIRM_RESTORE=YES after checking the archive path."
  exit 1
fi

cd "${SITE_ROOT}"
tar -tzf "${ARCHIVE_PATH}" >/dev/null
tar -xzf "${ARCHIVE_PATH}" -C "${WORK_DIR}"
BACKUP_DIR="$(find "${WORK_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

if [ -z "${BACKUP_DIR}" ] || [ ! -f "${BACKUP_DIR}/checksums.sha256" ]; then
  echo "Backup archive is missing checksums.sha256"
  exit 1
fi

(
  cd "${BACKUP_DIR}"
  sha256sum -c checksums.sha256
)

if [ "${VERIFY_ONLY}" = "YES" ]; then
  echo "Backup archive verified successfully: ${ARCHIVE_PATH}"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required for restore."
  exit 1
fi

if [ "${SKIP_PRE_RESTORE_BACKUP}" != "YES" ]; then
  echo "Creating a fresh backup before restore"
  COMPOSE_OVERRIDE="${COMPOSE_OVERRIDE}" "${SITE_ROOT}/scripts/backup.sh"
fi

docker compose "${COMPOSE_ARGS[@]}" down
mkdir -p "${ROLLBACK_DIR}"

if [ -d storage/data ]; then
  mv storage/data "${ROLLBACK_DIR}/storage-data"
fi
if [ -d uploads ]; then
  mv uploads "${ROLLBACK_DIR}/uploads"
fi

mkdir -p storage/data uploads

if [ -f "${BACKUP_DIR}/storage-data.tar.gz" ]; then
  tar -xzf "${BACKUP_DIR}/storage-data.tar.gz" -C "${SITE_ROOT}"
fi
if [ -f "${BACKUP_DIR}/uploads.tar.gz" ]; then
  tar -xzf "${BACKUP_DIR}/uploads.tar.gz" -C "${SITE_ROOT}"
fi
if [ -f "${BACKUP_DIR}/data.db" ]; then
  cp -a "${BACKUP_DIR}/data.db" storage/data/data.db
  rm -f storage/data/data.db-wal storage/data/data.db-shm
fi

if [ "${RESTORE_ENV}" = "YES" ]; then
  for file in .env .env.prod; do
    [ -f "${BACKUP_DIR}/${file}" ] && cp -a "${BACKUP_DIR}/${file}" "${SITE_ROOT}/${file}"
  done
fi

chown -R "${CONTAINER_UID}:${CONTAINER_GID}" storage/data uploads

echo "Previous runtime data preserved in ${ROLLBACK_DIR}"

if [ "${NO_START}" != "YES" ]; then
  docker compose "${COMPOSE_ARGS[@]}" up -d
  APP_PORT="${APP_PORT}" "${SITE_ROOT}/scripts/healthcheck.sh"
fi

echo "Restore completed successfully from ${ARCHIVE_PATH}"

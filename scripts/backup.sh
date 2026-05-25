#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_ROOT="${BACKUP_ROOT:-/backups/site}"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"

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

if [ -f data.db ]; then
  cp -a data.db "${BACKUP_DIR}/data.db.root"
fi

if [ -d storage/data ]; then
  tar -czf "${BACKUP_DIR}/storage-data.tar.gz" storage/data
fi

if [ -d uploads ]; then
  tar -czf "${BACKUP_DIR}/uploads.tar.gz" uploads
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml config --volumes > "${BACKUP_DIR}/docker-volumes.txt" || true
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

tar -czf "${BACKUP_ROOT}/site-backup-${STAMP}.tar.gz" -C "${BACKUP_ROOT}" "${STAMP}"

echo "Backup created: ${BACKUP_ROOT}/site-backup-${STAMP}.tar.gz"

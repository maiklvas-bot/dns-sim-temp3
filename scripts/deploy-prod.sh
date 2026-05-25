#!/usr/bin/env bash
set -euo pipefail

cd "${SITE_ROOT:-/opt/site-prod}"

./scripts/backup.sh

git checkout main
git pull origin main

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

APP_PORT="${APP_PORT:-5001}" ./scripts/healthcheck.sh

#!/usr/bin/env bash
set -euo pipefail

cd "${SITE_ROOT:-/opt/site-staging}"

git checkout dev
git pull origin dev

docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build

APP_PORT="${APP_PORT:-5002}" ./scripts/healthcheck.sh

#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${APP_PORT:-5000}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:${APP_PORT}/api/health}"

echo "Checking ${HEALTHCHECK_URL}"
curl -fsS "${HEALTHCHECK_URL}" >/tmp/dns-simcenter-healthcheck.json
cat /tmp/dns-simcenter-healthcheck.json
echo

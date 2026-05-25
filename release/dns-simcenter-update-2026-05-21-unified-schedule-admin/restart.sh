#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="dns-simcenter"
INSTALL_DIR="${INSTALL_DIR:-/opt/dns-simcenter}"
COMPOSE_CMD=""

usage() {
  cat <<USAGE
Usage:
  sudo bash ./restart.sh [options]

Options:
  --install-dir /opt/dns-simcenter
  --help
USAGE
}

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

[[ -d "$INSTALL_DIR" ]] || fail "Install directory not found: $INSTALL_DIR"
[[ -f "$INSTALL_DIR/docker-compose.yml" ]] || fail "docker-compose.yml not found in install dir: $INSTALL_DIR"

resolve_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  else
    fail "Docker Compose is not available."
  fi
}

compose() {
  (
    cd "$INSTALL_DIR"
    export COMPOSE_PROJECT_NAME="$APP_NAME"
    if [[ "$COMPOSE_CMD" == "docker compose" ]]; then
      docker compose "$@"
    else
      docker-compose "$@"
    fi
  )
}

resolve_compose_cmd
log "Recreating application container"
compose up -d --force-recreate app
log "Container status"
compose ps

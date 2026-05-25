#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="dns-simcenter"
INSTALL_DIR="${INSTALL_DIR:-/opt/dns-simcenter}"
SOURCE_DIR="${SOURCE_DIR:-$(pwd)}"
COMPOSE_CMD=""

usage() {
  cat <<USAGE
Usage:
  sudo bash ./update.sh [options]

Options:
  --install-dir /opt/dns-simcenter
  --source-dir /path/to/source
  --help
USAGE
}

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --source-dir) SOURCE_DIR="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || fail "Run this updater as root: sudo bash ./update.sh"
[[ -d "$INSTALL_DIR" ]] || fail "Install directory not found: $INSTALL_DIR"
[[ -d "$SOURCE_DIR" ]] || fail "Source directory not found: $SOURCE_DIR"
[[ -f "$INSTALL_DIR/docker-compose.yml" ]] || fail "docker-compose.yml not found in install dir: $INSTALL_DIR"

resolve_source_dir() {
  if [[ -f "$SOURCE_DIR/package.json" ]]; then
    return
  fi

  local nested_dir
  nested_dir="$(find "$SOURCE_DIR" -mindepth 1 -maxdepth 3 -type f -name package.json -printf '%h\n' | head -n 1 || true)"
  if [[ -n "$nested_dir" ]]; then
    log "Detected nested source directory: $nested_dir"
    SOURCE_DIR="$nested_dir"
    return
  fi

  fail "package.json not found in source dir: $SOURCE_DIR"
}

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

sync_source() {
  log "Updating project files in $INSTALL_DIR"

  local resolved_source resolved_install
  resolved_source="$(cd "$SOURCE_DIR" && pwd -P)"
  resolved_install="$(cd "$INSTALL_DIR" && pwd -P)"

  if [[ "$resolved_source" == "$resolved_install" ]]; then
    log "Source directory is already the install directory, skipping file sync"
    return
  fi

  rsync -a --delete \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.tools' \
    --exclude 'storage' \
    --exclude 'uploads' \
    --exclude 'backups' \
    --exclude '*.log' \
    "$SOURCE_DIR/" "$INSTALL_DIR/"
}

sync_uploads() {
  if [[ ! -d "$SOURCE_DIR/uploads" ]]; then
    log "Source archive does not include uploads/, keeping existing server media files"
    return
  fi

  log "Syncing uploaded media files"
  mkdir -p "$INSTALL_DIR/uploads"
  rsync -a "$SOURCE_DIR/uploads/" "$INSTALL_DIR/uploads/"
}

ensure_runtime_dirs() {
  mkdir -p "$INSTALL_DIR/storage/data" "$INSTALL_DIR/uploads"
  chown -R 1000:1000 "$INSTALL_DIR/storage" "$INSTALL_DIR/uploads"
}

rebuild_stack() {
  log "Rebuilding and starting updated containers"
  compose up -d --build
}

show_status() {
  log "Container status"
  compose ps
}

resolve_compose_cmd
resolve_source_dir
sync_source
sync_uploads
ensure_runtime_dirs
rebuild_stack
show_status

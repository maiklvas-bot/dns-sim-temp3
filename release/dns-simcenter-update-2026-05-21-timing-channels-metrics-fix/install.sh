#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="dns-simcenter"
INSTALL_DIR="${INSTALL_DIR:-/opt/dns-simcenter}"
SOURCE_DIR="${SOURCE_DIR:-$(pwd)}"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
SKIP_CERTBOT="${SKIP_CERTBOT:-0}"

OS_ID=""
OS_LIKE=""
COMPOSE_CMD=""
NGINX_CONF_PATH=""
TLS_STATUS="pending"

usage() {
  cat <<USAGE
Usage:
  sudo bash ./install.sh [options]

Options:
  --domain example.com
  --email admin@example.com
  --install-dir /opt/dns-simcenter
  --source-dir /path/to/source
  --skip-certbot
  --help

The script installs Docker Engine + Docker Compose plugin,
copies the current project to the target directory, starts
the application with docker compose, configures nginx and
obtains a Let's Encrypt certificate via certbot.
USAGE
}

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m[warn]\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --source-dir) SOURCE_DIR="$2"; shift 2 ;;
    --skip-certbot) SKIP_CERTBOT=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || fail "Run this installer as root: sudo bash ./install.sh"
[[ -d "$SOURCE_DIR" ]] || fail "Source directory not found: $SOURCE_DIR"
[[ -f "$SOURCE_DIR/package.json" ]] || fail "package.json not found in source dir: $SOURCE_DIR"
[[ -f "$SOURCE_DIR/Dockerfile" ]] || fail "Dockerfile not found in source dir: $SOURCE_DIR"
[[ -f "$SOURCE_DIR/docker-compose.yml" ]] || fail "docker-compose.yml not found in source dir: $SOURCE_DIR"
[[ -f "$SOURCE_DIR/.env.example" ]] || fail ".env.example not found in source dir: $SOURCE_DIR"

detect_os() {
  [[ -f /etc/os-release ]] || fail "/etc/os-release not found. Unsupported Linux distribution."
  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID="${ID:-}"
  OS_LIKE="${ID_LIKE:-}"
  [[ -n "$OS_ID" ]] || fail "Could not detect Linux distribution."
}

ensure_install_inputs() {
  if [[ -z "$DOMAIN" ]]; then
    if [[ -t 0 ]]; then
      read -r -p "Enter domain for deployment (example.com): " DOMAIN
    else
      fail "Domain is required. Pass it via --domain example.com"
    fi
  fi

  [[ -n "$DOMAIN" ]] || fail "Domain is required"

  if [[ "$SKIP_CERTBOT" != "1" && -z "$EMAIL" ]]; then
    if [[ -t 0 ]]; then
      read -r -p "Enter email for Let's Encrypt notifications: " EMAIL
    else
      fail "Email is required unless --skip-certbot is used"
    fi
  fi

  [[ "$SKIP_CERTBOT" == "1" || -n "$EMAIL" ]] || fail "Email is required unless --skip-certbot is used"
}

install_system_packages_apt() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    rsync \
    git \
    nginx \
    certbot \
    python3-certbot-nginx
}

install_system_packages_rhel() {
  local pkg_tool="$1"
  local common_packages=(ca-certificates curl rsync git nginx certbot python3-certbot-nginx)

  if [[ "$OS_ID" != "fedora" ]]; then
    if [[ "$pkg_tool" == "dnf" ]]; then
      dnf install -y epel-release || true
      if command -v crb >/dev/null 2>&1; then
        crb enable || true
      fi
      dnf install -y dnf-plugins-core
    else
      yum install -y epel-release || true
      yum install -y yum-utils
    fi
  else
    if [[ "$pkg_tool" == "dnf" ]]; then
      dnf install -y dnf-plugins-core
    else
      yum install -y yum-utils
    fi
  fi

  if [[ "$pkg_tool" == "dnf" ]]; then
    dnf install -y "${common_packages[@]}"
  else
    yum install -y "${common_packages[@]}"
  fi
}

ensure_platform_packages() {
  case "$OS_ID" in
    ubuntu|debian)
      install_system_packages_apt
      ;;
    almalinux|rocky|rhel|centos|fedora)
      if command -v dnf >/dev/null 2>&1; then
        install_system_packages_rhel dnf
      elif command -v yum >/dev/null 2>&1; then
        install_system_packages_rhel yum
      else
        fail "Neither dnf nor yum found on this RHEL-like system."
      fi
      ;;
    *)
      if [[ "$OS_LIKE" == *"debian"* ]]; then
        install_system_packages_apt
      elif [[ "$OS_LIKE" == *"rhel"* || "$OS_LIKE" == *"fedora"* ]]; then
        if command -v dnf >/dev/null 2>&1; then
          install_system_packages_rhel dnf
        elif command -v yum >/dev/null 2>&1; then
          install_system_packages_rhel yum
        else
          fail "Neither dnf nor yum found on this RHEL-like system."
        fi
      else
        fail "Unsupported Linux distribution: ${OS_ID:-unknown}"
      fi
      ;;
  esac
}

install_docker_apt() {
  log "Installing Docker packages for Debian/Ubuntu"

  local repo_os codename
  repo_os="$OS_ID"
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"

  if [[ "$repo_os" != "ubuntu" && "$repo_os" != "debian" ]]; then
    if [[ -n "${UBUNTU_CODENAME:-}" ]]; then
      repo_os="ubuntu"
      codename="${UBUNTU_CODENAME}"
    else
      repo_os="debian"
    fi
  fi

  install -m 0755 -d /etc/apt/keyrings
  rm -f /etc/apt/keyrings/docker.gpg
  curl -fsSL "https://download.docker.com/linux/${repo_os}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  [[ -n "$codename" ]] || fail "Could not detect distro codename for Docker repository."

  cat > /etc/apt/sources.list.d/docker.list <<APT
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${repo_os} ${codename} stable
APT

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_rhel() {
  local pkg_tool="$1"
  local repo_os="centos"
  if [[ "$OS_ID" == "fedora" ]]; then
    repo_os="fedora"
  fi

  log "Installing Docker packages for RHEL-like distribution"

  if [[ "$pkg_tool" == "dnf" ]]; then
    dnf config-manager --add-repo "https://download.docker.com/linux/${repo_os}/docker-ce.repo"
    dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    yum-config-manager --add-repo "https://download.docker.com/linux/${repo_os}/docker-ce.repo"
    yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
}

ensure_docker() {
  detect_os
  ensure_platform_packages

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker and Docker Compose plugin are already installed"
  else
    case "$OS_ID" in
      ubuntu|debian)
        install_docker_apt
        ;;
      almalinux|rocky|rhel|centos|fedora)
        if command -v dnf >/dev/null 2>&1; then
          install_docker_rhel dnf
        elif command -v yum >/dev/null 2>&1; then
          install_docker_rhel yum
        else
          fail "Neither dnf nor yum found on this RHEL-like system."
        fi
        ;;
      *)
        if [[ "$OS_LIKE" == *"debian"* ]]; then
          install_docker_apt
        elif [[ "$OS_LIKE" == *"rhel"* || "$OS_LIKE" == *"fedora"* ]]; then
          if command -v dnf >/dev/null 2>&1; then
            install_docker_rhel dnf
          elif command -v yum >/dev/null 2>&1; then
            install_docker_rhel yum
          else
            fail "Neither dnf nor yum found on this RHEL-like system."
          fi
        else
          fail "Unsupported Linux distribution: ${OS_ID:-unknown}"
        fi
        ;;
    esac
  fi

  systemctl enable --now docker
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
  log "Copying project files to $INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"

  local resolved_source resolved_install
  resolved_source="$(cd "$SOURCE_DIR" && pwd -P)"
  resolved_install="$(cd "$INSTALL_DIR" 2>/dev/null && pwd -P)"

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
  log "Preparing persistent directories"
  mkdir -p "$INSTALL_DIR/storage/data" "$INSTALL_DIR/uploads"
  chown -R 1000:1000 "$INSTALL_DIR/storage" "$INSTALL_DIR/uploads"

  if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    warn "Created $INSTALL_DIR/.env from .env.example. Review passwords and SESSION_SECRET before opening access."
  fi
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  awk -F= -v key="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 == key {
      sub(/^[^=]*=/, "", $0)
      print $0
      exit
    }
  ' "$env_file" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//'
}

resolve_app_port() {
  local app_port="5000"

  if [[ -f "$INSTALL_DIR/.env" ]]; then
    local configured_port
    configured_port="$(read_env_value "$INSTALL_DIR/.env" "APP_PORT" || true)"
    if [[ -z "$configured_port" ]]; then
      configured_port="$(read_env_value "$INSTALL_DIR/.env" "PORT" || true)"
    fi
    if [[ -n "$configured_port" ]]; then
      app_port="$configured_port"
    fi
  fi

  [[ "$app_port" =~ ^[0-9]+$ ]] || fail "APP_PORT/PORT must be numeric in $INSTALL_DIR/.env"
  [[ "$app_port" != "80" && "$app_port" != "443" ]] || fail "APP_PORT/PORT must not be 80 or 443 when nginx is enabled"

  printf '%s\n' "$app_port"
}

start_stack() {
  log "Building and starting containers"
  compose up -d --build
}

create_nginx_config() {
  local app_port="$1"
  NGINX_CONF_PATH="/etc/nginx/conf.d/${DOMAIN}.conf"

  log "Creating nginx config for ${DOMAIN}"
  cat > "$NGINX_CONF_PATH" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 160m;

    location / {
        proxy_pass http://127.0.0.1:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_connect_timeout 15s;
    }
}
NGINX

  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

issue_cert() {
  if [[ "$SKIP_CERTBOT" == "1" ]]; then
    TLS_STATUS="skipped"
    warn "Skipping certbot by request"
    return 0
  fi

  log "Requesting TLS certificate via certbot"
  if ! certbot --nginx --non-interactive --agree-tos --redirect --keep-until-expiring -m "$EMAIL" -d "$DOMAIN"; then
    TLS_STATUS="failed"
    warn "Certbot failed. The site remains available over HTTP. Check DNS, ports 80/443 and rerun: certbot --nginx -d $DOMAIN -m $EMAIL"
    return 0
  fi

  TLS_STATUS="enabled"

  if systemctl list-unit-files | grep -q '^certbot\.timer'; then
    systemctl enable --now certbot.timer || true
  fi

  systemctl reload nginx
}

verify_stack() {
  local app_port
  app_port="$(resolve_app_port)"

  log "Container status"
  compose ps

  log "Checking local HTTP response on port $app_port"
  if ! curl -fsS "http://127.0.0.1:${app_port}" >/dev/null; then
    warn "HTTP check failed. Inspect logs with: cd $INSTALL_DIR && $COMPOSE_CMD logs --tail=100"
  fi

  log "Checking nginx proxy for ${DOMAIN}"
  if ! curl -fsS -H "Host: ${DOMAIN}" "http://127.0.0.1" >/dev/null; then
    warn "Nginx proxy check failed for ${DOMAIN}. Inspect: systemctl status nginx and nginx -t"
  fi
}

print_summary() {
  cat <<SUMMARY

Installation finished.

Project dir: $INSTALL_DIR
Compose app: $APP_NAME
Domain: $DOMAIN
TLS: $TLS_STATUS

Useful commands:
  cd $INSTALL_DIR && $COMPOSE_CMD ps
  cd $INSTALL_DIR && $COMPOSE_CMD logs -f
  systemctl status nginx
  journalctl -u nginx -n 100 --no-pager
  sudo bash $INSTALL_DIR/update.sh --source-dir /path/to/new/source
  sudo bash $INSTALL_DIR/restart.sh

Before production use:
  1. Edit $INSTALL_DIR/.env
  2. Set strong ADMIN_PASSWORD, EVALUATOR_PASSWORD and SESSION_SECRET
  3. If needed, change APP_PORT

Open in browser:
  http://$DOMAIN
$( [[ "$TLS_STATUS" == "enabled" ]] && printf '  https://%s\n' "$DOMAIN" )
SUMMARY
}

ensure_install_inputs
ensure_docker
resolve_compose_cmd
sync_source
sync_uploads
ensure_runtime_dirs
start_stack
create_nginx_config "$(resolve_app_port)"
issue_cert
verify_stack
print_summary

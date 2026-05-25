#!/usr/bin/env bash
# =============================================================================
# DNS SimCenter — Production Setup Script
# =============================================================================
#
# УСТАНОВКА:
#   chmod +x install.sh
#   ./install.sh
#
# ЧТО ДЕЛАЕТ:
# 1. Проверяет наличие Docker и Docker Compose
# 2. Генерирует безопасный SESSION_SECRET
# 3. Создаёт .env файл с настройками
# 4. Создаёт необходимые директории (data, uploads, ssl)
# 5. Собирает Docker образ
# 6. Запускает контейнеры
# 7. Показывает инструкции по доступу
#
# ТРЕБОВАНИЯ:
#   - Docker Engine 24.0+
#   - Docker Compose v2+
#   - Linux/macOS (bash)
# =============================================================================

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# =============================================================================
# Вспомогательные функции
# =============================================================================

log_info() { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

print_banner() {
    echo -e "${CYAN}"
    cat << 'BANNER'
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║    ██████  ███    ██ ███████     ███████ ██ ███    ███   ║
    ║    ██   ██ ████   ██ ██               ██  ██ ████  ████   ║
    ║    ██   ██ ██ ██  ██ ███████          ██   ██ ██ ████ ██   ║
    ║    ██   ██ ██  ██ ██      ██         ██    ██ ██  ██  ██   ║
    ║    ██████  ██   ████ ███████        ██     ██ ██      ██   ║
    ║                                                           ║
    ║           Production Docker Setup v2.0                    ║
    ╚═══════════════════════════════════════════════════════════╝
BANNER
    echo -e "${NC}"
}

# =============================================================================
# Шаг 1: Проверка зависимостей
# =============================================================================

check_docker() {
    log_step "Проверка зависимостей"

    # Проверка Docker
    if ! command -v docker &> /dev/null; then
        log_err "Docker не установлен!"
        log_info "Установка: https://docs.docker.com/engine/install/"
        exit 1
    fi
    log_ok "Docker установлен: $(docker --version)"

    # Проверка Docker Compose (v2)
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
        log_ok "Docker Compose v2: $(docker compose version --short)"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
        log_ok "Docker Compose: $(docker-compose --version)"
    else
        log_err "Docker Compose не установлен!"
        log_info "Установка: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # Проверка запущен ли Docker демон
    if ! docker info &> /dev/null; then
        log_err "Docker демон не запущен!"
        log_info "Запустите: sudo systemctl start docker"
        exit 1
    fi
    log_ok "Docker демон работает"
}

# =============================================================================
# Шаг 2: Генерация SESSION_SECRET
# =============================================================================

generate_secrets() {
    log_step "Генерация секретов"

    # Генерация SESSION_SECRET (64 байта = 128 hex символов)
    SESSION_SECRET=$(openssl rand -hex 64 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 128)
    log_ok "SESSION_SECRET сгенерирован (128 hex символов)"

    # Генерация паролей по умолчанию
    ADMIN_PASS=$(openssl rand -base64 16 2>/dev/null || cat /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 20)
    EVALUATOR_PASS=$(openssl rand -base64 16 2>/dev/null || cat /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 20)
    log_ok "Пароли по умолчанию сгенерированы"
}

# =============================================================================
# Шаг 3: Создание .env файла
# =============================================================================

create_env_file() {
    log_step "Создание .env файла"

    if [ -f ".env" ]; then
        log_warn "Файл .env уже существует!"
        read -p "Перезаписать? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Сохранён существующий .env"
            return
        fi
        cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "Создан бэкап существующего .env"
    fi

    # Запрос данных у пользователя
    echo
    read -p "Порт приложения [5000]: " APP_PORT_INPUT
    APP_PORT=${APP_PORT_INPUT:-5000}

    read -p "Имя администратора [admin]: " ADMIN_USER_INPUT
    ADMIN_USER=${ADMIN_USER_INPUT:-admin}

    read -p "Отображаемое имя администратора [Главный администратор]: " ADMIN_NAME_INPUT
    ADMIN_NAME=${ADMIN_NAME_INPUT:-Главный администратор}

    read -p "Имя оценщика [evaluator]: " EVAL_USER_INPUT
    EVAL_USER=${EVAL_USER_INPUT:-evaluator}

    read -p "Отображаемое имя оценщика [Оценщик]: " EVAL_NAME_INPUT
    EVAL_NAME=${EVAL_NAME_INPUT:-Оценщик}

    # Предложить сгенерированные пароли или ввести свои
    echo
    log_info "Сгенерированные пароли (рекомендуется использовать свои):"
    echo -e "  Администратор:  ${YELLOW}${ADMIN_PASS}${NC}"
    echo -e "  Оценщик:        ${YELLOW}${EVALUATOR_PASS}${NC}"
    
    read -p "Использовать сгенерированные пароли? [Y/n]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        read -sp "Пароль администратора: " ADMIN_PASS
        echo
        read -sp "Пароль оценщика: " EVALUATOR_PASS
        echo
    fi

    # Запись .env файла
    cat > .env << EOF
# =============================================================================
# DNS SimCenter — Production Environment
# =============================================================================
# Сгенерирован автоматически: $(date '+%Y-%m-%d %H:%M:%S')
# НЕ КОММИТЬТЕ ЭТОТ ФАЙЛ В GIT!
# =============================================================================

# --- Application -------------------------------------------------------------
NODE_ENV=production
PORT=${APP_PORT}
APP_PORT=${APP_PORT}

# --- Session Secret (критически важно!) ------------------------------------
SESSION_SECRET=${SESSION_SECRET}

# --- HTTPS (включён для production) -----------------------------------------
HTTPS=true

# --- Staff Accounts ----------------------------------------------------------
SYNC_STAFF_FROM_ENV=true

ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}
ADMIN_DISPLAY_NAME="${ADMIN_NAME}"

EVALUATOR_USERNAME=${EVAL_USER}
EVALUATOR_PASSWORD=${EVALUATOR_PASS}
EVALUATOR_DISPLAY_NAME="${EVAL_NAME}"
EOF

    chmod 600 .env
    log_ok ".env файл создан (права 600)"
}

# =============================================================================
# Шаг 4: Создание директорий
# =============================================================================

create_directories() {
    log_step "Создание директорий"

    # Директория для SQLite данных
    mkdir -p storage/data
    log_ok "storage/data/ — для SQLite базы данных"

    # Директория для загрузок
    mkdir -p uploads
    log_ok "uploads/ — для медиафайлов"

    # Директория для SSL сертификатов
    mkdir -p ssl
    log_ok "ssl/ — для SSL сертификатов (опционально)"

    # Директория для Let's Encrypt (если используется)
    mkdir -p certbot
    log_ok "certbot/ — для Let's Encrypt challenges"
}

# =============================================================================
# Шаг 5: Сборка Docker образа
# =============================================================================

build_image() {
    log_step "Сборка Docker образа"

    log_info "Сборка может занять 5-10 минут..."
    
    # Pull свежих базовых образов
    docker pull node:20-alpine --quiet 2>/dev/null || true

    # Сборка
    $COMPOSE_CMD build --no-cache
    
    log_ok "Docker образ собран"
}

# =============================================================================
# Шаг 6: Запуск контейнеров
# =============================================================================

start_containers() {
    log_step "Запуск контейнеров"

    # Остановка предыдущих контейнеров (если есть)
    $COMPOSE_CMD down --remove-orphans 2>/dev/null || true

    # Запуск
    $COMPOSE_CMD up -d

    log_ok "Контейнеры запущены"
}

# =============================================================================
# Шаг 7: Проверка статуса
# =============================================================================

check_status() {
    log_step "Проверка статуса"

    # Ждём запуска
    log_info "Ожидание запуска приложения (30 сек)..."
    sleep 5

    # Проверка health
    local max_attempts=12
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if $COMPOSE_CMD ps app | grep -q "healthy"; then
            log_ok "Приложение готово к работе!"
            return 0
        elif $COMPOSE_CMD ps app | grep -q "unhealthy"; then
            log_err "Приложение не прошло health check!"
            $COMPOSE_CMD logs --tail=50 app
            return 1
        fi
        
        echo -n "."
        sleep 3
        attempt=$((attempt + 1))
    done

    log_warn "Health check не подтвердился за отведённое время"
    log_info "Проверьте логи: $COMPOSE_CMD logs -f app"
}

# =============================================================================
# Шаг 8: Вывод инструкций
# =============================================================================

print_instructions() {
    local port=$APP_PORT
    
    echo -e "\n${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                  DNS SimCenter запущен!                       ║${NC}"
    echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

    echo -e "${BOLD}📡 Доступ:${NC}"
    echo -e "   • HTTP локально:  ${CYAN}http://127.0.0.1:${port}${NC}"
    echo -e "   • Health check:   ${CYAN}http://127.0.0.1:${port}/health${NC}"
    echo
    
    echo -e "${BOLD}👤 Учётные данные по умолчанию:${NC}"
    echo -e "   • Администратор:  ${YELLOW}${ADMIN_USER}${NC} / ${YELLOW}${ADMIN_PASS}${NC}"
    echo -e "   • Оценщик:        ${YELLOW}${EVAL_USER}${NC} / ${YELLOW}${EVALUATOR_PASS}${NC}"
    echo
    
    echo -e "${BOLD}⚠️  Важно — СМЕНИТЕ ПАРОЛИ при первом входе!${NC}"
    echo

    echo -e "${BOLD}📁 Файлы конфигурации:${NC}"
    echo -e "   • Переменные окружения: ${CYAN}.env${NC}"
    echo -e "   • База данных:          ${CYAN}storage/data/${NC}"
    echo -e "   • Загрузки:             ${CYAN}uploads/${NC}"
    echo -e "   • SSL сертификаты:      ${CYAN}ssl/${NC}"
    echo

    echo -e "${BOLD}🐳 Docker команды:${NC}"
    echo -e "   • Логи:      ${CYAN}${COMPOSE_CMD} logs -f app${NC}"
    echo -e "   • Остановка: ${CYAN}${COMPOSE_CMD} down${NC}"
    echo -e "   • Перезапуск:${CYAN}${COMPOSE_CMD} restart app${NC}"
    echo -e "   • Статус:    ${CYAN}${COMPOSE_CMD} ps${NC}"
    echo -e "   • В shell:   ${CYAN}${COMPOSE_CMD} exec app sh${NC}"
    echo

    echo -e "${BOLD}🔒 SSL (для production):${NC}"
    echo -e "   1. Получите сертификаты Let's Encrypt:"
    echo -e "      ${CYAN}certbot certonly --standalone -d your-domain.com${NC}"
    echo -e "   2. Скопируйте в ssl/:"
    echo -e "      ${CYAN}cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem${NC}"
    echo -e "      ${CYAN}cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem${NC}"
    echo -e "   3. Запустите с Nginx:"
    echo -e "      ${CYAN}${COMPOSE_CMD} --profile with-nginx up -d${NC}"
    echo

    echo -e "${BOLD}💾 Бэкап:${NC}"
    echo -e "   ${CYAN}cp storage/data/data.db storage/data/data.db.backup.$(date +%Y%m%d)${NC}"
    echo
    
    # Запись паролей в отдельный файл для справки
    cat > "credentials.$(date +%Y%m%d).txt" << EOF
DNS SimCenter — Учётные данные ($(date '+%Y-%m-%d %H:%M:%S'))
=========================================================

URL: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '127.0.0.1'):${port}

Администратор:
  Username: ${ADMIN_USER}
  Password: ${ADMIN_PASS}
  Display:  ${ADMIN_NAME}

Оценщик:
  Username: ${EVAL_USER}
  Password: ${EVALUATOR_PASS}
  Display:  ${EVAL_NAME}

СОХРАНИТЕ ЭТОТ ФАЙЛ В БЕЗОПАСНОМ МЕСТЕ И УДАЛИТЕ ПОСЛЕ ПРОЧТЕНИЯ!
EOF

    chmod 600 "credentials.$(date +%Y%m%d).txt"
    log_warn "Учётные данные сохранены в: credentials.$(date +%Y%m%d).txt"
    log_warn "СОХРАНИТЕ И УДАЛИТЕ ЭТОТ ФАЙЛ!"
}

# =============================================================================
# Главная функция
# =============================================================================

main() {
    print_banner
    
    # Определение Docker Compose команды
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    check_docker
    generate_secrets
    create_env_file
    create_directories
    build_image
    start_containers
    check_status
    print_instructions
}

# Запуск
main "$@"

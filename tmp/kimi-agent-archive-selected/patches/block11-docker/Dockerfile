# =============================================================================
# DNS SimCenter — Оптимизированный многоступенчатый Dockerfile
# =============================================================================
# 
# ОПТИМИЗАЦИИ:
# — Multi-stage build: разделение build и runtime
# — node:20-alpine: минимальный базовый образ (~180MB vs ~900MB bookworm)
# — dumb-init: корректная обработка сигналов (PID 1)
# — Удаление devDependencies после сборки
# — Очистка кэша npm
# — Не-root пользователь (node) для безопасности
# — entrypoint: инициализация БД при первом запуске
#
# СБОРКА:
#   docker build --target production -t dns-simcenter .
#
# РАЗМЕРЫ:
#   build stage: ~1.2GB (включая devDependencies и исходники)
#   production:  ~450MB (только runtime + production deps)
# =============================================================================

# ============================================================================
# Этап 1: BUILD — компиляция TypeScript и сборка клиента
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Установка системных зависимостей для сборки нативных модулей
# (better-sqlite3, bcrypt требуют compilation tools)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    && npm config set python /usr/bin/python3

# Копируем файлы зависимостей первыми для кэширования слоя
COPY package.json package-lock.json ./

# Устанавливаем ВСЕ зависимости (включая devDependencies для сборки)
RUN npm ci \
    && npm cache clean --force

# Копируем исходный код проекта
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY script ./script
COPY migrations ./migrations
COPY attached_assets ./attached_assets
COPY .env.example ./.env.example
COPY components.json ./
COPY data.db ./data.db
COPY drizzle.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY docker ./docker

# Собираем проект (TypeScript → dist/ + Vite client build)
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

# ============================================================================
# Этап 2: PRODUCTION — минимальный runtime образ
# ============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# -----------------------------------------------------------------------------
# Безопасность: обновляем пакеты и устанавливаем runtime-зависимости
# -----------------------------------------------------------------------------
RUN apk upgrade --no-cache \
    && apk add --no-cache \
    # dumb-init: корректная обработка SIGTERM/SIGINT для PID 1
    dumb-init \
    # wget: для healthcheck из docker-compose
    wget \
    # Python + reportlab: генерация PDF отчётов
    python3 \
    py3-reportlab \
    # Шрифты для PDF генерации (кириллица)
    font-noto \
    font-noto-cjk \
    # SSL сертификаты для HTTPS-запросов
    ca-certificates \
    # Очистка
    && rm -rf /var/cache/apk/*

# -----------------------------------------------------------------------------
# Переменные окружения
# -----------------------------------------------------------------------------
ENV NODE_ENV=production
ENV PORT=5000
# Путь к SQLite базе данных (persistent volume)
ENV SQLITE_PATH=/app/data/data.db
# Синхронизация staff-аккаунтов из env при запуске
ENV SYNC_STAFF_FROM_ENV=true

# -----------------------------------------------------------------------------
# Копируем production-зависимости из builder
# -----------------------------------------------------------------------------
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

# -----------------------------------------------------------------------------
# Копируем скомпилированные артефакты
# -----------------------------------------------------------------------------
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/attached_assets ./attached_assets
COPY --from=builder /app/data.db ./bootstrap/data.db

# -----------------------------------------------------------------------------
# Entrypoint: инициализация БД при первом запуске
# -----------------------------------------------------------------------------
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# -----------------------------------------------------------------------------
# Подготовка директорий и права
# -----------------------------------------------------------------------------
RUN mkdir -p /app/data /app/uploads /app/bootstrap \
    && chown -R node:node /app \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# -----------------------------------------------------------------------------
# Безопасность: запуск от не-root пользователя
# -----------------------------------------------------------------------------
USER node

# Порт приложения
EXPOSE 5000

# dumb-init как PID 1: корректная обработка сигналов
ENTRYPOINT ["dumb-init", "--", "docker-entrypoint.sh"]

# Запуск production сервера
CMD ["node", "dist/index.cjs"]

# =============================================================================
# HEALTHCHECK (опционально, если не используется docker-compose healthcheck)
# =============================================================================
# Health check: проверка доступности API (/api/health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:5000/api/health || exit 1

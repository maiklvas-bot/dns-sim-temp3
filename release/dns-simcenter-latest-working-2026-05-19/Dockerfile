FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

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

RUN npm run build \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-reportlab fonts-noto-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000
ENV SQLITE_PATH=/app/data/data.db
ENV SYNC_STAFF_FROM_ENV=true

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/attached_assets ./attached_assets
COPY --from=build /app/data.db ./bootstrap/data.db
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data /app/uploads /app/bootstrap \
  && chown -R node:node /app \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

EXPOSE 5000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.cjs"]

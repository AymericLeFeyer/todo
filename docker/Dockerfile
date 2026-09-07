# syntax=docker/dockerfile:1

# Base Debian plutôt qu'Alpine : better-sqlite3 se lie à la glibc, et la
# compilation d'un module natif sur musl réserve d'autres surprises.
FROM node:24-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Les manifestes seuls d'abord : la couche d'installation reste en cache tant
# que les dépendances ne bougent pas.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# better-sqlite3 est un module natif : quand aucun binaire précompilé ne
# correspond à l'ABI de l'image, node-gyp prend le relais et réclame Python et
# un compilateur C++. Ces outils restent cantonnés aux étapes d'installation :
# l'image finale repart de `base` et n'embarque que le `.node` compilé.
FROM manifests AS toolchain
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

FROM toolchain AS deps
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build -w @todo/core \
  && npm run build -w @todo/api \
  && npm run build -w @todo/web

FROM toolchain AS prod-deps
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/todo.db \
    WEB_DIST_PATH=/app/apps/web/dist

# node_modules conserve les liens symboliques des workspaces : les paquets
# `packages/core` et `apps/api` doivent donc rester à leur place.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=manifests /app/package.json ./package.json
COPY --from=manifests /app/packages/core/package.json ./packages/core/package.json
COPY --from=manifests /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]

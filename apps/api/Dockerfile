# Build context: monorepo root (necessário para resolver workspaces Bun)

# ─── Stage 1: instalar dependências ─────────────────────────────────────────
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

# Copiar apenas os manifests primeiro (cache de layers)
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/metrics/package.json ./packages/metrics/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

# ─── Stage 2: dev ────────────────────────────────────────────────────────────
FROM deps AS dev
COPY . .
WORKDIR /app/apps/api

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["bun", "run", "--watch", "src/index.ts"]

# ─── Stage 3: prod ───────────────────────────────────────────────────────────
FROM deps AS prod
COPY . .
WORKDIR /app/apps/api

# Não rodar como root em produção
USER bun

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]

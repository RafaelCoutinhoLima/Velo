# Build context: monorepo root
# uv já vem em /usr/local/bin/uv na imagem oficial — não fazer pip install uv

# ─── Stage 1: base com uv e deps instaladas ──────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS base
WORKDIR /app

# Copiar manifests do sidecar
COPY services/garmin-sidecar/pyproject.toml ./

# Instalar deps de produção (sem dev)
RUN uv sync --no-dev

# ─── Stage 2: dev (inclui pytest e httpx) ───────────────────────────────────
FROM base AS dev
WORKDIR /app

RUN uv sync

COPY services/garmin-sidecar/ ./

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ─── Stage 3: prod ───────────────────────────────────────────────────────────
FROM base AS prod
WORKDIR /app

COPY services/garmin-sidecar/ ./

# Usuário não-privilegiado
RUN adduser --disabled-password --gecos "" appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

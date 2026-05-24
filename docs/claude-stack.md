# claude-stack.md — Referência técnica da stack FitSync AI

> Complemento do `CLAUDE.md`. Enquanto o `CLAUDE.md` define **como trabalhar**, este arquivo define **o que usar** — versões, comandos, configurações e padrões por camada da stack.
>
> **Para mim, Claude**: consulto este arquivo sempre que (a) preciso adicionar uma dependência, (b) preciso escrever código novo em uma camada que ainda não toquei na sessão, ou (c) o Rafael pedir "como faço X com nossa stack". Versões aqui são as **fixas** do projeto — não atualizar sem decisão do Rafael.

---

## 1. Como ler este documento

A stack está dividida em duas regiões (princípio do Stack Evolutiva v2):

- **Núcleo invariável**: tecnologias que **nunca migram**. Trocar = reescrever produto. Decisão fixa.
- **Camada evolutiva**: tecnologias que mudam com triggers explícitos (Fase 1 → 2 → 3). Hoje estamos na **Fase 1** (2–10 usuários, dogfooding).

Para cada item listo: **o que é**, **versão fixa**, **como instalar**, **padrão de uso**, **gotchas conhecidos**.

Quando este documento e a internet discordam: **este documento ganha**. Se a discrepância parece importante, paro e pergunto ao Rafael.

---

## 2. Núcleo invariável

### 2.1 React Native + Expo (mobile)

- **React Native**: `0.79.x` (versão suportada pelo Expo SDK 53)
- **Expo SDK**: `53` (latest stable em maio 2026)
- **TypeScript**: `5.5+` com `strict: true`
- **Expo Router**: `v4.x` (file-based routing, deep linking nativo)

Scaffold inicial (uma vez no Pré-MVP):
```bash
bunx create-expo-app@latest apps/mobile --template default
cd apps/mobile && bunx expo install expo-router expo-secure-store expo-notifications
```

Padrões obrigatórios:
- Storage local **sempre** via `expo-secure-store` (nunca `AsyncStorage`, nunca `localStorage`)
- Push notifications via `expo-notifications` + Expo Push Service (gratuito, ilimitado)
- EAS Build para builds de produção (free tier no MVP)
- Arquivos de rota em `app/` seguem convenção do Expo Router v4 (`app/(auth)/login.tsx`, `app/plan/[week].tsx`, etc.)

Gotcha: `expo-secure-store` tem limite de ~2KB por chave em Android. Para o token Garmin (que cabe), tudo bem. Para payloads grandes, fragmenta ou usa Supabase.

### 2.2 Estado: TanStack Query + Zustand

- **TanStack Query**: `v5.x` (estado servidor)
- **Zustand**: `v5.x` (estado local UI)

```bash
bun add @tanstack/react-query @tanstack/query-async-storage-persister
bun add zustand
```

Regra simples de onde colocar cada coisa:

| Tipo de dado | Onde fica |
|---|---|
| Plano semanal vindo do backend | TanStack Query (`queryKey: ['plan', weekId]`) |
| Métricas calculadas (ACWR, CTL, TSB) | TanStack Query (cache 1h) |
| Workouts importados do Garmin | TanStack Query (cache invalidado por sync) |
| Perfil do atleta | Zustand (carrega 1x no login) |
| JWT da sessão | Zustand + persist em SecureStore |
| Estado de modal aberto, toast visível | Zustand puro |
| Input não submetido | `useState` local — não vai pra Zustand |

Padrão de cache offline: persister em SecureStore para que abrir o app sem rede mostre o último plano.

### 2.3 Bun + Elysia (backend principal)

- **Bun**: `1.2.x` (Anthropic adquiriu em dez/2025 — é a infra do Claude Code)
- **Elysia**: `1.2.x` ou superior
- **TypeBox**: vem com Elysia (validação + tipos)
- **Eden Treaty**: client type-safe entre mobile e api

Scaffold inicial:
```bash
mkdir apps/api && cd apps/api
bun init
bun add elysia @elysiajs/cors @elysiajs/swagger
bun add @supabase/supabase-js @anthropic-ai/sdk zod
bun add -d @types/bun
```

Estrutura de pastas dentro de `apps/api/`:
```
src/
├── index.ts                  # bootstrap Elysia + plugins
├── routes/
│   ├── auth.ts               # OAuth callbacks
│   ├── onboarding.ts         # POST /onboarding
│   ├── plan.ts               # GET /plan, PATCH /plan/move, POST /plan/replan
│   ├── workouts.ts           # GET /workouts, POST /sync
│   ├── jobs.ts               # GET /jobs/:id (polling do async)
│   └── feedback.ts
├── claude/
│   ├── client.ts             # cliente Anthropic SDK
│   ├── prompts/              # prompts versionados
│   │   ├── plan_v1.ts
│   │   └── feedback_v1.ts
│   ├── schemas.ts            # Zod schemas de resposta Claude
│   └── guardrails.ts         # validações determinísticas pós-resposta
├── garmin/
│   └── client.ts             # HTTP client p/ sidecar Python
├── db/
│   ├── client.ts             # supabase-js singleton
│   ├── migrations/           # versionadas, nunca editar antigas
│   └── queries/              # queries organizadas por domínio
└── lib/
    ├── metrics.ts            # importa de packages/metrics
    └── logger.ts             # pino com filtros de PII
```

Padrões obrigatórios:
- Toda rota tem `body` ou `query` definido com TypeBox para validação automática
- Toda resposta tem `response` definido para garantir contrato com mobile
- Eden Treaty exportado para o mobile via `packages/shared/`

Gotcha: Bun ainda tem incompatibilidades com algumas libs Node antigas. Para qualquer lib nova, testar o import primeiro em REPL Bun antes de adicionar ao código.

### 2.4 Claude API (IA do produto, não Claude Code)

- **SDK**: `@anthropic-ai/sdk` versão mais recente
- **Modelo padrão**: `claude-sonnet-4-6` (string exata: `claude-sonnet-4-6`)
- **Fallback**: nenhum no MVP. Se Claude falhar, retorna erro humanizado e marca o job como `failed`.

```bash
bun add @anthropic-ai/sdk
```

Padrão de uso:
```ts
// apps/api/src/claude/client.ts
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Toda chamada que gera plano passa por aqui:
export async function generatePlan(input: PlanInput): Promise<PlanResponseValidated> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT_V1, // inclui principios_treino.md
    messages: [{ role: 'user', content: formatBriefing(input) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = PlanResponseSchema.parse(JSON.parse(extractJSON(text))); // Zod
  const guarded = applyGuardrails(parsed); // ACWR ≤ 1.30, progressão ≤ 10%
  return guarded;
}
```

Regras não negociáveis:
- **Sempre** Zod no boundary da resposta (RF-027)
- **Sempre** guardrails determinísticos depois do parse (RF-028)
- **Hard cap** 30 chamadas/atleta/mês (RF-032) — checa em tabela `claude_usage` antes de chamar
- Prompts **versionados em git** — incrementa versão (`plan_v2.ts`) e loga em `plan_history.prompt_version`

### 2.5 Supabase (banco + auth + vault)

- **Plano**: Free no Pré-MVP, migra para Pro (~R$125/mês) na Fase 2
- **Região obrigatória**: `sa-east-1` (São Paulo) — LGPD
- **Postgres**: 15+ (default do Supabase)
- **Extensões habilitadas**: `pgcrypto`, `uuid-ossp`, `pg_trgm`

```bash
bun add @supabase/supabase-js
```

Padrões obrigatórios:
- Auth: Supabase Auth nativo (Google + Apple). **Não** rolar nosso próprio auth.
- Tokens Garmin: **sempre** em Supabase Vault, nunca em coluna texto plano.
- RLS (Row-Level Security): habilitada em **toda** tabela de produção. Política base: `auth.uid() = athlete_id`.
- Backups: `pg_dump` semanal para Cloudflare R2 (cron Railway) — RF-036.

Schema inicial (migration `001_initial.sql`):
```sql
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table athletes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  email text not null,
  birth_year smallint not null,
  weight_kg numeric(5,2) not null,
  sex text not null check (sex in ('M','F','other')),
  modality text not null default 'running',
  weekly_frequency text not null,
  timezone text not null default 'America/Recife',
  goal_mode text not null check (goal_mode in ('race','general_progression')),
  race_date date,
  race_distance_km numeric(5,2),
  calibration_mode boolean not null default true,
  created_at timestamptz not null default now()
);

create table workouts (...);
create table plans (...);
create table plan_history (...);
create table jobs (...);
create table consents (...);
create table feedback (...);
create table metrics_daily (...);
create table claude_usage (athlete_id uuid, month date, call_count int);
create table guardrail_violations (...);
```

Gotcha: Supabase Vault tem latência maior que coluna comum. Cache o token decriptado em memória do processo Bun durante a vida útil da requisição.

### 2.6 Railway (deploy)

- **Região obrigatória**: `sa-east1` (São Paulo)
- **Serviços no MVP**: 2 — Bun API + sidecar Python
- **Custo estimado MVP**: R$ 15–25/mês

Configuração de cada serviço via `railway.json` na raiz do respectivo pacote:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/api/Dockerfile",
    "buildContext": "."
  },
  "deploy": {
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

> O `Dockerfile` tem o stage `prod` como **último** stage — Railway pega ele por padrão sem precisar de `dockerfileTarget`. Não definimos `startCommand` aqui porque o `CMD` do Dockerfile já cuida disso. Mesmo padrão para o sidecar (mudando `dockerfilePath`).

Padrões obrigatórios:
- Deploy automático em push pro `main`
- Variáveis de ambiente em Railway dashboard, **nunca** commitar `.env`
- Rede interna privada entre Bun e sidecar (`http://garmin-sidecar.railway.internal:8000`)
- Cron job nativo do Railway para sync Garmin (60min) e backup pg_dump (semanal)

### 2.7 Docker & docker-compose

> **Histórico**: até abr/2026 Docker estava listado na §4 como "não usar (complexidade desnecessária)". Decisão revisada em **mai/2026** após (a) Rafael já dominar Docker no dia-a-dia, (b) chegada do amigo colaborador exigindo ambiente reprodutível, (c) o sidecar Python ter deps de sistema que variam entre máquinas. Mudança aprovada com ressalva: **Docker é ferramenta de dev e empacotamento de produção; NÃO substitui Railway, NÃO traz Kubernetes, NÃO entra em CI ainda.**

- **Docker Engine**: `27.x+` ou Docker Desktop equivalente
- **docker-compose**: `v2.x` (plugin nativo do Docker, comando `docker compose`)
- **Padrão de imagens base** (fixadas):
  - Bun: `oven/bun:1.2-alpine`
  - Python sidecar: `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`
  - Postgres dev local (opcional): `postgres:15-alpine`

**Arquitetura dos Dockerfiles (multi-stage)**

Cada serviço tem **um único `Dockerfile` com targets `dev` e `prod`** — não criar `Dockerfile.dev` separado. Isso garante que o que roda local e o que roda em produção compartilham as mesmas camadas base.

```
apps/api/Dockerfile                 # targets: deps → dev / prod
services/garmin-sidecar/Dockerfile  # targets: base → dev / prod
docker-compose.yml                  # raiz — orquestra dev local
.dockerignore                       # raiz — exclui node_modules, .git, etc.
```

**Build context é sempre a raiz do monorepo** (não a pasta do serviço) — necessário pra resolver workspaces Bun e copiar `packages/shared` e `packages/metrics` na imagem da api.

**Banco local em dev**

O `db` (Postgres 15-alpine) fica no `docker-compose.yml` sob o profile `with-db` — opcional. Por padrão, dev local conecta no Supabase remoto (`sa-east-1`). Levantar com:

```bash
docker compose --profile with-db up        # com Postgres local
docker compose up                          # só api + sidecar, banco no Supabase remoto
```

⚠️ **Limitação importante**: Postgres local **não tem Supabase Auth nem Vault**. Use só para testar migrations e queries puras. Pra dev local com auth/vault completo, rodar `supabase start` em paralelo (CLI do Supabase usa Docker também e sobe o stack inteiro local).

**Padrões obrigatórios**:
- Não rodar como root: usar `USER bun` (api) e usuário não-privilegiado (sidecar) no target `prod`
- Não copiar `.env` para a imagem — variáveis vêm em runtime via `env_file` (dev) ou Railway dashboard (prod)
- Healthcheck em todo serviço (`HEALTHCHECK` no Dockerfile + `healthcheck` no compose)
- `.dockerignore` exclui: `node_modules`, `.git`, `.env*`, `*.log`, `coverage/`, `dist/`, `.expo/`, `.next/`, `__pycache__/`, `.venv/`

**Trigger pra trocar Nixpacks por Dockerfile no Railway**

~~Decidido em **mai/2026**: trocar imediatamente.~~ A partir do Pré-MVP, `railway.json` de **todos** os serviços usa `"builder": "DOCKERFILE"` com `dockerfilePath` apontando pro Dockerfile do serviço. Nixpacks **não** é mais usado. Ver §2.6 atualizada.

**Gotchas**:
- Bun em Alpine ocasionalmente tem problemas com binários nativos (ex: `node-gyp` deps). Se aparecer, trocar para `oven/bun:1.2` (Debian-based) — paga em ~30MB de imagem mas resolve.
- `uv` na imagem oficial já vem como `/usr/local/bin/uv`. Não rodar `pip install uv` em cima.
- Volumes nomeados (`fitsync-pgdata`) **persistem entre `docker compose down` e `up`**. Para reset total: `docker compose down -v`.
- M1/M2 Mac: forçar `platform: linux/amd64` no compose se a imagem da Railway for amd64 e você quiser paridade total — caso contrário, deixar nativo arm64 (mais rápido).

---

## 3. Camada evolutiva — Fase 1 (MVP)

### 3.1 Python sidecar Garmin

- **Python**: `3.11+` (3.12 preferido)
- **FastAPI**: `0.115+`
- **`python-garminconnect`**: **versão exata travada após validação no Pré-MVP**. Em maio 2026, a versão estável é `0.3.x` (atualizada em abril 2026 com suporte ao SSO mobile DI OAuth).
- **uv** como gerenciador de pacotes (preferido a poetry/pip)

Scaffold:
```bash
cd services/garmin-sidecar
uv init --python 3.12
uv add fastapi 'uvicorn[standard]' pydantic python-garminconnect cryptography
uv add --dev pytest pytest-asyncio httpx
```

Estrutura:
```
services/garmin-sidecar/
├── pyproject.toml
├── app/
│   ├── main.py               # FastAPI app
│   ├── routes/
│   │   ├── auth.py           # POST /auth (login Garmin)
│   │   ├── metrics.py        # GET /metrics (lê HRV, training readiness, etc.)
│   │   └── workout.py        # POST /workout (envia treino estruturado)
│   ├── garmin/
│   │   └── client.py         # wrapper de python-garminconnect
│   └── models.py             # pydantic schemas
└── tests/
```

Padrões obrigatórios:
- **3 endpoints e mais nada**. Se aparecer ideia de quarto endpoint, parar e perguntar antes.
- Tokens DI OAuth do Garmin chegam do Bun (criptografados), são decriptados localmente no sidecar para a requisição e descartados ao final.
- Nunca persiste estado: o sidecar é stateless. Toda chamada vem com contexto necessário no body.
- Logs filtram credenciais via regex configurado no logger do FastAPI.

Endpoints essenciais (vão no `principios_treino.md`):
- `POST /auth` — body: `{ email, password, mfa_code? }`; retorna `{ di_token, refresh_token, expires_at }`
- `GET /metrics?date=...&days=...` — header `X-Garmin-Token: <di_token>`; retorna métricas normalizadas
- `POST /workout` — body: `{ token, workout: { type: "run", steps: [...] }, schedule_date }`; usa `upload_running_workout()` + `schedule_workout()`

Gotcha crítico: a Garmin **já mudou o SSO 2 vezes** (nov/2024 e mar/2026). Toda mudança quebra a lib. Quando isso acontece, atualizar a lib é a primeira ação — o resto do sistema fica intocado.

### 3.2 Filas: Postgres-as-queue

**Sem BullMQ no MVP**. Tabela `jobs` no Postgres é suficiente para 2–10 atletas com geração esporádica.

Schema:
```sql
create table jobs (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid references athletes(id) on delete cascade not null,
  type text not null check (type in ('plan_generate','plan_replan','feedback_generate')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts int not null default 0,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index jobs_pending_idx on jobs (status, created_at) where status = 'pending';
```

Worker simples no Bun:
```ts
// roda a cada 10s via setInterval (suficiente no MVP)
const { data: job } = await supabase.rpc('claim_next_job'); // FOR UPDATE SKIP LOCKED
if (job) await processJob(job);
```

Trigger de migração para BullMQ: P95 de geração > 3s **ou** 30+ atletas ativos/dia (Fase 2).

### 3.3 Observability — Fase 1

**Mínimo viável**: `console.log` estruturado + Railway logs nativo.

Logger:
```ts
// apps/api/src/lib/logger.ts
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.di_token', '*.email', '*.refresh_token'],
    censor: '[REDACTED]',
  },
});
```

Sem Sentry no MVP. **Trigger para adicionar**: ao adicionar o segundo atleta (João Eduardo). RF de adição: 2–3 horas de trabalho.

### 3.4 Lint, format, testes — toolchain transversal

- **Biome**: `1.9+` (substitui ESLint + Prettier — mais rápido em Bun)
- **Husky**: `9.x` para git hooks
- **Vitest**: `2.x` para testes TS
- **pytest**: `8.x` para testes Python

```bash
bun add -d -w @biomejs/biome husky vitest @vitest/coverage-v8
bunx biome init
bunx husky init
```

`biome.json` raiz:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true, "suspicious": { "noExplicitAny": "error" } }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "trailingCommas": "all" } }
}
```

Pre-commit hook (`.husky/pre-commit`):
```bash
bun run check && bun run test --run
```

GitHub Actions (`.github/workflows/ci.yml`) — **buildar via Docker e testar dentro dos containers** (cache GHA pra acelerar):
```yaml
name: CI
on: [push, pull_request]
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build api (dev target)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          target: dev
          load: true
          tags: fitsync-api:test
          cache-from: type=gha,scope=api
          cache-to: type=gha,mode=max,scope=api
      - name: Lint + test api
        run: docker run --rm fitsync-api:test sh -c "bun run check && bun run test"

  sidecar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build sidecar (dev target)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: services/garmin-sidecar/Dockerfile
          target: dev
          load: true
          tags: fitsync-sidecar:test
          cache-from: type=gha,scope=sidecar
          cache-to: type=gha,mode=max,scope=sidecar
      - name: Test sidecar
        run: docker run --rm fitsync-sidecar:test uv run pytest

  prod-build-check:
    runs-on: ubuntu-latest
    needs: [api, sidecar]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build api prod (validação)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          target: prod
          cache-from: type=gha,scope=api-prod
          cache-to: type=gha,mode=max,scope=api-prod
      - name: Build sidecar prod (validação)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: services/garmin-sidecar/Dockerfile
          target: prod
          cache-from: type=gha,scope=sidecar-prod
          cache-to: type=gha,mode=max,scope=sidecar-prod
```

> Por que esse layout: (1) builda e testa as imagens `dev` em paralelo (api + sidecar como jobs separados), (2) `prod-build-check` garante que o stage `prod` builda limpo antes de Railway tentar deployar, (3) cache GHA com scopes separados evita poluição entre serviços. Não pushamos imagens pra registry — Railway rebuilda no deploy.

---

## 4. O que NÃO usar (decisões já tomadas)

Esta seção evita que Claude Code "sugira melhorias" trazendo libs descartadas.

| Não usar | Por quê | Alternativa atual |
|---|---|---|
| **Node.js** | Padrão Bun + alinhamento Anthropic | Bun runtime |
| **Express / Fastify / Hono** | Elysia tem type safety ponta-a-ponta com TypeBox + Eden Treaty | Elysia |
| **Clerk / Auth0** | Vendor lock-in, custo alto | Supabase Auth |
| **Better Auth** | Avaliado, fica para futuro se Supabase Auth limitar | Supabase Auth |
| **Firebase / Firestore** | Não relacional, vendor lock-in | Supabase Postgres |
| **MongoDB** | NoSQL não cabe nas queries fisiológicas necessárias | Postgres |
| **Drizzle / Prisma** | Mais complexidade que valor no MVP | `@supabase/supabase-js` queries diretas |
| **Redis (qualquer flavor)** | Fase 2+ (BullMQ trigger explícito) | Postgres-as-queue |
| **BullMQ** | Fase 2+ | Postgres-as-queue |
| **Sentry** | Fase 2+ (trigger: 2º atleta) | Pino + Railway logs |
| **PostHog / Mixpanel / Amplitude** | Fase 2+ (Beta V1) | Metabase no Railway (Fase 2) |
| **AsyncStorage** | Inseguro para tokens | `expo-secure-store` |
| **localStorage / sessionStorage** | **Não existem** em React Native; em artifacts são proibidos | Zustand + SecureStore |
| **React Navigation puro** | Expo Router já abstrai e adiciona deep linking | Expo Router v4 |
| **Redux / Redux Toolkit** | Overkill para o MVP | Zustand |
| **TailwindCSS / NativeWind** | Não adicionado no MVP — design system próprio simples | `StyleSheet.create` ou Restyle se virar dor |
| **GraphQL** | Sem necessidade no MVP | REST + Eden Treaty |
| **~~Docker (em dev)~~** | ~~Complexidade desnecessária; Railway builda direto~~ → **Revisado em mai/2026: agora é núcleo invariável** | Ver §2.7 |
| **Kubernetes** | Não estamos nessa escala | Railway |
| **HealthKit / Health Connect (lib RN)** | Fase 2 | Só Garmin via sidecar |
| **Flutter / Swift nativo / Kotlin nativo** | Reescreveria 100% | React Native + Expo |
| **OpenAI / Gemini / qualquer outro LLM** | Trocar = refazer prompt engineering | Claude Sonnet 4.6 |
| **Antigravity (Google agentic IDE)** | Avaliado e descartado (learning curve vs. 5h/sem) | Claude Code |
| **`garth` (lib Python Garmin)** | Deprecado em 28/03/2026 | `python-garminconnect` 0.3.x |
| **`GarminDB`** | Só análise offline, não faz upload | `python-garminconnect` |
| **Poetry** | uv é mais rápido e moderno | uv |
| **ESLint + Prettier** | Biome substitui ambos com 1 ferramenta | Biome |
| **Jest** | Vitest é mais rápido e roda em Bun nativamente | Vitest |
| **Detox / Maestro (E2E mobile)** | Fase 2 — não cabe nas 5h/sem do MVP | Smoke test manual |

Quando em dúvida se uma lib está nessa lista: **perguntar antes de adicionar**.

---

## 5. Migrações futuras — não implementar ainda

Lista do que vem em cada fase, **com trigger explícito**. Claude Code não deve adicionar nada disso sem o trigger ser atingido **e** o Rafael confirmar.

### Fase 2 (10–100 atletas)

| Adicionar | Trigger objetivo | Esforço |
|---|---|---|
| `@kingstinct/react-native-healthkit` | 1º pedido de atleta não-Garmin (iOS) | 5–7 dias |
| `react-native-health-connect` | 1º pedido de atleta não-Garmin (Android) | 5–7 dias |
| BullMQ + Upstash Redis | P95 geração > 3s OU 30+ atletas/dia | 1–2 dias |
| Sentry (mobile + backend + sidecar) | Imediato ao adicionar 2º atleta | 2–3 horas |
| Logflare | Quando precisar buscar log de evento específico | 2–3 horas |
| PostHog free | Início do Beta V1 (semana 9+) | 1 dia |
| Metabase self-hosted no Railway | Início do Beta V1 | 1 dia |

### Fase 3 (100+ atletas)

| Adicionar | Trigger objetivo | Esforço |
|---|---|---|
| Garmin Training API oficial | 100+ atletas pagantes ativos | 4–6 semanas (aprovação) |
| Redis cache (hot data) | P95 Postgres > 100ms OU custo Postgres > 30% total | 2–3 dias |
| TimescaleDB extension | Tabela `workouts` > 1M rows OU query histórica > 500ms | 1 dia |
| Fly.io multi-região | Atendimento internacional (improvável < 1k atletas) | Decidir na época |
| Maestro E2E mobile | Fase 2 madura | 1 semana setup |
| Cloudflare WAF | Receita previsível | 1 dia |

---

## 6. Cheatsheet — comandos mais usados

```bash
# Setup zero do projeto (uma vez)
bun create elysia apps/api
bunx create-expo-app apps/mobile
mkdir -p services/garmin-sidecar packages/{shared,metrics,ui}

# Dev diário
bun run dev                                # turbo: mobile + api + sidecar paralelo
bun --filter mobile dev                    # só Expo (com QR code)
bun --filter api dev                       # só Bun watch
cd services/garmin-sidecar && uv run uvicorn app.main:app --reload --port 8000

# Adicionar dep
bun add <pkg> --filter mobile              # adiciona só no mobile
bun add <pkg> --filter api                 # adiciona só na api
bun add -w <pkg>                           # adiciona na raiz (toolchain compartilhada)
cd services/garmin-sidecar && uv add <pkg>

# Testes
bun run test                               # todos os pacotes JS/TS
bun --filter metrics test --coverage       # cobertura específica
cd services/garmin-sidecar && uv run pytest -v

# Lint / format
bun run check                              # biome check
bun run format                             # biome format --write

# DB
bun --filter api run db:migrate            # aplica migrations
bun --filter api run db:generate <name>    # nova migration

# Deploy
git push origin main                       # deploy automático Railway
railway logs --service api                 # tail dos logs em prod
railway logs --service garmin-sidecar

# Docker dev local
docker compose up --build                  # sobe api + sidecar (Supabase remoto)
docker compose --profile with-db up        # idem + Postgres local
docker compose down                        # para os containers
docker compose down -v                     # idem + apaga volumes (reset total)
docker compose logs -f api                 # tail dos logs de um serviço
docker compose exec api sh                 # shell dentro do container api

# Docker — build/test produção localmente
docker build --target prod -t fitsync-api:prod -f apps/api/Dockerfile .
docker build --target prod -t fitsync-sidecar:prod -f services/garmin-sidecar/Dockerfile .
docker run --rm -p 3000:3000 --env-file .env fitsync-api:prod  # smoke test
```

---

## 7. Variáveis de ambiente

Lista canônica. Tudo no `.env` local (não commitado) e no Railway dashboard em produção.

```dotenv
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...                  # backend only, nunca no mobile
SUPABASE_VAULT_KEY_NAME=garmin_tokens

# Sidecar (Bun → sidecar interno)
GARMIN_SIDECAR_URL=http://garmin-sidecar.railway.internal:8000

# Expo
EXPO_PUBLIC_API_URL=https://api.fitsync.app  # mobile chama isso

# Cloudflare R2 (backups)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=fitsync-backups

# Resend (suporte por email)
RESEND_API_KEY=re_...

# Misc
LOG_LEVEL=info
NODE_ENV=production

# Docker dev local (opcional — só quando rodar `docker compose --profile with-db up`)
DATABASE_URL=postgres://postgres:postgres@db:5432/fitsync
```

Regra: nenhuma chave começando com `EXPO_PUBLIC_` pode conter segredos. **Tudo** com `EXPO_PUBLIC_` vai pro bundle do app e fica visível para qualquer pessoa que extraia o `.ipa`/`.apk`.

---

## 8. Quando este arquivo deve ser atualizado

- **Sempre que**: uma versão de lib do núcleo invariável muda (raro — exige aprovação Rafael)
- **Sempre que**: um trigger de Fase 2/3 é atingido e a migração começa (mover item da seção 5 para a seção apropriada)
- **Sempre que**: uma lib é avaliada e descartada (adicionar à seção 4 com razão)
- **Mensalmente**: revisar versões da seção 2 (uma vez por mês, ver se há patches críticos de segurança)

Atualização sempre via PR com mensagem `docs(stack): <motivo>` e revisão do Rafael.

---

## 9. Como o Claude Code deve usar este arquivo

1. **Antes de adicionar qualquer dependência**: conferir se está listada aqui. Se sim, usar versão fixa. Se não, perguntar antes de instalar.
2. **Antes de propor uma alternativa "melhor"**: conferir a seção 4 (Não usar). Se está lá, não sugerir.
3. **Ao gerar comandos de setup**: copiar dos blocos `bash` acima sem alterar.
4. **Ao gerar configurações** (biome.json, railway.json, schemas SQL, etc.): usar os templates acima como base.
5. **Quando o Rafael perguntar "que lib eu uso para X"**: responder direto consultando seção 2 e 3. Não inventar.

Quando este documento e a documentação oficial de uma lib discordarem em algo crítico (versão, sintaxe), **parar e perguntar** — pode ser que o documento esteja desatualizado, ou pode ser que a doc oficial mudou e precisamos travar a versão.

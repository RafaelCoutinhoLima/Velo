# CLAUDE.md — Orquestração do Claude Code para o FitSync AI

> Este arquivo é lido pelo Claude Code no início de cada sessão. Ele estabelece o **contexto**, as **regras de engenharia** e os **modos de trabalho** que tornam o vibe coding produtivo e consistente.
>
> **Para mim, Claude**: sempre que iniciar uma nova sessão, leia este arquivo inteiro **antes** de tocar em qualquer código. Quando tiver dúvida sobre escopo, prioridade ou stack, **pergunte ao Rafael** em vez de assumir.

---

## 1. O que é o FitSync AI

Aplicativo mobile de treino para corrida e triathlon, com IA gerando planos semanais adaptativos a partir de dados de wearable (Garmin) e métricas fisiológicas (ACWR, rTSS, HRV, decoupling Pa:HR).

**Status atual**: MVP em **Scenario A** — portfolio + dogfooding pessoal do Rafael. Sem usuários externos pagantes ainda. **Running only**. 8 semanas de chronograma.

**Dois propósitos paralelos**:
1. Peça de portfolio do Rafael (dev iniciante / intern)
2. Ferramenta real de treino do Rafael (triatleta iniciante 70.3 em formação)

---

## 2. Contexto operacional

- **Time**: Rafael (proprietário, dev iniciante) + 1 amigo desenvolvedor colaborador
- **Capacidade real**: ~5h/semana cada, **~10h/semana total**
- **Localização**: Recife, PE — fuso `America/Recife` (UTC−3, sem horário de verão)
- **Língua principal**: português brasileiro. **Toda interface, mensagens de erro, prompts ao Claude e documentação geram em pt-BR**. Comentários de código e nomes de variáveis em inglês (padrão da comunidade).
- **Disciplina não negociável**: scope discipline. Rafael já cortou de 105 para 81 story points (Scenario B → Scenario A). Nada novo entra sem cortar algo equivalente.

---

## 3. Stack — invariável vs. evolutiva

### 3.1 Núcleo invariável (não mudar sem decisão arquitetural)

| Camada | Tech | Por quê |
|---|---|---|
| Mobile | React Native + Expo + TypeScript | Discord/Coinbase/Bluesky em produção |
| Roteamento | Expo Router v4 | File-based, deep linking nativo |
| Estado servidor | TanStack Query | Cache, refetch, offline |
| Estado local | Zustand | 1KB, leve, padrão da indústria |
| Backend principal | Bun + Elysia (TS) | TypeBox + Eden Treaty para type safety ponta-a-ponta |
| IA | Claude API — `claude-sonnet-4-6` | Trocar = refazer prompts |
| Banco + Auth + Vault | Supabase (Postgres) na região `sa-east-1` | LGPD |
| Deploy | Railway na região `sa-east1` | Sem cold start, custo previsível |

### 3.2 Camada evolutiva (Fase 1 do MVP)

| Camada | Tech atual MVP | Migração futura |
|---|---|---|
| Garmin | Sidecar Python + FastAPI + `python-garminconnect` v0.3.x | Garmin Training API oficial em Fase 3 (100+ usuários) |
| Filas | Postgres-as-queue (tabela `jobs`) | BullMQ + Upstash Redis em Fase 2 (P95 >3s ou 30+ atletas) |
| Observability | Console + Railway logs | Sentry + Logflare em Fase 2 |
| Wearables | Garmin only | HealthKit + Health Connect em Fase 2 |

**Princípio**: tudo que está no núcleo invariável não é tocado sem conversa com Rafael. Tudo que está na camada evolutiva tem **trigger explícito** para migrar (ver `FitSync_AI_Stack_Evolutiva_v2.pdf` §4).

---

## 4. Estrutura do monorepo

```
fitsync-ai/
├── apps/
│   ├── mobile/                # Expo + React Native
│   │   ├── app/               # Expo Router (file-based)
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/               # TanStack Query, Zustand stores
│   │   └── app.json
│   └── api/                   # Bun + Elysia
│       ├── src/
│       │   ├── routes/        # endpoints organizados por domínio
│       │   ├── claude/        # cliente Claude + prompts + guardrails
│       │   ├── garmin/        # cliente HTTP para o sidecar
│       │   └── db/            # queries Postgres (via @supabase/supabase-js)
│       └── package.json
├── services/
│   └── garmin-sidecar/        # Python + FastAPI
│       ├── app/
│       │   ├── routes/        # /auth, /metrics, /workout
│       │   └── garmin/        # wrapper de python-garminconnect
│       └── pyproject.toml
├── packages/
│   ├── shared/                # Zod schemas, tipos compartilhados
│   ├── metrics/               # cálculo rTSS, ATL, CTL, ACWR, decoupling — 100% Vitest
│   └── ui/                    # componentes de design compartilhados
├── docs/
│   ├── principios_treino.md   # base científica injetada no prompt Claude
│   ├── user-stories.md
│   ├── backlog.md
│   └── CLAUDE.md              # este arquivo
├── docker-compose.yml         # orquestra dev local (api + sidecar + db opcional)
├── .dockerignore              # exclui node_modules, .git, .env, etc.
├── biome.json
├── package.json               # Bun Workspaces
└── README.md
```

> **Sobre Dockerfiles**: cada serviço com runtime próprio tem seu `Dockerfile` (multi-stage, targets `dev` e `prod`):
> - `apps/api/Dockerfile` — Bun + Elysia
> - `services/garmin-sidecar/Dockerfile` — Python + FastAPI + uv
>
> Mobile (Expo) **não** tem Dockerfile — build via EAS Build na nuvem.

---

## 5. Regras de engenharia

### 5.1 Antes de codar

1. **Leia a user story relacionada** em `docs/user-stories.md`. Critérios de aceite são o contrato.
2. **Confirme o sprint atual** em `docs/backlog.md`. Se a story não está no sprint corrente, peça confirmação ao Rafael antes de começar.
3. **Olhe o que já existe**. Antes de criar um arquivo novo, faça grep e veja se há componente/função reusável.
4. **Quebre em commits pequenos**: cada commit deve fazer uma coisa e ter mensagem em Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).

### 5.2 TypeScript

- `strict: true` em todos os tsconfigs. Sem `any` exceto em boundary justificado com comentário.
- Prefere **inferência** a anotações redundantes. Anota retorno de função exportada e de função >10 linhas.
- Schemas Zod **no boundary** (entrada HTTP, saída Claude, leitura do sidecar) — sempre. Tipos TS derivados via `z.infer<typeof Schema>`.
- Eden Treaty para chamadas mobile → api (type safety ponta-a-ponta).

### 5.3 Python (sidecar)

- Python 3.11+. Tipagem com `typing` em toda função pública.
- `pydantic` v2 para schemas. FastAPI usa pydantic nativo.
- Dependências fixadas em `pyproject.toml` (uv preferido a poetry). `python-garminconnect` na versão exata testada no Pré-MVP.
- Nunca logar credenciais Garmin ou tokens. Filtros de log obrigatórios.

### 5.4 Testes

- **`packages/metrics/`**: 100% de cobertura Vitest. Fixtures de regressão com workouts reais do Rafael (anonimizados).
- **Endpoints HTTP**: testes de integração com Bun test runner — pelo menos o happy path + 1 erro por endpoint.
- **Sidecar Python**: pytest com mock do `python-garminconnect`.
- **Mobile**: smoke test manual obrigatório (DoD em `backlog.md`). Não invistir em testes E2E (Maestro) no MVP — agendado para Fase 2.

### 5.5 Banco de dados

- Migrations versionadas em `apps/api/db/migrations/` — uma migration por mudança, nunca editar migrations antigas.
- Toda coluna com dados sensíveis (token Garmin, email) usa `pgcrypto`/Supabase Vault — nunca texto plano.
- Indexes em `athlete_id` em **toda** tabela com FK pra `athletes` (essencial pra performance e RLS futura).
- Postgres-as-queue: tabela `jobs` com `status` (`pending|running|done|failed`) e `attempts`. Worker simples no Bun lê via `SELECT ... FOR UPDATE SKIP LOCKED`.

### 5.6 Segurança e LGPD

- Tokens Garmin **sempre** criptografados via Supabase Vault.
- Logs **não** podem conter PII (email, nome) — usar `athlete_id` (UUID) sempre.
- Dados em região `sa-east-1` (SP) — não criar buckets/databases em outras regiões.
- Disclaimer LGPD no onboarding (RF-029) é obrigatório antes de qualquer chamada Claude.
- Endpoints `DELETE /me` e `GET /me/export` precisam funcionar antes do Sprint 5 acabar (RF-034, RF-035).

### 5.7 Claude API — uso de IA dentro do produto

Não confundir com Claude Code (a ferramenta de desenvolvimento).

- Modelo padrão: `claude-sonnet-4-6` (sem fallback no MVP).
- **Schema validation Zod** na resposta — sempre (RF-027). Se schema falha, regenera silenciosamente (max 2x), depois marca job como `failed`.
- **Guardrails determinísticos no backend Bun** — independentes da resposta Claude (RF-028):
  - ACWR ≤ 1.30 (computado depois do plano, regenera se viola)
  - Progressão semanal ≤ 10%
  - Nunca dois estímulos altos (Z4–Z5) em dias consecutivos sem recuperação
- **Hard cap**: 30 chamadas Claude por atleta por mês (RF-032). Counter em tabela `claude_usage`.
- **Prompt versionado em git** — `apps/api/src/claude/prompts/plan_v{N}.ts`. Cada mudança incrementa versão e fica logada na tabela `plan_history`.
- **Base científica em `docs/principios_treino.md`** é o contexto injetado no system prompt. Mudanças nesse arquivo requerem revisão dupla (Rafael lê + Claude Code valida estrutura).

### 5.8 Comunicação com o atleta (copy)

- **Tom**: treinador no WhatsApp — direto, caloroso, nunca punitivo. Nunca usar termos médicos (ACWR, decoupling, Pa:HR) sem traduzir.
- **Feedbacks pós-treino**: referenciam dados específicos do treino, nunca genéricos. *"Seu pace caiu 8s/km comparado com a semana passada"* em vez de *"Bom trabalho!"*.
- **Erros**: nunca técnicos. *"Tive um problema técnico, já avisamos a equipe"* em vez de stack trace.

---

## 6. Workflows — como o Rafael e o Claude Code trabalham juntos

### 6.1 Início de sessão

```
Rafael: "Hoje vou trabalhar em [story]"
Claude: lê CLAUDE.md → lê a story em user-stories.md → confirma sprint atual em backlog.md →
         propõe um plano de ação em 3–5 passos antes de tocar em código
```

### 6.2 Implementação de uma story

1. Claude propõe os arquivos que serão criados/modificados (sem código ainda)
2. Rafael aprova
3. Claude implementa em commits pequenos, narrando o que está fazendo
4. Após implementar, Claude roda testes localmente e relata o resultado
5. Se algo na story está ambíguo, **pergunta** — não decide sozinho

### 6.3 Quando Claude deve pausar e perguntar

- Decisão arquitetural não coberta neste arquivo (nova lib, mudança no schema, mudança em prompt)
- Conflito entre story e algo já implementado
- Tarefa que claramente vai estourar a estimativa do sprint
- Sugestão de cortar SHOULD ou COULD — sempre confirma antes

### 6.4 Quando Claude pode decidir sozinho

- Nome de variável/função (segue convenção)
- Estrutura interna de um componente quando os critérios de aceite são claros
- Refator local sem mudar API
- Adicionar teste de regressão para bug encontrado
- Atualizar docstring/comentário inline

### 6.5 Code review por Claude

Quando Rafael pedir "revisa esse código":
- Verificar: types, error handling, edge cases, segurança LGPD, alinhamento com critérios de aceite
- **Não** sugerir refator estilístico se o código funciona — Scenario A é portfolio em prazo apertado, não código aberto público
- Apontar 1–3 melhorias prioritárias, não uma lista de 15 nits

---

## 7. Comandos essenciais

```bash
# Setup inicial (1x — instala deps no host pra IDE/intellisense funcionar)
bun install                                      # workspaces Bun
cd services/garmin-sidecar && uv sync            # deps Python
cp .env.example .env                             # configurar chaves locais

# Dev — Docker é o caminho padrão sempre
docker compose up --build                        # api + sidecar (banco no Supabase remoto)
docker compose --profile with-db up              # idem + Postgres local em container
docker compose logs -f api                       # logs de um serviço específico
docker compose down                              # para todos os containers
docker compose down -v                           # idem + apaga volumes (reset total)
docker compose exec api sh                       # shell dentro do container api

# Mobile — exceção: roda no host (Expo precisa USB/QR direto)
bun --filter mobile dev                          # Expo Dev Client

# Lint + test — dentro dos containers (mesmo ambiente do CI)
docker compose exec api sh -c "bun run check && bun run test"
docker compose exec garmin-sidecar uv run pytest

# Migrations
docker compose exec api bun run db:migrate
docker compose exec api bun run db:generate <nome>

# Build/test produção localmente (smoke antes de push pro main)
docker build --target prod -t fitsync-api:prod -f apps/api/Dockerfile .
docker build --target prod -t fitsync-sidecar:prod -f services/garmin-sidecar/Dockerfile .
docker run --rm -p 3000:3000 --env-file .env fitsync-api:prod

# Deploy — automático em push pro main (Railway usa DOCKERFILE builder)
git push origin main
railway logs --service api
railway logs --service garmin-sidecar
```

> **Regra única**: dev, CI e produção **todos** rodam dentro de Docker. O único caminho fora de container é Expo no celular (USB/QR) e instalação inicial das deps no host (pra IDE ter intellisense + autocomplete). Qualquer comando que rode lógica da api ou do sidecar passa por `docker compose exec` ou pelas imagens buildadas.

---

## 8. Documentos de referência (em ordem de consulta)

1. **`docs/CLAUDE.md`** (este arquivo) — primeiro a ler
2. **`docs/backlog.md`** — sprint atual, próximas stories, kill criteria
3. **`docs/user-stories.md`** — critérios de aceite por story
4. **`docs/principios_treino.md`** — base científica injetada no Claude. Quando dúvida fisiológica, consultar.
5. **`docs/generation_spec.md`** — spec de geração: schemas (briefing/output), guardrails G1–G10, fallback, prompt feedback, conversão Garmin. Ler antes de mexer em `apps/api/src/claude/` ou `garmin/workoutBuilder.ts`.
6. **`FitSync_AI_PRD_v1.0.md`** — PRD completo. Para detalhes profundos de jornadas, RFs, riscos, métricas.
7. **`FitSync_AI_Stack_Evolutiva_v2.pdf`** — quando avaliar adição de nova lib/serviço, ver se cabe na Fase atual.
8. **`FitSync_AI_Wearable_Integration__Garmin_APIs_and_Libraries_Deep_Dive.md`** — referência técnica do `python-garminconnect` (endpoints, autenticação SSO mobile, riscos legais).
9. **`FitSync_AI_Guia_de_Estudos.pdf`** — fisiologia, wearables, produto de saúde. Quando Claude precisa explicar algo sobre treino para Rafael, alinhar com livros listados.

---

## 9. Antipadrões — o que NÃO fazer

- ❌ Adicionar Redis, BullMQ, Sentry, ou outras peças da Fase 2 antes do trigger (PRD §4 e Stack §4)
- ❌ Criar `any` no TypeScript sem comentário justificando
- ❌ Logar emails, nomes, ou tokens Garmin
- ❌ Hardcodar chaves de API em arquivos commitados
- ❌ Pular schema validation Zod no boundary do Claude (RF-027)
- ❌ Quebrar a regra do ACWR ≤ 1.30 mesmo se "esse caso parece ok"
- ❌ Usar `localStorage` no React Native (não existe — usar `expo-secure-store`)
- ❌ Implementar feature de bike/natação no MVP — running only
- ❌ Criar feature B2B2C / coach humano no MVP
- ❌ Adicionar tracking / analytics intrusivo sem consentimento explícito
- ❌ Reescrever o sidecar Python em TypeScript (já avaliado e descartado — sem equivalente da lib)
- ❌ Mudar prompt do Claude sem incrementar a versão em git e logar em `plan_history`
- ❌ Rodar api ou sidecar direto no host fora do compose (drift entre dev / CI / prod). Mobile é a única exceção.
- ❌ Configurar `railway.json` com `"builder": "NIXPACKS"` — decidido em mai/2026 que Railway usa DOCKERFILE builder (ver `claude-stack.md §2.6`).

---

## 10. Quando este arquivo deve ser atualizado

- **Sempre que**: o stack mudar (adicionar nova lib invariável, mudar modelo Claude, etc.)
- **Sempre que**: nova convenção de código for estabelecida
- **No fim de cada sprint**: atualizar a seção 6 com aprendizados (workflows que funcionaram ou não)
- **No fim do MVP**: revisão completa antes de iniciar Beta V1

Atualização **não é** mudança casual. Cada edição deste arquivo é um PR pequeno com mensagem `docs(claude): <motivo>` e revisão do Rafael.

---

## 11. Lembrete final

O FitSync AI prescreve treinos que afetam o corpo de pessoas reais — começando pelo próprio Rafael. Isto não é um app de productividade. Erros de cálculo viram lesão. Erros de copy viram ansiedade. Errors de segurança viram vazamento LGPD.

**Quando em dúvida**: pergunte. Quando certo: implemente com testes. Sempre: respeite o escopo Scenario A.

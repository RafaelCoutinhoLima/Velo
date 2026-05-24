# FitSync AI — Backlog do MVP

> Backlog operacional do MVP em **Scenario A** (portfolio + dogfooding, running only). Janela: **8 semanas** + 2 semanas de pré-MVP. Capacidade: **~5h/semana** (Rafael) + amigo colaborador, modelo vibe coding com Claude Code.
>
> Fonte de detalhamento: `user-stories.md`, `FitSync_AI_PRD_v1.0.md`, `FitSync_AI_Stack_Evolutiva_v2.pdf`.
>
> **Última atualização**: 2026-05-17 — revisão sênior UX/UI mobile. **Bugs corrigidos**: #1 nome do dia da semana (derivava do índice, não da data real de `week_start`); #2 sobreposição do card "Estrutura do treino" (Shadow.elevated duplicado vazava + blocos sem separação); #4 toggle Modo Avançado morto (`advancedMode`/calibração saíram do `profile` sempre-null para campos próprios no store). **Decisão de produto US-017**: histórico Garmin importado passa a contar para a janela de 14 dias (`earliestIso` em `calibration.ts`). Suíte api **65/65**, tsc mobile + export web verdes, biome limpo.
>
> **Pente-fino 2026-05-17 (parte 2)**: `bun audit` 0 vulnerabilidades. **Coverage api 68% → 81% linhas** (decisão do dono: alto-valor primeiro, não 95% global). Cobertos a ~100%: `guardrails.ts` (ACWR≤1.30 e G1–G10, era 6%), `workoutBuilder.ts` (era 11%), `calibration.ts`; rotas `feedback.ts` 97%, `plan.ts` 83%. **109/109 testes verdes**. UX: login com botão Apple gated p/ iOS (drop-off Android); demais itens Mouseflow já implementados (Google 1º, ErrorCard, pickers no onboarding, history, hero card). tsc dos testes: ruído pré-existente reduzido (calibration/garmin); gate do projeto é biome+bun test, não tsc — limpeza completa dos mocks fica como tarefa dedicada. **Exceção de coverage documentada**: cola Claude API (`briefing.ts`/`client.ts`) e `garmin/client.ts` não testados (I/O glue, ROI baixo no Scenario A). **Resta de infra (não-código, p/ Rafael)**: ligar cron Railway em `/metrics` e `/push/rpe-reminders`; teste físico Forerunner (P0-09); validação E2E em device.

---

## Status geral (2026-05-16)

| Sprint | Foco | Progresso | Estado |
|---|---|---|---|
| Pré-MVP | Setup técnico | ~95% | ✅ Concluído |
| Sprint 1 | Onboarding | ~100% | ✅ Concluído |
| Sprint 2 | Plano da semana | ~100% | ✅ Concluído |
| Sprint 3 | Execução + feedback | ~60% | 🔴 Em andamento |
| Sprint 4 | Replanejamento | 0% | ⏳ Não iniciado |
| Sprint 5 | Polimento + LGPD | ~15% | ⏳ Não iniciado |

> ✅ **R-08 resolvido (2026-05-16)**: codebase mobile consolidado no Expo Router (`apps/mobile/`). Features portadas do legado: Teste de Cooper (`onboarding/cooper.tsx` → `POST /onboarding/zones`), botão enviar-pro-relógio (`plan.tsx` → `POST /plan/send-to-garmin`), feedback do treinador inline (`workout/[id].tsx` → `POST /feedback`). Diretório `mobile/` legado **apagado**. Bug pré-existente corrigido de quebra (import `react-native-safe-area-context` inexistente em `workout/[id].tsx`). `feedback.tsx` (contrato quebrado, sem refs) removido.

---

## Princípios do backlog

1. **MoSCoW estrito**: `MUST` corta primeiro nos cortes — não. `SHOULD` é o que cai. `COULD` é bônus.
2. **Story points fixos por sprint**. Se um SHOULD ameaça um MUST, o SHOULD vai para o próximo sprint, sem exceção.
3. **Kill criteria explícitos por sprint**. Antes de iniciar o sprint seguinte, ler o critério e decidir.
4. **Validações técnicas críticas vão para o Pré-MVP**, não para Sprint 1. Não começamos a construir em cima de algo que pode não funcionar.
5. **Dogfooding diário a partir do final do Sprint 3**. O sistema só ganha valor se Rafael correr usando ele.

---

## Estrutura de prioridade (MoSCoW)

| Categoria | O que significa |
|---|---|
| **MUST** | Sem isso o app não funciona. Não corta. |
| **SHOULD** | Diferencial importante. Pode atrasar 1 sprint sem matar o produto. |
| **COULD** | Bônus se sobrar tempo. Não compromete dogfooding. |
| **WON'T (MVP)** | Fora de escopo deliberado. Documentado em `user-stories.md` como referência. |

---

## Pré-MVP — Semanas 0–2 (Setup técnico)

**Objetivo**: ambiente de dev rodando, deploy automático funcionando, validações técnicas críticas confirmadas.

**Estado atual**: ✅ Concluído (~95%). Bloqueio aberto: região do Supabase é `us-east-1` em vez de `sa-east-1` (LGPD pendente — discutir com Rafael antes do Sprint 5).

### Tasks

| # | Task | Prioridade | Status | Observação |
|---|---|---|---|---|
| P0-01 | Monorepo Bun Workspaces com `apps/mobile`, `apps/api`, `services/garmin-sidecar`, `packages/shared`, `packages/metrics` | MUST | ✅ Done | — |
| P0-02 | Biome (lint + format) + Husky (pre-commit) | MUST | ✅ Done | — |
| P0-03 | Vitest no Bun + pytest no sidecar + setup de fixtures | MUST | ✅ Done | — |
| P0-04 | Projeto Supabase em região `sa-east-1` (SP) — LGPD | MUST | ⚠️ Parcial | Projeto criado mas região é `us-east-1`. Pendente migração. |
| P0-05 | Schema inicial Postgres: `athletes`, `workouts`, `plans`, `plan_history`, `jobs`, `consents`, `feedback`, `metrics_daily` | MUST | ✅ Done | Migrations 001–004 aplicadas (003 plan_history+cost, 004 profile zones) |
| P0-06 | pgcrypto + Supabase Vault para tokens Garmin | MUST | ✅ Done | RPCs `store_garmin_token` + `get_garmin_token` em produção |
| P0-07 | Projeto Railway `sa-east1` com 2 serviços (api + sidecar) + rede privada | MUST | ⏳ Pendente | Dockerfiles prontos; Railway ainda não configurado |
| P0-08 | GitHub Actions: build Docker + lint + test + coverage ≥95% | MUST | ✅ Done | CI verde. Job `quality` no host (lint+audit+coverage — Bun não implementa `node:inspector`); Docker só para sidecar pytest + prod-build-check. Playwright E2E (`tests/api/`) cobrindo health/garmin/onboarding/plan/workouts |
| P0-09 | **VALIDAÇÃO CRÍTICA**: `python-garminconnect` v0.3.3 com conta Rafael — SSO, `get_activities()`, `upload_running_workout()`, campo `perceived_effort` | BLOCKER | ⚠️ Parcial | SSO + `get_activities()` OK. Sidecar `upload_workout()` + `schedule_workout()` implementados (`services/garmin-sidecar/app/garmin/client.py`); **falta teste físico no Forerunner do Rafael** — segue como BLOCKER aberto |
| P0-10 | Expo + EAS Build (free tier) + Expo Dev Client no iPhone e Android | MUST | ✅ Done | — |
| P0-11 | Anthropic API key + Claude SDK (modelo `claude-sonnet-4-6`) | MUST | ✅ Done | `max_tokens` corrigido para 8192 |
| P0-12 | Registrar domínio `fitsync.app` + DNS Cloudflare | SHOULD | ❌ Não feito | Baixo impacto no MVP; adiar para Beta |
| P0-13 | Skeleton inicial das telas no Expo Router | MUST | ✅ Done | 6 telas + fluxo de onboarding completo |
| P0-14 | Setup Sentry SDK (instalado, não ativado) | COULD | ❌ Não feito | Fase 2 — não bloqueia MVP |
| P0-15 | Docker multi-stage (`dev`/`prod`) para api + sidecar; `docker-compose.yml`; `railway.json` | MUST | ✅ Done | `docker compose up --build` saudável |

### Kill criteria do Pré-MVP

**Não passa para Sprint 1 se:**
- P0-09 falhar (`python-garminconnect` não consegue enviar workout estruturado pro relógio) → re-arquiteturar antes de qualquer linha de produto.
- **Pipeline Docker quebrado em qualquer etapa** (P0-15): `docker compose up` não saudável em 2 máquinas distintas, OU Railway não deploya via Dockerfile, OU CI Actions vermelho buildando imagens.
- Schema do Postgres ainda não estiver em migrations versionadas.

**Marcos**: ambiente local + remoto rodando, smoke test de auth completo, primeira chamada Claude com resposta válida no log.

---

## Sprint 1 — Onboarding (semanas 3–4)

**Capacidade alvo**: 21 pontos. **Foco**: J1 completa. Sem onboarding nada funciona.

**Estado atual**: ✅ Concluído. Todas as 8 stories implementadas. Pendência menor: OAuth Apple precisa de smoke test físico no iPhone.

### Stories incluídas

| ID | Story | Pts | Prioridade | Status | Observação |
|---|---|---|---|---|---|
| US-001 | Login Google/Apple via Supabase | 2 | MUST | ✅ Done | Google OAuth configurado no Supabase; Apple auth no mobile |
| US-002 | Conectar Garmin via sidecar | 5 | MUST | ✅ Done | `POST /garmin/connect` + garth session no Vault |
| US-003 | Perfil esportivo | 2 | MUST | ✅ Done | `POST /onboarding/profile` + tela. Ampliado: Teste de Cooper (`onboarding/cooper.tsx`, FC máx medida + FC repouso → `/onboarding/zones`), zonas FC + VO2max (migration 004). UI no app canônico ✓ |
| US-004 | Prova alvo ou modo geral | 2 | MUST | ✅ Done | `POST /onboarding/goal` + toggle race/general |
| US-005 | Importar 90 dias do Garmin | 5 | MUST | ✅ Done | `POST /garmin/sync` + upsert em `workouts` |
| US-006 | Primeiro plano síncrono | 3 | MUST | ✅ Done | `POST /plan/generate` + Claude + guardrails |
| US-007 | Primeiro plano async (fallback) | 1 | MUST | ✅ Done | `POST /jobs` + `GET /jobs/:id` Postgres-as-queue |
| US-008 | Disclaimer obrigatório | 1 | MUST | ✅ Done | `POST /onboarding/consent` + 4 cards LGPD |

### Subtarefas técnicas transversais

- [x] Zod schemas no boundary com Claude (RF-027)
- [x] Functions `rTSS`, `ATL`, `CTL`, `ACWR` em `packages/metrics/` com 100% cobertura
- [x] Endpoint `POST /jobs` + `GET /jobs/:id`
- [x] Design system unificado (`apps/mobile/lib/theme.ts` + componentes Button/Input/Card/LoadingScreen/ErrorCard/ConfirmModal)
- [x] **Segurança**: cliente HTTP único (`apps/mobile/lib/api.ts`) injeta `Authorization: Bearer` + timeout 15s (AbortController) em todas as chamadas
- [x] `principios_treino.md` v1 — **criado** em `docs/` (modelo 5 zonas, TID periodizada, ACWR/EWMA, taper, modo calibração). Injetado no system prompt do Claude
- [x] `generation_spec.md` v1.0 — spec completa de geração (briefing/output schemas, guardrails G1–G10, fallback determinístico, prompt feedback)
- [x] Schema rico de plano (superset) implementado: `plan_v3_structured` ativo, `schemas.ts`/guardrails/`workoutBuilder.ts`/sidecar `converters.py` alinhados ao `generation_spec §2.3/§5`
- [x] **Follow-up B**: renderizar estrutura no mobile — `components/WorkoutStructure.tsx` (colapsável: aquecimento / parte principal com séries+recuperação / desaquecimento, chip `rtss_estimado`, `notas_tecnicas` só no Modo Avançado), wired no hero card e nos cards da semana em `plan.tsx`. Tipos espelham `schemas.ts` (opcionais → compat com plano legado). tsc verde
- [ ] **Follow-up B**: enriquecer `briefing.ts` ao `generation_spec §2.2` (perfil/zonas/prontidão completos) — hoje briefing é mais simples que o spec; Fase 2 conforme `generation_spec §8`
- [ ] **Follow-up B**: unificar conversor — **decisão pendente (Rafael)**: análise + recomendação (opção A) em `generation_spec §11`. `workoutBuilder.ts` é o caminho vivo; `converters.py` é fallback inerte mas testado
- [x] Expo Push Notifications — token capturado no `_layout.tsx` ao logar (`lib/push.ts` best-effort) → `POST /push/register` → coluna `athletes.push_token`. Envio via `apps/api/src/lib/push.ts`. Falta só o cron Railway disparar `/push/rpe-reminders`

### Kill criteria do Sprint 1

**Não avança para Sprint 2 se:**
- Rafael não consegue completar o onboarding inteiro em <10min no próprio celular
- O primeiro plano gerado contém violação de guardrail óbvia (ex: 2 intervalados consecutivos sem recuperação)
- Token Garmin **não está criptografado** no Vault (segurança não-negociável)

---

## Sprint 2 — Plano da semana (semanas 4–5)

**Capacidade alvo**: 13 pontos. **Foco**: a tela onde o atleta vive — visualização, drag&drop, métricas opcionais.

**Estado atual**: ✅ Concluído. Tela de plano semanal, drag&drop e modo avançado implementados pelo colaborador (commit `609d652`). Pendência: smoke test drag&drop no Android.

### Stories incluídas

| ID | Story | Pts | Prioridade | Status | Observação |
|---|---|---|---|---|---|
| US-009 | Visualizar plano da semana | 5 | MUST | ✅ Done | 7 dias, cores por tipo, status |
| US-010 | Drag&drop entre dias | 5 | MUST | ✅ Done | `PATCH /plan/move` + guardrail check |
| US-011 | Modo Avançado | 3 | SHOULD | ✅ Done | Tela `metrics.tsx` — ACWR, CTL, TSB |

### Subtarefas técnicas

- [x] Guardrails determinísticos completos (ACWR ≤ 1.30, progressão ≤ 10%) — RF-028
- [x] `plan_history` persistido em jsonb
- [x] Componente `<WorkoutCard>` em `packages/ui/`
- [ ] Cache offline TanStack Query + `@tanstack/query-async-storage-persister` — SDK instalado, não integrado
- [ ] `<PlanDiff>` — não iniciado (necessário para Sprint 4)

### Kill criteria do Sprint 2

- Render do plano >2s P95 → otimizar antes de Sprint 3
- Drag&drop falha em Android (testar no smartphone do amigo colaborador)
- Cortar US-011 se Sprint 1 atrasou — Modo Avançado é SHOULD

---

## Sprint 3 — Execução e feedback (semanas 5–6)

**Capacidade alvo**: 26 pontos. **Foco**: o ciclo recorrente. Aqui o produto fica usável.

**Estado atual**: 🔴 Em andamento (~70%). Métricas completas; feedback Claude implementado (US-016); endpoint enviar-pro-relógio implementado (US-012 backend); **modo calibração US-017 completo** (lógica de saída 14d+30d + banner mobile). Pendentes: teste físico no Forerunner, notificações RPE/push (US-015), cron Railway, consolidação do conversor.

### Stories incluídas

| ID | Story | Pts | Prioridade | Status | Observação |
|---|---|---|---|---|---|
| US-012 | Treino no Garmin automaticamente | 5 | MUST | ⚠️ Parcial | Backend completo: `POST /plan/send-to-garmin`, `garmin/workoutBuilder.ts`, sidecar `upload_workout()`+`schedule_workout()`. Botão UI portado para `apps/mobile/app/(tabs)/plan.tsx` ✓. Falta só teste físico no Forerunner (P0-09) |
| US-013 | Sync automático pós-treino | 3 | MUST | ⚠️ Parcial | Endpoint existe; cron Railway não configurado |
| US-014 | Cálculo determinístico de métricas | 5 | MUST | ✅ Done | `packages/metrics/` 100% Vitest; pipeline Garmin→métricas implementado; detalhe de treino extrai métricas do `raw_payload` |
| US-015 | Captura de RPE | 3 | SHOULD | ✅ Done (cron pendente) | Camada 1 ✓ (sync importa `perceived_effort`). Camada 2 ✓: migração `005_push_token.sql`, `lib/push.ts` (Expo Push, fire-and-forget), `POST /push/register` (token capturado no `_layout.tsx` mobile via expo-notifications), `POST /push/rpe-reminders` (sweep cron-triggered, 1 push/atleta). Camada 3 ✓ (null/sem-token não bloqueia). Push de "calibração concluída" (US-017) também ligado. **Resta só**: ligar o cron Railway no endpoint `/push/rpe-reminders` (infra) + validação física no device. 4 testes em `push.test.ts` |
| US-016 | Feedback humanizado pós-treino | 8 | MUST | ✅ Done | `POST /feedback` com Claude (`prompts/feedback_v1.ts`) + `GET /feedback`. UI inline portada para `apps/mobile/app/workout/[id].tsx` (gera sob demanda, deduplica server-side → respeita hard cap RF-032) ✓ |
| US-017 | Modo calibração 2 semanas | 2 | MUST | ✅ Done | Helper único `apps/api/src/lib/calibration.ts` (`evaluateCalibration`): regra de saída = ≥14 dias de app **E** ≥30 dias de dados (corrige o flip antigo errado de ≥7 datas). Idempotente, persiste + loga "Modo calibração concluído". Chamado no sync Garmin, na geração de plano e em `/plan/current` (flip acontece só abrindo o app). Prompt já injetava calibração (`plan_v3.ts`: Z1/Z2, vol 70%). Mobile: banner permanente + aviso one-time de conclusão (`plan.tsx`). 4 testes novos em `garmin.test.ts`. Notificação push de conclusão depende de US-015 (backend já loga/expõe o evento) |

### Subtarefas técnicas

- [ ] **Cron Railway**: trigger `GET /metrics` a cada 60min → sync automático
- [ ] **Pipeline observável**: log estruturado sync → cálculo → claude → push
- [x] Hard cap 30 chamadas Claude/atleta/mês (RF-032) — tabela `claude_usage` + guard no backend
- [x] Log de violações de guardrail em `guardrail_violations` (RF-031)
- [x] Motor de geração Claude v2: briefing inteligente (`claude/briefing.ts`) + guardrails G1–G10 (`claude/guardrails.ts`) + `prompts/plan_v2.ts` + plano multi-semanas
- [ ] Deep linking push notification validado em iOS + Android
- [x] `principios_treino.md` v1 + `generation_spec.md` v1.0 — contexto científico + spec de geração injetados/contratualizados

### Próximos passos prioritários (Sprint 3)

1. ~~**Consolidar codebase mobile**~~ ✅ **Feito 2026-05-16** — R-08 resolvido, legado apagado
2. **US-012** — teste físico no Forerunner do Rafael (fecha BLOCKER P0-09) (meio dia)
3. **Cron Railway** — configurar trigger de sync a cada 60min (meio dia)
4. **US-015** — Token push notification + captura `perceived_effort` Garmin (1 dia) — *próximo na fila; fecha também a notificação de "calibração concluída" da US-017*
5. ~~**US-017** — Modo calibração~~ ✅ **Feito 2026-05-16**

### Kill criteria do Sprint 3

- Pipeline pós-treino >10min P95 → degradação inaceitável, otimizar antes do Sprint 4
- Feedback gera texto punitivo em qualquer caso → revisão completa do prompt
- **Início do dogfooding diário do Rafael** — se não conseguir treinar usando o produto sozinho, parar e refazer

---

## Sprint 4 — Replanejamento (semanas 6–7)

**Capacidade alvo**: 13 pontos. **Foco**: fechar o ciclo semanal — quando a realidade força replanejamento.

**Estado atual**: ⏳ Não iniciado. Depende do Sprint 3 concluído (especialmente US-016).

### Stories incluídas

| ID | Story | Pts | Prioridade | Status | Observação |
|---|---|---|---|---|---|
| US-018 | Replanejamento automático semanal | 5 | MUST | ❌ Não iniciado | Trigger toda segunda-feira + Claude call |
| US-019 | Replanejamento sob demanda | 3 | SHOULD | ❌ Não iniciado | Botão na tela de plano + rate limit 1x/semana |
| US-020 | Diff visual do plano atualizado | 5 | MUST | ❌ Não iniciado | Componente `<PlanDiff>` + API com versão anterior |

### Subtarefas técnicas

- [ ] Retry exponencial Claude: 30s/2min/5min + mensagem "Tive um problema técnico" (RF-033)
- [ ] Rate limit replan sob demanda: tabela `replan_requests` com timestamp
- [ ] Componente `<PlanDiff>` reutilizável

### Kill criteria do Sprint 4

- Versão antiga do plano não consegue ser recuperada (perda de histórico) → corrigir antes de Sprint 5
- Trigger automático não dispara em segunda-feira → bug crítico

---

## Sprint 5 — Polimento, LGPD, retenção (semanas 7–8)

**Capacidade alvo**: 8 pontos. **Foco**: arestas para o produto poder ser mostrado.

**Estado atual**: ⏳ Não iniciado (~15% — polimento UX adiantado). Stories LGPD (US-021/022) ainda 0%; mas design system trouxe empty states, erros humanizados e telas reais (history/metrics/feedback conectadas) cedo.

### Stories incluídas

| ID | Story | Pts | Prioridade | Status | Observação |
|---|---|---|---|---|---|
| US-021 | Exportar meus dados | 2 | SHOULD | ❌ Não iniciado | CSV+JSON zip via Supabase Storage |
| US-022 | Excluir minha conta | 2 | SHOULD | ❌ Não iniciado | Soft/hard delete + 90 dias retenção |
| US-023 | Streak adaptado FitSync | 2 | COULD | ❌ Não iniciado | Bônus se sobrar tempo |
| US-024 | Conquistas não-gamificadas | 2 | COULD | ❌ Não iniciado | Bônus se sobrar tempo |

### Subtarefas técnicas

- [ ] Backup pg_dump semanal para Cloudflare R2 (RF-036) — cron Railway
- [ ] Timezone configurável persistido no perfil (RF-037) — `date-fns-tz`
- [~] Polimento: empty states + erros humanizados (`ErrorCard`/`LoadingScreen`) feitos no app canônico; micro-animações pendentes
- [x] **Overhaul visual "Performance Dark" (2026-05-16)**: `theme.ts` reescrito (dark, accent lima/cyan, tokens estáveis → propaga p/ todas as telas), shell/tab bar dark, componentes + `WorkoutCard` restilizados. Só visual, zero mudança de lógica. tsc/biome verdes
- [x] **Bloqueadores de dev corrigidos**: assets ausentes no `app.json` (Expo defaults) + SecureStore >2048 bytes (`lib/secureStorage.ts` com chunking, padrão Supabase RN)
- [x] **Validação automatizada (2026-05-16)**: `expo export --platform web` limpo (812 módulos), sweep Playwright headless em 12 rotas com 0 pageerrors, screenshots reais capturados (login, disclaimer, cooper, settings, workout error), handlers reais clicados (accordion, router.replace)
- [x] **Fix fallback web do SecureStore**: `Platform.OS === 'web'` usa `localStorage`; iOS/Android seguem no SecureStore com chunking. Pegou bug `getValueWithKeyAsync is not a function` via Playwright
- [ ] **Follow-up FE**: ícone/splash branded (precisa PNG desenhado); micro-polish por tela com feedback de device (tabular-nums em métricas, micro-animações, haptics); validação device dos fluxos autenticados E2E (gerar plano, enviar-pro-relógio, feedback Claude — requer Supabase+API+credenciais reais)
- [ ] Documentar APIs em `README.md` por pacote
- [ ] Migrar Supabase para região `sa-east-1` (LGPD) — postergado do P0-04

### Kill criteria do Sprint 5

- Sprint 5 é deliberadamente flexível. Se atrasar:
  - **Manter**: US-021 e US-022 (LGPD — alto valor regulatório com baixo custo)
  - **Cortar**: US-023 e US-024 (são COULDs)
- Backup semanal **não** pode ser cortado (proteção contra perda de dados é não-negociável)

---

## Visão geral em 1 tabela

| Sprint | Semanas | Foco | Pts MUST | Pts SHOULD | Pts COULD | Total | Progresso |
|---|---|---|---|---|---|---|---|
| Pré-MVP | 0–2 | Setup | — | — | — | — | ✅ ~95% |
| Sprint 1 | 3–4 | Onboarding | 21 | 0 | 0 | **21** | ✅ 100% |
| Sprint 2 | 4–5 | Plano da semana | 10 | 3 | 0 | **13** | ✅ 100% |
| Sprint 3 | 5–6 | Execução + feedback | 23 | 3 | 0 | **26** | 🔴 ~70% |
| Sprint 4 | 6–7 | Replanejamento | 10 | 3 | 0 | **13** | ⏳ 0% |
| Sprint 5 | 7–8 | Polimento + LGPD | 0 | 4 | 4 | **8** | ⏳ ~15% |
| **TOTAL** | | | **64** | **13** | **4** | **81** | **~72%** |

**Reserva de risco**: se atrasos acumulam, há ~4 pontos em COULDs para sacrificar (US-023, US-024) e ~13 pontos em SHOULDs (US-011, US-015, US-019, US-021, US-022). O caminho crítico de **64 pontos em MUSTs** é o mínimo absoluto.

---

## Riscos do backlog (não dos features)

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R-01 | `python-garminconnect` quebra durante o MVP (Garmin muda SSO de novo) | Média | Crítico | P0-09 valida cedo; código isolado no sidecar; manter dependência atualizada |
| R-02 | Capacidade <5h/semana real do Rafael (intern + estudos) | Alta | Alto | COULDs e SHOULDs já mapeados como cortáveis; vibe coding com Claude Code amplifica tempo |
| R-03 | Amigo colaborador deixa de contribuir | Baixa | Médio | Stack toda em TS exceto sidecar isolado → Rafael consegue tocar sozinho |
| R-04 | Custos Claude API estouram orçamento do MVP | Baixa | Baixo | Hard cap 30 calls/atleta/mês (RF-032); só 2 atletas no MVP |
| R-05 | Mudança no Apple/Google policy força HealthKit antes do esperado | Baixa | Alto | App store submission é V1, não MVP → tempo de reagir |
| R-06 | Bug crítico em cálculo de métricas afeta plano gerado | Média | Alto | 100% cobertura Vitest em `packages/metrics/`; fixtures de regressão |
| R-07 | Supabase em `us-east-1` viola LGPD antes do Sprint 5 | Média | Médio | Aceito temporariamente; migrar para `sa-east-1` no Sprint 5 |
| R-08 | ~~Dois codebases mobile divergentes~~ | — | — | ✅ **RESOLVIDO 2026-05-16**: features portadas para `apps/mobile/` (Cooper, enviar-pro-relógio, feedback inline); `mobile/` legado apagado; type-check + biome verdes |
| R-09 | ~~Divergência de schema plano~~ | — | — | ✅ **RESOLVIDO 2026-05-16 via opção B (superset)**: investigado — não era bug runtime (backend Zod `schemas.ts` ↔ `plan.tsx` já batiam); era drift doc↔código. Adotado **superset compatível**: campos planos mantidos + ricos opcionais (`aquecimento`/`parte_principal`{fc_alvo_bpm,repeticoes,recuperacao}/`desaquecimento`/`rtss_estimado`/`avaliacao`). Prompt `plan_v3_structured`, guardrails usam `rtss_estimado`/`zona_alvo`, `workoutBuilder.ts` gera steps estruturados (repeat/recovery), sidecar `converters.py` + pytest. tsc mobile verde (R-08 preservado) |

---

## Definition of Done (DoD) — checklist por story

Antes de marcar uma story como **Done**:

- [ ] Build verde no GitHub Actions (lint Biome + tests Vitest/pytest passando)
- [ ] Testes unitários para lógica nova (cobertura ≥80% em código novo)
- [ ] Smoke test manual no Expo Dev Client (iOS **E** Android)
- [ ] Critérios de aceite da story todos check
- [ ] Sem `// TODO` crítico no diff
- [ ] Sem credenciais hardcoded (verificado pelo Husky pre-commit)
- [ ] PR mergeada com squash → main → deploy automático Railway
- [ ] Rafael conseguiu **usar a feature** em dogfooding ao menos 1 vez

---

## Para depois do MVP — radar visível

Lista não-trabalhada agora, mantida visível para evitar perder ideias:

- **Beta V1** (semanas 9–12): convidar 5–10 atletas externos, instrumentar PostHog, ativar Sentry (Fase 2 da Stack)
- **HealthKit + Health Connect**: primeiro pedido não-Garmin dispara migração (Fase 2)
- **BullMQ + Upstash Redis**: P95 de geração >3s ou 30+ atletas/dia (Fase 2)
- **Pagamentos**: validar disposição a pagar antes (Van Westendorp + A/B)
- **Multi-modalidade triathlon**: bike + natação na Fase 3
- **Garmin API oficial**: 100+ usuários pagantes na Fase 3

Triggers detalhados: `FitSync_AI_Stack_Evolutiva_v2.pdf` §4.

---

## Cadência operacional

- **Daily**: commit no main com mensagem padrão Conventional Commits + descrição em PT-BR
- **Weekly review (sexta-feira)**: revisar burn-down do sprint, atualizar este arquivo, decidir cortes
- **Sprint review (último dia do sprint)**: avaliar kill criteria, mover stories incompletas para sprint seguinte, atualizar `principios_treino.md` se aprendizado fisiológico veio do dogfooding
- **Conversa com Claude Code**: ler `CLAUDE.md` no início de cada sessão de coding

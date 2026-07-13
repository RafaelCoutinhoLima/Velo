# Rotina de Segurança e Tratamento de Erros — 2026-07-13

## Foco da Madrugada
**Melhoria na Segurança e Tratamento de Erros** — uma das duas categorias que esta rotina
ainda não tinha coberto (a outra é Performance). Os focos recentes foram UI/UX (11/07),
Refatoração (12/07), Testes (PR #3) e Acessibilidade (13/07, execução imediatamente
anterior), então repetir qualquer um deles estava fora de questão. Entre Performance e
Segurança, o diagnóstico do código decidiu: a API já teve uma passada forte de performance
fora da rotina (`45ed5f4` — verificação local de JWT, batching, paralelismo; `eb415f9` —
índices e RLS), e o que sobrou de perf é marginal. Já em tratamento de erros havia um
**bug real de produção**: mensagens de erro escritas para o atleta que nunca chegam a ele
(detalhe no diagnóstico) — mais um endpoint de credenciais sem rate limit. Valor concreto
maior, risco menor.

## Diagnóstico

1. **O `onError` global engole as mensagens curadas em produção** (o achado principal).
   `apps/api/src/index.ts:70-85` devolvia texto genérico ("Tive um problema técnico…")
   para **todo** erro lançado — decisão correta da auditoria de segurança (`988c1cb`)
   para não vazar mensagens cruas de Postgres/Garmin/stack, mas que anulou o fix
   posterior `7d46c3d`, que criou mensagens específicas para o atleta:
   - `routes/garmin.ts:111` — `throw new Error('Sua conexão Garmin expirou. Reconecte o
     Garmin nas configurações.')` → o app mostrava o genérico, e o atleta não sabia que
     precisava reconectar.
   - `routes/garmin.ts:94` — "Garmin não está conectado. Conecte o Garmin primeiro."
   - `routes/garmin.ts:55` — a mensagem curada do sidecar ("credenciais inválidas",
     "muitas tentativas"), repassada de propósito no `/connect`, também sumia.
   - `routes/plan.ts:70/142` — "Atleta não encontrado. Complete o onboarding primeiro."
   - `claude/client.ts:260` — "Limite de 30 gerações por mês atingido" virava 500
     genérico: quem batia na cota mensal achava que o app estava quebrado.

   A evidência de que o bug era invisível aos testes: **todo** arquivo de teste de rota
   monta seu próprio app com `.onError(({ error }) => ({ error: error.message }))`
   (ex.: `routes/garmin.test.ts:207`), então os testes viam a mensagem curada — e até
   asseravam ela (`garmin.test.ts:425` espera "Reconecte o Garmin") — enquanto produção,
   com o `onError` real, devolvia o genérico. O contrato testado não era o contrato
   servido.

2. **`POST /garmin/connect` sem rate limit** (`routes/garmin.ts:35-80`): a rota recebe
   `email` + `password` e repassa ao Garmin via sidecar. Qualquer conta Velo válida
   funcionava como oráculo de credential stuffing contra contas Garmin (tentativas
   ilimitadas), além de arriscar bloqueio do IP do sidecar pelo próprio Garmin. Nenhuma
   rota da API tinha qualquer rate limiting.

3. **Comparação do segredo do cron vulnerável a timing** (`routes/push.ts:64`):
   `headers['x-cron-secret'] !== cronSecret` retorna no primeiro byte diferente —
   oráculo de timing clássico para adivinhar o segredo byte a byte no endpoint
   `POST /push/rpe-reminders`, que dispara push para todos os atletas.

## Arquivos Modificados
- `apps/api/src/lib/errors.ts` (novo — `AppError` + `mapErrorResponse`)
- `apps/api/src/lib/errors.test.ts` (novo — 8 testes)
- `apps/api/src/lib/rateLimit.ts` (novo — fixed-window em memória)
- `apps/api/src/lib/rateLimit.test.ts` (novo — 4 testes)
- `apps/api/src/index.ts` (onError delega a `mapErrorResponse`)
- `apps/api/src/routes/garmin.ts` (AppError + rate limit no `/connect`)
- `apps/api/src/routes/garmin.test.ts` (+2 testes de rate limit)
- `apps/api/src/routes/plan.ts` (AppError nas mensagens curadas)
- `apps/api/src/routes/workouts.ts`, `feedback.ts`, `jobs.ts`, `onboarding.ts` (idem)
- `apps/api/src/routes/push.ts` (comparação timing-safe do `x-cron-secret`)
- `apps/api/src/claude/client.ts` (cota mensal → AppError 429)
- `docs/rotina/2026-07-13-seguranca-tratamento-erros.md` (este relatório)

## Ações Realizadas e Justificativas

1. **`AppError` como canal explícito de mensagem segura** (`lib/errors.ts`): classe de
   erro com `status` HTTP e mensagem curada por construção — quem instancia um `AppError`
   garante que o texto pode ir ao cliente. O `onError` global (`index.ts`) agora repassa
   status+mensagem de `AppError` e mantém **exatamente** o comportamento anterior para
   todo o resto (VALIDATION→400, NOT_FOUND→404, genérico→500 opaco). A postura de
   segurança da auditoria fica intacta: `Error` cru continua nunca vazando — a prova é
   `buildPlan` (`plan.ts`), onde `Falha ao salvar plano: ${saveErr.message}` interpola
   mensagem de Postgres e **permaneceu** `Error` de propósito. A lógica de mapeamento foi
   extraída para `mapErrorResponse()` porque `index.ts` dá `.listen()` no import (não é
   importável em teste); a função pura é testada isoladamente e num app Elysia de
   integração. Verifiquei empiricamente (script descartável) que o Elysia 1.4 respeita
   `error.status` de erros custom, então mantive `status = 500` em todas as conversões
   de mensagens existentes — **zero mudança de código HTTP** nas rotas atuais; as únicas
   respostas novas são os 429 (abaixo). Conversões: 15 `throw new Error(...)` com
   mensagem já curada viraram `AppError` em `garmin.ts`, `plan.ts`, `workouts.ts`,
   `feedback.ts`, `jobs.ts` e `onboarding.ts`.

2. **Cota mensal do Claude vira 429 com a mensagem real** (`claude/client.ts`): "Limite
   de 30 gerações por mês atingido" agora chega ao atleta com status 429 em vez de 500
   "Tive um problema técnico" — cota não é bug, e o copy deixa de gerar suporte falso.

3. **Rate limit no `POST /garmin/connect`** (`lib/rateLimit.ts` + `garmin.ts`): limiter
   fixed-window em memória, 5 tentativas por usuário a cada 15 minutos (cobre erro de
   digitação + fluxo de MFA), estourou → `AppError` 429 com copy no tom do produto. Sem
   Redis de propósito (peça de Fase 2, antipadrão CLAUDE.md §9); instância única no
   Railway torna o in-memory suficiente para o que ele protege (bruteforce, não cota de
   negócio — a cota Claude já é atômica no Postgres). O limiter é criado por instância
   de plugin: produção usa o singleton do módulo (estado efetivo entre requests) e cada
   teste cria o seu (isolamento de graça — mesmo padrão do cache de `internalId`).

4. **Comparação timing-safe do segredo do cron** (`push.ts`): `crypto.timingSafeEqual`
   (com short-circuit apenas no comprimento) no lugar de `!==`. Sem mudança de contrato:
   segredo certo → 200, errado/ausente → 401, como os testes existentes já asseravam.

5. **Testes novos (14)**: `errors.test.ts` cobre o mapeamento puro e um app Elysia de
   integração com o mesmo shape do `onError` de produção — inclusive o caso "mensagem
   interna de Postgres NÃO vaza" e "mensagem curada CHEGA ao cliente", que era o gap
   exato entre teste e produção; `rateLimit.test.ts` cobre janela, chaves independentes,
   expiração e isolamento entre instâncias; `garmin.test.ts` ganhou o cenário de
   credential stuffing (6ª tentativa → 429 com copy correto).

### Verificação
- `bun x tsc --noEmit` em `apps/api`: limpo.
- `bun test` em `apps/api` (com os mesmos placeholders de env do CI): **209 pass, 0
  fail** (195 pré-existentes + 14 novos). Sem env (não há `apps/api/.env` neste
  sandbox), 15 testes de `guardrails.boundaries` falham por cascata de import do
  `db/client` — comportamento idêntico na base `fe7d068`, não relacionado a esta mudança.
- `bun run check` (biome, raiz): limpo.
- Pre-commit (biome + testes de `@fitsync/metrics`) executado no commit.

### Pendências
- **Performance** segue como única categoria nunca coberta pela rotina — candidata
  natural para a próxima execução (junto com o item 3 de Responsividade Mobile pendente
  da trilha de UI/UX, registrado no relatório de 13/07).
- Rate limit é por instância/processo; se a API virar multi-instância (Fase 2), migrar
  para o Redis que entrará com BullMQ.
- `POST /plan/generate` ficou fora do rate limit por já ter dupla proteção (cota mensal
  atômica + timeout/job); se o custo por burst virar problema antes da Fase 2, o
  `createRateLimiter` já está pronto para ser plugado.

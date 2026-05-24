# FitSync AI — User Stories

> Documento operacional. Fonte da verdade detalhada: `FitSync_AI_PRD_v1.0.md` (seções 5 e 17). Este arquivo extrai as histórias **testáveis** organizadas por jornada, com critérios de aceite verificáveis. Escopo deste documento: **Scenario A — portfolio + dogfooding, running only, semanas 0–8**.

---

## Convenções

- **ID**: `US-NNN` mantém numeração do PRD para rastreabilidade.
- **RF**: requisitos funcionais relacionados (PRD §7).
- **Sprint**: sprint do MVP em que a história deve ficar pronta (PRD §16.2).
- **Prioridade MoSCoW**: `MUST` / `SHOULD` / `COULD` / `WON'T (MVP)`.
- **DoD** (Definition of Done) global aplica a todas: build verde, testes Vitest passando, lint Biome limpo, manual smoke test em iOS + Android (Expo Dev Client), feature flag descritivo em `feature_flags.ts` quando aplicável.

---

## J1 — Onboarding inicial (Sprint 1, semanas 3–4)

A jornada que só acontece uma vez na vida do atleta. Se falhar, o produto não existe.

### US-001 — Login com Google ou Apple — `MUST` — RF-001

**Como** atleta novo no app, **quero** entrar com Google ou Apple, **para que** eu não precise criar mais uma senha.

Critérios de aceite:
- [ ] Botão "Continuar com Google" e "Continuar com Apple" na tela inicial
- [ ] OAuth via Supabase Auth nativo (sem custom backend de auth)
- [ ] JWT da sessão persistido em `expo-secure-store` (não AsyncStorage)
- [ ] Erro de OAuth renderiza mensagem humanizada + botão "Tentar novamente"
- [ ] Em iOS, "Continuar com Apple" cumpre Apple Guideline 4.8 (obrigatório se há outros providers)
- [ ] Após login com sucesso, redireciona para `J1 — Conectar Garmin`

### US-002 — Conectar conta Garmin via sidecar Python — `MUST` — RF-002

**Como** atleta logado, **quero** conectar minha conta Garmin Connect, **para que** o app leia meus treinos e métricas.

Critérios de aceite:
- [ ] Tela explica em uma frase por que precisa do Garmin
- [ ] Form com email + senha Garmin (campos `secureTextEntry`)
- [ ] App chama `POST /auth` do sidecar Python; sidecar usa `python-garminconnect` v0.3.x (SSO mobile DI OAuth)
- [ ] Suporte a 2FA: se Garmin pedir, app renderiza input adicional para TOTP/SMS
- [ ] Token DI OAuth recebido é gravado **criptografado em Supabase Vault** (nunca em texto plano, nunca no log)
- [ ] Erro de SSO mostra: "Garmin com problema de login no momento. Tente novamente em alguns minutos." + botão retry
- [ ] Disclaimer visível na tela: "Usamos uma integração não-oficial. Para uso pessoal isso é seguro; nada das suas credenciais sai do nosso servidor criptografado."

### US-003 — Preencher perfil esportivo — `MUST` — RF-003

**Como** atleta conectado ao Garmin, **quero** preencher meu perfil esportivo, **para que** o sistema personalize o plano.

Critérios de aceite:
- [ ] Form com **≤6 campos**: idade, peso, sexo, modalidade (fixo "Corrida" no Scenario A), frequência atual (1–3 / 3–5 / 5+ por semana), timezone (auto-detectado, editável)
- [ ] Validação inline: idade 13–90, peso 30–200kg
- [ ] Salva em tabela `athletes` no Postgres com timestamp
- [ ] Botão "Pular por agora" desabilitado no MVP (perfil é obrigatório)

### US-004 — Definir prova alvo (ou modo evolução geral) — `MUST` — RF-004

**Como** atleta com perfil preenchido, **quero** declarar minha prova alvo ou marcar "sem prova", **para que** o plano respeite meu objetivo real.

Critérios de aceite:
- [ ] Toggle "Tenho uma prova alvo" / "Sem prova, foco em evolução"
- [ ] Se "tem prova": campos data (date picker), distância (5K / 10K / 21K / 42K), nome da prova (string livre, opcional)
- [ ] Se "sem prova": passa direto
- [ ] Data da prova deve ser ≥ 4 semanas no futuro (caso contrário mostra aviso "Pouco tempo para periodizar com segurança")
- [ ] Decisão registrada no perfil como `goal_mode = 'race' | 'general_progression'`

### US-005 — Importação de 90 dias do histórico Garmin — `MUST` — RF-005

**Como** atleta com perfil completo, **quero** que o sistema leia meus últimos 90 dias de treinos, **para que** o primeiro plano já saia calibrado.

Critérios de aceite:
- [ ] Sidecar Python faz pull dos últimos 90 dias via `get_activities()` em paginação
- [ ] Tela mostra loading "Lendo seu histórico no Garmin..." com progresso aproximado
- [ ] Importação completa em **<2min P95**
- [ ] Cada workout é normalizado e gravado em tabela `workouts` (campos: id, athlete_id, date, distance_m, duration_s, avg_hr, rTSS, raw_payload jsonb)
- [ ] ATL/CTL/ACWR baseline são calculados a partir do histórico
- [ ] Se atleta tem **<30 dias** de histórico, flag `calibration_mode = true` no perfil
- [ ] Se importação falhar parcialmente, app continua com os dados que conseguiu + log do erro

### US-006 — Receber primeiro plano (caminho síncrono) — `MUST` — RF-006, RF-007, RF-008

**Como** atleta com histórico importado, **quero** receber meu primeiro plano semanal, **para que** eu comece a treinar.

Critérios de aceite:
- [ ] Backend chama Claude (`claude-sonnet-4-6`) com **timeout 25s**
- [ ] Tela mostra loading "Preparando seu plano..."
- [ ] Plano renderizado em **<60s P95** no caminho feliz
- [ ] Os 7 treinos da semana são enviados para Garmin Connect via sidecar (`POST /workout` + `schedule_workout(date)`)
- [ ] Atleta vê banner "Por que esses treinos" no topo (texto humanizado gerado pelo Claude)
- [ ] Plano cumpre guardrails determinísticos (ACWR ≤ 1.30, progressão ≤ 10%) — caso contrário, regeneração automática silenciosa (max 2 tentativas)

### US-007 — Receber primeiro plano (caminho async) — `MUST` — RF-006

**Como** atleta cuja chamada Claude passou de 25s, **quero** receber meu plano em alguns minutos sem ficar travado.

Critérios de aceite:
- [ ] Após 25s, backend retorna `202 Accepted` com `job_id`
- [ ] App entra em polling `GET /jobs/{job_id}` a cada 5s (max 5 minutos)
- [ ] Tela mostra "Continuamos preparando seu plano. Te avisaremos." + opção "Fechar app, eu volto"
- [ ] Quando job termina, push notification via Expo Push abre o app direto na tela do plano
- [ ] Job é persistido em tabela `jobs` no Postgres (Postgres-as-queue; **BullMQ é Fase 2**)
- [ ] Se job falha 2x consecutivas, mensagem: "Tive um problema técnico. Já avisamos a equipe."

### US-008 — Disclaimer obrigatório no onboarding — `MUST` — RF-029

**Como** atleta no onboarding, **quero** entender que o app é auxiliar e não substitui acompanhamento profissional.

Critérios de aceite:
- [ ] Modal aparece **antes** da geração do primeiro plano
- [ ] Texto exato: *"FitSync não substitui acompanhamento médico ou profissional. Em caso de dor, pare e procure médico esportivo."*
- [ ] Botão "Entendi e concordo" obrigatório para prosseguir
- [ ] Aceite registrado em tabela `consents` com timestamp + versão do texto
- [ ] Versão reduzida do disclaimer fica permanente no rodapé das telas de plano e feedback

---

## J2 — Plano da semana (Sprint 2, semanas 4–5)

Onde o atleta vive boa parte do tempo. A tela inicial do app a partir do dia 1.

### US-009 — Visualizar plano da semana — `MUST` — RF-008, RF-011

**Como** atleta logado, **quero** ver minha semana de treinos com a explicação do "porquê".

Critérios de aceite:
- [ ] Tela inicial mostra banner com "porquê" da semana em linguagem humanizada
- [ ] Lista vertical de 7 dias (Seg–Dom) com cards de workout
- [ ] Cada card mostra: nome do treino, duração, zonas alvo, tipo (intervalado, longo, descanso)
- [ ] Estado visual dos treinos: ✅ feito · 🟢 hoje · ⚪ futuro · 💤 descanso
- [ ] Render **<500ms P95** com cache TanStack Query
- [ ] Funciona offline com último plano em cache
- [ ] Pull-to-refresh dispara revalidação do cache

### US-010 — Mover treino entre dias (drag&drop) — `MUST` — RF-009

**Como** atleta com agenda variável, **quero** mover treinos entre dias.

Critérios de aceite:
- [ ] Drag&drop entre cards de dias funciona em iOS e Android
- [ ] Ao soltar, app chama `PATCH /plan/move` no backend Bun
- [ ] Backend valida heuristicamente (sem chamar Claude): nunca dois estímulos altos consecutivos sem recuperação
- [ ] Se válido: aceita silenciosamente; treino re-enviado para Garmin
- [ ] Se viola princípio: modal "Esse arranjo pode comprometer sua recuperação. Confirma mesmo assim?" com botões Confirmar / Cancelar
- [ ] Confirmação salva como `manual_override = true` no histórico do plano
- [ ] Cancelamento retorna card para posição original (sem chamada extra)

### US-011 — Acessar Modo Avançado (métricas técnicas) — `SHOULD` — RF-010

**Como** atleta avançado (P2 dogfooding — Rafael), **quero** ver meus dados técnicos (ACWR, CTL, TSB, decoupling).

Critérios de aceite:
- [ ] Toggle "Modo Avançado" em Configurações → Preferências (padrão **off**)
- [ ] Quando on: link "Ver detalhes técnicos" aparece no rodapé do plano
- [ ] Tela de detalhes mostra: ACWR atual, CTL 7 dias, TSB hoje, decoupling do último treino, gráfico de carga últimas 6 semanas
- [ ] Adoção do toggle registrada como métrica (`metabase_events`) para informar pricing futuro

---

## J3 — Execução do treino (Sprint 3, semanas 5–6)

O dia a dia. O treino tem que estar **no relógio**, não no app.

### US-012 — Treino no Garmin automaticamente — `MUST` — RF-012, RF-016

**Como** atleta com plano gerado, **quero** que os treinos apareçam no meu Garmin sem eu mexer no app.

Critérios de aceite:
- [ ] Quando plano é gerado/atualizado, sidecar envia 7 treinos via `upload_running_workout()` + `schedule_workout(date)`
- [ ] Treinos aparecem como "Treino estruturado" no relógio (validar manualmente no Forerunner do Rafael)
- [ ] Estrutura inclui: aquecimento, blocos com zonas alvo (HR ou pace), recuperação, alongamento
- [ ] Se sidecar falha: app exibe banner "Não consegui enviar para o relógio" + botão "Tentar novamente"
- [ ] Treino sempre visível no app mesmo se Garmin falhar (zero falha silenciosa)
- [ ] Retry exponencial automático no backend (3 tentativas: 30s, 2min, 5min)

### US-013 — Sincronização automática pós-treino — `MUST` — RF-013, RF-014

**Como** atleta que terminou um treino, **quero** que ele apareça no app rapidamente.

Critérios de aceite:
- [ ] Cron do Railway dispara sidecar a cada 60min para ler novos workouts (`get_activities(start=last_synced_at)`)
- [ ] Pull adicional ao abrir o app (lazy sync) — não pode demorar mais de 3s
- [ ] Delta detectado: workouts com `start_time > last_synced_at` viram entradas na tabela `workouts`
- [ ] Trigger Postgres dispara recálculo de ATL/CTL/ACWR/decoupling
- [ ] Se sync falha, app continua usando dados em cache + retry no próximo ciclo

### US-014 — Cálculo determinístico de métricas — `MUST` — RF-015

**Como** sistema, **preciso** calcular rTSS, ATL, CTL, ACWR, decoupling e Pa:HR a partir dos dados Garmin com correção fisiológica.

Critérios de aceite:
- [ ] Funções TypeScript puras em `packages/metrics/` (sem side effects, fácil de testar)
- [ ] **100% de cobertura de teste Vitest** nessas funções
- [ ] Fórmulas seguem documentação cravada no `principios_treino.md` (TrainingPeaks/Firstbeat)
- [ ] Outliers de FC óptica (variação >20bpm/seg) descartados antes do cálculo de decoupling
- [ ] Funções idempotentes: rodar 2x no mesmo workout dá o mesmo resultado
- [ ] Caso de teste de regressão: workout conhecido do Rafael com valores esperados em fixture

### US-015 — Captura de RPE pós-treino — `SHOULD` — RF-017

**Como** atleta que acabou de treinar, **quero** registrar minha percepção de esforço (RPE 1–10).

Critérios de aceite:
- [~] **Item técnico crítico**: sidecar mapeia `perceivedEffort` do Garmin (`client.py`) → caminho de código pronto; **validação física no Forerunner ainda pendente** (P0-09)
- [x] Camada 1: se Garmin já tem RPE, importa automaticamente (`/garmin/sync` → `normalizeRpe` → `workouts.rpe`)
- [x] Camada 2: push 30min pós-treino — `lib/push.ts` (Expo Push) + `/push/register` (token via `_layout.tsx`) + `/push/rpe-reminders` (sweep). Migração `005_push_token.sql`. **Resta só ligar o cron Railway** no endpoint + validar no device
- [x] Camada 3: se atleta ignora, sistema segue sem RPE (null não bloqueia nada)
- [x] RPE salvo em `workouts.rpe`; null é estado válido

---

## J4 — Feedback pós-treino (Sprint 3, semanas 5–6)

O momento mágico recorrente. O diferencial #3 do produto.

### US-016 — Feedback humanizado pós-treino — `MUST` — RF-018, RF-019, RF-020, RF-021

**Como** atleta que acabou de sincronizar um treino, **quero** receber um feedback humanizado em poucos minutos.

Critérios de aceite:
- [ ] Pipeline: workout sync → cálculo métricas → chamada Claude → notificação
- [ ] **Tempo total <5min P95** do fim do treino até notificação no app
- [ ] Tom obrigatório: "treinador no WhatsApp" — nunca punitivo, sempre construtivo
- [ ] Push notification: "Seu treino de [tipo] está com feedback pronto"
- [ ] Tap na notificação abre direto na tela do feedback (deep linking via Expo Router)
- [ ] Feedback referencia dados específicos do treino: pace médio, FC média, decoupling, zona predominante
- [ ] Histórico de feedbacks acessível em `/historico/feedbacks` (RF-022)

### US-017 — Modo calibração nas 2 primeiras semanas — `MUST` — RF-030

**Como** atleta com pouco histórico (<30 dias) ou em primeira interação, **quero** um plano mais conservador.

Critérios de aceite:
- [x] Flag `calibration_mode = true` por padrão enquanto `days_with_data < 30` ou primeiras 2 semanas (default no schema + `evaluateCalibration`)
- [x] Prompt do Claude com instrução explícita de calibração (`plan_v3.ts`: APENAS Z1/Z2, volume 70%, só easy/long/rest/cross)
- [x] Banner permanente no plano (`plan.tsx` CalibrationBanner)
- [x] Após ≥14 dias E ≥30 dias de dados → flag vira `false` automaticamente (`evaluateCalibration` em sync/geração/leitura) + aviso in-app one-time. **Notificação push** depende de US-015 (backend já loga "Modo calibração concluído" e expõe a transição)
- [x] **Decisão do dono 2026-05-17**: a janela de ≥14 dias conta a partir do **treino mais antigo importado** (ou criação da conta, o que for mais antigo), não só do `created_at`. Quem chega com histórico Garmin não espera 14 dias de conta nova. (`earliestIso` em `calibration.ts`; `earliestWorkoutDate` propagado pelo sync)

---

## J5 — Replanejamento (Sprint 4, semanas 6–7)

Quando a realidade não cabe no plano.

### US-018 — Replanejamento automático semanal — `MUST` — RF-023

**Como** atleta que terminou a semana, **quero** que o próximo plano seja gerado automaticamente.

Critérios de aceite:
- [ ] Trigger primário: último treino prescrito da semana foi sincronizado
- [ ] Trigger fallback: atleta abre app na segunda-feira sem plano novo (lazy)
- [ ] Plano novo aparece no app antes das 6h da manhã de segunda no fuso do atleta
- [ ] Push notification: "Seu plano da semana está pronto"
- [ ] Versão anterior arquivada em `plan_history` (jsonb, com timestamp)

### US-019 — Replanejamento sob demanda — `SHOULD` — RF-024

**Como** atleta que teve uma semana ruim, **quero** pedir um replanejamento manual.

Critérios de aceite:
- [ ] Botão "Replanejar minha semana" no menu de configurações
- [ ] **Rate limit: 1 uso por semana por atleta** (botão fica desabilitado com tooltip "Disponível em X dias")
- [ ] Texto opcional: "Conte rapidamente o que aconteceu" (max 280 chars, passa pro Claude no prompt)
- [ ] Mesmo pipeline da geração normal (sync com timeout 25s + fallback async)

### US-020 — Diff visual do plano atualizado — `MUST` — RF-025

**Como** atleta que recebeu plano novo, **quero** entender o que mudou.

Critérios de aceite:
- [ ] Quando plano atualiza, app mostra toast persistente "Seu plano foi atualizado — ver mudanças"
- [ ] Tap no toast abre tela de diff: lado esquerdo plano antigo, direito plano novo, diferenças destacadas em cor
- [ ] Justificativa por mudança gerada pelo Claude (1–2 frases por treino alterado)
- [ ] Toast desaparece após 1 visualização ou 3 dias

---

## Sprint 5 — Polimento e privacidade (semanas 7–8)

### US-021 — Exportar meus dados — `SHOULD` — RF-034

**Como** atleta consciente sobre LGPD, **quero** baixar todos os meus dados.

Critérios de aceite:
- [ ] "Configurações → Meus dados → Exportar tudo" gera CSV + JSON com todos os workouts, planos, feedbacks, perfil
- [ ] Backend gera arquivo zip e disponibiliza link Supabase Storage com TTL 24h
- [ ] Email enviado para o atleta com o link via Resend
- [ ] **Atende Art. 18 LGPD** (direito de portabilidade)

### US-022 — Excluir minha conta — `SHOULD` — RF-035

**Como** atleta que quer sair, **quero** excluir minha conta e meus dados.

Critérios de aceite:
- [ ] "Configurações → Excluir minha conta" pede confirmação dupla
- [ ] Soft delete imediato: conta desativada, login bloqueado, plano cancelado
- [ ] Hard delete 90 dias depois (cron job): workouts, feedbacks, tokens Vault deletados
- [ ] Backup pg_dump de retenção de 4 semanas ainda contém — documentado nos termos
- [ ] Email de confirmação via Resend

### US-023 — Streak adaptado FitSync — `COULD` — RF-038

**Como** atleta engajado, **quero** ver minha sequência de dias seguindo o plano (incluindo descansos prescritos).

Critérios de aceite:
- [ ] Card no perfil: "🔥 X dias seguindo seu plano"
- [ ] **Dias de descanso prescritos contam como sucesso** (anti-overtraining)
- [ ] Dia falha se: treino prescrito não foi feito + não foi rearranjado para outro dia da semana
- [ ] Quebra de streak não dispara notificação punitiva (só atualiza silenciosamente)

### US-024 — Conquistas não-gamificadas — `COULD` — RF-039

**Como** atleta, **quero** receber reconhecimento por evoluções reais (não badges genéricos).

Critérios de aceite:
- [ ] Sistema detecta marcos automaticamente: melhora de pace em distância, primeira vez em zona X, primeira semana >40km, etc.
- [ ] Push notification + card no app: "Seu 5K caiu de 27'24'' em 8 semanas — isso é evolução real"
- [ ] Texto sempre referencia o dado específico (não "Parabéns pelo treino!")
- [ ] Sem ícones de troféu / medalhas — só texto e número
- [ ] Limite: max 1 conquista por semana para não inflacionar

---

## Fora de escopo (Won't have no MVP — Scenario A)

Histórias deliberadamente deixadas para fora deste MVP, registradas para evitar scope creep:

| ID | Tema | Por quê |
|---|---|---|
| Pagamentos / Stripe / IAP | Scenario A é portfolio + dogfooding; sem cobrança no MVP |
| HealthKit / Health Connect | Fase 2 da Stack; só Garmin no MVP |
| Suporte multi-modalidade (bike, natação) | Fase 3 da Stack; running only |
| Web app | Mobile-only no MVP |
| Pesquisa em papers científicos (web search) | Fase 3 da Stack |
| Brick training (triathlon) | Fase 3 da Stack |
| Conta de coach (visão B2B2C) | V2+ se houver tração |
| Detecção automática de lesão | Risco regulatório (ANVISA SaMD) |

---

## Mapeamento Sprint → Stories

| Sprint | Semanas | Stories | Pontos est. |
|---|---|---|---|
| Pré-MVP | 0–2 | Setup (sem stories funcionais — ver `backlog.md`) | — |
| Sprint 1 | 3–4 | US-001 a US-008 | 21 |
| Sprint 2 | 4–5 | US-009 a US-011 | 13 |
| Sprint 3 | 5–6 | US-012 a US-017 | 26 |
| Sprint 4 | 6–7 | US-018 a US-020 | 13 |
| Sprint 5 | 7–8 | US-021 a US-024 | 8 |
| **Total** | **8 semanas** | **24 stories** | **~81 pontos** |

Pontuação reduzida vs. 105 do PRD original porque Scenario A corta pagamentos (US-11/US-12), métricas externas e análises agregadas que exigiam 10+ atletas.

---

## Referência cruzada

- Detalhes de cada US (fluxo, mockups, edge cases): `FitSync_AI_PRD_v1.0.md` §17
- Jornadas com fluxograma Mermaid: `FitSync_AI_PRD_v1.0.md` §5
- Requisitos não-funcionais (RNF) por story: `FitSync_AI_PRD_v1.0.md` §9
- Backlog por sprint com kill criteria: `backlog.md`
- Como o Claude Code deve orquestrar a implementação: `CLAUDE.md`

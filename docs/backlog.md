# FitSync AI — Backlog de Execução

> Plano operacional de 8 semanas para entrega do MVP (Cenário A).
> Formato Scrum simplificado para solo dev com <5h/semana.

**Versão:** 2.0
**Data de início prevista:** próximo fim de semana disponível
**Data de conclusão prevista:** 8 semanas após início
**Total de Story Points:** 35 pts
**Capacidade semanal estimada:** 4-5 pts/semana (3-5h de trabalho real)

---

## Priorização MoSCoW

### 🔴 Must Have (MVP — não entrega sem)
Toda a lista de US-01 a US-10 é Must Have. Se qualquer uma delas não entrega até a semana 8, o MVP está incompleto.

### 🟡 Should Have (entrega se sobrar tempo)
- **SH-01** — Tela de perfil com edição de dados pessoais (peso, altura, idade)
- **SH-02** — Export de plano em PDF para imprimir
- **SH-03** — Notificação local no celular no dia do treino
- **SH-04** — Modo escuro no app

### 🟢 Could Have (nice to have, fica para Fase 2)
- Gráfico de evolução do pace de limiar ao longo das semanas
- Comparação entre plano previsto e plano executado
- Histórico de planos gerados (trocar entre versões)
- Convite de amigos para ver o plano

### ⚫ Won't Have (explicitamente fora)
Tudo listado na seção "O Que Ficou Fora" do `user-stories.md` e na seção "Escopo Inviolável" do `CLAUDE.md`.

---

## Sprints Detalhados

Cada sprint dura **2 semanas** e cabe 8-10 pontos considerando capacidade real de 3-5h/semana.

### 🏁 Sprint 0 — Preparação (Semana 1)

Sprint técnico de setup. Não tem user story, mas é pré-requisito para tudo.

#### Tarefas
- [ ] Criar conta Supabase e projeto `fitsync-ai`
- [ ] Criar conta Railway e projeto vazio
- [ ] Criar conta Anthropic API e obter chave
- [ ] Criar repositório Git (GitHub) `fitsync-ai`
- [ ] Configurar estrutura de pastas conforme `CLAUDE.md`
- [ ] Criar `.env.example` e `.gitignore`
- [ ] Instalar `python-garminconnect` em ambiente virtual local
- [ ] Rodar o exemplo oficial e ver seu próprio perfil Garmin no terminal
- [ ] Instalar Expo CLI e criar projeto RN vazio
- [ ] Conseguir rodar "Hello World" do Expo no seu celular via Expo Go

#### Critério de Vitória da Sprint
`python -m garminconnect` retorna o seu nome de usuário Garmin real. App Expo vazio abre no seu celular.

#### Tempo estimado
3-5 horas (um fim de semana)

---

### 🏗️ Sprint 1 — Fundação de Dados (Semanas 2-3)

Objetivo: ter login no app + Garmin autenticado + suas atividades reais no banco.

#### Stories incluídas
- **US-01** — Login no App (2 pts)
- **US-02** — Conectar Conta Garmin (5 pts)
- **US-03** — Importar Últimas Atividades (3 pts)

**Total: 10 pts**

#### Tarefas técnicas principais
- Schema inicial no Supabase: `users` (via Auth), `garmin_tokens`, `activities`
- Backend FastAPI com endpoint `/health` e `/auth/garmin/connect`
- Wrapper Python em volta do `python-garminconnect` com storage de tokens no Supabase
- Tela de login no app (React Native + Supabase JS)
- Tela de configuração Garmin
- Tela de lista de atividades com pull-to-refresh

#### Definition of Done da Sprint
- Fazer login no app → conectar Garmin → ver suas 20 últimas corridas reais
- Tudo deployado em Railway (backend) e rodando no Expo Go (mobile)

---

### 🧠 Sprint 2 — Inteligência (Semanas 4-5)

Objetivo: o coração do produto — IA gera plano e você vê no celular.

#### Stories incluídas
- **US-04** — Registrar Teste de 3km (3 pts)
- **US-05** — Informar Objetivo de Treino (2 pts)
- **US-06** — IA Gera Plano de Treino (8 pts)
- **US-07** — Visualizar Plano no App (3 pts)

**Total: 16 pts** (sprint pesada — atenção)

#### Tarefas técnicas principais
- Schema novo: `athlete_profile`, `training_goals`, `training_plans`, `llm_logs`
- Lógica de cálculo de zonas (Python, funções puras testáveis)
- Estrutura de prompts versionada em `backend/prompts/`
- Integração Claude API com schema JSON
- Validação Pydantic do output
- Pós-processamento com regras hard-coded (progressão máx, dias de descanso)
- Tela de teste de 3km no app
- Formulário de objetivo
- Tela de plano semanal

#### Definition of Done da Sprint
- Você gera um plano real para você mesmo e abre no celular
- Plano tem 4 semanas, sem dias absurdos, respeitando progressão

#### 🚨 Sprint mais arriscada
Se atrasar, é aqui. A US-06 sozinha é um marco técnico. Se na metade da sprint ela ainda não tem JSON saindo da Claude API, pausa a US-07 e foca nela.

---

### ⌚ Sprint 3 — Integração Final (Semanas 6-7)

Objetivo: fechar o ciclo — plano vai pro relógio, volta feedback, sistema adapta.

#### Stories incluídas
- **US-08** — Enviar Treino ao Garmin (5 pts)
- **US-09** — Marcar Feedback do Treino (1 pt)
- **US-10** — Recalibração Simples do Plano (3 pts)

**Total: 9 pts**

#### Tarefas técnicas principais
- Conversão de plano JSON → `RunningWorkout` do python-garminconnect
- Endpoint `/plans/send-to-garmin/{workout_id}`
- Implementar plano B: geração de arquivo `.FIT` local como fallback
- Schema: `workout_feedback`
- Lógica de detecção "3 feedbacks consecutivos"
- Endpoint `/plans/recalibrate`
- Tela de feedback com 3 botões
- Notificação "ajustar plano?" quando regra dispara

#### Definition of Done da Sprint
- Você executa um treino real, vê o treino no relógio, termina, dá feedback no app, e ao dar 3 feedbacks "difícil" recebe oferta de recalibração que funciona

---

### 🧪 Sprint 4 — Dogfooding e Polimento (Semana 8)

Objetivo: você usa o sistema por uma semana inteira de treino real, corrige bugs que aparecerem, documenta aprendizados.

#### Tarefas
- [ ] Executar pelo menos 3 treinos reais vindos do app
- [ ] Listar bugs encontrados em `BUGS.md`
- [ ] Corrigir os 3 bugs mais críticos
- [ ] Escrever `LEARNINGS.md` com o que funcionou / o que não
- [ ] Decidir se o projeto continua (Fase 2) ou pausa

#### Definition of Done da Sprint
- Um ciclo completo rodou: plano → relógio → execução → feedback → recalibração
- Documento de decisão sobre Fase 2 escrito (continua, pivota, pausa)

---

## Definition of Done Geral

Para qualquer história ser considerada "done" ela precisa atender:

1. ✅ Código commitado no `main` do repositório
2. ✅ Rodando localmente sem erros no terminal
3. ✅ Rodando no celular do desenvolvedor via Expo Go (para stories com tela)
4. ✅ Deploy da API atualizado no Railway (para stories que mexem no backend)
5. ✅ Dados persistindo corretamente no Supabase (se aplicável)
6. ✅ Critérios de aceitação da story marcados como atendidos
7. ✅ Sem erros no console do app / nos logs do Railway ao exercitar o fluxo principal

---

## Mapa de Riscos (Top 5)

### 🔴 R1 — Garmin bloqueia `python-garminconnect` novamente
- **Probabilidade:** Média
- **Impacto:** Alto (quebra US-02, US-03, US-08)
- **Mitigação:** plano B documentado desde Sprint 1 (exportação FIT manual como fallback); monitorar issues do repositório da biblioteca semanalmente
- **Gatilho de ação:** se a biblioteca ficar 7+ dias sem conseguir logar, executar plano B oficialmente

### 🟠 R2 — Claude API gera planos incoerentes ou perigosos
- **Probabilidade:** Média
- **Impacto:** Médio (quebra US-06)
- **Mitigação:** prompt conservador + validação hard-coded de pós-processamento (se volume > 10% semana anterior, rejeita)
- **Gatilho de ação:** se 3 planos consecutivos falharem validação, revisar system prompt antes de seguir

### 🟠 R3 — Desenvolvedor perde tempo disponível
- **Probabilidade:** Alta (estágio pode intensificar, provas, etc.)
- **Impacto:** Médio (atrasa cronograma)
- **Mitigação:** critérios de kill por semana evitam atraso cumulativo; cada sprint é independente
- **Gatilho de ação:** se uma sprint fechar com menos de 50% entregue, renegociar escopo na próxima ao invés de empilhar

### 🟡 R4 — Custo Claude API maior do que esperado
- **Probabilidade:** Baixa
- **Impacto:** Baixo
- **Mitigação:** hard cap mensal na conta Anthropic; geração de plano limitada a 1x/semana por usuário
- **Gatilho de ação:** se custo > R$50/mês, trocar modelo Opus por Sonnet

### 🟡 R5 — Supabase ou Railway mudam free tier
- **Probabilidade:** Baixa no horizonte de 8 semanas
- **Impacto:** Médio
- **Mitigação:** manter aplicação stateless o suficiente para migrar em 1 dia
- **Gatilho de ação:** se acontecer, migrar para alternativa (Render, Fly.io, Neon)

---

## Critérios de Kill (quando parar oficialmente)

Os critérios abaixo são **gatilhos de revisão formal**, não de desistência. Disparar um deles significa "abre uma sessão de análise antes do próximo commit".

| Gatilho | Ação |
|---------|------|
| Fim da Semana 2 sem `python-garminconnect` logando | Revisar Sprint 1 e decidir se projeto vira "sem Garmin" (só importação manual de FIT) |
| Fim da Semana 5 sem Claude API gerando JSON válido | Revisar US-06 e decidir se IA vira calculadora de zonas clássica (Karvonen + regras fixas) |
| Fim da Semana 8 sem um ciclo fechado completo | Pausar oficialmente, documentar aprendizado em `LEARNINGS.md`, guardar como portfólio |
| Duas sprints consecutivas entregando menos de 50% | Renegociar escopo total (remover US-10, US-09 vira nice-to-have) |

---

## Cronograma Consolidado

| Semana | Data aprox. | Sprint | Entrega principal |
|--------|-------------|--------|---------------------|
| 1 | 26/04 - 02/05 | Sprint 0 | Ambiente pronto |
| 2 | 03/05 - 09/05 | Sprint 1 | Login + Garmin auth |
| 3 | 10/05 - 16/05 | Sprint 1 | Atividades reais no app |
| 4 | 17/05 - 23/05 | Sprint 2 | Teste 3km + zonas |
| 5 | 24/05 - 30/05 | Sprint 2 | IA gera plano em JSON |
| 6 | 31/05 - 06/06 | Sprint 3 | Plano vai pro Garmin |
| 7 | 07/06 - 13/06 | Sprint 3 | Feedback + recalibração |
| 8 | 14/06 - 20/06 | Sprint 4 | Dogfooding + polimento |

> Datas são referência. Se o projeto começar em outro fim de semana, shift linear de tudo.

---

## Métricas de Sucesso do MVP

Ao fim das 8 semanas, o projeto é um **sucesso** se pelo menos 3 destas 4 métricas forem atingidas:

1. ✅ O desenvolvedor executou pelo menos 3 treinos reais que saíram do app
2. ✅ A IA gerou pelo menos 1 plano coerente que o desenvolvedor toparia seguir
3. ✅ O ciclo "plano → relógio → execução → feedback → recalibração" fechou pelo menos 1 vez
4. ✅ O código está em um repositório público no GitHub como portfólio

Se atingir as 4, abrir conversa sobre Fase 2 com análise de continuidade. Se atingir 2 ou menos, pausar com aprendizado documentado.

---

## Reunião de Retrospectiva (ao fim de cada sprint)

Toda sprint termina com o desenvolvedor respondendo 3 perguntas, escritas em `RETRO.md`:

1. **O que funcionou?** (manter)
2. **O que não funcionou?** (ajustar ou remover)
3. **O que eu faria diferente se começasse agora?** (aprender)

Não é formalidade — é defesa contra cair de novo na armadilha de "documentação paralisa, código liberta".
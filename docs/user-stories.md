# FitSync AI — User Stories

> Histórias de usuário do MVP (Cenário A — ferramenta pessoal de corrida).
> Total: **10 histórias, 32 Story Points**, 8 semanas de execução.
> Usuário único do MVP: o próprio desenvolvedor (Rafael, triatleta iniciante).

**Versão:** 2.0
**Data:** 22/04/2026
**Substitui:** as 13 histórias e 105 pontos do Planning Poker v1

---

## Referência de Escala (Fibonacci)

| Pontos | Significado |
|--------|-------------|
| 1 | Trivial — algumas linhas de código, resolvido em 1h |
| 2 | Simples — 1-2 arquivos, resolvido em uma sessão |
| 3 | Pequeno — um fluxo completo mas direto |
| 5 | Médio — integração entre 2-3 componentes |
| 8 | Grande — múltiplos componentes + incerteza técnica |
| 13 | Muito grande — deveria ser quebrado |

---

## Épicos do MVP

- **E1 — Autenticação e Acesso** (US-01, US-02) — 7 pts
- **E2 — Leitura de Dados Garmin** (US-03, US-04) — 6 pts
- **E3 — Geração de Plano por IA** (US-05, US-06, US-07) — 13 pts
- **E4 — Envio ao Relógio** (US-08) — 5 pts
- **E5 — Ciclo Adaptativo** (US-09, US-10) — 4 pts

**Total: 32 pontos**

---

## US-01 — Login no App

**Épico:** E1 — Autenticação
**Pontos:** 2
**Prioridade:** Must Have
**Sprint:** 1

### Narrativa
Como usuário do FitSync AI, quero fazer login no aplicativo com e-mail e senha, para que minhas informações e planos de treino fiquem associados à minha conta e persistam entre sessões.

### Critérios de Aceitação
- Tela de login com campos de e-mail e senha
- Botão "entrar" que chama Supabase Auth
- Mensagem de erro clara quando credenciais são inválidas
- Após login bem-sucedido, redirecionar para tela principal
- Token de sessão persistido no dispositivo (AsyncStorage)
- Botão "sair" disponível em alguma tela após o login
- Tela de cadastro básico (e-mail + senha + confirmação)

### Definition of Done
- Tela funciona no Expo Go no celular do desenvolvedor
- Conta criada com sucesso no Supabase (visível no dashboard)
- Próxima abertura do app não pede login novamente enquanto token for válido

### Dependências
- Nenhuma

---

## US-02 — Conectar Conta Garmin

**Épico:** E1 — Autenticação
**Pontos:** 5
**Prioridade:** Must Have
**Sprint:** 2

### Narrativa
Como usuário autenticado, quero informar minhas credenciais Garmin uma única vez, para que o sistema consiga acessar minhas atividades e agendar treinos no meu relógio sem que eu precise logar toda vez.

### Critérios de Aceitação
- Tela de configuração com campos para e-mail e senha Garmin
- Credenciais enviadas ao backend via HTTPS
- Backend usa `python-garminconnect` para autenticar
- Se Garmin pedir MFA, fluxo permite inserir o código
- Tokens DI OAuth Bearer salvos no Supabase (criptografados)
- Mensagem de sucesso "Garmin conectado" exibida ao usuário
- Botão "desconectar Garmin" disponível

### Definition of Done
- Login Garmin real funciona de ponta a ponta
- Tokens são reutilizados em requisições subsequentes sem novo login
- Auto-refresh de token funciona (testar deixando token "envelhecer")

### Dependências
- US-01 (usuário precisa estar logado no app)

### Riscos
- Garmin pode alterar fluxo de autenticação novamente. **Mitigação:** manter `python-garminconnect` sempre atualizado, monitorar issues do repositório.
- MFA obrigatório pode complicar UX. **Mitigação:** suportar o fluxo de callback de MFA desde o início.

---

## US-03 — Importar Últimas Atividades

**Épico:** E2 — Leitura de Dados Garmin
**Pontos:** 3
**Prioridade:** Must Have
**Sprint:** 2

### Narrativa
Como usuário com Garmin conectado, quero que minhas últimas 20 corridas sejam importadas e exibidas no app, para que eu veja meu histórico recente e confirme que a integração está funcionando.

### Critérios de Aceitação
- Endpoint `GET /activities` na API retorna as 20 últimas atividades do tipo "running"
- Cada atividade contém: data, distância (km), tempo total, pace médio, FC média, FC máxima
- Atividades são persistidas no Supabase (tabela `activities`) para evitar chamadas repetidas à Garmin
- Tela mobile lista as atividades em ordem cronológica reversa
- Atualização manual via "puxar para atualizar" (pull to refresh)

### Definition of Done
- O desenvolvedor vê suas corridas reais no app
- Dados batem com o que aparece no Garmin Connect oficial
- Sincronização manual funciona sem erro

### Dependências
- US-02 (Garmin conectado)

---

## US-04 — Registrar Teste de 3km

**Épico:** E2 — Leitura de Dados Garmin
**Pontos:** 3
**Prioridade:** Must Have
**Sprint:** 3

### Narrativa
Como usuário que quer um plano personalizado, quero marcar uma das minhas atividades como "teste de 3km", para que o sistema extraia meu pace de limiar, FC máxima e zonas de treinamento a partir dela.

### Critérios de Aceitação
- Na tela de lista de atividades, botão "usar como teste de 3km" em cada item
- Sistema valida se a atividade tem distância entre 2.8 e 3.2 km
- Extração automática de: pace médio, FC máxima detectada, FC média
- Cálculo das 5 zonas de FC baseado em FC máxima (fórmula de Karvonen ou percentuais simples)
- Cálculo das 3 zonas de pace baseado no pace médio do teste
- Dados salvos no perfil do usuário (tabela `athlete_profile`)
- Tela de confirmação mostra as zonas calculadas

### Definition of Done
- Teste de 3km real do desenvolvedor é processado e zonas aparecem no app
- Valores calculados fazem sentido fisiológico (FC Z1 < Z2 < Z3 < Z4 < Z5)

### Dependências
- US-03 (atividades importadas)

---

## US-05 — Informar Objetivo de Treino

**Épico:** E3 — Geração de Plano
**Pontos:** 2
**Prioridade:** Must Have
**Sprint:** 3

### Narrativa
Como usuário com zonas calculadas, quero informar meu objetivo (distância alvo e prazo em semanas), para que a IA saiba qual plano deve gerar.

### Critérios de Aceitação
- Tela com campo de distância alvo (5km, 10km, 21km, 42km — apenas opções pré-definidas no MVP)
- Campo de tempo disponível (número de semanas, entre 4 e 16)
- Campo de dias de treino por semana (3, 4 ou 5)
- Campo "tempo alvo opcional" (texto livre ou vazio)
- Botão "gerar plano" que dispara US-06
- Objetivo persiste no Supabase (tabela `training_goals`)

### Definition of Done
- Formulário funciona e valida campos
- Dados chegam ao backend em estrutura JSON consistente

### Dependências
- US-04 (zonas precisam estar calculadas)

---

## US-06 — IA Gera Plano de Treino

**Épico:** E3 — Geração de Plano
**Pontos:** 8
**Prioridade:** Must Have
**Sprint:** 3-4

### Narrativa
Como usuário com zonas e objetivo definidos, quero que a IA gere um plano semanal coerente de corrida, para que eu tenha treinos estruturados até meu objetivo sem precisar contratar treinador.

### Critérios de Aceitação
- Endpoint `POST /plans/generate` chama Claude API
- System prompt inclui:
  - Princípios de periodização linear para iniciantes
  - Regra de progressão máxima de 10% em volume semanal
  - No máximo 1 treino intervalado por semana para iniciantes
  - 1 dia de descanso obrigatório entre treinos intensos
  - Pelo menos 1 longão por semana
- Prompt recebe: perfil do atleta, zonas calculadas, objetivo, histórico recente (últimas 3 semanas)
- Output em JSON estruturado validado por Pydantic
- Schema do plano: lista de semanas, cada semana com dias, cada dia com tipo de treino + duração + zona alvo + instrução curta
- Plano persistido no Supabase (tabela `training_plans`)
- Log da chamada Claude API salvo para debug (prompt, resposta, tokens usados)

### Definition of Done
- Desenvolvedor gera um plano real, lê, e toparia seguir
- JSON retornado é sempre válido (nunca texto livre)
- Custo por geração abaixo de R$ 0,50

### Dependências
- US-04, US-05

### Riscos
- IA pode gerar plano agressivo demais ou incoerente. **Mitigação:** prompt conservador + limites hard-coded em pós-processamento (se volume > 10% → rejeita e regenera).
- Claude API pode ficar instável. **Mitigação:** retry com backoff, fallback para cache do último plano válido.

### Notas Técnicas
- Usar `response_format` com JSON schema ao chamar Claude API
- System prompt em arquivo separado (`backend/prompts/system_plan_generation.md`) para versionamento

---

## US-07 — Visualizar Plano no App

**Épico:** E3 — Geração de Plano
**Pontos:** 3
**Prioridade:** Must Have
**Sprint:** 4

### Narrativa
Como usuário com plano gerado, quero ver os treinos da semana atual no app, para saber o que fazer em cada dia sem precisar decorar ou abrir outro aplicativo.

### Critérios de Aceitação
- Tela "semana atual" com 7 cards (segunda a domingo)
- Cada card mostra: tipo de treino (ex: "longão Z2"), duração estimada, descrição curta
- Dia de descanso aparece com visual diferenciado
- Treinos já executados aparecem com marca de concluído
- Navegação entre semanas (anterior / próxima) dentro do plano
- Tela "próximo treino" em destaque na home

### Definition of Done
- Plano gerado no passo US-06 aparece renderizado de forma legível
- Usuário consegue navegar todas as semanas do plano

### Dependências
- US-06

---

## US-08 — Enviar Treino ao Garmin

**Épico:** E4 — Envio ao Relógio
**Pontos:** 5
**Prioridade:** Must Have
**Sprint:** 5

### Narrativa
Como usuário com plano visível no app, quero enviar um treino do plano diretamente para meu Garmin com um clique, para que quando eu iniciar a atividade no relógio, os intervalos e zonas já estejam prontos.

### Critérios de Aceitação
- Botão "enviar para meu Garmin" em cada card de treino
- Backend converte o treino JSON em objeto `RunningWorkout` do `python-garminconnect`
- Steps do workout incluem: aquecimento, corpo principal (com zonas), desaquecimento
- Chama `upload_running_workout()` e em seguida `schedule_workout()` para a data do treino
- Mensagem de sucesso ou erro exibida ao usuário
- ID do workout Garmin salvo no banco para permitir "desagendar" depois

### Definition of Done
- Treino aparece agendado no Garmin Connect oficial na data correta
- Ao iniciar a atividade no relógio, os steps estruturados aparecem
- **Plano B documentado:** se a API falhar, gerar arquivo .FIT local e mostrar instrução de importação manual

### Dependências
- US-02, US-07

### Riscos
- **RISCO ALTO:** Garmin pode fechar o acesso do `python-garminconnect` novamente. **Mitigação:** implementar plano B (.FIT manual) como fallback desde o início; não deixar para depois.

---

## US-09 — Marcar Feedback do Treino

**Épico:** E5 — Ciclo Adaptativo
**Pontos:** 1
**Prioridade:** Must Have
**Sprint:** 6

### Narrativa
Como usuário que acabou de fazer um treino, quero marcar se foi fácil, médio ou difícil com um clique, para que o sistema acompanhe como estou respondendo à carga.

### Critérios de Aceitação
- Após sincronização da atividade (via US-03), notificação aparece no app: "como foi seu treino de hoje?"
- Três botões grandes: 😌 fácil / 😐 médio / 😣 difícil
- Clique salva feedback no Supabase (tabela `workout_feedback`)
- Feedback opcional (usuário pode ignorar)

### Definition of Done
- Feedback de 3 botões funciona e persiste
- Histórico de feedbacks é consultável no banco

### Dependências
- US-03 (atividade precisa estar sincronizada)

---

## US-10 — Recalibração Simples do Plano

**Épico:** E5 — Ciclo Adaptativo
**Pontos:** 3
**Prioridade:** Must Have
**Sprint:** 6

### Narrativa
Como usuário que vem dando feedback, quero que o plano se recalibre automaticamente quando meu corpo dá sinais consistentes de fadiga ou folga, para que o treino acompanhe minha realidade sem eu ter que pedir.

### Critérios de Aceitação
- Regra: se os últimos 3 feedbacks forem "difícil", chamar US-06 com instrução de redução de 15% de volume
- Regra: se os últimos 3 feedbacks forem "fácil", chamar US-06 com instrução de aumento de 5% de volume (respeitando limite de progressão)
- Antes de regenerar, notificar usuário: "seu último ciclo foi consistentemente [fácil/difícil], posso ajustar o plano?"
- Usuário aceita ou recusa
- Novo plano substitui o anterior, mantendo histórico

### Definition of Done
- Ciclo fecha pelo menos uma vez com recalibração real
- Novo plano respeita a instrução de ajuste

### Dependências
- US-06, US-09

---

## Resumo por Sprint

| Sprint | Semanas | Stories | Pontos |
|--------|---------|---------|--------|
| Sprint 1 | 1-2 | US-01, US-02, US-03 | 10 |
| Sprint 2 | 3-4 | US-04, US-05, US-06, US-07 | 16 |
| Sprint 3 | 5-6 | US-08, US-09, US-10 | 9 |
| **Total** | **6 semanas úteis** | **10 stories** | **35 pts** |

> Observação: a soma dá 35 porque duas stories ficaram ligeiramente maiores do que inicialmente estimado no doc principal (32). Buffer de 3 pontos é o colchão para imprevistos — não é permissão para escopo novo.

Sobram 2 semanas do roadmap total de 8 para: polimento, correção de bugs e o primeiro ciclo de dogfooding com ajustes reais.

---

## O Que Ficou Fora (Stories Adiadas)

Para preservar o escopo, as histórias abaixo foram explicitamente **removidas** do MVP:

- Integração com ciclismo e natação
- Sincronização com Apple Watch, Coros, Polar, Suunto
- Dashboard de evolução com gráficos de carga (TSS/ATL/CTL)
- Detecção automática de lesão por padrões de FC
- Perfis avançado, intermediário, transição
- Onboarding elaborado com anamnese
- Notificações push
- Compartilhamento de planos
- Assinatura paga via Stripe
- Publicação em App Store / Play Store

Essas histórias moram em `FUTURE.md` e só voltam à discussão após o MVP rodar com 4 ciclos completos de treino executado.
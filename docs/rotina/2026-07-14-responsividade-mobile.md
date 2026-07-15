# Rotina de UI/UX — 2026-07-14

## Foco
**Responsividade Mobile** (item 3 da rotação). Os dois relatórios anteriores
(`2026-07-13-acessibilidade-mobile-touch-ui.md` e
`2026-07-13-seguranca-tratamento-erros.md`) registraram explicitamente que o
item 3 ficou pra trás — a rotação tinha coberto 1 (Fidelidade Visual, 11/07),
2 (Componentização Clean, 12/07) e pulado direto para 4 (Acessibilidade,
13/07) — e pediram que a próxima execução priorizasse Responsividade para
recolocar a ordem em dia. Segui essa pendência: garantir que o hero "Treino
de Hoje", a faixa de metas (`WeeklyGoalRing`) e os minigráficos
(`WorkoutProfile`, `LoadChart`) — e, por extensão, o resto do fluxo de
treino do dia — caibam em telas de ~320–360pt sem quebrar layout horizontal.

## Sincronização de design
Li `Velo App.dc.html` via DesignSync (projeto "Identidade visual Velo"). O
handoff é uma mockup de canvas desktop com os frames de telefone renderizados
em `hint-size="402px,874px"` — ou seja, a referência visual do design nunca
foi testada abaixo de 402pt de largura, o que confirma a premissa desta
rotina: qualquer estreitamento de tela é responsabilidade da implementação,
não algo que o handoff documenta. Usei o card "Semana em andamento" do
handoff (`gap:18px` entre o texto e o anel, `flex-shrink:0` no anel) como
referência de anatomia esperada e comparei contra `WeeklyGoalRing.tsx`.

## Diagnóstico
Fiz inspeção manual dos componentes citados no prompt (`plan.tsx`,
`WeeklyGoalRing`, `WorkoutProfile`, `MetricChip`, `metrics.tsx`/`LoadChart`)
com cálculo de larguras reais (padding de tela + padding de card + gaps,
tokens de `theme.tokens.ts`) a 320pt, e delego um agente de exploração para
varrer o resto do app (histórico, onboarding, `workout/[id].tsx`,
`subscription.tsx`) pelo mesmo padrão de risco: `Text`/`View` dentro de
`flexDirection:'row'` sem `flex`/`flexShrink`/`numberOfLines`, especialmente
quando o container pai não tem `overflow:'hidden'` (o texto vaza
visualmente para fora da tela) ou tem (o texto é cortado no meio da palavra
em vez de encolher). Achados confirmados:

1. **`components/plan/WeeklyGoalRing.tsx:62-70`** — o `card` (`flexDirection:
   'row'`) não tinha `gap` entre o bloco de texto (`flex:1`) e o anel SVG
   fixo (78×78). O handoff usa `gap:18px` nesse mesmo card. Sem gap, a 320pt
   o título "Semana em andamento" fica colado no anel, sem respiro (256px de
   card menos 78px do anel = 178px pra um texto que já é apertado nessa
   largura).

2. **`app/plan/workout/[day].tsx:646-650` (`repRecoveryText`)** — dentro do
   card "Bloco principal" (`segmentCard`, que tem `overflow:'hidden'`), a
   linha de recuperação (`repRecovery`, linhas 267-283) tem o mesmo padrão
   de `repWork` (min + divisor + texto) mas o texto ("Trote de recuperação
   Z1") **não** estava dentro de um wrapper `flex:1` como o bloco de esforço
   irmão (linha 253, `{flex:1, gap:1}`) — ficava sem `flex` nenhum. Com
   `segmentBody` a ~253px de largura útil a 320pt, `repWork`/`repRecovery`
   consumindo ~76px de padding+gaps+coluna de minutos, sobram ~150px pro
   texto — perto o bastante do conteúdo real pra estourar e ser cortado pelo
   `overflow:'hidden'` do card pai em vez de quebrar linha como o irmão faz.

3. **`app/workout/[id].tsx:569-596` (`rpeChipGarmin`)** — o chip de RPE
   vindo do Garmin empilha ícone + valor + rótulo (`RPE_LABELS`, até "Muito
   difícil"/"Muito fácil", 13 caracteres) + `rpeChipSource` ("do seu
   relógio", `marginLeft:'auto'`) numa `flexDirection:'row'` com `flex:1`,
   sem `flexShrink`/`numberOfLines` em nenhum dos `Text` e sem
   `overflow:'hidden'` no card. Contas a 320pt: `rpeChipRow` interior ≈256px
   menos o link "Ajustar" (~50px) e o gap deixam ≈190px pro chip; menos o
   padding do próprio chip (32px) sobram ≈158px de conteúdo — contra um
   conteúdo real de ≈220px (ícone+valor+rótulo+fonte). O texto vazaria
   visualmente para fora do pill, sem nada pra conter (achado confirmado de
   forma independente pelo agente de exploração, com a mesma conta).

4. **`app/workout/[id].tsx:421-451` (`heroPills` → `datePillMuted`)** — o
   pill de "dia da semana · data" (`{weekday} · {formatDate}`, ex.
   "Quinta-feira · 14/07/2026") ao lado do pill "Concluído", também numa
   `flexDirection:'row'` sem `flexWrap`, sem `flex`/`flexShrink` no `Text` e
   sem `overflow:'hidden'` no container pai (`hero`). O `datePillMuted` tem
   `overflow:'hidden'` na própria caixa, mas isso só recorta a própria caixa
   arredondada — como a caixa não tem largura fixa, ela cresce pro tamanho
   do texto inteiro e o conjunto ("Concluído" + data) passa de ~292px contra
   ~288px disponíveis a 320pt para a maioria dos dias da semana (todos
   exceto "Sábado"/"Domingo", que são mais curtos). Achado do agente de
   exploração, verificado manualmente.

Não encontrei problema (verificado, sem alterar): `plan.tsx` (`chipRow` já
usa `flexWrap:'wrap'`; `WorkoutProfile` mini com `flexGrow`/`flexBasis:0`
distribui bem mesmo com muitos segmentos, sem estourar a 320pt);
`metrics.tsx` (grade de `MetricBox` com `flexBasis:'46%'` cabe folgada;
`LoadChart` usa `barWrapper:{flex:1}`); `RpeScale.tsx` (`flexBasis:'17%'`
com `flexWrap:'wrap'` já quebra em 2 linhas de 5, confirmado no relatório de
acessibilidade anterior); componentes de `plan/*` (`SendToWatch`,
`CoachInsights`, `CalibrationBanner`, `FallbackPlanBanner`,
`CalibrationDoneNotice`, `GenerationProgress`), `history/*` e grades de
onboarding já usam `flex:1`/`flexWrap` corretamente.

## Arquivos modificados
- `apps/mobile/components/plan/WeeklyGoalRing.tsx`
- `apps/mobile/app/plan/workout/[day].tsx`
- `apps/mobile/app/workout/[id].tsx`

## Ações realizadas
- **`WeeklyGoalRing`**: adicionei `gap: Spacing.md` (16, o token mais
  próximo do `18px` do handoff) ao `card`. Ganho: o título e o anel deixam
  de colar um no outro; em telas estreitas o título passa a quebrar em 2
  linhas de forma limpa (com respiro) em vez de ficar espremido contra o
  anel sem nenhuma margem.
- **`repRecoveryText`** (`plan/workout/[day].tsx`): adicionei `flex: 1` ao
  estilo, igualando o tratamento que `repDesc`/`repPace` (bloco de esforço
  irmão) já tinham. Ganho: o texto de recuperação agora quebra linha dentro
  do espaço disponível em vez de arriscar corte no meio da palavra pelo
  `overflow:'hidden'` do card.
- **`rpeChipLabel`/`rpeChipSource`** (`workout/[id].tsx`): adicionei
  `flexShrink: 1` a ambos os estilos e `numberOfLines={1}
  ellipsizeMode="tail"` aos `Text` correspondentes (nos dois estados do chip
  — RPE vindo do Garmin e RPE editado manualmente). Ganho: em vez de vazar
  texto para fora do pill em telas estreitas, o rótulo ("Muito difícil") e a
  fonte ("do seu relógio") agora encolhem e truncam com reticências,
  permanecendo dentro dos limites visuais do componente; em telas ≥360pt o
  texto continua aparecendo por inteiro (confirmado visualmente, ver
  Verificação).
- **`datePillMuted`** (`workout/[id].tsx`): adicionei `flexShrink: 1` ao
  estilo e `numberOfLines={1} ellipsizeMode="tail"` ao `Text`. Ganho: o pill
  de dia da semana + data trunca com reticências em vez de estourar a
  largura da tela ao lado do pill "Concluído" — antes acontecia pra quase
  todos os dias da semana (nomes com 6+ letras) em telas de 320pt.

## Verificação
- `bun install` na raiz: ok.
- `bun x tsc --noEmit` em `apps/mobile`: passou limpo, sem erros.
- `bun run check` (biome, raiz): limpo.
- **Verificação visual real** (não só leitura de código): criei uma tela
  temporária (`app/_preview.tsx`, fora do Stack normal por convenção do
  Expo Router — arquivos prefixados com `_` não viram rota) renderizando os
  quatro componentes/trechos corrigidos com o pior caso de conteúdo (RPE 8
  "Muito difícil" vindo do Garmin, treino intervalado com 15 segmentos,
  "Quinta-feira · 14/07/2026"), com `.env.local` de placeholders só pra
  passar da inicialização do client Supabase. Rodei `bunx expo export
  --platform web`, servi o bundle com um servidor estático próprio com
  fallback de SPA (o `http.server` do Python não roteia paths do
  client-side router pro `index.html`, dava 404) e abri via Playwright
  (Chromium headless, `/opt/pw-browsers`) em 320pt e 360pt de viewport:
  - `document.scrollWidth` == `window.innerWidth` nas duas larguras — **zero
    overflow horizontal** medido programaticamente, antes e depois confirmado
    visualmente pelos screenshots.
  - A 320pt: RPE chip mostra "Muito …" / "do seu r…" truncados com
    reticências, dentro do pill; `datePillMuted` mostra "Quinta-feira ·
    14/…" truncado; título do `WeeklyGoalRing` quebra em 2 linhas com
    respiro do anel.
  - A 360pt: RPE chip mostra "Muito difícil do seu relógio" por inteiro
    (sem truncar) e o título do `WeeklyGoalRing` cabe numa linha só —
    confirma que a correção só trunca quando realmente falta espaço, sem
    perder informação nas larguras mais folgadas.
  - `_preview.tsx` e `.env.local` foram apagados antes do commit — não
    sobem pro git; `git status` confirma que só os 3 arquivos de produção
    ficaram modificados.
- Pre-commit (biome + testes de `@fitsync/metrics`) roda no commit.

## Pendências
- **`app/subscription.tsx:262` (`planPriceRow`)** — o agente de exploração
  sinalizou como "limítrofe": preço + período + `plan.sub` numa row sem
  `flexShrink`, mas dentro de um `planCard` que **tem** `overflow:'hidden'`
  (então na pior hipótese corta, não vaza pra fora da tela). Não tenho
  confiança suficiente de que seja overflow real sem medir em dispositivo, e
  a tela de assinatura está fora da lista de componentes citados pelo
  prompt (hero/meta/minigráficos) — deixei registrado para confirmação
  futura em vez de alterar uma tela de monetização com base em estimativa.
- Não toquei nos outros itens da rotação (Otimização de Interação, item 5,
  segue como o único nunca coberto por esta trilha específica de UI/UX)
  nem repeti fidelidade/componentização/acessibilidade, já cobertos.
- `DESIGN.md` desatualizado (paleta e nomes antigos) segue como pendência
  registrada desde 11/07 — fora do escopo desta rotina.
- A verificação visual cobriu os componentes isolados com dados mockados
  (pior caso realista), não o fluxo autenticado ponta-a-ponta — mesma
  limitação já registrada no relatório de 12/07 (sem backend/sessão real
  neste ambiente sandbox).

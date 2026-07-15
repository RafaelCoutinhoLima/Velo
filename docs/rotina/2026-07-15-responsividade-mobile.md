# Rotina de UI/UX — 2026-07-15

## Foco
**Responsividade Mobile** (item 3 da rotação). Os dois relatórios anteriores de UI/UX
(2026-07-12 — Componentização Clean, 2026-07-13 — Acessibilidade Mobile e Touch UI)
registraram explicitamente como pendência que o item 3 não tinha execução própria e
pediram que a próxima rotina o priorizasse para recolocar a rotação em ordem. Segui essa
recomendação.

## Sincronização de design
Li `Velo App.dc.html` (DesignSync, projeto "Identidade visual Velo", seção `#s04 ·
PLANO DA SEMANA`) e comparei o "today hero" do handoff com `app/(tabs)/plan.tsx`. O
handoff mostra o rótulo do dia da semana como forma curta — `"Terça"` — ao lado do pill
`"Treino de hoje"`. O código usava `PT_WEEKDAYS_FULL` com sufixo `-feira` (`"Terça-feira"`,
13 caracteres), uma divergência de fidelidade que também é a causa direta de um problema
de responsividade: React Native não faz wrap/shrink automático entre `Text` irmãos numa
`row` (`flexShrink` padrão é `0`, diferente do CSS web), então dois textos de largura
fixa lado a lado (pill + dia da semana) podem ultrapassar a largura do card sem quebrar
linha — apenas cortam/vazam.

## Diagnóstico
Medi as larguras disponíveis contra os tokens reais (`Spacing`/`FontSize` de
`lib/theme.tokens.ts`) para uma tela de referência de 320pt:

1. **Hero "Treino de Hoje"** (`apps/mobile/app/(tabs)/plan.tsx:391-398`, estilos
   `heroEyebrowRow`/`heroPill`/`heroWeekday` em `:634-654`): largura interna do card em
   320pt = 320 − 2×`Spacing.md` (padding da `ScrollView`) − 2×`Spacing.lg` (padding do
   card) = **240pt**. O pill `"TREINO DE HOJE"` (JetBrains Mono 11px + tracking wide +
   padding) ocupa ~126–134pt; o dia da semana no formato completo (ex.: `"SEGUNDA-FEIRA"`,
   13 caracteres, mesmo tratamento tipográfico) mais o `gap` chegam a ~240–250pt —
   estourando ou ficando na margem exata da largura disponível, sem qualquer wrap ou
   truncamento (nenhum dos dois `Text` tinha `flexShrink`/`numberOfLines`).
2. **Mesmo padrão duplicado** em `apps/mobile/app/workout/[id].tsx:206-213` (hero do
   treino concluído): `donePill` ("✓ Concluído") + `datePillMuted` (`"{weekday} ·
   {data}"`) numa `row` sem `flexShrink` em nenhum dos dois — com o weekday completo
   (`"Segunda-feira · 14/07"`, ~21 caracteres) o texto ficava na borda/estourava a
   largura do hero (320 − 2×`Spacing.md` = 288pt disponíveis contra ~272pt+ ocupados,
   sem folga para acomodar fontes maiores de acessibilidade).

Verifiquei e **não** encontrei violação em (dentro do escopo do foco, sem necessidade de
mexer): `WeeklyGoalRing.tsx` (faixa de metas — anel fixo 78×78 com `flex:1` no bloco de
texto, título/subtítulo apenas fazem wrap normal de `Text`, comportamento esperado, não
overflow horizontal), `WorkoutProfile.tsx` (perfil de intensidade — barras usam
`flexGrow`/`flexBasis: 0`/`minWidth: 2`, sempre cabem na largura do pai), `LoadChart`
(`app/metrics.tsx` — barras com `width: '100%'` dentro de `flex: 1`, sem largura fixa),
`MetricChip.tsx`/`chipRow` (já usa `flexWrap: 'wrap'`), `dayCard`/`dayBadges` (área da
esquerda é `flex: 1`, badges à direita são curtos e cabem com folga), `metricBox`
(bento grid com `flexBasis: '46%'`, responsivo). `plan/workout/[day].tsx` já usa a forma
abreviada `PT_WEEKDAYS` (`'Seg'`, `'Ter'`...) no cabeçalho — não estava exposto ao mesmo
bug.

## Arquivos modificados
- `apps/mobile/app/(tabs)/plan.tsx`
- `apps/mobile/app/workout/[id].tsx`

## Ações realizadas
- **Rótulo do dia da semana encurtado para bater com o handoff**: troquei
  `PT_WEEKDAYS_FULL` (`'Segunda-feira'`, `'Terça-feira'`...) pela forma curta
  (`'Segunda'`, `'Terça'`...) em ambos os arquivos — igual ao que o design mostra no
  "today hero" (`Velo App.dc.html`). Ganho duplo: alinha a fidelidade visual ao handoff
  *e* reduz a largura ocupada pelo rótulo em ~40%, eliminando a margem zero/estouro
  medida no diagnóstico sem mudar nenhuma outra regra de negócio (a data completa
  continua disponível via `formatDate`/`getDayLabel` onde já existia).
- **Defesa estrutural contra overflow horizontal**: adicionei `flexShrink: 0` aos pills
  fixos (`heroPill` em `plan.tsx`, `donePill` em `workout/[id].tsx`) e `flexShrink: 1` +
  `numberOfLines={1}`/`ellipsizeMode="tail"` aos textos variáveis ao lado
  (`heroWeekday`, `datePillMuted`). Ganho: mesmo em cenários não cobertos pela medição
  estática — fonte de acessibilidade maior (Dynamic Type/Ajuste de Fonte do sistema),
  device ainda mais estreito que 320pt, ou nomes de dia futuros mais longos — o texto
  agora trunca com reticências em vez de vazar visualmente para fora do card/hero.

## Verificação
- `bun install` na raiz: ok.
- `bun x tsc --noEmit` em `apps/mobile`: passou limpo, sem erros.
- `bun run check` (biome, raiz): limpo — `apps/mobile` fica fora do escopo do biome
  (`biome.json` exclui `**/mobile`).
- Pre-commit (biome + testes de `@fitsync/metrics`) executado no commit.
- Medição de largura foi feita analiticamente contra os tokens reais de
  `lib/theme.tokens.ts` (`Spacing`, `FontSize`, `Tracking`) e as métricas aproximadas da
  fonte monoespaçada JetBrains Mono, não em dispositivo/simulador real (sem
  simulador/dispositivo neste ambiente sandbox) — mesma limitação registrada nos
  relatórios anteriores desta rotina.

## Pendências
- Não revisei telas fora do escopo explícito do foco (hero, faixa de metas,
  minigráficos) — outros cabeçalhos com pares pill+texto fora dessas três áreas (ex.:
  banners em `components/plan/*`) não foram auditados nesta execução; se o padrão
  "dois `Text` de largura fixa numa `row` sem `flexShrink`" se repetir em telas novas,
  vale generalizar como regra de lint/checklist numa rotina futura.
- Não consegui validar visualmente em dispositivo/simulador de 320pt real — a
  verificação ficou em nível de `tsc` + cálculo analítico de largura contra os tokens de
  design, não em screenshot comparado ao handoff.
- `DESIGN.md` desatualizado (pendência recorrente desde 2026-07-11) segue fora do
  escopo desta rotina.
- Rotação de foco: com Fidelidade Visual (1), Componentização Clean (2), Responsividade
  Mobile (3, este relatório) e Acessibilidade Mobile e Touch UI (4) cobertos, o próximo
  item pendente é o **5 — Otimização de Interação** (RPE pós-treino e fluxos de
  confirmação).

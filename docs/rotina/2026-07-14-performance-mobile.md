# Rotina de Performance — Mobile (render) — 2026-07-14

## Foco da Madrugada
**Performance** — a única categoria que a rotina ainda não tinha coberto, registrada como
"candidata natural para a próxima execução" nas Pendências do relatório de 13/07
(segurança e tratamento de erros). O lado servidor já teve uma passada forte de
performance fora da rotina (`45ed5f4` — verificação local de JWT, batching, paralelismo;
`eb415f9` — índices Postgres e RLS), então repetir esse trabalho estava fora de questão.
O que sobrou — e o que esta execução corrige — é um anti-padrão de render no **client
mobile**: sub-componentes React definidos dentro do corpo da função do componente pai,
presente em 8 telas do app.

## Diagnóstico

O padrão problemático: `function TelaX() { ... function SubComponente() {...}; return
<SubComponente/> }`. A cada render do pai, a função `SubComponente` é recriada — um novo
valor, nova identidade. O React decide entre reconciliar (diff de props) ou desmontar e
remontar a subárvore inteira comparando a **identidade referencial** do `type` do
elemento. Como a identidade muda a cada render do pai, todo re-render do pai (qualquer
`setState`, refetch do TanStack Query, troca de tema) desmonta e remonta os
sub-componentes do zero: o estado interno deles é perdido, e o React Native destrói e
recria as views nativas correspondentes — trabalho caro que a reconciliação normal
evitaria por completo.

Duas evidências concretas, confirmadas por leitura do código (linhas do código
**antes** desta correção):

1. **`apps/mobile/app/metrics.tsx` — o card de métrica fecha sozinho.** `MetricBox`
   (linha 49) era definido dentro de `MetricsScreen` e tem estado próprio: `const
   [expanded, setExpanded] = useState(false)` (linha 66), que controla se a descrição do
   card está aberta. `MetricsScreen` tem o `Switch` de "Modo Avançado" (`onValueChange=
   {setAdvancedMode}`, linha 166) e um `useQuery` com refetch — ambos re-renderizam o
   pai. Cenário reproduzível: o atleta toca no card ACWR para ler a descrição
   ("Carga dos últimos 7 dias dividida pelos últimos 28…") → toca no switch de Modo
   Avançado (ou o refetch dispara) → `MetricBox` é remontado como componente novo, o
   `useState(false)` roda de novo → **a descrição que ele acabou de abrir fecha
   sozinha**, sem nenhuma ação sobre aquele card. `LoadChart` (linha 93) sofria a mesma
   remontagem (sem estado, mas com recriação das views nativas das 14 barras a cada
   render do pai).

2. **`apps/mobile/app/onboarding/profile.tsx` — risco de perda de foco no teclado.**
   `WeightPicker` (linha 159) é um `TextInput` **controlado** e `YearPicker` (linha 116)
   contém um `useRef<FlatList>` e o scroll interno da lista horizontal de anos — ambos
   definidos dentro de `ProfileScreen`, que tem 7 `useState` (`birthYear`, `weightKg`,
   `sex`, `frequency`, `availableDays`, `loading`, `error`, linhas 54–60). Qualquer
   mudança — inclusive **digitar no próprio campo de peso** (`setWeightKg` a cada tecla)
   — re-renderiza a tela inteira e recria `WeightPicker` como um tipo novo. É o padrão
   clássico e bem documentado de "por que meu input perde o foco a cada tecla": o
   `TextInput` antigo é desmontado (levando o foco do teclado junto) e um novo é montado.
   No `YearPicker`, a remontagem também descarta a posição de scroll do `FlatList`.

O mesmo anti-padrão existia em mais 6 telas (lista completa abaixo) — sem estado interno
nos sub-componentes, mas pagando o custo de desmontar/remontar views nativas em todo
re-render do pai.

## Arquivos Modificados
- `apps/mobile/app/plan/new.tsx` — `InfoRow` extraído
- `apps/mobile/app/metrics.tsx` — `MetricBox` e `LoadChart` extraídos
- `apps/mobile/app/onboarding/goal.tsx` — `ModeCard` extraído
- `apps/mobile/app/onboarding/garmin.tsx` — `BenefitRow` extraído
- `apps/mobile/app/onboarding/profile.tsx` — `SectionCard`, `SectionTitle`, `YearPicker`,
  `WeightPicker` e `OptionGrid<T>` extraídos (o generic foi mantido)
- `apps/mobile/app/workout/[id].tsx` — `SplitPanel` e `GridStat` extraídos
- `apps/mobile/app/(tabs)/settings.tsx` — `SettingRow`, `SectionLabel`, `ThemeSelector`
  e `AccentSelector` extraídos
- `apps/mobile/app/(tabs)/conquistas.tsx` — `StatCard` e `MilestoneBadge` extraídos
- `docs/rotina/2026-07-14-performance-mobile.md` (este relatório)

## Ações Realizadas e Justificativas

1. **Extração mecânica 1:1 para escopo de módulo.** Cada sub-componente saiu do corpo da
   função da tela e virou uma função top-level do mesmo arquivo (posicionada antes do
   `createStyles`, com comentário explicando o porquê). Definido uma única vez no load do
   módulo, o componente passa a ter **identidade de tipo estável entre renders** — o
   React vê o mesmo `type` no elemento e **reconcilia** (diff de props) em vez de
   desmontar/remontar. Isso corrige o bug do `MetricBox` (o `expanded` sobrevive a
   re-renders do pai), elimina o risco de perda de foco no `WeightPicker` (o `TextInput`
   é o mesmo nó nativo entre teclas) e preserva o scroll do `YearPicker`.

2. **Closures viraram props explícitas.** Fora do corpo da tela, os sub-componentes
   perdem acesso ao `theme`/`styles`/estado do pai por closure, então tudo virou prop:
   `theme: Theme` onde há acesso pontual a `theme.colors.X`, e `styles:
   ReturnType<typeof createStyles>` (alias `type Styles` nos arquivos com vários
   sub-componentes) — os estilos **não** são recriados dentro do sub-componente, o mesmo
   objeto memoizado do pai (`useMemo(() => createStyles(theme), [theme])`) é passado
   adiante. Em `settings.tsx`, `ThemeSelector` e `AccentSelector` fechavam sobre sete
   variáveis do pai (`available`, `themeName`, `setThemeName`, `availableAccents`,
   `accentName`, `setAccentName`, `theme`) — todas viraram props tipadas (com
   `AccentName` importado de `lib/theme`). Constantes que já viviam no escopo de módulo
   (`THEME_PREVIEWS`, `ACCENTS`, `YEARS`, `ITEM_W`, `ITEM_GAP`) continuam acessadas
   diretamente, sem virar prop. Nomes, ordem de props, JSX, textos e estilos ficaram
   idênticos — zero mudança de comportamento visual ou de lógica.

3. **Nenhum sub-componente extraído usa outro sub-componente extraído** (verificado em
   cada arquivo — `SectionCard`/`SectionTitle` são irmãos compostos no JSX da tela, não
   aninhados entre si), então nenhuma extração dependeu de outra.

4. **Sem `React.memo` de propósito.** O objetivo era corrigir o bug de identidade
   instável (correção segura, semanticamente neutra), não otimizar renders além disso.
   `memo` mudaria o perfil de re-render dos filhos e exigiria auditar cada prop
   (callbacks inline, objetos novos a cada render) — otimização especulativa fora do
   escopo, anotada como pendência.

### Verificação
- `bun x tsc --noEmit` em `apps/mobile`: **limpo** (zero erros; foi necessário rodar
  `bun install` no sandbox antes, pois as deps não estavam instaladas e o tsconfig do
  Expo vive em `node_modules`).
- `bun run check` (biome, raiz): **limpo** — "Checked 89 files. No fixes applied."
- `git status`: apenas os 8 arquivos de tela listados foram modificados (nada em
  `apps/api/`, `services/` ou `packages/`).
- Busca por resíduos: nenhum `function [A-Z]…` indentado (componente inline) restante em
  `apps/mobile/app/`.
- **Limitação honesta**: este sandbox não tem sessão Supabase nem dados reais, então não
  foi possível rodar o app e **observar** em runtime o bug do `MetricBox` fechando
  sozinho (nem sua ausência após o fix). A correção se apoia no comportamento documentado
  e determinístico da reconciliação do React (identidade referencial do `type` decide
  reconciliar vs. remontar) e na verificação estática acima. Recomendado o smoke test
  manual do DoD: abrir Métricas → expandir ACWR → alternar Modo Avançado (descrição deve
  permanecer aberta); e no onboarding de perfil, digitar o peso (foco do teclado deve
  permanecer no campo).

### Pendências
- **Smoke test manual em device** dos dois cenários acima (Métricas e Perfil) na próxima
  sessão com Expo — a rotina não tem como executar o app.
- `React.memo` nos sub-componentes extraídos ficou de fora de propósito; se algum perfil
  de render mostrar custo real (ex.: `SettingRow` re-renderizando a lista toda), avaliar
  caso a caso com as props estabilizadas.
- Vários desses sub-componentes são estruturalmente parecidos entre telas (`StatCard`,
  `GridStat`, `SectionCard`/`SectionLabel`) — candidatos a promoção para
  `apps/mobile/components/` numa próxima rotina de Refatoração, agora que estão em
  escopo de módulo com props explícitas.
- Item 3 de Responsividade Mobile (pendente da trilha de UI/UX desde 13/07) segue em
  aberto.

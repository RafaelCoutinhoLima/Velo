# Rotina de UI/UX — 2026-07-11

## Foco
**Fidelidade Visual.** Primeira execução da rotina (não havia relatórios anteriores em
`docs/rotina/`), então segui a ordem da rotação a partir do item 1 do prompt: alinhar
estilos do código estritamente ao handoff `Velo App.dc.html` (fonte de verdade, confirmada
pelo comentário em `apps/mobile/lib/themes/veloLight.ts:1-5`) e às regras nomeadas do
`DESIGN.md` (One Voice, Color-Is-Not-The-Label, Three-Levels de sombra, No-Pure-Black-Or-White).

Nota: `DESIGN.md` na raiz descreve um sistema antigo ("FitSync AI", temas `interstellar`/
`interspaceBlue`, paleta `#4777c2`/`#2e7d32`/`#ed6c02`). O código e o handoff `Velo App.dc.html`
já migraram para a identidade atual (`veloLight`/`veloDark`, paleta `#2a5ea7`/`#2f9e6f`/
`#ff8b00`) — usei o handoff + o código como referência viva, já que é isso que
`veloLight.ts` declara como fonte da verdade. `DESIGN.md` seguir desatualizado é uma
pendência (ver abaixo), não algo que eu deveria "corrigir" reescrevendo-o sem mais contexto.

## Diagnóstico
Comparei os tokens do handoff (cores extraídas de `Velo App.dc.html` via DesignSync) com
`apps/mobile/lib/themes/veloLight.ts` / `veloDark.ts` (que já batem) e depois varri o app em
busca de trechos que se desviam desses tokens:

1. **Sombra preta pura em vez de tingida** (viola a No-Pure-Black-Or-White Rule e a
   convenção já estabelecida em `veloDark.ts` de que elevação no escuro vira ausência de
   sombra, não sombra preta):
   - `apps/mobile/components/history/ViewToggle.tsx:64` — `shadowColor: '#000'` no pill ativo.
   - `apps/mobile/app/plan/workout/[day].tsx:558` — mesmo padrão, duplicado, no toggle
     Estrutura/Timeline.

2. **Preview de tema com cores hardcoded, duplicando (e podendo divergir de) os tokens
   reais** — viola o espírito do "Do usar `useTheme()`... nenhum import estático de cor deve
   ficar desatualizado" do `DESIGN.md`:
   - `apps/mobile/app/(tabs)/settings.tsx:156,165` — os swatches do seletor de tema claro/
     escuro usavam `'#5b95f7' / '#2a5ea7'` e `'#101113' / '#f5f8fd'` escritos à mão, em vez de
     ler `veloLight.colors` / `veloDark.colors` diretamente. Se a paleta mudar em
     `veloLight.ts`/`veloDark.ts`, esse preview ficaria mentiroso silenciosamente.

3. **Raio de card fora da escala de tokens** (`Radii.sm/md/lg/xl/full` = 8/12/16/20/9999):
   - `apps/mobile/app/plan/workout/[day].tsx:578` — `segmentCard` (container do bloco
     Aquecimento/Principal/Volta à calma) usava `borderRadius: 14`, valor mágico, enquanto o
     `card` genérico do mesmo arquivo (linha 509) usa `Radii.lg` (16) — inconsistência dentro
     do próprio arquivo.

Verifiquei também, sem encontrar violação: `Button.tsx` (pill, disabled via token — não
opacidade —, `activeOpacity` sem `scale`), `MonthSummary.tsx` (o único `borderLeftWidth`
restante do app é um divisor neutro de coluna, não um acento colorido — não viola a regra),
`AccentSelector` em `settings.tsx` (já lê de `ACCENTS`, correto), e uso de `Display`
(nenhuma tela repete o preset `display` duas vezes).

## Arquivos modificados
- `apps/mobile/components/history/ViewToggle.tsx`
- `apps/mobile/app/plan/workout/[day].tsx`
- `apps/mobile/app/(tabs)/settings.tsx`

## Ações realizadas
- Troquei `shadowColor: '#000'` por `theme.colors.textPrimary` (tinta azul-marinho do tema,
  já é o "ink" do sistema) nos dois toggles ativos, e tornei a sombra condicional
  (`theme.name === 'veloDark' ? null : {...}`) — no escuro a elevação some, como o resto do
  tema já faz em `card`/`elevated` de `veloDark.ts`. Ganho: os dois toggles (Histórico e
  Estrutura/Timeline) agora respeitam a regra "sem preto puro" e a convenção de elevação do
  tema escuro, em vez de vazar um preto hardcoded.
- Troquei `segmentCard.borderRadius: 14` por `Radii.lg` — alinha com o `card` do mesmo
  arquivo e com a escala de raios documentada.
- Removi os hex duplicados do seletor de tema em `settings.tsx` e passei a ler
  `veloLight.colors.primary/bg` e `veloDark.colors.primary/bg` direto (import de
  `lib/themes`, não de `lib/theme` — o preview precisa do tema *inativo*, que `useTheme()`
  não expõe). Ganho: o preview nunca mais pode divergir da paleta real; qualquer alteração
  futura em `veloLight.ts`/`veloDark.ts` já reflete automaticamente no seletor.

## Verificação
- `bun install` na raiz: ok.
- `bun x tsc --noEmit` em `apps/mobile`: passou limpo, sem erros.
- Pre-commit (biome + testes de metrics) executado no commit.

## Pendências
- `DESIGN.md` na raiz está desatualizado (paleta e nomes de tema antigos) frente ao handoff
  `Velo App.dc.html` e ao código. Não toquei nele porque reescrever a documentação de design
  é uma decisão de conteúdo/produto maior que o escopo desta rotina (risco de eu "inventar"
  texto sem a mesma curadoria do documento original) — sinalizando para decisão humana ou
  para uma rotina futura dedicada a isso.
- Raios "mágicos" de 10px em ícones/badges circulares (`onboarding/profile.tsx:410`,
  `onboarding/garmin.tsx:255`, `SendToWatch.tsx:175`, `WorkoutCard.tsx:88`,
  `[day].tsx:641`) não foram alterados: são usados de forma consistente em 6+ lugares como
  raio de badge de ícone (distinto do raio de card), então tratei como convenção
  intencional, não desvio — mas vale confirmar com o design se merece virar token nomeado
  (ex. `Radii.badge`) numa rotina de Componentização.
- `logoBadge` em `app/(auth)/login.tsx:252` usa `borderRadius: 22` (fora da escala,
  mais próximo de `Radii.xl`=20) — é uma marca hero única (não repetida), então deixei de
  fora por baixa confiança de que seja de fato um desvio e não uma escolha de marca
  deliberada.
- Não mexi em componentização (RPE scale, headers duplicados) nem em outros focos da
  rotação — ficam para as próximas execuções.

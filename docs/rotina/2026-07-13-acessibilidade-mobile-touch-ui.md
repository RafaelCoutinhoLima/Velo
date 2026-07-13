# Rotina de UI/UX — 2026-07-13

## Foco
**Acessibilidade Mobile e Touch UI** (item 4 da rotação).

**Nota sobre ordem da rotação**: os relatórios anteriores cobriram o item 1 (Fidelidade
Visual, 2026-07-11) e o item 2 (Componentização Clean, 2026-07-12). Pela ordem estrita da
rotação, o próximo item não feito seria o 3 (Responsividade Mobile). Nesta execução eu
comparei o handoff (`Velo App.dc.html` via DesignSync) com o código, fiz um spot-check de
fidelidade visual (hero card "Treino de hoje" bate com o handoff em cor, raio, sombra —
sem divergência nova digna de correção) e então rodei uma auditoria de acessibilidade
*antes* de notar que o item 3 ainda não tinha relatório. A auditoria já tinha achados
concretos e verificáveis (long-press sem alternativa acessível, zero live regions no app
inteiro), então decidi terminar o foco 4 em vez de descartar o trabalho. **Pendência
explícita**: a próxima execução desta rotina deve priorizar o item 3 (Responsividade
Mobile) para recolocar a rotação em ordem.

## Sincronização de design
Li `Velo App.dc.html` (DesignSync, projeto "Identidade visual Velo") e comparei a seção
"today hero" com `app/(tabs)/plan.tsx` — cor de fundo, borda, raio (20px = `Radii.xl`) e
sombra (`elevated`) batem com o handoff. Não achei divergência visual nova; o handoff não
documenta estados de acessibilidade (é um mockup estático), então a auditoria de a11y foi
feita direto contra o código e as regras de touch UI do prompt (alvo mínimo 44×44pt,
alternativa a gestos exclusivos, live regions, `accessibilityRole/Label/State`).

## Diagnóstico
Auditoria (via agente de exploração + inspeção manual) encontrou:

1. **Mover treino de dia é possível só por long-press** (sem alternativa operável por
   leitor de tela / usuário com limitação motora):
   - `apps/mobile/app/(tabs)/plan.tsx:365-382` (hero card "Treino de hoje")
   - `apps/mobile/app/(tabs)/plan.tsx:491-505` (card de dia na timeline)
   - Ambos tinham `accessibilityHint="Segure para mover de dia"`, mas o hint só
     descreve o gesto — não o torna executável sem o timing de um long-press físico.

2. **Zero uso de `accessibilityLiveRegion` em todo o app** (`grep` confirmou 0
   ocorrências): erros e estados assíncronos mudam visualmente sem qualquer anúncio a
   leitor de tela.
   - `apps/mobile/components/ErrorCard.tsx:13-17` — usado em `workout/[id].tsx` (erro de
     carregamento e de salvar RPE) sem `accessibilityRole="alert"` nem live region.
   - `apps/mobile/components/plan/GenerationProgress.tsx:51` — checklist de geração do
     plano avança via `setInterval` só visualmente.
   - `apps/mobile/app/workout/[id].tsx:360-362` — texto "Salvando…" do RPE sem anúncio.

3. **Alvo de toque abaixo de 44×44pt sem `hitSlop`**:
   - `apps/mobile/app/workout/[id].tsx:325-331` e `342-348` — links "Ajustar"/"Alterar"
     do RPE são só o texto (~30×18pt de área de toque).
   - `apps/mobile/components/history/MonthCalendar.tsx:56-80` — setas de navegação de
     mês (`navBtn`) são 40×40, abaixo do mínimo.

4. **`accessibilityRole`/`accessibilityState` ausentes em elementos selecionáveis**:
   - `apps/mobile/app/(tabs)/plan.tsx:365-382` e `491-505` — os dois `TouchableOpacity`
     tinham `accessibilityLabel` mas não `accessibilityRole="button"` nem
     `accessibilityState={{selected}}` para o estado "segurando para mover".

Verifiquei e **não** encontrei violação em (fora do escopo desta rotina, então não
mexi): `RpeScale.tsx` — os 10 botões de RPE quebram em 2 linhas de 5 (não 1 linha de 10
como parecia à primeira vista, por causa de `flexBasis: '17%'` com `flexWrap`), o que dá
~46×52pt por botão em tela de 320pt — já dentro do mínimo, sem necessidade de `hitSlop`.
`Button.tsx`, `RpeScale.tsx` e `ViewToggle.tsx`/`MonthCalendar.tsx` (chips) já usam
`accessibilityRole`/`accessibilityState` corretamente.

## Arquivos modificados
- `apps/mobile/app/(tabs)/plan.tsx`
- `apps/mobile/app/workout/[id].tsx`
- `apps/mobile/components/ErrorCard.tsx`
- `apps/mobile/components/plan/GenerationProgress.tsx`
- `apps/mobile/components/history/MonthCalendar.tsx`

## Ações realizadas
- **Alternativa acessível ao long-press** (`plan.tsx`, hero card e card de dia): adicionei
  `accessibilityRole="button"`, `accessibilityState={{selected}}` e
  `accessibilityActions={[{name: 'longpress', label: 'Mover treino de dia'}]}` com
  `onAccessibilityAction` chamando o mesmo `handleLongPress` já usado pelo gesto físico.
  Ganho: VoiceOver/TalkBack expõem "Mover treino de dia" como ação customizada (rotor/menu
  de ações), então o fluxo de mover treino deixa de depender de um gesto por tempo que
  parte dos atletas não consegue executar — sem mudar a UX visual pra quem usa toque normal.
- **Live regions** em `ErrorCard` (`accessibilityRole="alert"` +
  `accessibilityLiveRegion="assertive"`), no checklist de `GenerationProgress`
  (`accessibilityLiveRegion="polite"` + label dinâmico "Passo N de 4: ...") e no texto
  "Salvando…" do RPE (`accessibilityLiveRegion="polite"`). Ganho: erro de carregamento/RPE,
  progresso da geração do plano e confirmação de salvamento passam a ser anunciados —
  antes, essas três mudanças de estado eram mudas para leitor de tela.
- **`hitSlop`** nos links "Ajustar"/"Alterar" do RPE (12pt em cada lado — leva a área de
  toque de ~30×18pt pra ~54×42pt) e nas setas de mês do `MonthCalendar` (4pt em cada lado,
  levando 40×40 pra 48×48, acima do mínimo).

## Verificação
- `bun install` na raiz: ok.
- `bun x tsc --noEmit` em `apps/mobile`: passou limpo, sem erros.
- `bun run check` (biome, raiz): ok — `apps/mobile` está fora do escopo do biome
  (`biome.json` exclui `**/mobile`), então o lint roda mas não toca nesses arquivos.
- Pre-commit (biome + testes de `metrics`) executa no commit.
- Não consegui exercitar o app real com leitor de tela ligado (sem simulador/dispositivo
  neste ambiente sandbox) — a verificação ficou em nível de `tsc` + inspeção manual do JSX
  contra a API de acessibilidade do React Native (`accessibilityActions`/
  `onAccessibilityAction`/`accessibilityLiveRegion` são APIs padrão e documentadas do RN).

## Pendências
- **Item 3 da rotação (Responsividade Mobile) segue sem execução** — deve ser o foco da
  próxima rotina, para recolocar a rotação em ordem 3 → 5 → (novo ciclo).
- `CalibrationDoneNotice.tsx:11-27` — o ícone visual de fechar (18px) não tem `hitSlop`
  próprio, mas a linha inteira já é tocável, então não tratei como violação; vale
  confirmar se a linha inteira realmente aciona o fechamento em todos os casos numa
  rotina futura.
- Não adicionei `accessibilityActions` equivalentes em outras telas com `onLongPress` —
  uma busca rápida (`grep -rn onLongPress`) não achou outros usos fora de `plan.tsx`, mas
  vale reconferir se novas telas introduzirem o padrão.
- `DESIGN.md` desatualizado (pendência já registrada nos dois relatórios anteriores)
  continua fora do escopo desta rotina.

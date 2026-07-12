# Rotina de UI/UX — 2026-07-12

## Foco
**Componentização Clean.** O relatório anterior (`2026-07-11-fidelidade-visual.md`)
cobriu o item 1 da rotação (Fidelidade Visual) e listou como pendência explícita
"não mexi em componentização (RPE scale, headers duplicados)". Segui a ordem da
rotação para o item 2: isolar blocos repetidos em componentes reutilizáveis, sem
abstração desnecessária.

## Sincronização de design
Antes de escolher o foco, li `Velo App.dc.html` (DesignSync, projeto "Identidade
visual Velo") em busca da anatomia canônica do botão de voltar, já que ele é o
principal candidato a extração. O handoff mostra dois tamanhos convivendo (9×
`40×40px / border-radius:12px` e 5× `44×44px / border-radius:12px`/`13px`) — sem
um padrão único explícito no design. Como o código já usa `44×44` em 5 das 6
telas (só `plan/workout/[day].tsx` destoava com `42×42`) e `44×44` é também o
alvo mínimo de toque recomendado (regra que a rotina de Acessibilidade ainda vai
formalizar), usei `44×44` + `Radii.md` (12px, bate com o raio mais comum do
handoff) como anatomia canônica do componente extraído.

## Diagnóstico
1. **Header "voltar" duplicado em 6 telas**, todas com o mesmo
   `TouchableOpacity` (ícone `arrow-back`, `onPress={() => router.back()}`,
   `accessibilityRole="button"`, `accessibilityLabel="Voltar"`) e o mesmo
   container de header, com pequenas divergências acidentais entre cópias
   (tamanho 42×42 vs 44×44, `borderWidth` 1 vs 1.5):
   - `apps/mobile/app/workout/[id].tsx:133-144` (função local `BackButton`)
   - `apps/mobile/app/feedback/[id].tsx:64-73`
   - `apps/mobile/app/plan/workout/[day].tsx:322-344` (função local `Header`,
     com slot extra pra data à direita)
   - `apps/mobile/app/plan/new.tsx:96-105`
   - `apps/mobile/app/onboarding/cooper.tsx:133-142`
   - `apps/mobile/app/metrics.tsx:152-161`
2. **Escala de RPE (10 botões + rótulos de extremos) embutida inline** em
   `apps/mobile/app/workout/[id].tsx:373-400` (antes da extração), misturada
   com lógica de estado da tela (`saveRpe`, 3 estados de exibição) — bloco
   grande e auto-contido que dificultava ler o restante do arquivo.

## Arquivos modificados
- **Novos**:
  - `apps/mobile/components/BackHeader.tsx`
  - `apps/mobile/components/workout/RpeScale.tsx`
- **Refatorados** (troca do header inline por `<BackHeader />`, remoção de
  estilos/imports agora mortos):
  - `apps/mobile/app/workout/[id].tsx`
  - `apps/mobile/app/feedback/[id].tsx`
  - `apps/mobile/app/plan/workout/[day].tsx`
  - `apps/mobile/app/plan/new.tsx`
  - `apps/mobile/app/onboarding/cooper.tsx`
  - `apps/mobile/app/metrics.tsx`

## Ações realizadas
- Criei `BackHeader` (componente com `useTheme()` próprio — quem chama não
  precisa passar `theme`/`styles`): botão de voltar 44×44, `Radii.md`, borda
  1.5px, mais um slot opcional `right` para conteúdo extra (usado só em
  `plan/workout/[day].tsx` pra manter a data à direita). Ganho: elimina 6
  cópias de ~10 linhas de JSX + ~10 linhas de estilo cada; qualquer ajuste
  futuro no header de voltar (raio, alvo de toque, ícone) muda em um lugar só.
  De quebra, unifica a divergência acidental de tamanho (42→44) e borda
  (1→1.5) que existia entre `plan/workout/[day].tsx` e as outras 5 telas.
- Criei `RpeScale` a partir do bloco de 10 botões de `workout/[id].tsx`
  (grade + rótulos "muito fácil"/"máximo"), com props `value`, `onSelect` e
  `colorFor` — o componente não sabe nada sobre RPE de treino "do Garmin" vs
  manual, só renderiza a grade e emite a seleção. `RPE_LABELS` também migrou
  pra lá e voltou exportado, evitando duplicar o dicionário de rótulos.
  Ganho: `workout/[id].tsx` perde ~30 linhas de JSX de grade + ~35 linhas de
  estilo, o widget fica testável isoladamente, e o arquivo principal volta a
  ler como "estados de exibição do RPE", não "grade de botões + estados".
- Removi os estilos e imports que ficaram órfãos em cada arquivo (`header`,
  `backBtn`, `rpeRow`, `rpeBtn*`, `rpeExtremes*`, imports de `TouchableOpacity`/
  `router` não usados após a extração).

## Verificação
- `bun install` na raiz: ok.
- `bun x tsc --noEmit` em `apps/mobile`: passou limpo, sem erros, após cada
  arquivo refatorado.
- `bunx expo export --platform web`: bundle de produção compilou as 1175
  módulos sem erro (prova que os 6 arquivos + os 2 componentes novos resolvem
  e o grafo de rotas do expo-router registra tudo certo).
- Smoke visual: servi o bundle exportado (com `EXPO_PUBLIC_SUPABASE_URL`/
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` placeholders, só pra passar da inicialização
  do client Supabase — sem backend real disponível neste ambiente) e abri no
  Chromium headless via Playwright:
  - `/` → chega limpo na tela de login (sem sessão), sem erros de console.
  - `/workout/:id` e `/plan/workout/:day` (sem sessão válida, response de erro)
    → renderizam o estado de erro com `BackHeader` visível, botão 44×44,
    ícone de voltar, sem erros de console. Screenshots conferem visualmente
    contra a versão anterior — sem regressão.
  - Não deu pra chegar nas telas autenticadas (RPE scale, `metrics`, etc.)
    porque dependem de sessão Supabase real, que não existe neste ambiente
    sandbox. A extração da `RpeScale` foi verificada por fidelidade 1:1 ao
    JSX/estilo originais + `tsc` limpo + bundle sem erro de módulo.
  - `apps/mobile/.env.local` (placeholders) foi criado só pra esse teste e
    apagado antes do commit — não sobe pro git.
- Pre-commit (biome + testes de metrics) roda no commit; mobile está fora do
  escopo do biome raiz (`biome.json` exclui `**/mobile` explicitamente).

## Pendências
- `logoBadge` (`app/(auth)/login.tsx:252`), raios de badge de ícone (10px em
  6+ lugares) e `DESIGN.md` desatualizado seguem como pendências do relatório
  anterior — não fazem parte do foco de hoje.
- Não toquei em outros componentes candidatos a extração fora do escopo dos
  exemplos citados pelo prompt (ex.: cards genéricos repetidos entre telas) —
  ficam para uma futura rotina de Componentização, se a rotação voltar a esse
  item.
- Não consegui exercitar a `RpeScale` nem o `BackHeader` com `right` em
  cenário autenticado real (falta backend/sessão neste ambiente) — a
  verificação ficou em nível de bundle + smoke visual do estado sem sessão,
  não de fluxo ponta-a-ponta logado.

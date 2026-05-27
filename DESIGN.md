---
name: FitSync AI
description: O caderno de fisiologia do atleta — planejamento e revisão de treino, calmo, técnico, leitura atenta.
colors:
  primary: "#4777c2"
  brand-deep: "#2a5ea7"
  surface-base: "#fbf9f9"
  surface-card: "#ffffff"
  surface-alt: "#f5f3f3"
  border-soft: "#e3e2e2"
  border-strong: "#c6c6c6"
  text-primary: "#1b1c1c"
  text-secondary: "#474747"
  text-muted: "#777777"
  on-accent: "#ffffff"
  success: "#2e7d32"
  warning: "#ed6c02"
  danger: "#ba1a1a"
  workout-easy: "#2e7d32"
  workout-interval: "#c62828"
  workout-tempo: "#ed6c02"
  workout-long: "#2a5ea7"
  workout-rest: "#777777"
  workout-cross: "#6f5674"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: "40px"
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "26px"
  subtitle:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "19px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: "14px"
    letterSpacing: "1px"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  data-lg:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: "32px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
    height: "52px"
  button-primary-disabled:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    padding: "16px 24px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.md}"
    padding: "16px"
  card-tinted:
    backgroundColor: "{colors.surface-alt}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    height: "50px"
  input-error:
    backgroundColor: "#fde8e8"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  chip-workout:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: FitSync AI

## 1. Overview

**Creative North Star: "The Lab Notebook"**

O FitSync AI é o caderno de fisiologia do atleta. Não é um app fitness com aspirações estéticas — é uma página de papel branco onde a IA escreve, em tinta azul de análise, o que viu nos dados do Garmin e o que prescreve pra próxima semana. O atleta lê, anota mentalmente, confirma. Depois fecha o caderno e vai treinar no relógio.

A estética é deliberadamente solar: branco off-white (`#fbf9f9`) dominante, azul de confiança (`#4777c2`) usado com parcimônia em ações primárias e foco, e tipografia que faz o trabalho pesado de hierarquia. Hanken Grotesk em pesos cheios (700/800) dá autoridade aos títulos sem precisar de cor; JetBrains Mono em números tabulares torna ACWR, FC e ritmo legíveis ao bater o olho. Inter no corpo do texto deixa parágrafos didáticos respirarem.

O sistema **rejeita explicitamente** três famílias visuais (vindas do PRODUCT.md): SaaS fitness genérico (cards iguais, hero-metric pastel, gradient hover), wellness/mindfulness (gradientes suaves, ilustrações fofas, copy motivacional) e dark gamer/crypto (neon em preto, glassmorphism, vibe trader). Quando uma tela ficar parecida com Runna, Calm ou Whoop pré-redesign, ela falhou.

**Key Characteristics:**
- Light-only, branco off-white com tint quente quase imperceptível
- Tipografia carrega a hierarquia; cor é sinal, não decoração
- Dados em mono tabular (`fontVariant: ['tabular-nums']`) sempre que o número merece ser comparado
- Densidade média-alta: aproveita a tela mobile, sem otimizações pra leitura em movimento
- 3 níveis de elevação com propósito; nada de empilhar sombras pra "ficar bonito"
- Dois temas (`interstellar` canônico, `interspaceBlue` alternativo tech-forward) consumidos via `useTheme()`

## 2. Colors

Paleta de papel + tinta + sinal: superfícies brancas e off-white, um azul de confiança que carrega ações e foco, um azul mais profundo pra dados e branding, semânticos só onde há significado real. Workout signals formam uma sub-família própria, separada das cores semânticas, porque tipo de treino não é "warning" nem "success" — é categoria.

### Primary
- **Confidence Blue** (`#4777c2`): cor única de ação. CTAs, link ativo, ring de foco, ícone de feature ativa, KPI quando ele é a decisão da tela. Usada com parcimônia: ≤10% de qualquer tela. Quando aparece, importa.

### Secondary
- **Analytical Indigo** (`#2a5ea7`): azul mais escuro e saturado. Pra dados de gráfico (linha de ACWR, barra de carga semanal), pra branding em headers, e pra o estado `hover/pressed` do Primary. Nunca usado em fundo grande de superfície (vira "SaaS-blue").

### Neutral
- **Paper White** (`#fbf9f9`): fundo de toda tela. Não é `#fff` — tem um tint quente quase invisível pra evitar a frieza clínica.
- **Lab White** (`#ffffff`): superfície de card. O contraste com Paper White (~0,5% de diferença) é o que dá a sensação de "card sobre página".
- **Quiet Stone** (`#f5f3f3`): superfície tingida — fundo de input, modais, badges. Mais quente que Lab White, sinaliza "campo onde o atleta escreve".
- **Hairline Mist** (`#e3e2e2`): borda padrão. Aparece em cards, divisores, separadores de seção. Discreta o suficiente pra desaparecer em scroll.
- **Ledger Line** (`#c6c6c6`): borda forte. Inputs em repouso, botões secondary, divisões importantes.
- **Graphite Ink** (`#1b1c1c`): texto principal. Não é `#000` — preto puro é hostil em light mode.
- **Annotation Gray** (`#474747`): texto secundário, descrições, body sob título.
- **Footnote Gray** (`#777777`): labels uppercase, captions, "rest day", placeholders. Onde o texto precisa recuar.

### Semantic
- **Success** (`#2e7d32`): confirmação de sync, treino concluído, ACWR em zona ok.
- **Warning** (`#ed6c02`): ACWR fora da zona segura, HRV em queda, alertas suaves.
- **Danger** (`#ba1a1a`): erro de validação, falha de sync crítica, ACWR em zona de lesão.

### Workout Signals
Cor + ícone + label sempre juntos (regra de daltonismo). A cor sozinha nunca diz qual é o tipo de treino.

- **Regenerativo** — verde profundo (`#2e7d32`)
- **Intervalado** — vermelho técnico (`#c62828`)
- **Tempo Run** — laranja queimado (`#ed6c02`)
- **Long Run** — azul profundo (`#2a5ea7`)
- **Descanso** — cinza neutro (`#777777`)
- **Cross-training** — púrpura suave (`#6f5674`)

### Variante: Interspace Blue

Tema alternativo `interspaceBlue` (selecionável via `useTheme().setTheme('interspaceBlue')`). Mantém a estrutura mas inclina pra tech-forward:

- `primary` vira `#2a5ea7` (Analytical Indigo promovido a ação principal)
- `accent` vira `#3e90ff` (azul brilhante, mais saturado, pra dados)
- `surface-base` vira `#f5f8fd` (off-white com tint azul)
- `border` vira `#d6e3ff` (borda azul claro — "produto azul")
- `text-primary` vira `#001b3e` (azul-preto)
- Headlines usam Inter SemiBold em vez de Hanken ExtraBold — peso menor, vibe SaaS-moderno

Os dois temas compartilham o restante (radii, spacing, semantic, workout signals).

### Named Rules

**The One Voice Rule.** Confidence Blue carrega ≤10% de qualquer tela. Ele é o ponto de decisão visual. Se duas coisas estão em primary na mesma tela, uma delas está errada.

**The Color-Is-Not-The-Label Rule.** Toda categoria sinalizada por cor (tipo de treino, zona, status) também aparece com ícone e label de texto. Daltônico precisa entender a tela inteira sem ver as cores. Sem exceção.

**The No-Pure-Black-Or-White Rule.** `#000` e `#fff` são proibidos. Neutros sempre carregam um sussurro do hue (tint quente discreto). Pureza absoluta é fria.

## 3. Typography

**Display Font:** Hanken Grotesk (fallback `system-ui, sans-serif`)
**Body Font:** Inter (fallback `system-ui, sans-serif`)
**Mono Font:** JetBrains Mono (fallback `ui-monospace, monospace`)

**Character:** Trio editorial-técnico. Hanken Grotesk em peso extrabold dá presença sem precisar de cor — manchete de jornal. Inter no corpo é leitura sem fricção, neutro o bastante pra deixar o conteúdo falar. JetBrains Mono com `tabular-nums` faz números alinharem coluna a coluna — comparação entre ritmos, FC, ACWR fica óbvia.

### Hierarchy

- **Display** (Hanken ExtraBold 800, 36px, line 40, letter -0.5): nome da tela principal, herói raro. Uma por tela no máximo.
- **Headline** (Hanken Bold 700, 24px, line 30, letter -0.5): título de seção forte. "Plano da semana", "Histórico", "Métricas".
- **Title** (Hanken Bold 700, 20px, line 26): subtítulo, card título. "Quarta", "Treino de hoje".
- **Subtitle** (Inter SemiBold 600, 17px, line 24): destaque dentro de card, sub-cabeçalho.
- **Body** (Inter Regular 400, 15px, line 22): parágrafo, descrição de treino, explicação didática da IA. Linha máxima ~65ch.
- **Body Sm** (Inter Regular 400, 13px, line 19): texto secundário, captions, metadata.
- **Label** (Inter Bold 700, 11px, letter 1, UPPERCASE): rótulos de campo, header de coluna, "DURAÇÃO", "ZONA". Sempre uppercase + tracking aberto.
- **Data** (JetBrains Mono Medium 500, 13px, tabular): números inline em listas, lap times.
- **Data Lg** (JetBrains Mono Medium 500, 28px, tabular): KPI principal de card — duração total, ACWR, ritmo médio.

### Named Rules

**The Tabular Numbers Rule.** Todo número que pode ser comparado com outro número (ritmos, FC, distância, ACWR) usa JetBrains Mono com `fontVariant: ['tabular-nums']`. Inter pra prosa, Mono pra dado. Sem exceção em screens de dados.

**The Uppercase-Tracking Rule.** Texto em maiúscula sempre carrega `letterSpacing: 1` (tracking wide). Maiúscula sem tracking é grito.

**The No-Display-Per-Card Rule.** Display (36px Hanken) aparece no máximo uma vez por tela. Em card, o teto é Title (20px). Headlines competindo é hierarquia quebrada.

## 4. Elevation

Três níveis de sombra, com propósito explícito. Profundidade não é decoração — é sinal. Em light mode, a sombra é cinza-azulada suave (`#0f172a` com baixa opacidade), não preto puro, pra não "sujar" o off-white.

### Shadow Vocabulary

- **card** (`box-shadow: 0 1px 4px rgba(15, 23, 42, 0.05)`): superfícies em repouso. Cards na home, cards de treino, containers de seção. Quase imperceptível — sinaliza "isso é uma camada acima da página", nada mais.
- **elevated** (`box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12)`): elementos forçados pra frente do contexto. Modais (`ConfirmModal`), bottom sheets, popovers, cards de hover/long-press. Quando aparece, o atleta deve sentir que algo se destacou.
- **glow** (`box-shadow: 0 4px 12px rgba(71, 119, 194, 0.18)`): halo azul. **Reservado pra elementos em estado ativo de ação** — botão primary em repouso (sinaliza "esse é o caminho"), input em focus, CTA pressionado. Nunca decorativo. Glow azul em card estático é proibido.

### Named Rules

**The Three-Levels Rule.** Profundidade existe em exatamente três degraus: `card` (repouso), `elevated` (modal), `glow` (ação azul). Não inventar `card-lg`, `card-xl`, `card-hero`. Se a tela parecer rasa, a resposta é tipografia ou cor, não sombra extra.

**The Functional Glow Rule.** Sombra colorida (`glow`) é sempre funcional — sinaliza interação possível ou em curso. Glow puramente decorativo é traço de "app de crypto" e está proibido.

**The Restrained Shadow Rule.** Cards no Interstellar usam sombra mais suave (`shadowOpacity: 0.05`); no Interspace Blue, sombra leve com tint azul (`shadowColor: '#0a3a7a'`, `opacity: 0.06`). Em ambos os temas, a sombra deve **sumir** quando não estiver ajudando — não é o herói da tela.

## 5. Components

### Buttons

- **Shape:** pill totalmente arredondada (`rounded.full = 9999px`). Distingue elemento clicável de card estático à primeira vista — bordas retas são pra container.
- **Sizing:** altura mínima 52px (toque confortável em sofá ou na rua), padding `16px 24px`, label uppercase com tracking 1.
- **Tipografia do label:** Hanken Grotesk Bold/ExtraBold (700/800), tamanho 15px, sempre uppercase via `toUpperCase()` no render. Não usar uppercase visual sem letter-spacing — vira grito.
- **Primary:** fundo `#4777c2` (Confidence Blue), texto `#fff` (`on-accent`), sombra `glow` quando habilitado. É o caminho principal da tela. ≤1 por tela.
- **Secondary:** fundo transparente, borda `1.5px solid #c6c6c6` (Ledger Line), texto `#1b1c1c` (Graphite Ink). Ação alternativa, peso visual menor.
- **Ghost:** fundo transparente, sem borda, texto `#4777c2`. Pra ações terciárias dentro de cards ou fluxos densos.
- **Danger:** fundo `#ba1a1a`, texto `#fff`. Apagar conta, cancelar plano, ações destrutivas — sempre com `ConfirmModal` antes.
- **Disabled:** fundo `#f5f3f3` (Quiet Stone), texto `#777777` (Footnote Gray). Cinza neutro, sem sombra. Nunca opacar o botão (`opacity: 0.5`) — fica ambíguo.
- **Loading:** substitui label por `<ActivityIndicator>` na cor do texto da variante. Botão mantém altura — sem layout shift.
- **Comportamento:** `activeOpacity: 0.85` no toque. Sem `transform: scale`, sem bounce. Resposta tátil mínima.

### Cards

- **Corner Style:** `rounded.md = 12px`. Suave o bastante pra não parecer chip, fechado o bastante pra não parecer modal.
- **Background:** `#ffffff` (Lab White) padrão. `#f5f3f3` (Quiet Stone) quando o card é informativo/tingido (why-card, summary box).
- **Border:** `1px solid #e3e2e2` (Hairline Mist). Sempre borda completa, nunca side-stripe.
- **Shadow Strategy:** `card` (sutil ambient) em repouso. Elevar pra `elevated` só em modal/popover.
- **Internal Padding:** `16px` (`spacing.md`) por padrão. `24px` (`spacing.lg`) em cards heroicos.
- **Sem nesting.** Card dentro de card é sempre erro. Se a hierarquia exige sub-grupos, use divisores tipográficos (label uppercase + linha 1px), não outro card.

### Inputs

- **Style:** fundo `#f5f3f3` (Quiet Stone) — sinaliza "campo editável" pelo tom em vez de só pela borda. Borda `1px solid #c6c6c6` (Ledger Line), raio `12px`, padding `14px 16px`, altura mínima 50px.
- **Label:** acima do input, uppercase, Inter Bold 11px, tracking 1, cor `#777777` (Footnote Gray). Sempre presente — sem placeholder-como-label.
- **Placeholder:** `#777777`, mesmo tom da label. Some quando o atleta começa a digitar.
- **Focus:** borda muda pra `#4777c2` (Confidence Blue), sombra `glow` aparece. Sem outline padrão do browser/RN.
- **Error:** fundo `#fde8e8` (danger light), borda `#ba1a1a`, mensagem de erro em vermelho abaixo (Inter 11px). A mensagem é específica ("Email precisa de @", não "Campo inválido").
- **Disabled:** borda `#e3e2e2`, texto `#777777`, sem interatividade. Não esconder — atleta precisa ler o valor.

### Chips (Workout Type Signal)

- **Style:** pill (`rounded.full`), padding `4px 10px`, label uppercase Inter Bold 10–11px com tracking ~0.8.
- **Fundo + texto:** par dimensionado pela cor do tipo de treino. Fundo é a cor com alpha baixo (~10–15%), texto é a cor saturada. Garante contraste AA sem precisar testar caso a caso.
- **Sempre acompanhado:** ícone do tipo (corrida intervalada, long, cross) + label de dia ao lado. Nunca isolado.

### Modal (ConfirmModal)

- **Surface:** card `Lab White`, raio `lg` (16px), padding `24px`, sombra `elevated`.
- **Backdrop:** preto com 40% de opacidade, tap-to-dismiss desabilitado em destrutivas.
- **Hierarquia:** Title (20px) + Body (15px, max 2 linhas) + dois botões lado a lado (Secondary à esquerda = cancelar, Primary ou Danger à direita = confirmar).
- **Quando usar:** ações destrutivas e perda irreversível de dado. **Não usar** pra confirmar coisas pequenas (toggle, ajuste de campo, salvar) — inline melhor.

### Navigation (TopBar + Tabs)

- **TopBar:** altura ~56px, fundo `surface-base` (`#fbf9f9`), título Title (Hanken Bold 20px), botão de back em ghost.
- **Tabs (bottom tab bar):** 4 tabs principais (Plan, History, Conquistas, Settings). Ícone + label sempre visíveis (sem só-ícone). Ativo: ícone preenchido + texto `primary`. Inativo: ícone outline + texto `text-muted`. Indicador de tab ativa: a cor, não barra inferior decorativa.

### Signature: KPI Block

Componente recorrente em telas de métrica (Home, History, Metrics):

- Label uppercase (`label` style) com o nome da métrica ("ACWR 7D", "RITMO MÉDIO", "HRV").
- Valor em **Data Lg** (JetBrains Mono 28px) logo abaixo, sem cor — `#1b1c1c`.
- Unidade pequena ao lado (`body-sm`, cinza) — "min/km", "ms".
- Quando há comparação (vs. semana anterior), seta sutil + delta em cor semântica.
- Quando há incerteza (poucos dias de dados, sync atrasado), **mostra explicitamente**: "estimativa baseada em 4 dias" em footnote gray abaixo. Princípio "Honestidade sobre a incerteza" do PRODUCT.md.

## 6. Do's and Don'ts

### Do:
- **Do** usar `useTheme()` em todo componente que toque cor, sombra ou preset tipográfico. Imports estáticos de `Colors`/`Shadow`/`Type` foram removidos — qualquer arquivo que ainda use isso está desatualizado.
- **Do** combinar cor + ícone + label sempre que sinalizar tipo de treino, zona ou status. Daltonismo é requisito real.
- **Do** usar `fontVariant: ['tabular-nums']` em todo número que pode ser comparado (ritmos, FC, ACWR, distância). Inter pra prosa, JetBrains Mono pra dado.
- **Do** confiar na tipografia pra criar hierarquia. Headline Hanken 700 + Body Inter 400 é mais forte que cor.
- **Do** documentar incerteza na UI quando os dados são frouxos ("estimativa baseada em 4 dias", "HRV ainda calibrando").
- **Do** usar pill (`rounded.full`) só pra botões e chips. Card é raio `md` (12px), modal é `lg` (16px). Não misturar.
### Don't:
- **Don't** usar `border-left` (ou `border-right`) maior que 1px como acento colorido em cards/list items/callouts. É banido por design. Use borda completa, fundo tingido, ou número/ícone na frente.
- **Don't** usar gradient text (`background-clip: text` + gradient) em nenhuma headline. Cor única, peso ou tamanho fazem a ênfase.
- **Don't** usar `#000` ou `#fff` puro. Todo neutro carrega tint quente discreto (Paper White `#fbf9f9`, Graphite Ink `#1b1c1c`).
- **Don't** repetir hero-metric template (número gigante + label minúsculo + gradient atrás). Use o **KPI Block** documentado em Components.
- **Don't** desenhar a `(tabs)/plan.tsx` ou `(tabs)/history.tsx` como grid de cards idênticos com ícone+heading+texto — esse é o anti-pattern "Fitness SaaS genérico (Runna/Trainerize)" citado no PRODUCT.md.
- **Don't** abrir modal pra confirmar ajuste pequeno. Inline > modal sempre, exceto em ações destrutivas.
- **Don't** usar gradientes suaves pastel, ilustrações fofas ou copy motivacional ("Bora correr! 🔥"). Esse é o lane "Wellness/mindfulness (Calm/Headspace)" — proibido.
- **Don't** usar glow neon, glassmorphism ou dark mode com acentos saturados. O lane "Crypto/dark gamer (Whoop pré-redesign)" está banido — o app vive em light por decisão consciente.
- **Don't** empilhar sombras. Três níveis (`card`, `elevated`, `glow`), cada um com propósito. Inventar `card-lg` é cheirinho de design lazy.
- **Don't** colocar Display (36px) duas vezes na mesma tela. Hierarquia quebrada.
- **Don't** usar maiúsculas sem `letterSpacing` — vira grito.
- **Don't** opacar botão pra sinalizar disabled (`opacity: 0.5`). Use o token `disabled` explícito (`bg surface-alt`, `text text-muted`).
- **Don't** otimizar leitura pra "atleta correndo olhando o celular". O treino é no relógio. O app é planejamento e revisão — densidade tipográfica autorizada.

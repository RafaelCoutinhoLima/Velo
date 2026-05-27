# Product — FitSync AI

## Register

product

## Users

Atletas de corrida e triathlon (running-only no MVP) que já têm relógio Garmin e querem um plano semanal adaptativo gerado por IA a partir dos seus próprios dados fisiológicos (ACWR, rTSS, HRV, decoupling Pa:HR).

Usuário-âncora do MVP: Rafael — triatleta iniciante em formação pra 70.3, baseado em Recife/PE, dogfooding diário. Perfil de leitor técnico: lê os números, quer entender o porquê das recomendações, não precisa que ninguém o motive.

**Contexto de uso (não negociável):** o celular **não é usado durante o treino**. O treino é executado no relógio. O app serve três momentos:

1. **Antes do treino** (mesa de jantar, sofá): olhar o que a IA prescreveu pra semana, entender o porquê.
2. **Pré-sessão** (5–10 min antes): conferir o treino de hoje, ajustar se necessário, sincronizar pro relógio.
3. **Pós-treino** (na volta pra casa, ou no fim do dia): dar feedback subjetivo (RPE), ler o que a IA aprendeu da sessão, ver impacto em ACWR/HRV.

Não otimizamos pra leitura em movimento. Otimizamos pra leitura **atenta, técnica, em ambiente controlado**.

## Product Purpose

Substituir o trabalho de um coach humano de nível inicial-intermediário por uma IA que (a) lê dados do Garmin todo dia, (b) gera plano semanal adaptativo respeitando princípios fisiológicos reais (ACWR 0.8–1.3, polarização 80/20, super-compensação), (c) explica cada decisão de forma didática, e (d) ajusta semana a semana com base na resposta do atleta.

O sucesso do produto, no MVP, é definido por:

- O Rafael confiar no plano da IA o suficiente pra seguir 8 semanas sem reescrever no Excel.
- Cada tela responder à pergunta "por que esse treino, nesse dia, com essa intensidade?" sem o atleta precisar abrir um livro de fisiologia.
- ACWR, rTSS e HRV virarem números que o atleta entende e usa — não decoração.

## Brand Personality

**Inteligente, técnico, didático** — laboratório de fisiologia, não academia.

Tom: mentor que sabe muito e escolhe explicar com clareza, em vez de impressionar com jargão. Mostra ACWR, rTSS, HRV com os nomes reais (não inventa apelidos infantis), mas sempre acompanhados de uma frase curta dizendo o que aquilo significa pro treino de hoje.

Voz: pt-BR, direto, sem motivacional vazio. Nunca exclamações como "Vamos lá, campeão!". Nunca emojis como decoração. Quando o app cumprimenta o atleta, é breve e factual ("Bom treino" > "Bora correr! 🔥").

Referência mental: Strava se fosse desenhado pelo Stripe — denso de dado quando o dado importa, calmo e tipográfico quando o atleta tá só lendo.

## Anti-references

Coisas que o FitSync AI **não pode parecer**:

- **Fitness SaaS genérico (Runna, Trainerize, MyCoach):** cards idênticos com ícone + heading + texto, hero-metric pastel-com-gradient, vibe "app fitness sem identidade". Os cards atuais já fazem isso — é a primeira coisa a corrigir quando uma tela for redesenhada.
- **Wellness/mindfulness (Calm, Headspace, Strides):** gradientes suaves, ilustrações fofas, copy de coach motivacional ("Você consegue!"). Não combina com atleta sério rodando 70.3 que quer entender por que o ACWR dele tá em 1.4.
- **Crypto / dark gamer (Whoop pré-redesign, Coros app):** glow neon em preto, glassmorphism, vibe "trader/cockpit". O FitSync vive em light (Interstellar / Interspace Blue) por decisão consciente — não cair na reflex de "app de performance = preto neon".

Cuidados específicos a evitar (ban list dos design laws aplicada ao nosso contexto):

- Hero-metric template (número gigante, label minúsculo, gradient atrás).
- Cards iguais em grid — especialmente em `(tabs)/plan.tsx` e `(tabs)/history.tsx`.
- Modal como primeiro recurso pra confirmar/ajustar coisa pequena.
- Gradient text em headlines.

## Design Principles

Três regras de decisão. Quando uma tela for desenhada ou criticada, ela é medida contra estas:

1. **Confiança técnica sem jargão egoísta.** Toda métrica fisiológica (ACWR, rTSS, HRV, decoupling, zonas) aparece com o nome real **e** com uma frase curta dizendo o que ela significa pro treino de hoje. Nunca esconder o termo técnico, nunca soltar o termo técnico sem explicação. O atleta sai do app sabendo mais do que entrou.

2. **UI pra planejamento e revisão, nunca pra execução em movimento.** O treino acontece no relógio. O app é o coach do antes e do depois. Isso autoriza densidade tipográfica, leitura atenta, e desautoriza otimizações tipo "número gigante pra bater o olho correndo". Botões grandes existem porque a tela é tocada com dedo, não porque o atleta tá ofegante.

3. **Honestidade sobre a incerteza.** Quando ACWR é baseado em poucos dias, quando HRV é ruidoso, quando o Garmin não sincronizou, dizer isso explicitamente na UI. Nunca preencher silenciosamente com valor default que parece certo. A confiança do atleta na IA vem de saber o que ela **não** sabe.

## Accessibility & Inclusion

WCAG 2.1 **AA** + dois compromissos específicos pelo contexto do produto:

- **Cor nunca é o único sinal.** Os temas atuais codificam tipos de treino e zonas por cor (workoutEasy/Interval/Tempo/Long/Rest/Cross). Toda vez que cor for usada pra distinguir treino, intensidade ou zona, deve haver também ícone, label ou padrão. Daltonismo é um requisito real, não um nice-to-have.
- **Reduced motion respeitado.** Quando `prefers-reduced-motion` estiver ativo, animações de transição, gráficos animados e micro-interações decorativas devem ser desativadas ou substituídas por fade simples.

Demais práticas: contraste mínimo 4.5:1 em texto, touch targets ≥44pt, Dynamic Type / escala de fonte do sistema respeitada, navegação por leitor de tela funcional nas telas principais (home, plan, workout detail, history).

Sem auditoria formal por enquanto — o produto ainda é dogfooding pessoal. Quando houver usuário externo, reabrimos isso com um audit estruturado.

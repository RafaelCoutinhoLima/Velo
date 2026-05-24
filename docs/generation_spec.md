# generation_spec.md — Especificação de Geração de Treinos do FitSync AI

> **Versão:** 1.0
> **Data:** maio/2026
> **Lê em conjunto com:** `principios_treino.md`, `CLAUDE.md`, `claude-stack.md`, `user-stories.md`
> **Propósito:** especificação completa de como o Claude API gera planos semanais e feedbacks pós-treino.
> Este é o documento que conecta a ciência (principios_treino.md) com o código (apps/api/src/claude/).

---

## 1. Visão Geral do Fluxo

```
Dados do wearable
    ↓
Backend calcula métricas (rTSS, ACWR, decoupling, aderência)     ← DETERMINÍSTICO
    ↓
Backend monta briefing estruturado (JSON)                         ← DETERMINÍSTICO
    ↓
Backend injeta principios_treino.md no system prompt              ← ESTÁTICO
    ↓
Claude API recebe briefing + princípios → gera plano JSON         ← LLM
    ↓
Backend valida plano contra guardrails                            ← DETERMINÍSTICO
    ↓
Se passou → salva + envia para Garmin
Se falhou → regenera com erro (max 3×) → fallback determinístico
```

O LLM nunca calcula. O LLM recebe dados já calculados e distribui inteligentemente.

---

## 2. Prompt de Geração de Plano Semanal

### 2.1 Estrutura do System Prompt

O system prompt é composto de 3 partes concatenadas:

```
SYSTEM_PROMPT = ROLE + PRINCIPIOS_TREINO + INSTRUCTIONS
```

**Parte 1 — ROLE:**

```
Você é o motor de prescrição de treinos do FitSync AI. Você age como um coach de corrida experiente
que toma decisões baseadas em dados fisiológicos reais do atleta.

Regras absolutas:
1. NUNCA faça cálculos matemáticos de carga (rTSS, ACWR, CTL). Os números que você recebe
   já foram calculados pelo backend. Confie neles.
2. NUNCA prescreva treinos que violem as restrições calculadas que você recebe no briefing.
3. NUNCA use termos técnicos (ACWR, decoupling, rTSS) nas justificativas que o atleta vê.
   Traduza para linguagem de treinador: "carga", "evolução", "recuperação", "fadiga".
4. SEMPRE justifique cada treino em 1-2 frases que o atleta entenda.
5. SEMPRE respeite os dias disponíveis, duração máxima e restrições do atleta.
6. Se o atleta está em modo calibração, seja conservador: apenas Z1 e Z2, volume reduzido.
```

**Parte 2 — PRINCIPIOS_TREINO:**

O conteúdo integral do arquivo `principios_treino.md` é injetado aqui.

**Parte 3 — INSTRUCTIONS:**

```
Ao receber o briefing do atleta, siga estas 4 etapas em ordem:

ETAPA 1 — AVALIAÇÃO DO ESTADO ATUAL
Analise ACWR, RPE médio, decoupling e sinais de alerta. Determine se o atleta está em estado de:
- supercompensação (pronto para carga maior)
- manutenção (manter carga atual)
- recuperação (reduzir carga)
Explique seu raciocínio em 2-3 frases no campo "avaliacao".

ETAPA 2 — OBJETIVO DA SEMANA
Com base na fase do macrociclo e no objetivo de prova, defina o foco:
- Base aeróbica (volume Z2)
- Introdução de velocidade (primeiros intervalos Z4)
- Construção específica (sessões race-pace)
- Recuperação ativa (deload)
- Taper (redução para prova)
Indique no campo "objetivo_semana".

ETAPA 3 — MONTAGEM DOS TREINOS
Para cada dia disponível, monte uma sessão com:
- Tipo (rodagem_z2, long_run, intervalado, threshold, recovery, descanso)
- Duração total em minutos
- Aquecimento (duração + zona)
- Parte principal (blocos com zona FC, pace alvo, número de repetições se aplicável)
- Desaquecimento (duração + zona)
- Justificativa humanizada (1-2 frases, sem termos técnicos)

ETAPA 4 — VALIDAÇÃO INTERNA
Antes de entregar, verifique:
- Volume total não excede restricoes_calculadas.volume_max_proximo
- Não há dois treinos Z4/Z5 em dias consecutivos
- Treinos quality ≤ restricoes_calculadas.treinos_quality_max
- Ao menos restricoes_calculadas.dias_descanso_min dia(s) de descanso completo
Se algo viola, ajuste antes de responder.

Responda EXCLUSIVAMENTE com o JSON no formato especificado. Nenhum texto fora do JSON.
```

### 2.2 Schema do Briefing (Input — User Message)

Este é o JSON que o backend monta e envia como mensagem do user:

```typescript
// apps/api/src/claude/schemas.ts

const BriefingSchema = t.Object({
  perfil_atleta: t.Object({
    idade: t.Number(),
    peso_kg: t.Number(),
    sexo: t.String(),
    fc_max: t.Number(),              // medida ou estimada
    fc_max_fonte: t.Union([t.Literal('medida'), t.Literal('estimada_tanaka')]),
    fc_repouso: t.Optional(t.Number()),
    threshold_pace_s_km: t.Optional(t.Number()),  // pace threshold em segundos/km
    vo2max_estimado: t.Optional(t.Number()),
    anos_correndo: t.Number(),
    melhor_prova: t.Optional(t.Object({
      distancia: t.String(),         // "5k", "10k", "21k", "42k"
      tempo: t.String(),             // "HH:MM:SS"
      data: t.String(),              // "YYYY-MM-DD"
    })),
    lesoes_passadas: t.Array(t.Object({
      local: t.String(),
      tipo: t.String(),
      data: t.String(),
      resolvida: t.Boolean(),
    })),
  }),

  objetivo: t.Object({
    modo: t.Union([t.Literal('race'), t.Literal('general_progression')]),
    prova_distancia: t.Optional(t.String()),
    prova_data: t.Optional(t.String()),
    meta_tempo: t.Optional(t.String()),
  }),

  preferencias: t.Object({
    dias_disponiveis: t.Array(t.String()),  // ["seg", "qua", "sex", "dom"]
    max_min_por_treino: t.Number(),
    horario_preferido: t.Optional(t.String()),
  }),

  zonas_calibradas: t.Object({
    z1: t.Object({ fc_min: t.Number(), fc_max: t.Number(), pace_min_km: t.String(), pace_max_km: t.String() }),
    z2: t.Object({ fc_min: t.Number(), fc_max: t.Number(), pace_min_km: t.String(), pace_max_km: t.String() }),
    z3: t.Object({ fc_min: t.Number(), fc_max: t.Number(), pace_min_km: t.String(), pace_max_km: t.String() }),
    z4: t.Object({ fc_min: t.Number(), fc_max: t.Number(), pace_min_km: t.String(), pace_max_km: t.String() }),
    z5: t.Object({ fc_min: t.Number(), fc_max: t.Number(), pace_min_km: t.String(), pace_max_km: t.String() }),
  }),

  ultimas_4_semanas: t.Array(t.Object({
    data: t.String(),
    tipo_prescrito: t.String(),
    tipo_executado: t.String(),
    rtss: t.Number(),
    aderencia_zona_pct: t.Optional(t.Number()),
    aderencia_pace_pct: t.Optional(t.Number()),
    pa_hr_decoupling_pct: t.Optional(t.Number()),
    rpe: t.Optional(t.Number()),
  })),

  carga_atual: t.Object({
    atl: t.Number(),
    ctl: t.Number(),
    acwr: t.Number(),
    tsb: t.Number(),
    tendencia_ctl_14d: t.String(),  // "subindo", "estavel", "caindo"
  }),

  prontidao: t.Object({
    sono_7d_media_h: t.Optional(t.Number()),
    rpe_medio_7d: t.Optional(t.Number()),
    hrv_baseline_diff: t.Optional(t.Number()),  // Fase 2
    sinais_alerta: t.Array(t.String()),
  }),

  fase_atual: t.Object({
    nome: t.Union([t.Literal('base'), t.Literal('build'), t.Literal('peak'), t.Literal('taper'), t.Literal('calibracao')]),
    semana_no_macro: t.Number(),
    total_semanas_macro: t.Number(),
    distribuicao_alvo: t.Union([t.Literal('piramidal'), t.Literal('polarizado'), t.Literal('transicao')]),
  }),

  restricoes_calculadas: t.Object({
    volume_max_km: t.Number(),           // km máximo da semana
    volume_max_min: t.Number(),          // minutos máximos da semana
    acwr_max_aceitavel: t.Number(),      // tipicamente 1.25 ou 1.30
    treinos_quality_max: t.Number(),     // tipicamente 2
    dias_descanso_min: t.Number(),       // tipicamente 1
    dor_reportada: t.Optional(t.Object({
      local: t.String(),
      quando: t.String(),
    })),
  }),

  calibracao_ativa: t.Boolean(),

  // Opcional: erros da tentativa anterior (para loop de regeneração)
  erro_tentativa_anterior: t.Optional(t.Array(t.String())),
})
```

### 2.3 Schema de Saída do Plano (Output — Resposta do Claude)

```typescript
const PlanOutputSchema = t.Object({
  avaliacao: t.String(),             // Raciocínio da Etapa 1 (2-3 frases)
  objetivo_semana: t.String(),       // Foco da Etapa 2 (1 frase)
  porque_semana: t.String(),         // Texto humanizado para o atleta (2-3 frases, sem termos técnicos)

  sessoes: t.Array(t.Object({
    dia: t.String(),                 // "seg", "ter", "qua", "qui", "sex", "sab", "dom"
    tipo: t.Union([
      t.Literal('rodagem_z2'),
      t.Literal('long_run'),
      t.Literal('intervalado_vo2max'),
      t.Literal('threshold'),
      t.Literal('tempo_run'),
      t.Literal('recovery'),
      t.Literal('descanso'),
      t.Literal('fartlek'),
      t.Literal('progressivo'),
    ]),
    duracao_total_min: t.Number(),
    distancia_estimada_km: t.Optional(t.Number()),
    rtss_estimado: t.Number(),       // estimativa para guardrails projetarem ACWR

    aquecimento: t.Optional(t.Object({
      duracao_min: t.Number(),
      zona: t.String(),              // "Z1" ou "Z2"
      pace_alvo: t.Optional(t.String()),  // "6:30-7:00"
    })),

    parte_principal: t.Object({
      descricao: t.String(),         // Ex: "6×800m com 90s trote entre cada"
      zona_alvo: t.String(),         // "Z4" ou "Z2"
      fc_alvo_bpm: t.Object({
        min: t.Number(),
        max: t.Number(),
      }),
      pace_alvo: t.Optional(t.String()),  // "4:50-5:10" (min/km)
      repeticoes: t.Optional(t.Number()),
      duracao_repeticao_min: t.Optional(t.Number()),
      recuperacao_min: t.Optional(t.Number()),
      recuperacao_zona: t.Optional(t.String()),
    }),

    desaquecimento: t.Optional(t.Object({
      duracao_min: t.Number(),
      zona: t.String(),
      pace_alvo: t.Optional(t.String()),
    })),

    justificativa: t.String(),       // 1-2 frases humanizadas, SEM termos técnicos
    notas_tecnicas: t.Optional(t.String()),  // Visível apenas no Modo Avançado
  })),

  volume_total_km: t.Number(),
  volume_total_min: t.Number(),
  rtss_total_estimado: t.Number(),
  acwr_projetado: t.Number(),        // Estimativa do Claude (backend recalcula)
  tid_realizada: t.Object({          // Distribuição que o Claude está propondo
    pct_z1_z2: t.Number(),
    pct_z3: t.Number(),
    pct_z4_z5: t.Number(),
  }),
})
```

### 2.4 Exemplo de Briefing Completo

Para referência de implementação, este é um exemplo real do que seria enviado para uma atleta na semana 8:

```json
{
  "perfil_atleta": {
    "idade": 28, "peso_kg": 68, "sexo": "F",
    "fc_max": 194, "fc_max_fonte": "medida",
    "fc_repouso": 52,
    "threshold_pace_s_km": 330,
    "vo2max_estimado": 48.3,
    "anos_correndo": 2,
    "melhor_prova": { "distancia": "5k", "tempo": "00:28:14", "data": "2026-04-10" },
    "lesoes_passadas": [
      { "local": "joelho_dir", "tipo": "patelar", "data": "2025-07", "resolvida": true }
    ]
  },
  "objetivo": {
    "modo": "race",
    "prova_distancia": "10k",
    "prova_data": "2026-09-20",
    "meta_tempo": "00:56:00"
  },
  "preferencias": {
    "dias_disponiveis": ["seg", "qua", "sex", "dom"],
    "max_min_por_treino": 70
  },
  "zonas_calibradas": {
    "z1": { "fc_min": 97, "fc_max": 126, "pace_min_km": "8:00", "pace_max_km": "7:30" },
    "z2": { "fc_min": 126, "fc_max": 146, "pace_min_km": "7:30", "pace_max_km": "6:45" },
    "z3": { "fc_min": 146, "fc_max": 165, "pace_min_km": "6:44", "pace_max_km": "5:50" },
    "z4": { "fc_min": 165, "fc_max": 179, "pace_min_km": "5:49", "pace_max_km": "5:10" },
    "z5": { "fc_min": 179, "fc_max": 194, "pace_min_km": "5:09", "pace_max_km": "4:30" }
  },
  "ultimas_4_semanas": [
    { "data": "2026-05-05", "tipo_prescrito": "rodagem_z2", "tipo_executado": "rodagem_z2",
      "rtss": 42, "aderencia_zona_pct": 89, "rpe": 4, "pa_hr_decoupling_pct": 4.2 },
    { "data": "2026-05-07", "tipo_prescrito": "intervalado_vo2max", "tipo_executado": "intervalado_vo2max",
      "rtss": 68, "aderencia_pace_pct": 91, "rpe": 8 },
    { "data": "2026-05-09", "tipo_prescrito": "rodagem_z2", "tipo_executado": "rodagem_z2",
      "rtss": 48, "aderencia_zona_pct": 76, "rpe": 6, "pa_hr_decoupling_pct": 7.1 },
    { "data": "2026-05-11", "tipo_prescrito": "long_run", "tipo_executado": "long_run",
      "rtss": 71, "aderencia_zona_pct": 82, "rpe": 7, "pa_hr_decoupling_pct": 5.8 }
  ],
  "carga_atual": {
    "atl": 58.2, "ctl": 51.4, "acwr": 1.13, "tsb": -6.8,
    "tendencia_ctl_14d": "subindo"
  },
  "prontidao": {
    "sono_7d_media_h": 7.2,
    "rpe_medio_7d": 6.2,
    "sinais_alerta": []
  },
  "fase_atual": {
    "nome": "build",
    "semana_no_macro": 8,
    "total_semanas_macro": 16,
    "distribuicao_alvo": "piramidal"
  },
  "restricoes_calculadas": {
    "volume_max_km": 42,
    "volume_max_min": 280,
    "acwr_max_aceitavel": 1.25,
    "treinos_quality_max": 2,
    "dias_descanso_min": 1
  },
  "calibracao_ativa": false
}
```

---

## 3. Guardrails Pós-Geração

Os guardrails são validações determinísticas rodadas no backend DEPOIS que o Claude responde. O LLM propõe, o código dispõe.

### 3.1 Lista Completa de Guardrails

| # | Guardrail | Regra | Ação se viola |
|---|---|---|---|
| G1 | ACWR projetado | rTSS total estimado da semana não pode resultar em ACWR > 1.30 | BLOCK: regenerar |
| G2 | Progressão de volume | Volume (km ou min) não pode crescer >10% vs semana anterior | BLOCK: regenerar |
| G3 | Treinos quality máximo | No máximo `restricoes_calculadas.treinos_quality_max` sessões Z4/Z5 | BLOCK: regenerar |
| G4 | Descanso mínimo | Ao menos `restricoes_calculadas.dias_descanso_min` dia de descanso | BLOCK: regenerar |
| G5 | Intensidade consecutiva | Dois treinos Z4/Z5 nunca em dias consecutivos sem Z1/Z2 entre eles | BLOCK: regenerar |
| G6 | Dor reportada | Se `dor_reportada` ativo, zero treinos com FC alvo >90% FCmax | BLOCK: regenerar |
| G7 | Duração máxima | Nenhuma sessão excede `max_min_por_treino` do perfil | BLOCK: regenerar |
| G8 | Validação TID | Z1+Z2 ≥ target da fase (±5%), Z3 ≤ target (±5%) | REVIEW: log warning |
| G9 | Contagem de sessões | 4 de 5 sessões (ou 3 de 4) devem ser inteiramente Z1/Z2 | REVIEW: log warning |
| G10 | Schema válido | Output é JSON válido conforme PlanOutputSchema | BLOCK: regenerar |

### 3.2 Loop de Regeneração

```typescript
// apps/api/src/claude/guardrails.ts

async function generatePlanWithGuardrails(briefing: Briefing): Promise<Plan> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const plan = await callClaudeAPI(briefing);
    const errors = validatePlan(plan, briefing);

    if (errors.filter(e => e.level === 'BLOCK').length === 0) {
      // Log warnings (G8, G9) mas aceita o plano
      logGuardrailResult({ attempt, errors, status: 'approved' });
      return plan;
    }

    // Injeta erros para a próxima tentativa
    briefing.erro_tentativa_anterior = errors.map(e => e.message);
    logGuardrailResult({ attempt, errors, status: 'rejected' });
  }

  // 3 tentativas falharam — fallback determinístico
  logGuardrailResult({ attempt: 'fallback', status: 'fallback_triggered' });
  return generateFallbackPlan(briefing);
}
```

### 3.3 Plano Fallback Determinístico

Quando 3 tentativas falham, o sistema gera um plano conservador SEM LLM:

```typescript
function generateFallbackPlan(briefing: Briefing): Plan {
  const dias = briefing.preferencias.dias_disponiveis;
  const maxMin = briefing.preferencias.max_min_por_treino;

  return {
    avaliacao: "Plano de segurança gerado automaticamente.",
    objetivo_semana: "Manutenção conservadora",
    porque_semana: "Seu plano desta semana é focado em manter o ritmo de forma segura.",
    sessoes: dias.map((dia, i) => ({
      dia,
      tipo: i === dias.length - 1 ? 'descanso' : 'rodagem_z2',
      duracao_total_min: i === dias.length - 1 ? 0 : Math.min(45, maxMin),
      rtss_estimado: i === dias.length - 1 ? 0 : 40,
      parte_principal: {
        descricao: i === dias.length - 1
          ? "Dia de descanso completo"
          : "Corrida contínua em Z2, ritmo confortável",
        zona_alvo: "Z2",
        fc_alvo_bpm: {
          min: briefing.zonas_calibradas.z2.fc_min,
          max: briefing.zonas_calibradas.z2.fc_max,
        },
      },
      justificativa: i === dias.length - 1
        ? "Descanso para recuperação."
        : "Corrida leve para manter o condicionamento.",
    })),
    // ... volumes calculados deterministicamente
  };
}
```

---

## 4. Prompt de Feedback Pós-Treino

### 4.1 Quando é chamado

Após cada sincronização de treino: workout sync → cálculo de métricas → chamada Claude para feedback → push notification.

### 4.2 System Prompt do Feedback

```
Você é o componente de feedback pós-treino do FitSync AI. Você recebe os dados de um treino
que o atleta acabou de completar e gera um feedback humanizado.

Regras absolutas:
1. Tom: treinador no WhatsApp. Direto, caloroso, NUNCA punitivo.
2. SEMPRE referencie dados específicos do treino: pace, FC, duração, zona predominante.
3. NUNCA diga "Bom trabalho!" genérico. Seja específico: "Seu pace médio de 5:45/km ficou
   10s mais rápido que na semana passada no mesmo tipo de treino."
4. Se o atleta não atingiu o prescrito, foque no que fez certo antes de mencionar o desvio.
5. Se detectar intensity creep (Z2 prescrito virou Z3), mencione de forma construtiva:
   "Você correu um pouco mais forte que o planejado — da próxima vez tenta segurar o ritmo
   em [pace Z2], mesmo que pareça devagar."
6. NUNCA use termos técnicos (ACWR, decoupling, rTSS). Traduza.
7. Limite: 3-5 frases. Direto ao ponto.
```

### 4.3 Schema de Input do Feedback

```typescript
const FeedbackInputSchema = t.Object({
  treino_prescrito: t.Object({
    tipo: t.String(),
    zona_alvo: t.String(),
    pace_alvo: t.Optional(t.String()),
    fc_alvo: t.Optional(t.Object({ min: t.Number(), max: t.Number() })),
    duracao_prescrita_min: t.Number(),
  }),

  treino_executado: t.Object({
    duracao_real_min: t.Number(),
    pace_medio: t.String(),           // "5:45"
    fc_media: t.Number(),
    fc_max_treino: t.Number(),
    zona_predominante: t.String(),    // "Z2", "Z3", etc.
    aderencia_zona_pct: t.Number(),
    aderencia_pace_pct: t.Optional(t.Number()),
    pa_hr_decoupling_pct: t.Optional(t.Number()),
    cadencia_media: t.Optional(t.Number()),
    rtss: t.Number(),
    rpe: t.Optional(t.Number()),
  }),

  contexto: t.Object({
    semana_no_macro: t.Number(),
    treinos_restantes_semana: t.Number(),
    pace_medio_mesmo_tipo_30d: t.Optional(t.String()),  // comparação histórica
    fc_media_mesmo_tipo_30d: t.Optional(t.Number()),
    decoupling_trend_30d: t.Optional(t.String()),       // "caindo", "estavel", "subindo"
    calibracao_ativa: t.Boolean(),
  }),
})
```

### 4.4 Schema de Output do Feedback

```typescript
const FeedbackOutputSchema = t.Object({
  texto_principal: t.String(),       // 3-5 frases, tom de WhatsApp
  destaque_positivo: t.String(),     // 1 frase do que o atleta fez bem
  sugestao: t.Optional(t.String()),  // 1 frase de melhoria (apenas se relevante)
  emoji_resumo: t.String(),          // Um único emoji que resume o feedback
})
```

### 4.5 Exemplo de Feedback Gerado

Input: atleta fez rodagem Z2 prescrita, mas aderência de zona ficou em 76% (correu mais rápido).

```json
{
  "texto_principal": "Seu treino de hoje durou 50 minutos com pace médio de 6:15/km — consistente e bem executado. Sua FC ficou um pouco acima da zona prescrita em alguns momentos (76% do tempo na zona correta). Da próxima vez, tenta segurar o ritmo em 6:45-7:00/km mesmo que pareça lento — essa é a velocidade que constrói sua base aeróbica.",
  "destaque_positivo": "Duração exata no planejado e ritmo estável do início ao fim.",
  "sugestao": "Nos próximos treinos leves, se sua FC passar de 146 bpm, diminua o passo por 30 segundos e veja se estabiliza.",
  "emoji_resumo": "🏃"
}
```

---

## 5. Conversão para Treino Estruturado Garmin

Após o plano ser gerado e validado, cada sessão é convertida para o formato de workout estruturado do Garmin via sidecar Python.

### 5.1 Mapeamento de Sessão → Workout Steps

```python
# services/garmin-sidecar/app/converters.py

def session_to_garmin_steps(session: dict) -> list[dict]:
    steps = []

    # Aquecimento
    if session.get('aquecimento'):
        steps.append({
            "type": "warmup",
            "duration_type": "time",
            "duration_value_seconds": session['aquecimento']['duracao_min'] * 60,
            "target_type": "heart_rate_zone",
            "target_value": zone_to_garmin_zone(session['aquecimento']['zona']),
        })

    # Parte principal
    pp = session['parte_principal']
    if pp.get('repeticoes'):
        # Intervalado: repeat step
        steps.append({
            "type": "repeat",
            "repeat_count": pp['repeticoes'],
            "steps": [
                {
                    "type": "interval",
                    "duration_type": "time",
                    "duration_value_seconds": pp['duracao_repeticao_min'] * 60,
                    "target_type": "heart_rate",
                    "target_value_low": pp['fc_alvo_bpm']['min'],
                    "target_value_high": pp['fc_alvo_bpm']['max'],
                },
                {
                    "type": "recovery",
                    "duration_type": "time",
                    "duration_value_seconds": pp['recuperacao_min'] * 60,
                    "target_type": "heart_rate_zone",
                    "target_value": zone_to_garmin_zone(pp.get('recuperacao_zona', 'Z1')),
                }
            ]
        })
    else:
        # Contínuo
        steps.append({
            "type": "active",
            "duration_type": "time",
            "duration_value_seconds": calculate_main_duration(session) * 60,
            "target_type": "heart_rate",
            "target_value_low": pp['fc_alvo_bpm']['min'],
            "target_value_high": pp['fc_alvo_bpm']['max'],
        })

    # Desaquecimento
    if session.get('desaquecimento'):
        steps.append({
            "type": "cooldown",
            "duration_type": "time",
            "duration_value_seconds": session['desaquecimento']['duracao_min'] * 60,
            "target_type": "heart_rate_zone",
            "target_value": zone_to_garmin_zone(session['desaquecimento']['zona']),
        })

    return steps
```

---

## 6. Versionamento de Prompts

Cada prompt é um arquivo TypeScript versionado em git:

```
apps/api/src/claude/prompts/
├── plan_v1.ts        # Versão 1 do prompt de geração
├── feedback_v1.ts    # Versão 1 do prompt de feedback
└── index.ts          # Exporta a versão ativa
```

Toda chamada ao Claude loga em `plan_history`:

```sql
INSERT INTO plan_history (athlete_id, plan_json, prompt_version, input_json, tokens_used, cost_usd, created_at)
VALUES ($1, $2, 'plan_v1', $3, $4, $5, now());
```

Regra: nunca editar um prompt versionado. Criar `plan_v2.ts` e mudar o export no `index.ts`.

---

## 7. Estimativa de Custo por Chamada

Com Claude Sonnet 4.6 ($3/M input, $15/M output):

| Componente | Tokens estimados |
|---|---|
| System prompt (role + principios_treino.md) | ~3.000 tokens |
| Briefing do atleta (user message) | ~1.500 tokens |
| Resposta (plano JSON) | ~2.000 tokens |
| **Total por geração de plano** | **~6.500 tokens** |
| **Custo por geração** | **~$0.04** (sem caching) |
| **Com prompt caching (system prompt estável)** | **~$0.015** |

Para feedback pós-treino: ~2.000 tokens total, ~$0.01 por feedback.

Estimativa mensal por atleta ativo (4 planos + 16 feedbacks): **~$0.22/mês** sem caching, **~$0.10/mês** com caching.

---

## 8. O Que Falta Implementar (Fase 2+)

| Feature | Onde impacta | Quando |
|---|---|---|
| Padrões identificados no briefing | Adicionar seção `padroes_identificados` ao briefing com análise de tendências (ex: "aderência FC sextas consistentemente <80%") | Fase 2 |
| HRV e Body Battery no briefing | Adicionar campos de HRV e Body Battery à seção `prontidao` | Fase 2 |
| Periodização TID automática | Backend calcula transição piramidal→polarizado baseado em semanas restantes para prova | Fase 2 |
| Feedback de cadência | Adicionar `cadencia_por_pace` ao input de feedback com detecção de overstriding | Fase 2 |
| Web search para papers | Tool use do Claude para buscar evidência recente em decisões duvidosas | Fase 3 |
| Base vetorial de protocolos | pgvector + RAG antes de cada geração | Fase 3 |

---

## 9. Checklist de Implementação

Para o Claude Code usar como referência ao implementar US-006 e US-016:

- [ ] Criar `apps/api/src/claude/prompts/plan_v1.ts` com system prompt completo (§2.1)
- [ ] Criar `apps/api/src/claude/schemas.ts` com BriefingSchema e PlanOutputSchema (§2.2, §2.3)
- [ ] Criar `apps/api/src/claude/briefing.ts` — função que monta o briefing a partir do banco
- [ ] Criar `apps/api/src/claude/guardrails.ts` — 10 guardrails (§3.1) + loop de regeneração (§3.2)
- [ ] Criar `apps/api/src/claude/fallback.ts` — plano fallback determinístico (§3.3)
- [ ] Criar `apps/api/src/claude/prompts/feedback_v1.ts` — prompt de feedback (§4.2)
- [ ] Criar `services/garmin-sidecar/app/converters.py` — conversão sessão→workout steps (§5)
- [ ] Copiar `principios_treino.md` para `docs/principios_treino.md` e referenciar no build
- [ ] Adicionar tabela `plan_history` com campo `prompt_version` (§6)
- [ ] Adicionar tabela `guardrail_violations` para logging (§3.1)
- [ ] Testes: fixtures com briefing de exemplo (§2.4) → verificar que guardrails aceitam/rejeitam corretamente
- [ ] Testes: mock de resposta Claude → verificar parse + validação do schema de saída

---

## 10. Para o Claude Code Lendo Este Arquivo

Quando implementar qualquer parte da geração de treinos:

1. **Leia este arquivo inteiro antes de começar.**
2. **O principios_treino.md é injetado no system prompt — não resuma, não corte, injete completo.**
3. **Os schemas são o contrato — não adicione campos sem atualizar este documento.**
4. **Os guardrails são lei — não relaxe limites sem conversa com o Rafael.**
5. **Se precisar mudar o prompt, crie nova versão (`plan_vN.ts`), nunca edite versões anteriores.**

---

## 11. Status de Implementação (atualizado 2026-05-16)

Esta seção lista o que **realmente shipou** vs o que o spec acima descreve. Use-a como autoridade quando houver divergência entre o texto do spec e o código.

| Item do spec | Status real | Onde |
|---|---|---|
| BriefingSchema / PlanOutputSchema §2.2/§2.3 (TypeBox) | **Implementado em Zod** (não TypeBox), shape diferente porém alinhado entre backend e mobile | `apps/api/src/claude/schemas.ts` |
| Superset rico (`aquecimento`, `parte_principal{fc_alvo_bpm,repeticoes,recuperacao}`, `desaquecimento`, `rtss_estimado`, `avaliacao`, `objetivo_semana`) | **Implementado como campos opcionais aditivos** sobre a estrutura existente (`weeks[].days[]` com `day:number`, `type`, `duration_min`) — preserva consumidor mobile (R-08) | `schemas.ts` (WorkoutDaySchema/PlanWeekSchema) |
| BriefingSchema §2.2 completo (perfil rico, zonas calibradas, lesões, prontidão expandida) | **Briefing atual é mais simples**; enriquecimento marcado como Fase 2 conforme §8 | `apps/api/src/claude/briefing.ts` |
| Prompt v1 §2.1 | Evoluído para **`plan_v3_structured`** (ativo). Versões antigas mantidas. | `apps/api/src/claude/prompts/plan_v3.ts` (ativo), `plan_v1.ts`, `plan_v2.ts` (históricos) |
| Guardrails G1–G10 §3.1 | Implementados; G1/G10 usam `rtss_estimado` quando presente; G3/G5 detectam alta intensidade por `parte_principal.zona_alvo` | `apps/api/src/claude/guardrails.ts` |
| Fallback determinístico §3.3 | Implementado emitindo a estrutura superset válida (aquecimento/parte_principal Z2 via Karvonen/desaquecimento) | `buildFallbackPlan` em `apps/api/src/claude/client.ts` |
| Feedback prompt §4 | Implementado | `apps/api/src/claude/prompts/feedback_v1.ts` + `generateFeedback` em `client.ts` |
| Conversor sessão→Garmin §5 | **Vive em TS** no `apps/api/src/garmin/workoutBuilder.ts` (caminho live), API constrói o DTO e o sidecar só faz upload. `converters.py` existe como **caminho aditivo testado** no sidecar (aceita `session`+`zones` opcionais) | `apps/api/src/garmin/workoutBuilder.ts`, `services/garmin-sidecar/app/converters.py` |
| Versionamento de prompts §6 | Em uso (`PLAN_PROMPT_VERSION = 'plan_v3_structured'` logado em `plan_history`) | `client.ts` + `prompts/plan_vN.ts` |

**Follow-ups conhecidos (não bloqueiam dogfooding):**
- ✅ ~~Renderizar a estrutura superset no mobile~~ — feito 2026-05-16: `apps/mobile/components/WorkoutStructure.tsx` (colapsável, séries+recuperação, chip rTSS, `notas_tecnicas` gated por Modo Avançado) wired no hero card e nos cards da semana de `plan.tsx`.
- Enriquecer o briefing ao §2.2 completo (Fase 2).
- **Unificar o conversor — DECISÃO PENDENTE (Rafael, CLAUDE.md §6.3).** Estado real: `workoutBuilder.ts` (TS, 180 ln) é o **caminho vivo** — `plan.ts /send-to-garmin` monta o DTO e o sidecar só faz upload. `converters.py` (185 ln) é **fallback inerte mas testado**: `workout.py` usa o DTO pronto quando presente, e só cai no converters se a API não mandar DTO (hoje sempre manda). Opções:
  - **A — TS é a fonte**: apaga `converters.py` + ramo fallback do `workout.py`. Menos código, uma fonte. Perde a capacidade do sidecar montar workout sozinho (spec §5).
  - **B — Python é a fonte**: API manda a `session` rica, sidecar converte. Lógica de formato Garmin junto do cliente Garmin. Mexe no caminho vivo (mais risco), exige a API parar de montar DTO.
  - Recomendação: **A** (menor risco, caminho vivo intacto, remove só código morto). Aguardando OK do Rafael antes de remover qualquer caminho.

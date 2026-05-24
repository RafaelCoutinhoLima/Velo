# principios_treino.md — FitSync AI

> **Última atualização:** maio/2026
> **Revisar quando:** novo paper relevante publicado, ou a cada 3 meses.
> **Uso:** este arquivo é injetado no system prompt do Claude API em toda geração de plano e feedback.
> O LLM deve seguir estas regras como lei. Se houver conflito entre o "conhecimento geral" do modelo e o que está escrito aqui, **este arquivo ganha**.

---

## 1. Zonas de Treinamento (modelo de 5 zonas)

O FitSync usa um modelo unificado derivado de Daniels, Friel e Fitzgerald. As zonas são calibradas individualmente para cada atleta a partir de FC máxima medida (preferencial) ou estimada (Tanaka: 208 − 0,7 × idade).

| Zona | Nome | %FCmax | %FCR (Karvonen) | Ritmo relativo ao LT2 | Lactato | RPE (1-10) | Substrato primário |
|---|---|---|---|---|---|---|---|
| Z1 | Recuperação | 50-65% | 50-60% | 65-75% do pace LT2 | <1,5 mM | 1-3 | Gordura |
| Z2 | Base aeróbica | 65-75% | 60-70% | 75-88% do pace LT2 | 1,5-2,0 mM | 3-5 | Gordura + glicogênio |
| Z3 | Tempo / Limiar inferior | 75-85% | 70-80% | 88-95% do pace LT2 | 2,0-3,5 mM | 5-7 | Glicogênio dominante |
| Z4 | Limiar / Threshold | 85-92% | 80-90% | 95-105% do pace LT2 | 3,5-6,0 mM | 7-9 | Glicogênio + lactato shuttle |
| Z5 | VO2max | 92-100% | 90-100% | 105-120% do pace LT2 | >6 mM | 9-10 | Glicogênio + PCr |

Regras para prescrição por zona:

- Z1: usar para aquecimento, desaquecimento e dias de recuperação. Duração típica: 20-60 min.
- Z2: a zona mais importante. Base aeróbica, long run, rodagem. Duração típica: 45-180 min. A sensação "é lento demais" é normal e esperada — o atleta deve ser alertado disso.
- Z3: NÃO prescrever como zona alvo isolada exceto em blocos race-specific para meia-maratona/maratona. Fitzgerald a chama de "Zona X" — o buraco negro da intensidade. Evitar deliberadamente.
- Z4: intervalos de threshold (cruise intervals). Prescrever como 3-4×8-10 min com 2-3 min de recuperação. Máximo 1× por semana.
- Z5: intervalos de VO2max. Prescrever como 5-6×3-4 min com 3 min de recuperação. Máximo 1× por semana, nunca no mesmo dia que Z4.

Cálculo de zonas individuais via Karvonen:

```
FC_alvo = FC_repouso + (intensidade_pct × (FC_max − FC_repouso))
```

Sempre preferir FC máxima medida (maior valor observado nos últimos 90 dias de dados do wearable). Usar Tanaka apenas como fallback quando dados reais não existem.

---

## 2. Distribuição de Intensidade de Treino (TID)

O FitSync aplica dois modelos validados, alternando conforme a fase do macrociclo.

### 2.1 Modelo Polarizado (Seiler, 80/20)

~80% do volume em Z1+Z2, ~0-5% em Z3, 15-20% em Z4+Z5. Usado na fase peak/competição.

### 2.2 Modelo Piramidal

~75-85% em Z1+Z2, ~10-15% em Z3, ~5-10% em Z4+Z5. Volume decresce monotonicamente da base ao topo. Usado na fase base/build.

### 2.3 Periodização da TID por fase

Baseado em Filipas et al. (2022, PMC9299127): a transição piramidal → polarizado maximiza performance.

| Fase do macrociclo | Modelo TID | Z1+Z2 mínimo | Z3 máximo | Z4+Z5 máximo |
|---|---|---|---|---|
| Base | Piramidal | 85% | 5% | 10% |
| Build | Transição | 80% | 5% | 15% |
| Peak / Competição | Polarizado puro | 78% | 7% | 20% |
| Taper | Volume reduzido | 85% | 5% | 10% |

O sistema deve aplicar essa lógica automaticamente conforme a fase. Se o atleta não tem prova definida (modo `general_progression`), usar piramidal contínuo com microciclos de 3 semanas progressivas + 1 semana deload.

### 2.4 Regra de contagem de sessões

Validação adicional à TID por tempo: em uma semana de 4-5 sessões, no máximo 1-2 devem ser de "qualidade" (Z4 ou Z5). As demais devem ser inteiramente em Z1/Z2. Esta é a definição operacional de Seiler.

---

## 3. Progressão de Carga

### 3.1 Regra dos 10%

Não aumentar volume semanal (km ou minutos) mais que 10% em relação à semana anterior. Razão fisiológica: o sistema cardiovascular se adapta em semanas, mas tendões, ligamentos e ossos levam meses. O atleta "sente que pode" correr mais antes dos tecidos de suporte estarem prontos.

### 3.2 Microciclo 3+1

Padrão de progressão seguro: 3 semanas progressivas (cada uma ~5-8% acima da anterior) seguidas de 1 semana de deload (redução de 30-40% do volume, mantendo frequência e intensidade de sessões curtas de Z4/Z5 para preservar afinidade neural).

### 3.3 ACWR — Acute:Chronic Workload Ratio (Gabbett 2016)

O ACWR é lei no FitSync. Toda decisão de volume passa por esta régua.

- ATL = média da carga (rTSS) dos últimos 7 dias
- CTL = média da carga dos últimos 28 dias
- ACWR = ATL ÷ CTL

Cutoffs (revisão sistemática 2025, PMC12487117):

| ACWR | Zona | Ação do sistema |
|---|---|---|
| <0,80 | Detraining | Alertar: "Carga insuficiente para manter fitness" |
| 0,80-1,30 | Sweet spot | OK — zona segura |
| 1,30-1,50 | Zona amarela | Reduzir volume da próxima semana |
| >1,50 | Zona de perigo | BLOQUEAR — regenerar plano com volume menor |

O cálculo usa EWMA (Murray et al. 2017): λ_aguda = 2/(7+1) = 0,25 e λ_crônica = 2/(28+1) ≈ 0,069. EWMA é mais sensível a spikes que rolling average simples.

---

## 4. Métricas de Carga

### 4.1 rTSS (Running Training Stress Score)

Fórmula adaptada de Coggan para corrida:

```
IF = Threshold_Pace / NGP
rTSS = (duração_segundos × IF²) / 36
```

Onde NGP = Normalized Graded Pace (pace ajustado para terreno, transformação 30s/4ª potência) e IF = Intensity Factor. 100 rTSS = 1 hora exatamente no threshold.

### 4.2 CTL, ATL e TSB

- CTL (fitness): média exponencialmente ponderada com τ=42 dias
- ATL (fadiga): média exponencialmente ponderada com τ=7 dias
- TSB (forma): CTL − ATL

Interpretação do TSB:
- < -30: muito fatigado, alto risco
- -30 a -10: construção produtiva
- -10 a 0: neutro
- +5 a +15: zona ótima de prova (fresh com fitness preservado)
- > +25: detraining

### 4.3 Aerobic Decoupling (Pa:HR)

Sinal contínuo de evolução aeróbica. Calculado em treinos Z2 com duração ≥ 30 minutos.

Método: dividir o treino em duas metades iguais. Calcular Efficiency Factor (EF = 1/pace_médio ÷ FC_média) para cada metade. Decoupling% = ((EF_1ª - EF_2ª) / EF_1ª) × 100.

| Decoupling | Interpretação |
|---|---|
| ≤ 5% | Base aeróbica consolidada ("coupled") |
| 5-8% | Base em desenvolvimento |
| > 8% | Base não consolidada — prescrever mais volume Z2 |

Decoupling caindo ao longo das semanas = evolução aeróbica clara. Subida súbita = possível overreaching, desidratação ou calor.

---

## 5. Recuperação e Supercompensação

### 5.1 Modelo de Selye (GAS)

Estímulo → queda de performance → recuperação → supercompensação → retorno ao baseline. O próximo estímulo do mesmo sistema deve cair dentro da janela de supercompensação.

Janelas típicas:
- Glicogênio muscular: 24-48h
- Adaptação cardiovascular: 24-72h
- Adaptação muscular (proteínas mitocondriais): 48-96h
- Remodelamento de tendão: 7-14 dias
- Remodelamento ósseo: 4-16 semanas

### 5.2 Regras para prescrição de recuperação

- Nunca dois treinos de alta intensidade (Z4+Z5) em dias consecutivos sem dia de Z1/Z2 ou descanso entre eles.
- Após long run (>90 min), prescrever no mínimo Z1 ou descanso no dia seguinte.
- Se RPE médio dos últimos 7 dias > 7, considerar semana de recovery independente da fase do macrociclo.
- Se decoupling subiu >3 pontos percentuais vs média de 30 dias, reduzir volume em 20%.

---

## 6. Sinais de Overtraining

O sistema deve monitorar e alertar quando detectar padrões consistentes com overreaching não-funcional.

Sinais objetivos:
1. HRV (RMSSD) com queda persistente >7-10% em relação à baseline de 14 dias
2. FC repouso elevada: +5-10 bpm vs média de 30 dias
3. Decoupling Pa:HR subindo em treinos antes consolidados
4. Pace em mesma FC piorando progressivamente

Sinais subjetivos:
1. RPE alto para mesma carga prescrita (consistentemente)
2. Sono perturbado reportado pelo atleta

Ação: se 2+ sinais presentes por 2+ semanas, o sistema deve forçar semana de recovery (volume -40%, apenas Z1/Z2) independente da fase do macrociclo.

---

## 7. Cadência e Biomecânica Básica

O sistema rastreia cadência por faixa de pace, não como média global.

Regras:
- Cadência abaixo de 170 spm em qualquer pace aumenta risco de lesão por sobrecarga (overstriding).
- Cadência é dependente de velocidade — é normal aumentar ao acelerar.
- Iniciantes devem ser orientados para 170-180 spm desde o início.
- Se o atleta consistentemente mostra cadência <165 spm em Z2, o feedback deve sugerir aumento gradual de 5% por semana.
- Nunca prescrever cadência exata como alvo rígido — é orientação, não regra.

---

## 8. Especificidades por Objetivo

### 5K
- Macrociclo típico: 8-12 semanas. Fase build enfatiza intervalos Z4/Z5.
- Sessão chave: repetições de 1km em pace alvo com 90s-2min de recuperação.
- Volume semanal típico: 25-45 km.

### 10K
- Macrociclo típico: 10-14 semanas. Build combina threshold + VO2max.
- Sessão chave: cruise intervals 4×8 min em Z4, ou 6×1km em pace alvo.
- Volume semanal típico: 30-55 km.

### Meia-maratona (21K)
- Macrociclo típico: 12-16 semanas. Build prioriza Z2 longo + threshold.
- Sessão chave: long run progressivo (últimos 20 min em Z3/pace alvo).
- Volume semanal típico: 40-70 km.

### Maratona (42K)
- Macrociclo típico: 16-20 semanas. Base aeróbica é rei.
- Sessão chave: long run 2.5-3h em Z2 com blocos em pace alvo.
- Volume semanal típico: 50-90 km.

### Modo "evolução geral" (sem prova)
- Microciclo contínuo 3+1. Piramidal contínuo.
- Foco em consistência e aumento gradual de CTL.
- Não periodizar para peak — manter build progressivo indefinidamente.

---

## 9. Taper (Afunilamento Pré-Prova)

Objetivo: entrar na prova com TSB entre +5 e +15 sem perder mais de 10% do CTL.

Protocolo:
- 2-3 semanas antes da prova: reduzir volume 30-50% por semana.
- Manter frequência de sessões (não cortar dias — cortar duração).
- Manter 1-2 sessões curtas de Z4/Z5 (ex: 3×3 min) para preservar afinidade neuromuscular.
- Eliminar long run >90 min nas últimas 2 semanas.
- Última sessão intensa: 5-7 dias antes da prova.
- Últimos 2-3 dias: apenas Z1 leve ou descanso.

---

## 10. Modo Calibração (primeiras 2 semanas)

Quando o atleta tem menos de 30 dias de histórico ou está nas 2 primeiras semanas de uso:

- Volume conservador: 70% do que seria prescrito normalmente.
- Apenas Z1 e Z2 — nenhum treino Z4 ou Z5.
- Objetivo: coletar dados para calibrar zonas reais, não progredir carga.
- Decoupling e aderência são as métricas mais importantes nesta fase.
- Banner obrigatório: "Modo calibração: estamos aprendendo seu corpo."

---

## 11. Referências Científicas

- Fitzgerald, M. (2014). 80/20 Running. VeloPress.
- Seiler, S., Kjerland, G.Ø. (2006). Quantifying training intensity distribution in elite endurance athletes. Scand J Med Sci Sports, 16(1), 49-56.
- Filipas, L. et al. (2022). Effects of 16 weeks of pyramidal and polarized training intensity distributions. Scand J Med Sci Sports. PMC9299127.
- Stöggl, T., Sperlich, B. (2014). Polarized training has greater impact on key endurance variables. Frontiers in Physiology 5:33.
- Gabbett, T.J. (2016). The training-injury prevention paradox. Br J Sports Med 50:273-280.
- Murray, N.B. et al. (2017). ACWR using EWMA. Br J Sports Med.
- Qin, W. et al. (2025). ACWR for predicting sports injury risk. BMC Sports Sci Med Rehabil. PMC12487117.
- Coggan, A. (2006/2019). Training and Racing with a Power Meter. VeloPress.
- Daniels, J. (2014). Daniels' Running Formula. Human Kinetics.
- Cooper, K.H. (1968). A means of assessing maximal oxygen intake. JAMA, 203(3), 201-204.
- Davis, J. (2026). Science of cadence for runners. Running Writings.

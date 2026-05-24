/**
 * TRIMP de Banister (Training Impulse) — carga de treino baseada em FC.
 * Funciona para QUALQUER esporte com FC média (corrida, bike, natação,
 * remo, etc), ao contrário do rTSS que depende de pace de corrida.
 *
 * Fórmula: TRIMP = duração_min × HRr × 0.64 × e^(y · HRr)
 *   HRr = (FC_média − FC_repouso) / (FC_máx − FC_repouso)  ∈ [0, 1]
 *   y   = 1.92 (homem) / 1.67 (mulher) / 1.80 (outro/desconhecido)
 *
 * O fator exponencial dá peso maior a sessões intensas — coerente com a
 * ideia de que tempo em zona alta de FC custa mais que tempo em zona baixa.
 * Usado para somar carga cross-sport no ACWR/CTL/ATL (US do volume total).
 */
export function calculateTrimp(
  durationS: number,
  avgHr: number,
  hrRest: number,
  hrMax: number,
  sex: 'M' | 'F' | 'other' = 'other',
): number {
  // Inputs inválidos → sem carga (não bloqueia, só não soma).
  if (durationS <= 0) return 0;
  if (hrMax <= hrRest) return 0; // zonas impossíveis
  if (avgHr <= hrRest) return 0; // sem esforço acima do repouso

  // Fração de reserva de FC, travada em [0, 1] (FC acima da máx vira 1).
  const hrReserve = Math.min(1, (avgHr - hrRest) / (hrMax - hrRest));

  const y = sex === 'M' ? 1.92 : sex === 'F' ? 1.67 : 1.8;
  const durationMin = durationS / 60;

  const trimp = durationMin * hrReserve * 0.64 * Math.exp(y * hrReserve);

  return Math.round(Math.max(0, trimp) * 10) / 10;
}

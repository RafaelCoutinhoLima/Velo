import type { DailyLoad } from './types';

/**
 * ACWR (Acute:Chronic Workload Ratio).
 * ATL dos últimos 7 dias / CTL dos últimos 28 dias.
 * Zona segura: 0.8–1.30. Acima de 1.30 = risco de lesão.
 */
export function calculateACWR(loads: DailyLoad[]): number {
  if (loads.length === 0) return 0;

  // Tie-break por rtss: com datas duplicadas, o resultado não pode depender
  // da ordem de entrada (slice(-7) escolheria subconjuntos diferentes).
  const sorted = [...loads].sort((a, b) => a.date.localeCompare(b.date) || a.rtss - b.rtss);
  const last7 = sorted.slice(-7);
  const last28 = sorted.slice(-28);

  const atl7 = last7.reduce((sum, l) => sum + l.rtss, 0) / 7;
  const ctl28 = last28.reduce((sum, l) => sum + l.rtss, 0) / 28;

  if (ctl28 === 0) return 0;

  return Math.round((atl7 / ctl28) * 1000) / 1000;
}

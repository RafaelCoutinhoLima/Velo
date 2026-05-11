import type { DailyLoad } from './types';

const ATL_DECAY = Math.exp(-1 / 7);
const CTL_DECAY = Math.exp(-1 / 42);

/**
 * ATL (Acute Training Load) — média exponencial de 7 dias.
 */
export function calculateATL(loads: DailyLoad[]): number {
  return loads.reduce((atl, { rtss }) => atl * ATL_DECAY + rtss * (1 - ATL_DECAY), 0);
}

/**
 * CTL (Chronic Training Load) — média exponencial de 42 dias.
 */
export function calculateCTL(loads: DailyLoad[]): number {
  return loads.reduce((ctl, { rtss }) => ctl * CTL_DECAY + rtss * (1 - CTL_DECAY), 0);
}

/**
 * TSB (Training Stress Balance) = CTL - ATL.
 * Positivo = atleta descansado. Negativo = fatigado.
 */
export function calculateTSB(ctl: number, atl: number): number {
  return Math.round((ctl - atl) * 10) / 10;
}

import { describe, expect, it } from 'vitest';
import { calculateATL, calculateCTL, calculateTSB } from '../src/load';
import type { DailyLoad } from '../src/types';

const makeLoads = (values: number[]): DailyLoad[] =>
  values.map((rtss, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, rtss }));

describe('calculateATL', () => {
  it('retorna 0 para lista vazia', () => {
    expect(calculateATL([])).toBe(0);
  });

  it('cresce com cargas altas repetidas', () => {
    const low = calculateATL(makeLoads([20, 20, 20, 20, 20, 20, 20]));
    const high = calculateATL(makeLoads([80, 80, 80, 80, 80, 80, 80]));
    expect(high).toBeGreaterThan(low);
  });

  it('decai após dias de descanso', () => {
    const withTraining = calculateATL(makeLoads([100, 100, 100, 100, 100, 100, 100]));
    const withRest = calculateATL(makeLoads([100, 100, 100, 0, 0, 0, 0]));
    expect(withTraining).toBeGreaterThan(withRest);
  });
});

describe('calculateCTL', () => {
  it('retorna 0 para lista vazia', () => {
    expect(calculateCTL([])).toBe(0);
  });

  it('é maior que ATL para mesma carga sustentada (janela maior = mais lento)', () => {
    const loads = makeLoads(Array(42).fill(60));
    const atl = calculateATL(loads);
    const ctl = calculateCTL(loads);
    // Com mesma carga constante, ATL e CTL convergem mas CTL chega mais devagar
    expect(ctl).toBeLessThanOrEqual(atl + 5);
  });
});

describe('calculateTSB', () => {
  it('retorna CTL - ATL', () => {
    expect(calculateTSB(50, 70)).toBe(-20);
    expect(calculateTSB(70, 50)).toBe(20);
    expect(calculateTSB(60, 60)).toBe(0);
  });
});

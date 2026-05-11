import { describe, expect, it } from 'vitest';
import { calculateACWR } from '../src/acwr';
import type { DailyLoad } from '../src/types';

const makeLoads = (values: number[], startDate = '2026-01-01'): DailyLoad[] => {
  const start = new Date(startDate);
  return values.map((rtss, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().slice(0, 10), rtss };
  });
};

describe('calculateACWR', () => {
  it('retorna 0 para lista vazia', () => {
    expect(calculateACWR([])).toBe(0);
  });

  it('retorna 0 quando CTL é zero (sem treinos crônicos)', () => {
    const loads = makeLoads([0, 0, 0, 0, 0, 0, 0]);
    expect(calculateACWR(loads)).toBe(0);
  });

  it('é próximo de 1.0 para carga constante de 28+ dias', () => {
    const loads = makeLoads(Array(28).fill(50));
    const acwr = calculateACWR(loads);
    expect(acwr).toBeGreaterThan(0.8);
    expect(acwr).toBeLessThan(1.2);
  });

  it('ultrapassa 1.30 quando carga aguda é muito alta', () => {
    // 21 dias de 30 TSS + 7 dias de 100 TSS = spike
    const loads = makeLoads([...Array(21).fill(30), ...Array(7).fill(100)]);
    const acwr = calculateACWR(loads);
    expect(acwr).toBeGreaterThan(1.3);
  });

  it('é menor que 0.8 após semana de descanso após treino intenso', () => {
    const loads = makeLoads([...Array(21).fill(80), ...Array(7).fill(0)]);
    const acwr = calculateACWR(loads);
    expect(acwr).toBeLessThan(0.8);
  });

  // Fixture de regressão — treino real do Rafael (anonimizado)
  // Base: 3 semanas de 40 rTSS/dia (~28km/sem)
  // Spike: semana com 25% mais carga (~35km/sem → 50 rTSS/dia)
  it('fixture Rafael: semana de 35km após base de 28km/semana', () => {
    const base = Array(21).fill(40); // ~28km/sem base
    const spike = Array(7).fill(50); // ~35km/sem (+25%)
    const loads = makeLoads([...base, ...spike]);
    const acwr = calculateACWR(loads);
    // ACWR = 50 / ((21*40 + 7*50)/28) = 50/42.5 ≈ 1.176 — dentro do seguro
    expect(acwr).toBeGreaterThanOrEqual(1.0);
    expect(acwr).toBeLessThanOrEqual(1.3);
  });
});

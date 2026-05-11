import { describe, expect, it } from 'vitest';
import { calculateDecoupling, filterHROutliers } from '../src/decoupling';
import type { WorkoutInput } from '../src/types';

describe('filterHROutliers', () => {
  it('retorna array vazio para entrada vazia', () => {
    expect(filterHROutliers([])).toEqual([]);
  });

  it('mantém série estável sem outliers', () => {
    const series = [140, 142, 141, 143, 142, 144];
    expect(filterHROutliers(series)).toEqual(series);
  });

  it('remove pico abrupto (> 20bpm/s)', () => {
    const series = [140, 142, 190, 143, 141];
    const filtered = filterHROutliers(series);
    expect(filtered).not.toContain(190);
  });

  it('mantém sempre o primeiro valor', () => {
    const series = [180, 142, 141];
    expect(filterHROutliers(series)[0]).toBe(180);
  });
});

describe('calculateDecoupling', () => {
  const baseWorkout: WorkoutInput = {
    date: '2026-01-01',
    distance_m: 10000,
    duration_s: 3600,
    avg_hr: 150,
    max_hr: 170,
  };

  it('retorna 0 sem série de FC e dados válidos', () => {
    const result = calculateDecoupling(baseWorkout);
    expect(result).toBe(0);
  });

  it('retorna 0 para série com menos de 10 pontos', () => {
    const result = calculateDecoupling({ ...baseWorkout, hr_series: [140, 142, 144] });
    expect(result).toBe(0);
  });

  it('retorna decoupling positivo quando FC sobe na segunda metade', () => {
    const firstHalf = Array(30).fill(145);
    const secondHalf = Array(30).fill(158);
    const result = calculateDecoupling({
      ...baseWorkout,
      hr_series: [...firstHalf, ...secondHalf],
    });
    expect(result).toBeGreaterThan(0);
  });

  it('retorna decoupling negativo (improvável mas válido) quando FC cai', () => {
    const firstHalf = Array(30).fill(158);
    const secondHalf = Array(30).fill(145);
    const result = calculateDecoupling({
      ...baseWorkout,
      hr_series: [...firstHalf, ...secondHalf],
    });
    expect(result).toBeLessThan(0);
  });

  it('decoupling < 5% indica boa eficiência aeróbica', () => {
    const stable = Array(60).fill(150);
    const result = calculateDecoupling({ ...baseWorkout, hr_series: stable });
    expect(Math.abs(result)).toBeLessThan(5);
  });

  it('retorna 0 quando média de FC da primeira metade é zero (série de zeros)', () => {
    // Cobre o guard avgHR1 === 0
    const result = calculateDecoupling({ ...baseWorkout, hr_series: Array(60).fill(0) });
    expect(result).toBe(0);
  });
});

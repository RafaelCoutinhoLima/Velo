import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateTrimp } from '../src/trimp';

describe('calculateTrimp — exemplos', () => {
  it('zero quando duração ≤ 0', () => {
    expect(calculateTrimp(0, 150, 60, 190)).toBe(0);
    expect(calculateTrimp(-100, 150, 60, 190)).toBe(0);
  });

  it('zero quando FC média ≤ FC repouso (sem esforço)', () => {
    expect(calculateTrimp(3600, 55, 60, 190)).toBe(0);
    expect(calculateTrimp(3600, 60, 60, 190)).toBe(0);
  });

  it('zero quando zonas inválidas (FC máx ≤ repouso)', () => {
    expect(calculateTrimp(3600, 150, 190, 190)).toBe(0);
    expect(calculateTrimp(3600, 150, 200, 190)).toBe(0);
  });

  it('valor plausível para 1h em ~70% da reserva (homem)', () => {
    // HRr = (150-60)/(190-60) = 0.692
    // TRIMP = 60 × 0.692 × 0.64 × e^(1.92×0.692) ≈ 60×0.692×0.64×3.78 ≈ 100
    const t = calculateTrimp(3600, 150, 60, 190, 'M');
    expect(t).toBeGreaterThan(80);
    expect(t).toBeLessThan(130);
  });

  it('homem > mulher para mesmos inputs (y maior no expoente)', () => {
    const m = calculateTrimp(3600, 160, 60, 190, 'M');
    const f = calculateTrimp(3600, 160, 60, 190, 'F');
    expect(m).toBeGreaterThan(f);
  });

  it('trava HRr em 1 quando FC média acima da máx', () => {
    const atMax = calculateTrimp(1800, 190, 60, 190, 'M');
    const aboveMax = calculateTrimp(1800, 210, 60, 190, 'M');
    expect(aboveMax).toBe(atMax); // clamp em 1.0
  });
});

describe('calculateTrimp — propriedades', () => {
  const arbHr = fc.integer({ min: 40, max: 210 });

  it('sempre não-negativo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20000 }),
        arbHr,
        fc.integer({ min: 30, max: 80 }),
        fc.integer({ min: 150, max: 210 }),
        (dur, avg, rest, max) => calculateTrimp(dur, avg, rest, max) >= 0,
      ),
    );
  });

  it('monotônico em duração (mais tempo na mesma FC ⇒ ≥ carga)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 7200 }),
        fc.integer({ min: 120, max: 180 }),
        (dur, avg) => {
          const base = calculateTrimp(dur, avg, 60, 190, 'M');
          const longer = calculateTrimp(dur + 600, avg, 60, 190, 'M');
          return longer >= base;
        },
      ),
    );
  });

  it('monotônico em FC média (mais intenso ⇒ ≥ carga, duração fixa)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 600, max: 7200 }),
        fc.integer({ min: 70, max: 160 }),
        (dur, avg) => {
          const lower = calculateTrimp(dur, avg, 60, 190, 'M');
          const higher = calculateTrimp(dur, avg + 20, 60, 190, 'M');
          return higher >= lower;
        },
      ),
    );
  });
});

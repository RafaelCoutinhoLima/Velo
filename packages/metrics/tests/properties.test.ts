// Property-based tests (fast-check) — propriedades matemáticas e invariantes
// das funções de métricas. Complementa os testes baseados em exemplo: aqui
// procuramos contra-exemplos em centenas de execuções aleatórias.
//
// Quando uma propriedade falha, fast-check faz "shrinking" e devolve o menor
// input que reproduz o bug — vital para entender regressões em código que
// processa séries temporais.

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateACWR } from '../src/acwr';
import { calculateDecoupling, filterHROutliers } from '../src/decoupling';
import { calculateATL, calculateCTL, calculateTSB } from '../src/load';
import { calculateRTSS } from '../src/rtss';
import type { DailyLoad, WorkoutInput } from '../src/types';

// ── Geradores reutilizáveis ──────────────────────────────────────────────────

// Datas ISO ordenáveis (ano-mês-dia plausível em janela de treino real).
// Geramos via offset de dias para evitar "Invalid Date" do fc.date com extremos.
const arbDate = fc.integer({ min: 0, max: 365 * 3 }).map((offset) => {
  const base = new Date('2024-01-01T00:00:00Z').getTime();
  return new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
});

const arbRtss = fc.double({
  min: 0,
  max: 500,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbDailyLoad: fc.Arbitrary<DailyLoad> = fc.record({
  date: arbDate,
  rtss: arbRtss,
});

const arbDailyLoads = fc.array(arbDailyLoad, { minLength: 0, maxLength: 60 });

const arbPositiveInt = (max: number) => fc.integer({ min: 1, max });

const arbWorkout: fc.Arbitrary<WorkoutInput> = fc.record({
  duration_s: arbPositiveInt(20_000), // até ~5h30
  distance_m: arbPositiveInt(60_000), // até 60km
});

// FTP pace plausível em corrida (3:30/km até 7:00/km).
const arbFtpPace = fc.integer({ min: 210, max: 420 });

// ── ACWR ──────────────────────────────────────────────────────────────────────

describe('calculateACWR — propriedades', () => {
  it('retorna 0 para input vazio', () => {
    expect(calculateACWR([])).toBe(0);
  });

  it('é sempre não-negativo para qualquer série válida', () => {
    fc.assert(fc.property(arbDailyLoads, (loads) => calculateACWR(loads) >= 0));
  });

  it('não depende da ordem do array de entrada (sort interno por data)', () => {
    fc.assert(
      fc.property(arbDailyLoads, (loads) => {
        const shuffled = [...loads].sort(() => Math.random() - 0.5);
        return calculateACWR(loads) === calculateACWR(shuffled);
      }),
    );
  });

  it('retorna ≈1 quando todas as cargas são iguais (≥28 dias)', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 200, noNaN: true, noDefaultInfinity: true }), (rtss) => {
        const loads: DailyLoad[] = Array.from({ length: 28 }, (_, i) => ({
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          rtss,
        }));
        // Tolerância de arredondamento (3 casas) para floats finitos
        expect(calculateACWR(loads)).toBeCloseTo(1.0, 2);
      }),
    );
  });

  it('é invariante a escala: ACWR(k·loads) == ACWR(loads), k>0', () => {
    fc.assert(
      fc.property(
        arbDailyLoads.filter((l) => l.length >= 7),
        fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
        (loads, k) => {
          const scaled = loads.map((l) => ({ ...l, rtss: l.rtss * k }));
          // Tolerância maior por causa do arredondamento a 3 casas
          expect(Math.abs(calculateACWR(loads) - calculateACWR(scaled))).toBeLessThan(0.01);
        },
      ),
    );
  });
});

// ── rTSS ──────────────────────────────────────────────────────────────────────

describe('calculateRTSS — propriedades', () => {
  it('zero quando duração ou distância ≤ 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        fc.integer({ min: 1, max: 10000 }),
        arbFtpPace,
        (duration_s, distance_m, ftp) => calculateRTSS({ duration_s, distance_m }, ftp) === 0,
      ),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: -1000, max: 0 }),
        arbFtpPace,
        (duration_s, distance_m, ftp) => calculateRTSS({ duration_s, distance_m }, ftp) === 0,
      ),
    );
  });

  it('é sempre não-negativo', () => {
    fc.assert(fc.property(arbWorkout, arbFtpPace, (w, ftp) => calculateRTSS(w, ftp) >= 0));
  });

  it('monotônico em duração: dobrar duração no mesmo pace dobra TSS', () => {
    fc.assert(
      fc.property(
        // Treinos com TSS suficiente — o round(.1) introduz ruído ≤0.05 absoluto.
        fc.integer({ min: 600, max: 7200 }), // 10min a 2h
        fc.integer({ min: 1000, max: 30000 }), // 1km a 30km
        arbFtpPace,
        (dur, dist, ftp) => {
          const single = calculateRTSS({ duration_s: dur, distance_m: dist }, ftp);
          const doubled = calculateRTSS({ duration_s: dur * 2, distance_m: dist * 2 }, ftp);
          // Filtra TSS baixo (rounding domina): exige single ≥ 5
          if (single < 5) return doubled <= single * 2 + 0.3;
          return Math.abs(doubled / single - 2) < 0.02;
        },
      ),
    );
  });

  it('IF=1 quando pace == FTP pace → TSS ≈ duration_s/3600·100', () => {
    fc.assert(
      fc.property(
        // Durações onde a distância derivada é grande o suficiente pra arredondar bem.
        fc.integer({ min: 600, max: 7200 }),
        arbFtpPace,
        (duration_s, ftp) => {
          const distance_m = Math.round((duration_s / ftp) * 1000);
          if (distance_m === 0) return true;
          const tss = calculateRTSS({ duration_s, distance_m }, ftp);
          const expected = (duration_s / 3600) * 100;
          // Tolerância de 2% por arredondamento do distance_m em inputs pequenos
          return Math.abs(tss - expected) / expected < 0.02;
        },
      ),
    );
  });
});

// ── ATL / CTL / TSB ──────────────────────────────────────────────────────────

describe('calculateATL — propriedades', () => {
  it('zero para input vazio', () => {
    expect(calculateATL([])).toBe(0);
  });

  it('sempre não-negativo para rtss ≥ 0', () => {
    fc.assert(fc.property(arbDailyLoads, (loads) => calculateATL(loads) >= 0));
  });

  it('monotônico em rtss: somar Δ≥0 em algum dia não decresce ATL', () => {
    fc.assert(
      fc.property(
        arbDailyLoads.filter((l) => l.length > 0),
        fc.integer({ min: 0, max: 50 }),
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (loads, idx, delta) => {
          const i = idx % loads.length;
          const bumped = loads.map((l, k) => (k === i ? { ...l, rtss: l.rtss + delta } : l));
          return calculateATL(bumped) >= calculateATL(loads) - 1e-9;
        },
      ),
    );
  });
});

describe('calculateCTL — propriedades', () => {
  it('zero para input vazio', () => {
    expect(calculateCTL([])).toBe(0);
  });

  it('ATL reage mais rápido que CTL ao mesmo input (decay menor)', () => {
    // Sequência de cargas zeros + um spike no final: ATL "sobe" mais que CTL.
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 40 }),
        fc.double({ min: 50, max: 200, noNaN: true, noDefaultInfinity: true }),
        (n, spike) => {
          const loads: DailyLoad[] = Array.from({ length: n }, (_, i) => ({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            rtss: i === n - 1 ? spike : 0,
          }));
          // Spike isolado: ATL > CTL pois decay ATL é menor (7d vs 42d)
          return calculateATL(loads) > calculateCTL(loads);
        },
      ),
    );
  });
});

describe('calculateTSB — propriedades', () => {
  it('é igual a CTL - ATL arredondado a 1 casa', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -200, max: 200, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -200, max: 200, noNaN: true, noDefaultInfinity: true }),
        (ctl, atl) => {
          const expected = Math.round((ctl - atl) * 10) / 10;
          return calculateTSB(ctl, atl) === expected;
        },
      ),
    );
  });
});

// ── Decoupling + HR outlier filter ───────────────────────────────────────────

describe('filterHROutliers — propriedades', () => {
  it('vazio → vazio', () => {
    expect(filterHROutliers([])).toEqual([]);
  });

  it('output.length ≤ input.length sempre', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 30, max: 220 }), { maxLength: 200 }),
        (series) => filterHROutliers(series).length <= series.length,
      ),
    );
  });

  it('mantém todos quando deltas estão sob o threshold (≤20 bpm/s)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 180 }),
        fc.array(fc.integer({ min: -20, max: 20 }), { minLength: 1, maxLength: 100 }),
        (start, deltas) => {
          const series: number[] = [start];
          for (const d of deltas) series.push(series[series.length - 1] + d);
          return filterHROutliers(series).length === series.length;
        },
      ),
    );
  });

  it('primeiro elemento sempre presente', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 30, max: 220 }), { minLength: 1, maxLength: 100 }),
        (series) => filterHROutliers(series)[0] === series[0],
      ),
    );
  });
});

describe('calculateDecoupling — propriedades', () => {
  it('zero quando série < 10 pontos', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 30, max: 220 }), { maxLength: 9 }),
        (hr_series) => calculateDecoupling({ duration_s: 1, distance_m: 1, hr_series }) === 0,
      ),
    );
  });

  it('zero (ou ≈0) quando FC é constante', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60, max: 180 }),
        fc.integer({ min: 10, max: 100 }),
        (hr, len) => {
          const hr_series = Array.from({ length: len }, () => hr);
          return calculateDecoupling({ duration_s: 1, distance_m: 1, hr_series }) === 0;
        },
      ),
    );
  });

  it('sinal de decoupling segue diferença avgHR2 - avgHR1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 160 }),
        fc.integer({ min: -10, max: 10 }),
        (baseHr, drift) => {
          // Série de 20 pontos: primeira metade em baseHr, segunda em baseHr+drift
          const hr_series = [...Array(10).fill(baseHr), ...Array(10).fill(baseHr + drift)];
          const result = calculateDecoupling({
            duration_s: 1,
            distance_m: 1,
            hr_series,
          });
          if (drift > 0) return result > 0;
          if (drift < 0) return result < 0;
          return result === 0;
        },
      ),
    );
  });
});

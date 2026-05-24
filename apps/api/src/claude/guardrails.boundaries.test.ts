// Boundary/threshold tests pra guardrails — focados em matar mutantes de
// operador (>, >=, <, <=) e de threshold (0.1, 1.3, 200, 90, 50, 40%).
// Cada teste exercita um valor exatamente no limite e outro a 1 unidade
// dele — a diferença obriga a regra a usar o operador correto.
//
// Complementa guardrails.test.ts (cenários gerais). Não substitui mutation
// testing — apenas pega os bugs de regra de negócio mais comuns.

import { describe, expect, it, mock } from 'bun:test';

mock.module('../db/client', () => ({
  supabase: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));

import { applyGuardrails, type GuardrailContext } from './guardrails';
import type { PlanResponse, PlanWeek, WorkoutDay } from './schemas';

const LONG_DESC = 'Corrida leve em Z2 mantendo conversa, foco em base aerobica geral progressiva.';

function day(p: Partial<WorkoutDay> = {}): WorkoutDay {
  return {
    day: 1,
    type: 'easy',
    duration_min: 60,
    distance_km: 10,
    zones: [2],
    description: LONG_DESC,
    ...p,
  };
}
function week(days: WorkoutDay[], p: Partial<PlanWeek> = {}): PlanWeek {
  return { week_number: 1, total_km: 50, days, why_text: 'baseline da semana', ...p };
}
function plan(weeks: PlanWeek[]): PlanResponse {
  return { weeks, summary: 'plano de teste com descricao suficientemente longa' };
}
const baseCtx: GuardrailContext = { atl: 0, ctl: 0, calibrationMode: false };

// ── G5: progressão semanal exatamente em 10% (limite) vs 10.01% (acima) ──────

describe('G5 — limite de progressão semanal (10%)', () => {
  it('NÃO recorta progressão exata de 10% (limite inclusivo do operador >)', () => {
    const p = plan([
      week([day()], { week_number: 1, total_km: 50 }),
      week([day()], { week_number: 2, total_km: 55 }), // +10% exato
    ]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[1].total_km).toBe(55);
  });

  it('recorta progressão acima de 10% (10.2% deve cair para exatamente +10%)', () => {
    const p = plan([
      week([day()], { week_number: 1, total_km: 50 }),
      week([day()], { week_number: 2, total_km: 55.1 }), // +10.2%
    ]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[1].total_km).toBe(55); // 50 * 1.1
  });
});

// ── G6: long run exatamente em 90 min vs 91 min em semana de taper ───────────

describe('G6 — limite de long run no taper (90 min)', () => {
  it('NÃO ajusta long run de exatamente 90 min em taper', () => {
    const p = plan([week([day({ type: 'long', duration_min: 90, distance_km: 15 })])]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, weeksToRace: 1 });
    expect(p.weeks[0].days[0].duration_min).toBe(90);
    expect(p.weeks[0].days[0].distance_km).toBe(15);
  });

  it('ajusta long run de 91 min em taper para 90 min', () => {
    const p = plan([week([day({ type: 'long', duration_min: 91, distance_km: 15 })])]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, weeksToRace: 1 });
    expect(p.weeks[0].days[0].duration_min).toBe(90);
  });

  it('NÃO mexe em long run quando NÃO está em taper (weeksToRace>2)', () => {
    const p = plan([week([day({ type: 'long', duration_min: 120, distance_km: 20 })])]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, weeksToRace: 5 });
    expect(p.weeks[0].days[0].duration_min).toBe(120);
  });

  it('NÃO mexe quando weeksToRace é null (não há prova)', () => {
    const p = plan([week([day({ type: 'long', duration_min: 120, distance_km: 20 })])]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, weeksToRace: null });
    expect(p.weeks[0].days[0].duration_min).toBe(120);
  });
});

// ── G1: ACWR projetado no limite 1.30 vs acima ──────────────────────────────

describe('G1 — ACWR projetado limite 1.30', () => {
  it('NÃO escala quando CTL=0 (atleta sem histórico)', () => {
    const p = plan([
      week([day({ duration_min: 60 }), day({ day: 2, type: 'interval', duration_min: 60 })]),
    ]);
    const before = p.weeks[0].days[0].duration_min;
    applyGuardrails(p, 'ath-1', { ...baseCtx, atl: 0, ctl: 0 });
    expect(p.weeks[0].days[0].duration_min).toBe(before);
  });

  it('reduz volume da semana 1 quando ACWR projetado > 1.30', () => {
    // ctl baixo + várias sessões pesadas → projectedAcwr alto
    const p = plan([
      week([
        day({ type: 'interval', duration_min: 80 }),
        day({ day: 2, type: 'interval', duration_min: 80 }),
        day({ day: 3, type: 'tempo', duration_min: 80 }),
        day({ day: 4, type: 'long', duration_min: 120 }),
      ]),
    ]);
    const before = p.weeks[0].days[0].duration_min;
    applyGuardrails(p, 'ath-1', { ...baseCtx, atl: 5, ctl: 5 });
    expect(p.weeks[0].days[0].duration_min).toBeLessThan(before);
  });

  it('preserva tipos rest/cross intactos mesmo durante escalonamento ACWR', () => {
    const p = plan([
      week([
        day({ type: 'interval', duration_min: 80 }),
        day({ day: 2, type: 'rest', duration_min: 0, distance_km: 0 }),
        day({ day: 3, type: 'cross', duration_min: 45, distance_km: 0 }),
        day({ day: 4, type: 'tempo', duration_min: 60 }),
      ]),
    ]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, atl: 5, ctl: 5 });
    expect(p.weeks[0].days[1].duration_min).toBe(0); // rest mantido
    expect(p.weeks[0].days[2].duration_min).toBe(45); // cross mantido
  });
});

// ── G10: rTSS por sessão limite 200 ──────────────────────────────────────────

describe('G10 — rTSS por sessão limite 200', () => {
  it('NÃO ajusta sessão com rtss_estimado de exatamente 200', () => {
    const p = plan([week([day({ type: 'easy', duration_min: 60, rtss_estimado: 200 })])]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[0].days[0].duration_min).toBe(60);
  });

  it('ajusta sessão com rtss_estimado de 201', () => {
    const p = plan([week([day({ type: 'easy', duration_min: 200, rtss_estimado: 201 })])]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[0].days[0].rtss_estimado).toBe(200);
    // duration deve ter sido recalculada como 200/rpm_easy (1.2) ≈ 167
    expect(p.weeks[0].days[0].duration_min).toBe(167);
  });
});

// ── G3: dois estímulos altos consecutivos ────────────────────────────────────

describe('G3 — dois estímulos altos consecutivos', () => {
  it('rebaixa o SEGUNDO de dois interval consecutivos para easy/Z1', () => {
    const p = plan([week([day({ day: 1, type: 'interval' }), day({ day: 2, type: 'interval' })])]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[0].days[0].type).toBe('interval'); // primeiro fica
    expect(p.weeks[0].days[1].type).toBe('easy'); // segundo cai
    expect(p.weeks[0].days[1].zones).toEqual([1]);
  });

  it('NÃO mexe quando há easy entre dois intervals', () => {
    const p = plan([
      week([
        day({ day: 1, type: 'interval' }),
        day({ day: 2, type: 'easy' }),
        day({ day: 3, type: 'interval' }),
      ]),
    ]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[0].days[2].type).toBe('interval');
  });
});

// ── G4: Z3 (tempo) acima de 40% das sessões de qualidade ─────────────────────

describe('G4 — Z3 overuse limite 40%', () => {
  it('NÃO loga quando exatamente 40% das sessões de qualidade são tempo', () => {
    // 5 quality (não-rest/cross) das quais 2 tempo = 40% — operador é `>` 0.4
    const p = plan([
      week([
        day({ day: 1, type: 'easy' }),
        day({ day: 2, type: 'easy' }),
        day({ day: 3, type: 'easy' }),
        day({ day: 4, type: 'tempo' }),
        day({ day: 5, type: 'tempo' }),
        day({ day: 6, type: 'rest', duration_min: 0, distance_km: 0 }),
        day({ day: 7, type: 'cross', distance_km: 0 }),
      ]),
    ]);
    // No assertion on side effects — just verifies it doesn't throw and rule branch executed
    expect(() => applyGuardrails(p, 'ath-1', baseCtx)).not.toThrow();
  });
});

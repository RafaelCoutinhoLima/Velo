import { describe, expect, it, mock } from 'bun:test';

// logViolation escreve no Supabase (fire-and-forget). Mockamos o client
// para os testes serem puros e sem ruído de rede.
mock.module('../db/client', () => ({
  supabase: { from: () => ({ insert: () => Promise.resolve({ error: null }) }) },
}));

import {
  ACWR_MAX,
  applyGuardrails,
  type GuardrailContext,
  WEEKLY_PROGRESSION_MAX,
} from './guardrails';
import type { PlanResponse, PlanWeek, WorkoutDay } from './schemas';

const LONG_DESC = 'Corrida leve em Z2 mantendo conversa, foco em base aerobica geral.';

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
  return { week_number: 1, total_km: 50, days, why_text: 'porque sim', ...p };
}

function plan(weeks: PlanWeek[]): PlanResponse {
  return { weeks, summary: 'resumo do plano de teste' };
}

const baseCtx: GuardrailContext = { atl: 0, ctl: 0, calibrationMode: false };

describe('guardrails — constantes', () => {
  it('expõe os limites não-negociáveis', () => {
    expect(ACWR_MAX).toBe(1.3);
    expect(WEEKLY_PROGRESSION_MAX).toBe(0.1);
  });
});

describe('G2 — modo calibração só Z1/Z2', () => {
  it('rebaixa sessão de alta intensidade para easy/Z2', () => {
    const p = plan([week([day({ day: 1, type: 'interval' })])]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, calibrationMode: true });
    const d = p.weeks[0].days[0];
    expect(d.type).toBe('easy');
    expect(d.zones).toEqual([2]);
    expect(d.description.startsWith('[Modo calibração]')).toBe(true);
  });

  it('não toca em tipos permitidos (long)', () => {
    const p = plan([week([day({ type: 'long' })])]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, calibrationMode: true });
    expect(p.weeks[0].days[0].type).toBe('long');
  });
});

describe('G3 — dois estímulos altos consecutivos', () => {
  it('rebaixa o segundo dia e a parte estruturada', () => {
    const p = plan([
      week([
        day({ day: 1, type: 'interval' }),
        day({
          day: 2,
          type: 'tempo',
          parte_principal: {
            descricao: 'blocos',
            zona_alvo: 'Z4',
            fc_alvo_bpm: { min: 160, max: 175 },
          },
        }),
      ]),
    ]);
    applyGuardrails(p, 'ath-1', baseCtx);
    const d2 = p.weeks[0].days[1];
    expect(d2.type).toBe('easy');
    expect(d2.zones).toEqual([1]);
    expect(d2.parte_principal?.zona_alvo).toBe('Z1');
    expect(d2.description.startsWith('[Ajustado automaticamente')).toBe(true);
  });

  it('detecta alta intensidade pela zona_alvo estruturada', () => {
    const p = plan([
      week([
        day({
          day: 1,
          type: 'easy',
          parte_principal: {
            descricao: 'x',
            zona_alvo: 'Z5',
            fc_alvo_bpm: { min: 170, max: 185 },
          },
        }),
        day({
          day: 2,
          type: 'easy',
          parte_principal: {
            descricao: 'y',
            zona_alvo: 'Z4',
            fc_alvo_bpm: { min: 160, max: 175 },
          },
        }),
      ]),
    ]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[0].days[1].type).toBe('easy');
    expect(p.weeks[0].days[1].zones).toEqual([1]);
  });
});

describe('G1 — ACWR projetado ≤ 1.30', () => {
  it('reduz o volume da semana 1 quando o ACWR projetado estoura', () => {
    const p = plan([
      week([
        day({ day: 1, type: 'easy', duration_min: 60, rtss_estimado: 200 }),
        day({ day: 2, type: 'easy', duration_min: 60, rtss_estimado: 200 }),
      ]),
    ]);
    applyGuardrails(p, 'ath-1', { atl: 50, ctl: 10, calibrationMode: false });
    const d = p.weeks[0].days[0];
    expect(d.duration_min).toBeLessThan(60);
    expect(d.rtss_estimado).toBeLessThan(200);
  });

  it('não faz nada quando ctl <= 0', () => {
    const p = plan([week([day({ duration_min: 60, rtss_estimado: 200 })])]);
    applyGuardrails(p, 'ath-1', { atl: 999, ctl: 0, calibrationMode: false });
    expect(p.weeks[0].days[0].duration_min).toBe(60);
  });
});

describe('G5 — progressão semanal ≤ 10%', () => {
  it('clampa a semana que cresce mais de 10%', () => {
    const p = plan([
      week([day()], { week_number: 1, total_km: 50 }),
      week([day()], { week_number: 2, total_km: 100 }),
    ]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[1].total_km).toBe(55);
  });
});

describe('G6 — taper: long run ≤ 90 min nas 2 últimas semanas', () => {
  it('corta long run > 90 min quando weeksToRace <= 2', () => {
    const p = plan([week([day({ type: 'long', duration_min: 120, distance_km: 20 })])]);
    applyGuardrails(p, 'ath-1', { ...baseCtx, weeksToRace: 2 });
    const d = p.weeks[0].days[0];
    expect(d.duration_min).toBe(90);
    expect(d.distance_km).toBe(17);
    expect(d.description.startsWith('[Ajustado para taper]')).toBe(true);
  });
});

describe('G10 — rTSS por sessão ≤ 200', () => {
  it('corta sessão com rTSS estimado > 200', () => {
    const p = plan([week([day({ type: 'easy', rtss_estimado: 250 })])]);
    applyGuardrails(p, 'ath-1', baseCtx);
    const d = p.weeks[0].days[0];
    expect(d.rtss_estimado).toBe(200);
    expect(d.duration_min).toBe(167);
    expect(d.description.startsWith('[Duração ajustada para segurança]')).toBe(true);
  });
});

describe('G4/G7/G8/G9 — regras de log (sem mutação)', () => {
  it('G4: Z3 (tempo) acima de 40% das sessões de qualidade', () => {
    const p = plan([
      week([
        day({ day: 1, type: 'tempo' }),
        day({ day: 2, type: 'easy' }),
        day({ day: 3, type: 'tempo' }),
      ]),
    ]);
    applyGuardrails(p, 'ath-1', baseCtx);
    expect(p.weeks[0].days.map((d) => d.type)).toEqual(['tempo', 'easy', 'tempo']);
  });

  it('G9/G8: descrição curta e alta intensidade sem alvo de FC/pace', () => {
    const p = plan([week([day({ type: 'interval', description: 'Tiros.' })])]);
    expect(() => applyGuardrails(p, 'ath-1', baseCtx)).not.toThrow();
  });

  it('G7: 4+ semanas progressivas sem deload', () => {
    const p = plan(
      [50, 55, 60, 66, 72].map((km, i) => week([day()], { week_number: i + 1, total_km: km })),
    );
    expect(() => applyGuardrails(p, 'ath-1', baseCtx)).not.toThrow();
  });
});

import { describe, expect, it } from 'bun:test';
import { buildBriefing } from './briefing';
import type { PlanInput } from './client';

// Datas relativas a hoje pra cair nas janelas de 4 semanas.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function makeInput(workouts: Record<string, unknown>[]): PlanInput {
  return {
    athleteId: 'a1',
    profile: {
      birth_year: 1995,
      weight_kg: 70,
      sex: 'M',
      fc_max: 190,
      fc_rest: 50,
      goal_mode: 'general_progression',
      weekly_frequency: '4x',
      timezone: 'America/Recife',
    },
    recentWorkouts: workouts,
    metrics: { atl: 40, ctl: 45, tsb: 5, acwr: 0.9 },
    metricsHistory: [],
    calibrationMode: false,
  };
}

describe('buildBriefing — cross-training', () => {
  it('volume_km conta só corrida; carga (rtss) conta todos os esportes', () => {
    const b = buildBriefing(
      makeInput([
        { date: daysAgo(2), sport: 'run', distance_m: 8000, duration_s: 2400, rtss: 50 },
        { date: daysAgo(3), sport: 'bike', distance_m: 40000, duration_s: 7200, rtss: 90 },
        { date: daysAgo(4), sport: 'swim', distance_m: 1500, duration_s: 2400, rtss: 40 },
      ]),
    );
    const semanas = b.ultimas_4_semanas as Array<{
      semana: string;
      volume_km: number;
      rtss_total: number;
    }>;
    const atual = semanas.find((s) => s.semana === 'atual');
    expect(atual).toBeDefined();
    // Só os 8km de corrida entram no volume — natação/bike NÃO somam km
    expect(atual?.volume_km).toBe(8);
    // Mas a carga soma os 3 (50+90+40 = 180)
    expect(atual?.rtss_total).toBe(180);
  });

  it('cross_training_recente agrupa não-corrida por esporte', () => {
    const b = buildBriefing(
      makeInput([
        { date: daysAgo(1), sport: 'run', distance_m: 6000, duration_s: 1800, rtss: 45 },
        { date: daysAgo(2), sport: 'bike', distance_m: 30000, duration_s: 5400, rtss: 80 },
        { date: daysAgo(5), sport: 'bike', distance_m: 25000, duration_s: 3600, rtss: 60 },
        { date: daysAgo(6), sport: 'swim', distance_m: 1200, duration_s: 1800, rtss: 35 },
      ]),
    );
    const cross = b.cross_training_recente as Array<{
      esporte: string;
      sessoes: number;
      carga_total: number;
      minutos_total: number;
    }>;
    const bike = cross.find((c) => c.esporte === 'bike');
    expect(bike?.sessoes).toBe(2);
    expect(bike?.carga_total).toBe(140); // 80 + 60
    expect(bike?.minutos_total).toBe(150); // 90 + 60 min
    const swim = cross.find((c) => c.esporte === 'swim');
    expect(swim?.sessoes).toBe(1);
    // Corrida não aparece no cross-training
    expect(cross.find((c) => c.esporte === 'run')).toBeUndefined();
  });

  it('atleta que só corre → cross_training_recente vazio', () => {
    const b = buildBriefing(
      makeInput([
        { date: daysAgo(1), sport: 'run', distance_m: 6000, duration_s: 1800, rtss: 45 },
        // sport ausente também conta como corrida (default histórico)
        { date: daysAgo(3), distance_m: 5000, duration_s: 1500, rtss: 38 },
      ]),
    );
    expect(b.cross_training_recente).toEqual([]);
  });
});

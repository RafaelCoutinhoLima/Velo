import { describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';

// generatePlan chama a Claude API real — mockado para o teste do /generate.
mock.module('../claude/client', () => ({
  generatePlan: mock(async () => ({
    plan: {
      weeks: [
        {
          week_number: 1,
          total_km: 30,
          why_text: 'Base aeróbica',
          days: [
            {
              day: 1,
              type: 'easy',
              duration_min: 40,
              distance_km: 6,
              zones: [2],
              description: 'Leve',
            },
          ],
        },
      ],
      summary: 'Plano de teste',
    },
    promptVersion: 'test_v1',
    inputJson: {},
    tokensUsed: { input: 10, output: 20 },
    costUsd: 0.001,
  })),
}));

// garminClient faz upload real — mockado para o teste do /send-to-garmin.
mock.module('../garmin/client', () => ({
  garminClient: { scheduleWorkout: mock(async () => ({ ok: true })) },
}));

import { createPlanPlugin } from './plan';

const PLAN_ROW = {
  id: 'plan-uuid',
  athlete_id: 'athlete-uuid',
  week_start: '2026-05-11',
  why_text: 'Semana de base',
  is_active: true,
  prompt_version: '1',
  plan_json: {
    weeks: [
      {
        week_number: 1,
        total_km: 30,
        why_text: 'Semana de base',
        days: [
          {
            day: 1,
            type: 'easy',
            duration_min: 40,
            distance_km: 6,
            zones: [2],
            description: 'Corrida leve',
          },
          {
            day: 2,
            type: 'interval',
            duration_min: 60,
            distance_km: 10,
            zones: [4, 5],
            description: 'Intervalado',
          },
          {
            day: 3,
            type: 'rest',
            duration_min: 0,
            distance_km: 0,
            zones: [],
            description: 'Descanso',
          },
          {
            day: 4,
            type: 'easy',
            duration_min: 35,
            distance_km: 5,
            zones: [2],
            description: 'Corrida leve',
          },
          {
            day: 5,
            type: 'tempo',
            duration_min: 50,
            distance_km: 8,
            zones: [3, 4],
            description: 'Tempo run',
          },
          {
            day: 6,
            type: 'long',
            duration_min: 80,
            distance_km: 13,
            zones: [2, 3],
            description: 'Long run',
          },
          {
            day: 7,
            type: 'rest',
            duration_min: 0,
            distance_km: 0,
            zones: [],
            description: 'Descanso',
          },
        ],
      },
    ],
    summary: 'Semana de base aeróbica',
  },
};

const METRICS_ROW = {
  date: '2026-05-12',
  atl: 45.2,
  ctl: 52.1,
  tsb: -6.9,
  acwr: 0.87,
};

const ATHLETE_ROW = { id: 'athlete-uuid', user_id: 'user-auth-uuid' };

function makeMockDb(
  opts: {
    planData?: typeof PLAN_ROW | null;
    planError?: { message: string } | null;
    metricsData?: typeof METRICS_ROW | null;
    metricsError?: { message: string } | null;
    updateError?: { message: string } | null;
    athleteExists?: boolean;
  } = {},
) {
  const {
    planData = PLAN_ROW,
    planError = null,
    metricsData = METRICS_ROW,
    metricsError = null,
    updateError = null,
    athleteExists = true,
  } = opts;

  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: () => ({
            eq: () => ({
              single: async () =>
                athleteExists
                  ? { data: ATHLETE_ROW, error: null }
                  : { data: null, error: { message: 'Not found' } },
            }),
          }),
        };
      }

      if (table === 'metrics_daily') {
        const singleResult = { data: metricsData, error: metricsError };
        const listResult = { data: metricsData ? [metricsData] : [], error: metricsError };
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                // limit() must be both awaitable (list) and have .single() (point query)
                limit: () =>
                  Object.assign(Promise.resolve(listResult), {
                    single: async () => singleResult,
                  }),
              }),
            }),
          }),
        };
      }

      if (table === 'plans') {
        return {
          select: () => ({
            eq: (_field: string, _val: unknown) => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    single: async () => ({ data: planData, error: planError }),
                  }),
                }),
              }),
              single: async () => ({ data: planData, error: planError }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: updateError }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                single: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;

function makeApp(db: ReturnType<typeof makeMockDb>) {
  return new Elysia()
    .onError(({ error, code }) => {
      if (code === 'VALIDATION')
        return new Response(JSON.stringify({ validation: true }), { status: 422 });
      return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
    })
    .use(createPlanPlugin(db as unknown as Parameters<typeof createPlanPlugin>[0])) as AnyElysia;
}

function get(app: AnyElysia, path: string) {
  return app.handle(new Request(`http://localhost${path}`));
}

function patch(app: AnyElysia, path: string, body: object) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('GET /plan/current', () => {
  it('retorna plano ativo do atleta', async () => {
    const app = makeApp(makeMockDb());
    const res = await get(app, '/plan/current?athlete_id=athlete-uuid');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.id).toBe('plan-uuid');
  });

  it('retorna { plan: null } quando não há plano', async () => {
    const app = makeApp(makeMockDb({ planData: null, planError: { message: 'Not found' } }));
    const res = await get(app, '/plan/current?athlete_id=athlete-uuid');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBeNull();
  });

  it('retorna { plan: null } quando atleta não existe no banco', async () => {
    const app = makeApp(makeMockDb({ athleteExists: false }));
    const res = await get(app, '/plan/current?athlete_id=unknown-user');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBeNull();
  });

  it('retorna 422 quando athlete_id está ausente', async () => {
    const app = makeApp(makeMockDb());
    const res = await get(app, '/plan/current');
    expect(res.status).toBe(422);
  });
});

describe('PATCH /plan/move', () => {
  it('move workout válido sem violar guardrail', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, '/plan/move', {
      plan_id: 'plan-uuid',
      workout_day: 1,
      target_day: 3,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('retorna warning para dois estímulos altos consecutivos', async () => {
    const app = makeApp(makeMockDb());
    // Move interval (day 2) to day 4 which has easy next to tempo (day 5)
    const res = await patch(app, '/plan/move', {
      plan_id: 'plan-uuid',
      workout_day: 2,
      target_day: 4,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.requires_confirmation).toBe(true);
    expect(body.warning).toContain('recuperação');
  });

  it('aceita move com force=true mesmo violando guardrail', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, '/plan/move', {
      plan_id: 'plan-uuid',
      workout_day: 2,
      target_day: 4,
      force: true,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('retorna 500 quando plano não é encontrado', async () => {
    const app = makeApp(makeMockDb({ planData: null, planError: { message: 'Not found' } }));
    const res = await patch(app, '/plan/move', {
      plan_id: 'nonexistent',
      workout_day: 1,
      target_day: 3,
    });
    expect(res.status).toBe(500);
  });

  it('retorna 422 para body inválido', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, '/plan/move', { plan_id: 'plan-uuid' });
    expect(res.status).toBe(422);
  });
});

function post(app: AnyElysia, path: string, body: object) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const RECENT_ISO = new Date(Date.now() - 3 * 86_400_000).toISOString();

// Mock para /generate: athletes(*) → buildPlan(workouts/metrics/calibração)
// → plans.insert → plan_history.insert → rpc(get_garmin_token)=null.
function makeGenDb(
  opts: {
    athlete?: unknown;
    saveErr?: { message: string } | null;
    token?: string | null;
    planRow?: unknown;
  } = {},
) {
  const {
    athlete = { id: 'int-1', user_id: 'user-uuid', calibration_mode: true, created_at: RECENT_ISO },
    saveErr = null,
    token = null,
    planRow = null,
  } = opts;
  // limit() precisa ser awaitable (lista) e ter .single() (primeiro workout)
  const listP = Object.assign(Promise.resolve({ data: [], error: null }), {
    single: async () => ({ data: null, error: null }),
  });
  const awaitableEq = Object.assign(Promise.resolve({ data: [], error: null }), {
    order: () => ({ limit: () => listP }),
  });
  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: () => ({
            eq: () => ({
              single: async () =>
                athlete ? { data: athlete, error: null } : { data: null, error: { message: 'no' } },
            }),
          }),
        };
      }
      if (table === 'plans' || table === 'plan_history' || table === 'jobs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({ single: async () => ({ data: planRow, error: null }) }),
                }),
              }),
            }),
          }),
          insert: () =>
            Object.assign(Promise.resolve({ error: saveErr }), {
              select: () => ({ single: async () => ({ data: { id: 'p-new' }, error: saveErr }) }),
            }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      // workouts / metrics_daily
      return { select: () => ({ eq: () => awaitableEq }) };
    },
    rpc: async () => ({ data: token, error: null }),
  };
}

describe('POST /plan/generate', () => {
  it('gera o plano (happy path, Claude mockado)', async () => {
    const app = makeApp(makeGenDb() as Parameters<typeof makeApp>[0]);
    const res = await post(app, '/plan/generate', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.weeks[0].week_number).toBe(1);
    expect(body.plan.summary).toBe('Plano de teste');
  });

  it('falha quando atleta não existe', async () => {
    const app = makeApp(makeGenDb({ athlete: null }) as Parameters<typeof makeApp>[0]);
    const res = await post(app, '/plan/generate', { athlete_id: 'ghost' });
    expect(res.status).toBe(500);
  });

  it('422 quando body é inválido', async () => {
    const app = makeApp(makeGenDb() as Parameters<typeof makeApp>[0]);
    const res = await post(app, '/plan/generate', {});
    expect(res.status).toBe(422);
  });

  it('com Garmin conectado, envia os treinos da primeira semana (sendPlanToGarmin)', async () => {
    // Atleta com fc_max/fc_rest + token → buildPlan chama sendPlanToGarmin
    // que percorre weeks[0].days e despacha 5 workouts (dias non-rest).
    const athlete = {
      id: 'int-1',
      user_id: 'user-uuid',
      calibration_mode: true,
      created_at: RECENT_ISO,
      fc_max: 185,
      fc_rest: 55,
    };
    const app = makeApp(
      makeGenDb({ athlete, token: 'garmin-tok' }) as Parameters<typeof makeApp>[0],
    );
    const res = await post(app, '/plan/generate', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(200);
    // sendPlanToGarmin é fire-and-forget — damos um tick pra ele rodar
    await new Promise((r) => setTimeout(r, 30));
  });
});

describe('POST /plan/send-to-garmin', () => {
  const PLAN = { plan_json: PLAN_ROW.plan_json };

  it('envia os treinos da semana pro relógio (happy path)', async () => {
    const db = makeGenDb({ token: 'garmin-tok', planRow: PLAN });
    const app = makeApp(db as Parameters<typeof makeApp>[0]);
    const res = await post(app, '/plan/send-to-garmin', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(5); // 7 dias - 2 rest
  });

  it('404 quando atleta não existe', async () => {
    const app = makeApp(makeGenDb({ athlete: null }) as Parameters<typeof makeApp>[0]);
    const res = await post(app, '/plan/send-to-garmin', { athlete_id: 'ghost' });
    expect(res.status).toBe(404);
  });

  it('400 quando Garmin não está conectado', async () => {
    const app = makeApp(makeGenDb({ token: null }) as Parameters<typeof makeApp>[0]);
    const res = await post(app, '/plan/send-to-garmin', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(400);
  });

  it('404 quando não há plano ativo', async () => {
    const app = makeApp(
      makeGenDb({ token: 'tok', planRow: null }) as Parameters<typeof makeApp>[0],
    );
    const res = await post(app, '/plan/send-to-garmin', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(404);
  });

  it('404 quando a semana não existe no plano', async () => {
    const app = makeApp(
      makeGenDb({ token: 'tok', planRow: PLAN }) as Parameters<typeof makeApp>[0],
    );
    const res = await post(app, '/plan/send-to-garmin', {
      athlete_id: 'user-uuid',
      week_number: 9,
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /plan/metrics', () => {
  it('retorna métricas atuais e histórico', async () => {
    const app = makeApp(makeMockDb());
    const res = await get(app, '/plan/metrics?athlete_id=athlete-uuid');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).not.toBeNull();
  });

  it('retorna { current: null } quando não há métricas', async () => {
    const app = makeApp(makeMockDb({ metricsData: null, metricsError: { message: 'Not found' } }));
    const res = await get(app, '/plan/metrics?athlete_id=athlete-uuid');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBeNull();
  });

  it('retorna 422 quando athlete_id está ausente', async () => {
    const app = makeApp(makeMockDb());
    const res = await get(app, '/plan/metrics');
    expect(res.status).toBe(422);
  });
});

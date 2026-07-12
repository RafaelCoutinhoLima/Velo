import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import type { TokenVerifier } from '../lib/auth';
import { createWorkoutsPlugin } from './workouts';

const alwaysAuth: TokenVerifier = async () => 'user-uuid';

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;
type Db = Parameters<typeof createWorkoutsPlugin>[0];

const AID = '11111111-1111-4111-8111-111111111111';
const WID = '22222222-2222-4222-8222-222222222222';

// Mock genérico: athletes → internalId; workouts → dados/erro configuráveis.
function makeMockDb(
  opts: {
    athlete?: { id: string } | null;
    listData?: unknown[] | null;
    listError?: { message: string } | null;
    single?: unknown;
    singleError?: { message: string } | null;
    updateError?: { message: string } | null;
  } = {},
) {
  const {
    athlete = { id: AID },
    listData = [],
    listError = null,
    single,
    singleError = null,
    updateError = null,
  } = opts;

  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: athlete, error: null }) }),
          }),
        };
      }
      // workouts
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: listData, error: listError }),
            }),
            eq: () => ({
              single: async () => ({ data: single ?? null, error: singleError }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: async () => ({ error: updateError }),
          }),
        }),
      };
    },
  } as unknown as Db;
}

function makeApp(db: Db) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(createWorkoutsPlugin(db, alwaysAuth)) as AnyElysia;
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

describe('GET /workouts', () => {
  it('lista treinos derivando o esporte do typeKey e removendo o campo cru', async () => {
    const db = makeMockDb({
      listData: [
        {
          id: WID,
          date: '2026-05-10',
          distance_m: 8000,
          duration_s: 2400,
          avg_hr: 150,
          rtss: 60,
          rpe: 6,
          type_key: 'road_biking',
        },
      ],
    });
    const app = makeApp(db);
    const res = await get(app, '/workouts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workouts).toEqual([
      {
        id: WID,
        date: '2026-05-10',
        distance_m: 8000,
        duration_s: 2400,
        avg_hr: 150,
        rtss: 60,
        rpe: 6,
        sport: 'bike',
      },
    ]);
  });

  it('retorna lista vazia quando o atleta ainda não tem perfil (internalId nulo)', async () => {
    const app = makeApp(makeMockDb({ athlete: null }));
    const res = await get(app, '/workouts');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ workouts: [] });
  });

  it('aceita o parâmetro limit', async () => {
    const app = makeApp(makeMockDb({ listData: [] }));
    const res = await get(app, '/workouts?limit=5');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ workouts: [] });
  });

  it('propaga falha do banco como erro', async () => {
    const app = makeApp(makeMockDb({ listError: { message: 'connection error' } }));
    const res = await get(app, '/workouts');
    expect((await res.json()).error).toContain('Falha ao buscar treinos');
  });

  it('401 quando não autenticado', async () => {
    const app = new Elysia()
      .onError(({ error }) => ({ error: (error as Error).message }))
      .use(createWorkoutsPlugin(makeMockDb(), async () => null)) as AnyElysia;
    const res = await get(app, '/workouts');
    expect(res.status).toBe(401);
  });
});

describe('GET /workouts/:id', () => {
  it('retorna detalhes completos derivando campos do raw_payload', async () => {
    const db = makeMockDb({
      single: {
        id: WID,
        date: '2026-05-10',
        distance_m: 8000,
        duration_s: 2400,
        avg_hr: 150,
        rtss: 60,
        rpe: 6,
        raw_payload: {
          activityType: { typeKey: 'running' },
          averageSpeed: 2.5,
          maxHR: 180,
          calories: 500,
          elevationGain: 12.6,
          elevationLoss: 8.4,
          vO2MaxValue: 50.2,
          steps: 9000,
          activityName: 'Corrida matinal',
          locationName: 'Parque',
        },
      },
    });
    const app = makeApp(db);
    const res = await get(app, `/workouts/${WID}`);
    expect(res.status).toBe(200);
    const { workout } = await res.json();
    expect(workout).toEqual({
      id: WID,
      date: '2026-05-10',
      sport: 'run',
      distance_m: 8000,
      duration_s: 2400,
      avg_hr: 150,
      rtss: 60,
      rpe: 6,
      max_hr: 180,
      calories: 500,
      elevation_gain: 13,
      elevation_loss: 8,
      avg_pace_s: 400,
      vo2max: 50.2,
      steps: 9000,
      activity_name: 'Corrida matinal',
      location: 'Parque',
    });
  });

  it('lida com raw_payload ausente devolvendo campos derivados nulos', async () => {
    const db = makeMockDb({
      single: {
        id: WID,
        date: '2026-05-10',
        distance_m: 8000,
        duration_s: 2400,
        avg_hr: 150,
        rtss: 60,
        rpe: null,
        raw_payload: null,
      },
    });
    const app = makeApp(db);
    const res = await get(app, `/workouts/${WID}`);
    const { workout } = await res.json();
    expect(workout.sport).toBe('run'); // sem typeKey → assume corrida
    expect(workout.max_hr).toBeNull();
    expect(workout.avg_pace_s).toBeNull();
    expect(workout.location).toBeNull();
  });

  it('não calcula pace quando averageSpeed é zero', async () => {
    const db = makeMockDb({
      single: {
        id: WID,
        date: '2026-05-10',
        raw_payload: { averageSpeed: 0 },
      },
    });
    const app = makeApp(db);
    const res = await get(app, `/workouts/${WID}`);
    const { workout } = await res.json();
    expect(workout.avg_pace_s).toBeNull();
  });

  it('404 quando o atleta ainda não tem perfil (internalId nulo)', async () => {
    const app = makeApp(makeMockDb({ athlete: null }));
    const res = await get(app, `/workouts/${WID}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Treino não encontrado');
  });

  it('404 quando o treino não existe ou pertence a outro atleta (escopo IDOR)', async () => {
    const app = makeApp(makeMockDb({ single: null }));
    const res = await get(app, `/workouts/${WID}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Treino não encontrado');
  });

  it('404 quando o banco retorna erro na busca', async () => {
    const app = makeApp(makeMockDb({ singleError: { message: 'db down' } }));
    const res = await get(app, `/workouts/${WID}`);
    expect(res.status).toBe(404);
  });

  it('401 quando não autenticado', async () => {
    const app = new Elysia()
      .onError(({ error }) => ({ error: (error as Error).message }))
      .use(createWorkoutsPlugin(makeMockDb(), async () => null)) as AnyElysia;
    const res = await get(app, `/workouts/${WID}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /workouts/:id', () => {
  it('salva o RPE (happy path)', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, `/workouts/${WID}`, { rpe: 7 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('404 quando o atleta ainda não tem perfil (internalId nulo)', async () => {
    const app = makeApp(makeMockDb({ athlete: null }));
    const res = await patch(app, `/workouts/${WID}`, { rpe: 7 });
    expect(res.status).toBe(404);
  });

  it('500 quando o banco falha ao salvar', async () => {
    const app = makeApp(makeMockDb({ updateError: { message: 'update failed' } }));
    const res = await patch(app, `/workouts/${WID}`, { rpe: 7 });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Falha ao salvar RPE');
  });

  it('422 quando rpe está fora do intervalo válido (1-10)', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, `/workouts/${WID}`, { rpe: 11 });
    expect(res.status).toBe(422);
  });

  it('422 quando rpe é menor que 1', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, `/workouts/${WID}`, { rpe: 0 });
    expect(res.status).toBe(422);
  });

  it('401 quando não autenticado', async () => {
    const app = new Elysia()
      .onError(({ error }) => ({ error: (error as Error).message }))
      .use(createWorkoutsPlugin(makeMockDb(), async () => null)) as AnyElysia;
    const res = await patch(app, `/workouts/${WID}`, { rpe: 7 });
    expect(res.status).toBe(401);
  });
});

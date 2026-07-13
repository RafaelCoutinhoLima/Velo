import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import type { TokenVerifier } from '../lib/auth';
import { createGarminPlugin } from './garmin';

const alwaysAuth: TokenVerifier = async () => 'user-auth-uuid';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const ATHLETE_UUID = 'athlete-internal-uuid';
const USER_UUID = 'user-auth-uuid';
const TOKEN_JSON = JSON.stringify({ oauth_token: 'tok', oauth_token_secret: 'sec' });

const SAMPLE_ACTIVITIES = [
  {
    garmin_id: 'g1',
    date: '2026-05-01',
    distance_m: 5000,
    duration_s: 1800,
    avg_hr: 145,
    raw: { activityId: 'g1' },
  },
  {
    garmin_id: 'g2',
    date: '2026-05-03',
    distance_m: 10000,
    duration_s: 3600,
    avg_hr: 155,
    raw: { activityId: 'g2' },
  },
];

function makeWorkouts(distinctDays: number) {
  return Array.from({ length: distinctDays }, (_, i) => ({
    garmin_id: `g${i}`,
    date: `2026-04-${String((i % 30) + 1).padStart(2, '0')}`,
    distance_m: 8000,
    duration_s: 2800,
    avg_hr: 150,
    rtss: null,
  }));
}

// US-017: a saída de calibração exige ≥30 dias de dados E ≥14 dias de app.
const WORKOUTS_7_DAYS = makeWorkouts(7);
const WORKOUTS_30_DAYS = makeWorkouts(30);

const DAYS_AGO = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// ──────────────────────────────────────────────────────────────────────────────
// DB mock factory
// ──────────────────────────────────────────────────────────────────────────────

type MockDbOpts = {
  athleteExists?: boolean;
  rpcData?: string | null;
  rpcError?: { message: string } | null;
  upsertError?: { message: string } | null;
  workoutsData?: typeof WORKOUTS_7_DAYS;
  calibrationMode?: boolean;
  createdAt?: string;
};

function makeMockDb(opts: MockDbOpts = {}) {
  const {
    athleteExists = true,
    rpcData = TOKEN_JSON,
    rpcError = null,
    upsertError = null,
    workoutsData = [],
    calibrationMode = true,
    createdAt = DAYS_AGO(40),
  } = opts;

  // Tracks calls for assertions
  const calls = {
    metricsUpsert: 0,
    workoutsUpdate: 0,
    calibrationUpdate: 0,
    workoutsUpserted: [] as unknown[],
  };

  const db = {
    _calls: calls,
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              single: async () =>
                athleteExists
                  ? {
                      data: {
                        id: ATHLETE_UUID,
                        calibration_mode: calibrationMode,
                        created_at: createdAt,
                        // FC do atleta — usado pelo TRIMP dos treinos não-corrida
                        fc_max: 190,
                        fc_rest: 50,
                        sex: 'M',
                      },
                      error: null,
                    }
                  : { data: null, error: { message: 'Not found' } },
            }),
          }),
          update: (_data: unknown) => ({
            eq: async (_col: string, _val: unknown) => {
              calls.calibrationUpdate++;
              return { error: null };
            },
          }),
        };
      }

      if (table === 'workouts') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              order: (_col2: string, _opts: unknown) => ({
                limit: async (_n: number) => ({ data: workoutsData, error: null }),
              }),
            }),
          }),
          upsert: async (data: unknown, _opts?: unknown) => {
            calls.workoutsUpserted.push(data);
            return { error: upsertError };
          },
          update: (_data: unknown) => ({
            eq: (_col: string, _val: unknown) => ({
              eq: async (_col2: string, _val2: unknown) => {
                calls.workoutsUpdate++;
                return { error: null };
              },
            }),
          }),
        };
      }

      if (table === 'metrics_daily') {
        return {
          upsert: async (_data: unknown, _opts?: unknown) => {
            calls.metricsUpsert++;
            return { error: null };
          },
        };
      }

      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        upsert: async () => ({ error: null }),
      };
    },
    rpc: async (fn: string, _params: unknown) => {
      if (fn === 'get_garmin_token') return { data: rpcData, error: rpcError };
      if (fn === 'store_garmin_token') return { data: null, error: rpcError };
      return { data: null, error: null };
    },
  };

  return db;
}

// ──────────────────────────────────────────────────────────────────────────────
// fetch mock
// ──────────────────────────────────────────────────────────────────────────────

type FetchMockOpts = {
  authOk?: boolean;
  authBody?: object;
  metricsOk?: boolean;
  metricsBody?: object;
};

function installFetchMock(opts: FetchMockOpts = {}) {
  const {
    authOk = true,
    authBody = { session: { oauth_token: 'tok' } },
    metricsOk = true,
    metricsBody = { activities: SAMPLE_ACTIVITIES },
  } = opts;

  (globalThis as unknown as { fetch: unknown }).fetch = mock(async (url: string) => {
    if (url.includes('/auth')) {
      return new Response(JSON.stringify(authBody), {
        status: authOk ? 200 : 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/metrics')) {
      return new Response(JSON.stringify(metricsBody), {
        status: metricsOk ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  });
}

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;

function makeApp(db: ReturnType<typeof makeMockDb>) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(
      createGarminPlugin(db as unknown as Parameters<typeof createGarminPlugin>[0], alwaysAuth),
    ) as AnyElysia;
}

function post(app: AnyElysia, path: string, body: object) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests — POST /garmin/connect
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /garmin/connect', () => {
  beforeEach(() => installFetchMock());

  it('retorna { ok: true } quando autenticação e Vault têm sucesso', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/garmin/connect', {
      athlete_id: USER_UUID,
      email: 'rafael@garmin.test',
      password: 'secret',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('retorna erro 500 se atleta não existe no banco', async () => {
    const app = makeApp(makeMockDb({ athleteExists: false }));
    const res = await post(app, '/garmin/connect', {
      athlete_id: USER_UUID,
      email: 'rafael@garmin.test',
      password: 'secret',
    });

    expect(res.status).toBe(500);
  });

  it('retorna erro 500 se sidecar retorna 401', async () => {
    installFetchMock({ authOk: false, authBody: { detail: 'Login inválido' } });
    const app = makeApp(makeMockDb());
    const res = await post(app, '/garmin/connect', {
      athlete_id: USER_UUID,
      email: 'rafael@garmin.test',
      password: 'wrong',
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    // Mensagem curada do sidecar é repassada ao usuário (útil p/ reconectar).
    expect(body.error).toBe('Login inválido');
  });

  it('retorna erro 500 se Vault falha ao salvar token', async () => {
    const app = makeApp(makeMockDb({ rpcError: { message: 'vault error' } }));
    const res = await post(app, '/garmin/connect', {
      athlete_id: USER_UUID,
      email: 'rafael@garmin.test',
      password: 'secret',
    });

    expect(res.status).toBe(500);
  });

  it('retorna 422 se campos obrigatórios estão ausentes', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/garmin/connect', { athlete_id: USER_UUID });

    expect(res.status).toBe(422);
  });

  it('aceita mfa_code opcional', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/garmin/connect', {
      athlete_id: USER_UUID,
      email: 'rafael@garmin.test',
      password: 'secret',
      mfa_code: '123456',
    });

    expect(res.status).toBe(200);
  });

  it('usa mensagem fallback quando body de erro do sidecar não é JSON válido', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = mock(
      async () => new Response('Internal Server Error', { status: 500 }),
    );
    const app = makeApp(makeMockDb());
    const res = await post(app, '/garmin/connect', {
      athlete_id: USER_UUID,
      email: 'rafael@garmin.test',
      password: 'secret',
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Garmin');
  });

  it('rate limit: 6ª tentativa de connect na mesma janela retorna 429', async () => {
    // Sidecar sempre recusa (senha errada) — cenário de credential stuffing.
    installFetchMock({ authOk: false, authBody: { detail: 'Login inválido' } });
    const app = makeApp(makeMockDb());

    for (let i = 0; i < 5; i++) {
      const res = await post(app, '/garmin/connect', {
        email: 'rafael@garmin.test',
        password: `wrong-${i}`,
      });
      expect(res.status).toBe(500);
    }

    const blocked = await post(app, '/garmin/connect', {
      email: 'rafael@garmin.test',
      password: 'wrong-6',
    });
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error).toContain('Muitas tentativas');
  });

  it('rate limit: instância nova de plugin não herda contagem (janela por instância)', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/garmin/connect', {
      email: 'rafael@garmin.test',
      password: 'secret',
    });
    expect(res.status).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests — POST /garmin/sync
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /garmin/sync', () => {
  beforeEach(() => installFetchMock());

  it('retorna { synced: N } com o número de atividades importadas', async () => {
    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON }));
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(SAMPLE_ACTIVITIES.length);
  });

  it('US-015 Camada 1: importa RPE do Garmin (perceived_effort) para workouts.rpe', async () => {
    installFetchMock({
      metricsBody: {
        activities: [
          {
            garmin_id: 'g1',
            date: '2026-05-01',
            distance_m: 5000,
            duration_s: 1800,
            avg_hr: 145,
            perceived_effort: 7,
            raw: {},
          },
          {
            garmin_id: 'g2',
            date: '2026-05-03',
            distance_m: 9000,
            duration_s: 3000,
            avg_hr: 150,
            perceived_effort: 12,
            raw: {},
          },
          {
            garmin_id: 'g3',
            date: '2026-05-04',
            distance_m: 6000,
            duration_s: 2000,
            avg_hr: 148,
            raw: {},
          },
        ],
      },
    });
    const db = makeMockDb({ rpcData: TOKEN_JSON });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    // Upserts agora vão em LOTE (arrays); achata e olha só as linhas do sync
    // (têm `date` — as do write-back de rtss só têm athlete_id/garmin_id/rtss).
    const rows = (db._calls.workoutsUpserted as unknown[])
      .flat()
      .filter((r) => 'date' in (r as object)) as { garmin_id: string; rpe?: number }[];
    const byId = (id: string) => rows.find((r) => r.garmin_id === id);
    expect(byId('g1')?.rpe).toBe(7); // 1–10 válido → importado
    expect('rpe' in (byId('g2') ?? {})).toBe(false); // 12 fora de 1–10 → omitido
    expect('rpe' in (byId('g3') ?? {})).toBe(false); // sem perceived_effort → omitido (não sobrescreve)
  });

  it('retorna { synced: 0 } quando sidecar retorna lista vazia', async () => {
    installFetchMock({ metricsBody: { activities: [] } });
    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON }));
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
  });

  it('retorna erro 500 se atleta não existe no banco', async () => {
    const app = makeApp(makeMockDb({ athleteExists: false }));
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(500);
  });

  it('retorna erro 500 se Garmin não está conectado (sem token no Vault)', async () => {
    const app = makeApp(makeMockDb({ rpcData: null }));
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Conecte o Garmin');
  });

  it('retorna erro 500 se sidecar retorna 502', async () => {
    installFetchMock({ metricsOk: false });
    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON }));
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(500);
  });

  it('sessão expirada (sidecar 401) → mensagem de reconectar', async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = mock(async (url: string) =>
      url.includes('/metrics')
        ? new Response(JSON.stringify({ detail: 'Sessão Garmin expirada' }), { status: 401 })
        : new Response('{}', { status: 200 }),
    );
    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON }));
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Reconecte o Garmin');
  });

  it('usa days padrão de 90 quando não informado', async () => {
    let capturedUrl = '';
    (globalThis as unknown as { fetch: unknown }).fetch = mock(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ activities: [] }), { status: 200 });
    });

    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON }));
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(capturedUrl).toContain('days=90');
  });

  it('respeita days customizado', async () => {
    let capturedUrl = '';
    (globalThis as unknown as { fetch: unknown }).fetch = mock(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ activities: [] }), { status: 200 });
    });

    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON }));
    await post(app, '/garmin/sync', { athlete_id: USER_UUID, days: 30 });

    expect(capturedUrl).toContain('days=30');
  });

  it('conta apenas atividades com upsert bem-sucedido', async () => {
    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON, upsertError: { message: 'conflict' } }));
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(0);
  });

  it('salva metrics_daily após sync bem-sucedido', async () => {
    const db = makeMockDb({ rpcData: TOKEN_JSON, workoutsData: SAMPLE_ACTIVITIES as never });
    const app = makeApp(db);
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(200);
    expect(db._calls.metricsUpsert).toBe(1);
  });

  it('não salva metrics_daily quando nenhuma atividade foi importada', async () => {
    installFetchMock({ metricsBody: { activities: [] } });
    const db = makeMockDb({ rpcData: TOKEN_JSON });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(db._calls.metricsUpsert).toBe(0);
  });

  // US-017: saída de calibração exige ≥14 dias de app E ≥30 dias de dados.
  it('desativa calibration_mode com >=30 dias de dados E >=14 dias de app', async () => {
    const db = makeMockDb({
      rpcData: TOKEN_JSON,
      workoutsData: WORKOUTS_30_DAYS,
      createdAt: DAYS_AGO(20),
    });
    const app = makeApp(db);
    const res = await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(res.status).toBe(200);
    expect(db._calls.calibrationUpdate).toBe(1);
  });

  it('NÃO desativa com <30 dias de dados (mesmo após 14 dias de app)', async () => {
    const db = makeMockDb({
      rpcData: TOKEN_JSON,
      workoutsData: WORKOUTS_7_DAYS,
      createdAt: DAYS_AGO(20),
    });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(db._calls.calibrationUpdate).toBe(0);
  });

  // Decisão 2026-05-17: histórico Garmin importado conta para a janela de
  // 14 dias. Conta nova (5 dias) mas com ≥30 dias de histórico → SAI.
  it('desativa com conta nova SE há ≥30 dias de histórico importado', async () => {
    const db = makeMockDb({
      rpcData: TOKEN_JSON,
      workoutsData: WORKOUTS_30_DAYS,
      createdAt: DAYS_AGO(5),
    });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(db._calls.calibrationUpdate).toBe(1);
  });

  it('é idempotente: não reavalia se já saiu da calibração', async () => {
    const db = makeMockDb({
      rpcData: TOKEN_JSON,
      workoutsData: WORKOUTS_30_DAYS,
      createdAt: DAYS_AGO(20),
      calibrationMode: false,
    });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(db._calls.calibrationUpdate).toBe(0);
  });

  // O write-back de rtss agora vai num ÚNICO upsert em lote (era 1 UPDATE por
  // treino). As linhas do lote são identificáveis por terem rtss numérico.
  const rtssWrites = (db: { _calls: { workoutsUpserted: unknown[] } }) =>
    (db._calls.workoutsUpserted as Record<string, unknown>[][])
      .flat()
      .filter((r) => typeof r.rtss === 'number');

  it('computa rTSS para workouts sem rtss e atualiza no banco', async () => {
    const workoutsWithoutRtss = SAMPLE_ACTIVITIES.map((a) => ({ ...a, rtss: null }));
    const db = makeMockDb({ rpcData: TOKEN_JSON, workoutsData: workoutsWithoutRtss as never });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(rtssWrites(db).length).toBe(workoutsWithoutRtss.length);
    expect(db._calls.workoutsUpdate).toBe(0); // nada de UPDATE por linha
  });

  it('não atualiza rtss de workouts que já têm valor calculado', async () => {
    const workoutsWithRtss = SAMPLE_ACTIVITIES.map((a) => ({ ...a, rtss: 55.0 }));
    const db = makeMockDb({ rpcData: TOKEN_JSON, workoutsData: workoutsWithRtss as never });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(rtssWrites(db).length).toBe(0);
    expect(db._calls.workoutsUpdate).toBe(0);
  });

  it('computa carga de treino NÃO-corrida (bike) via TRIMP e soma nas métricas', async () => {
    // Bike sem pace útil (sport != run), mas com FC → carga vem do TRIMP.
    // Antes esse treino seria ignorado; agora entra no ACWR/CTL/ATL.
    const crossTraining = [
      {
        garmin_id: 'bike-1',
        date: '2026-05-02',
        type_key: 'virtual_ride',
        distance_m: 40000,
        duration_s: 7200,
        avg_hr: 140,
        rtss: null,
      },
      {
        garmin_id: 'swim-1',
        date: '2026-05-04',
        type_key: 'lap_swimming',
        distance_m: 1500,
        duration_s: 2400,
        avg_hr: 130,
        rtss: null,
      },
    ];
    const db = makeMockDb({ rpcData: TOKEN_JSON, workoutsData: crossTraining as never });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    // Ambos receberam carga calculada (write-back em lote) e as métricas foram salvas.
    expect(rtssWrites(db).length).toBe(2);
    expect(db._calls.metricsUpsert).toBe(1);
  });

  it('agrega 2 treinos no mesmo dia numa carga só (sem dupla-contagem de decay)', async () => {
    // Corrida + bike no MESMO dia → 1 entrada de carga somada pro ATL/CTL.
    const sameDay = [
      {
        garmin_id: 'run-am',
        date: '2026-05-05',
        type_key: 'treadmill_running',
        distance_m: 6000,
        duration_s: 1800,
        avg_hr: 150,
        rtss: null,
      },
      {
        garmin_id: 'bike-pm',
        date: '2026-05-05',
        type_key: 'cycling',
        distance_m: 30000,
        duration_s: 5400,
        avg_hr: 135,
        rtss: null,
      },
    ];
    const db = makeMockDb({ rpcData: TOKEN_JSON, workoutsData: sameDay as never });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(rtssWrites(db).length).toBe(2); // cada treino tem sua carga gravada (em lote)
    expect(db._calls.metricsUpsert).toBe(1); // métricas computadas uma vez
  });
});

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createGarminPlugin } from './garmin';

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
  const calls = { metricsUpsert: 0, workoutsUpdate: 0, calibrationUpdate: 0 };

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
          upsert: async (_data: unknown, _opts?: unknown) => ({ error: upsertError }),
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

  (globalThis as unknown as { fetch: typeof fetch }).fetch = mock(async (url: string) => {
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

function makeApp(db: ReturnType<typeof makeMockDb>) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(createGarminPlugin(db as Parameters<typeof createGarminPlugin>[0]));
}

function post(app: Elysia, path: string, body: object) {
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
    expect(body.error).toContain('Login inválido');
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
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mock(
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

  it('usa days padrão de 90 quando não informado', async () => {
    let capturedUrl = '';
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mock(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ activities: [] }), { status: 200 });
    });

    const app = makeApp(makeMockDb({ rpcData: TOKEN_JSON }));
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(capturedUrl).toContain('days=90');
  });

  it('respeita days customizado', async () => {
    let capturedUrl = '';
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mock(async (url: string) => {
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

  it('NÃO desativa nas primeiras 2 semanas (mesmo com 30 dias de dados)', async () => {
    const db = makeMockDb({
      rpcData: TOKEN_JSON,
      workoutsData: WORKOUTS_30_DAYS,
      createdAt: DAYS_AGO(5),
    });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(db._calls.calibrationUpdate).toBe(0);
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

  it('computa rTSS para workouts sem rtss e atualiza no banco', async () => {
    const workoutsWithoutRtss = SAMPLE_ACTIVITIES.map((a) => ({ ...a, rtss: null }));
    const db = makeMockDb({ rpcData: TOKEN_JSON, workoutsData: workoutsWithoutRtss as never });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(db._calls.workoutsUpdate).toBe(workoutsWithoutRtss.length);
  });

  it('não atualiza rtss de workouts que já têm valor calculado', async () => {
    const workoutsWithRtss = SAMPLE_ACTIVITIES.map((a) => ({ ...a, rtss: 55.0 }));
    const db = makeMockDb({ rpcData: TOKEN_JSON, workoutsData: workoutsWithRtss as never });
    const app = makeApp(db);
    await post(app, '/garmin/sync', { athlete_id: USER_UUID });

    expect(db._calls.workoutsUpdate).toBe(0);
  });
});

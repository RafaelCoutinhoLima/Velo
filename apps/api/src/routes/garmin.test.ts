import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createGarminPlugin } from './garmin';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
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

// ──────────────────────────────────────────────────────────────────────────────
// DB mock factory
// ──────────────────────────────────────────────────────────────────────────────

type MockDbOpts = {
  athleteExists?: boolean;
  rpcData?: string | null;
  rpcError?: { message: string } | null;
  upsertError?: { message: string } | null;
};

function makeMockDb(opts: MockDbOpts = {}) {
  const { athleteExists = true, rpcData = TOKEN_JSON, rpcError = null, upsertError = null } = opts;

  return {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            athleteExists
              ? { data: { id: ATHLETE_UUID }, error: null }
              : { data: null, error: { message: 'Not found' } },
        }),
      }),
      upsert: async () => ({ error: upsertError }),
    }),
    rpc: async (fn: string, _params: unknown) => {
      if (fn === 'get_garmin_token') return { data: rpcData, error: rpcError };
      if (fn === 'store_garmin_token') return { data: null, error: rpcError };
      return { data: null, error: null };
    },
  };
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
    // Cobre o .catch(() => ({})) no connect handler
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
});

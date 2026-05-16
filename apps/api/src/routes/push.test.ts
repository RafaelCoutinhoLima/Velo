import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createPushPlugin } from './push';

const USER_UUID = 'user-auth-uuid';
const ATHLETE_UUID = 'athlete-internal-uuid';
const EXPO_TOKEN = 'ExponentPushToken[abc123]';

type MockOpts = {
  athleteExists?: boolean;
  updateError?: { message: string } | null;
  workoutsNoRpe?: { id: string; athlete_id: string }[];
  pushToken?: string | null;
};

function makeMockDb(opts: MockOpts = {}) {
  const {
    athleteExists = true,
    updateError = null,
    workoutsNoRpe = [],
    pushToken = EXPO_TOKEN,
  } = opts;
  const calls = { update: 0 };

  const db = {
    _calls: calls,
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: (_c: string) => ({
            eq: (_col: string, _v: unknown) => ({
              single: async () =>
                athleteExists
                  ? { data: { id: ATHLETE_UUID, push_token: pushToken }, error: null }
                  : { data: null, error: { message: 'not found' } },
            }),
          }),
          update: (_d: unknown) => ({
            eq: async (_col: string, _v: unknown) => {
              calls.update++;
              return { error: updateError };
            },
          }),
        };
      }
      // workouts
      return {
        select: (_c: string) => ({
          is: (_col: string, _v: unknown) => ({
            gte: async (_col2: string, _v2: unknown) => ({ data: workoutsNoRpe, error: null }),
          }),
        }),
      };
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return db;
}

function makeApp(db: ReturnType<typeof makeMockDb>) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(createPushPlugin(db as Parameters<typeof createPushPlugin>[0]));
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

describe('POST /push/register', () => {
  beforeEach(() => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mock(
      async () => new Response('{}', { status: 200 }),
    );
  });

  it('registra o token e retorna { ok: true }', async () => {
    const db = makeMockDb();
    const res = await post(makeApp(db), '/push/register', {
      athlete_id: USER_UUID,
      token: EXPO_TOKEN,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db._calls.update).toBe(1);
  });

  it('retorna 404 quando atleta não existe', async () => {
    const res = await post(makeApp(makeMockDb({ athleteExists: false })), '/push/register', {
      athlete_id: USER_UUID,
      token: EXPO_TOKEN,
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /push/rpe-reminders', () => {
  beforeEach(() => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mock(
      async () => new Response('{}', { status: 200 }),
    );
  });

  it('retorna { reminded: 0 } quando não há treino sem RPE', async () => {
    const res = await post(makeApp(makeMockDb({ workoutsNoRpe: [] })), '/push/rpe-reminders', {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminded: 0 });
  });

  it('lembra 1x por atleta e pula quem não tem push_token', async () => {
    const withToken = makeMockDb({
      workoutsNoRpe: [
        { id: 'w1', athlete_id: 'a1' },
        { id: 'w2', athlete_id: 'a1' },
      ],
      pushToken: EXPO_TOKEN,
    });
    const r1 = await post(makeApp(withToken), '/push/rpe-reminders', {});
    expect(await r1.json()).toEqual({ reminded: 1 }); // 2 treinos, 1 atleta → 1 push

    const noToken = makeMockDb({
      workoutsNoRpe: [{ id: 'w1', athlete_id: 'a1' }],
      pushToken: null,
    });
    const r2 = await post(makeApp(noToken), '/push/rpe-reminders', {});
    expect(await r2.json()).toEqual({ reminded: 0 });
  });
});

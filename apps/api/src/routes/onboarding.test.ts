import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import type { TokenVerifier } from '../lib/auth';
import { createOnboardingPlugin } from './onboarding';

const alwaysAuth: TokenVerifier = async () => 'user-uuid';

// ── Mock DB ──────────────────────────────────────────────────────────────────

type DbError = { message: string; code: string } | null;

interface MockOpts {
  athleteSelectData?: { id: string } | null;
  athleteSelectError?: DbError;
  athleteUpsertError?: DbError;
  athleteUpdateError?: DbError;
  consentSelectData?: { id: string } | null;
  consentInsertError?: DbError;
}

function makeMockDb(opts: MockOpts = {}) {
  const {
    athleteSelectData = null,
    athleteSelectError = null,
    athleteUpsertError = null,
    athleteUpdateError = null,
    consentSelectData = null,
    consentInsertError = null,
  } = opts;

  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: athleteSelectData, error: athleteSelectError }),
            }),
          }),
          upsert: async () => ({ error: athleteUpsertError }),
          update: () => ({
            eq: async () => ({ error: athleteUpdateError }),
          }),
        };
      }
      if (table === 'consents') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                single: async () => ({ data: consentSelectData, error: null }),
              }),
            }),
          }),
          insert: async () => ({ error: consentInsertError }),
        };
      }
      return {};
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;

function makeApp(db: ReturnType<typeof makeMockDb>) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(
      createOnboardingPlugin(
        db as unknown as Parameters<typeof createOnboardingPlugin>[0],
        alwaysAuth,
      ),
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

const VALID_PROFILE = {
  athlete_id: 'user-uuid',
  birth_year: 1990,
  weight_kg: 70,
  sex: 'M',
  weekly_frequency: '3x',
  timezone: 'America/Recife',
} as const;

// ── GET /onboarding/profile-status ────────────────────────────────────────────

describe('GET /onboarding/profile-status', () => {
  it('retorna profile_complete=true quando atleta existe no banco', async () => {
    const app = makeApp(makeMockDb({ athleteSelectData: { id: 'athlete-id' } }));
    const res = await get(app, '/onboarding/profile-status?athlete_id=user-uuid');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profile_complete: true });
  });

  it('retorna profile_complete=false quando atleta não existe', async () => {
    const app = makeApp(makeMockDb({ athleteSelectData: null }));
    const res = await get(app, '/onboarding/profile-status?athlete_id=user-uuid');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profile_complete: false });
  });
});

// ── POST /onboarding/profile ──────────────────────────────────────────────────

describe('POST /onboarding/profile', () => {
  it('retorna { ok: true } quando upsert tem sucesso', async () => {
    const app = makeApp(makeMockDb({ athleteSelectData: { id: 'athlete-id' } }));
    const res = await post(app, '/onboarding/profile', VALID_PROFILE);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna 500 com mensagem quando upsert falha', async () => {
    const app = makeApp(
      makeMockDb({ athleteUpsertError: { message: 'permission denied', code: '42501' } }),
    );
    const res = await post(app, '/onboarding/profile', VALID_PROFILE);
    expect(res.status).toBe(500);
    const body = await res.json();
    // Mensagem genérica: o detalhe do Postgres não vaza mais ao cliente.
    expect(body.error).toBe('Falha ao salvar perfil');
  });

  it('retorna 422 para body inválido (birth_year fora do range)', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/profile', { ...VALID_PROFILE, birth_year: 1800 });
    expect(res.status).toBe(422);
  });

  it('retorna 422 para body inválido (weight_kg fora do range)', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/profile', { ...VALID_PROFILE, weight_kg: 5 });
    expect(res.status).toBe(422);
  });

  it('retorna 422 para sex inválido', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/profile', { ...VALID_PROFILE, sex: 'X' });
    expect(res.status).toBe(422);
  });

  it('faz backfill de consent quando atleta existe e consent não existe', async () => {
    const app = makeApp(
      makeMockDb({ athleteSelectData: { id: 'athlete-id' }, consentSelectData: null }),
    );
    const res = await post(app, '/onboarding/profile', VALID_PROFILE);
    expect(res.status).toBe(200);
  });

  it('não insere consent duplicado quando já existe', async () => {
    const app = makeApp(
      makeMockDb({
        athleteSelectData: { id: 'athlete-id' },
        consentSelectData: { id: 'consent-id' },
      }),
    );
    const res = await post(app, '/onboarding/profile', VALID_PROFILE);
    expect(res.status).toBe(200);
  });
});

// ── POST /onboarding/goal ──────────────────────────────────────────────────────

describe('POST /onboarding/goal', () => {
  it('retorna { ok: true } para general_progression', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/goal', {
      athlete_id: 'user-uuid',
      goal_mode: 'general_progression',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna { ok: true } para race com data e distância', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/goal', {
      athlete_id: 'user-uuid',
      goal_mode: 'race',
      race_date: '2027-03-01',
      race_distance_km: 42.195,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna 500 quando update do banco falha', async () => {
    const app = makeApp(
      makeMockDb({ athleteUpdateError: { message: 'connection error', code: '08000' } }),
    );
    const res = await post(app, '/onboarding/goal', {
      athlete_id: 'user-uuid',
      goal_mode: 'general_progression',
    });
    expect(res.status).toBe(500);
  });

  it('retorna 422 para goal_mode inválido', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/goal', {
      athlete_id: 'user-uuid',
      goal_mode: 'invalid',
    });
    expect(res.status).toBe(422);
  });
});

// ── PATCH /onboarding/profile ─────────────────────────────────────────────────

describe('PATCH /onboarding/profile', () => {
  it('retorna { ok: true } quando atualiza weekly_frequency', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, '/onboarding/profile', {
      athlete_id: 'user-uuid',
      weekly_frequency: '4x',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna { ok: true } quando atualiza só timezone', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, '/onboarding/profile', {
      athlete_id: 'user-uuid',
      timezone: 'America/Sao_Paulo',
    });
    expect(res.status).toBe(200);
  });

  it('retorna { ok: true } sem fazer update quando nada é informado (no-op)', async () => {
    const app = makeApp(makeMockDb());
    const res = await patch(app, '/onboarding/profile', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna 500 quando update falha', async () => {
    const app = makeApp(
      makeMockDb({ athleteUpdateError: { message: 'connection error', code: '08000' } }),
    );
    const res = await patch(app, '/onboarding/profile', {
      athlete_id: 'user-uuid',
      weekly_frequency: '5x',
    });
    expect(res.status).toBe(500);
  });
});

// ── POST /onboarding/zones ────────────────────────────────────────────────────

describe('POST /onboarding/zones', () => {
  it('retorna { ok: true } quando atualiza fc_max e fc_rest', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/zones', {
      athlete_id: 'user-uuid',
      fc_max: 185,
      fc_rest: 55,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna 500 quando update de zonas falha', async () => {
    const app = makeApp(
      makeMockDb({ athleteUpdateError: { message: 'connection error', code: '08000' } }),
    );
    const res = await post(app, '/onboarding/zones', {
      athlete_id: 'user-uuid',
      fc_max: 185,
      fc_rest: 55,
    });
    expect(res.status).toBe(500);
  });

  it('retorna 422 para body inválido (fc_max ausente)', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/onboarding/zones', { athlete_id: 'user-uuid', fc_rest: 55 });
    expect(res.status).toBe(422);
  });
});

// ── POST /onboarding/consent ──────────────────────────────────────────────────

describe('POST /onboarding/consent', () => {
  it('retorna { ok: true } quando atleta não existe ainda (novo usuário)', async () => {
    const app = makeApp(makeMockDb({ athleteSelectData: null }));
    const res = await post(app, '/onboarding/consent', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna { ok: true } quando atleta existe e consent é inserido com sucesso', async () => {
    const app = makeApp(makeMockDb({ athleteSelectData: { id: 'athlete-id' } }));
    const res = await post(app, '/onboarding/consent', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('retorna 500 quando insert de consent falha', async () => {
    const app = makeApp(
      makeMockDb({
        athleteSelectData: { id: 'athlete-id' },
        consentInsertError: { message: 'constraint violation', code: '23505' },
      }),
    );
    const res = await post(app, '/onboarding/consent', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(500);
  });
});

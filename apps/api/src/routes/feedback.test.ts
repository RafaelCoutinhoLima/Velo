import { describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';

// generateFeedback chama a Claude API real — mockado para os testes do POST.
mock.module('../claude/client', () => ({
  generateFeedback: mock(async () => ({
    feedback_md: '# Mandou bem',
    texto_principal: 'Você segurou o pace na Z2 o treino todo.',
    destaque_positivo: 'Constância de FC',
    sugestao: 'Tente +5 min na próxima',
    emoji_resumo: '🔥',
  })),
}));

import type { TokenVerifier } from '../lib/auth';
import { createFeedbackPlugin } from './feedback';

const alwaysAuth: TokenVerifier = async () => 'user-uuid';

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;
type Db = Parameters<typeof createFeedbackPlugin>[0];

// GET-only mock (testes de listagem): athletes → id do dono; feedback → lista
function makeMockDbGet(
  opts: { data?: unknown[]; error?: { message: string } | null; athlete?: unknown } = {},
) {
  const { data = [], error = null, athlete = { id: 'aid' } } = opts;
  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: athlete, error: null }) }) }),
        };
      }
      // feedback
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ limit: async () => ({ data, error }) }),
          }),
        }),
      };
    },
  } as unknown as Db;
}

const WID = '22222222-2222-4222-8222-222222222222';
const AID = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';

type PostOpts = {
  athlete?: unknown;
  existing?: unknown;
  workout?: unknown;
  saved?: unknown;
  saveErr?: { message: string } | null;
};

// Mock do fluxo POST: athletes → feedback(dupe) → workouts → feedback.insert
function makeMockDbPost(opts: PostOpts = {}) {
  const {
    athlete = { id: AID, birth_year: 1995, calibration_mode: false },
    existing = null,
    workout = {
      id: WID,
      date: '2026-05-10',
      distance_m: 8000,
      duration_s: 2400,
      avg_hr: 150,
      rtss: 60,
      rpe: 6,
    },
    saved = { id: 'fb-1', created_at: '2026-05-10T10:00:00Z' },
    saveErr = null,
  } = opts;

  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: athlete }) }) }) };
      }
      if (table === 'workouts') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: async () => ({ data: workout }) }) }),
          }),
        };
      }
      // feedback
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ single: async () => ({ data: existing }) }) }),
        }),
        insert: () => ({
          select: () => ({ single: async () => ({ data: saved, error: saveErr }) }),
        }),
      };
    },
  } as unknown as Db;
}

function makeApp(db: Db) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(createFeedbackPlugin(db, alwaysAuth)) as AnyElysia;
}

function get(app: AnyElysia, path: string) {
  return app.handle(new Request(`http://localhost${path}`));
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

describe('GET /feedback', () => {
  it('retorna lista de feedbacks para atleta', async () => {
    const feedbacks = [
      { id: 'f1', workout_id: 'w1', feedback_md: '# Bom treino', created_at: '2026-05-01' },
    ];
    const app = makeApp(makeMockDbGet({ data: feedbacks }));
    const res = await get(app, '/feedback?athlete_id=user-uuid');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feedbacks });
  });

  it('retorna lista vazia quando não há feedbacks', async () => {
    const app = makeApp(makeMockDbGet({ data: [] }));
    const res = await get(app, '/feedback?athlete_id=user-uuid');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feedbacks: [] });
  });

  it('retorna 500 quando banco falha', async () => {
    const app = makeApp(makeMockDbGet({ error: { message: 'connection error' } }));
    const res = await get(app, '/feedback?athlete_id=user-uuid');
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('Falha ao buscar feedbacks');
  });
});

describe('POST /feedback', () => {
  it('gera e salva feedback (happy path)', async () => {
    const app = makeApp(makeMockDbPost());
    const res = await post(app, '/feedback', { workout_id: WID, athlete_id: USER });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('fb-1');
    expect(body.texto_principal).toContain('Z2');
    expect(body.emoji_resumo).toBe('🔥');
  });

  it('404 quando atleta não existe', async () => {
    const app = makeApp(makeMockDbPost({ athlete: null }));
    const res = await post(app, '/feedback', { workout_id: WID, athlete_id: USER });
    expect(res.status).toBe(404);
  });

  it('retorna feedback em cache (cached) com markdown limpo', async () => {
    const app = makeApp(
      makeMockDbPost({
        existing: { id: 'fb-old', feedback_md: '# Título\n**Forte** _ritmo_', created_at: 'c' },
      }),
    );
    const res = await post(app, '/feedback', { workout_id: WID, athlete_id: USER });
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.texto_principal).toBe('Título\nForte ritmo');
  });

  it('404 quando treino não existe', async () => {
    const app = makeApp(makeMockDbPost({ workout: null }));
    const res = await post(app, '/feedback', { workout_id: WID, athlete_id: USER });
    expect(res.status).toBe(404);
  });

  it('500 quando salvar o feedback falha', async () => {
    const app = makeApp(makeMockDbPost({ saved: null, saveErr: { message: 'insert failed' } }));
    const res = await post(app, '/feedback', { workout_id: WID, athlete_id: USER });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain('salvar');
  });
});

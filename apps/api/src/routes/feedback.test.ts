import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { createFeedbackPlugin } from './feedback';

function makeMockDb(opts: { data?: unknown[]; error?: { message: string } | null } = {}) {
  const { data = [], error = null } = opts;
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data, error }),
          }),
        }),
      }),
    }),
  };
}

function makeApp(db: ReturnType<typeof makeMockDb>) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(createFeedbackPlugin(db as Parameters<typeof createFeedbackPlugin>[0]));
}

function get(app: Elysia, path: string) {
  return app.handle(new Request(`http://localhost${path}`));
}

describe('GET /feedback', () => {
  it('retorna lista de feedbacks para atleta', async () => {
    const feedbacks = [
      { id: 'f1', workout_id: 'w1', feedback_md: '# Bom treino', created_at: '2026-05-01' },
    ];
    const app = makeApp(makeMockDb({ data: feedbacks }));
    const res = await get(app, '/feedback?athlete_id=user-uuid');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feedbacks });
  });

  it('retorna lista vazia quando não há feedbacks', async () => {
    const app = makeApp(makeMockDb({ data: [] }));
    const res = await get(app, '/feedback?athlete_id=user-uuid');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ feedbacks: [] });
  });

  it('retorna 500 quando banco falha', async () => {
    const app = makeApp(makeMockDb({ error: { message: 'connection error' } }));
    const res = await get(app, '/feedback?athlete_id=user-uuid');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Falha ao buscar feedbacks');
  });

  it('retorna 422 quando athlete_id está ausente', async () => {
    const app = makeApp(makeMockDb());
    const res = await get(app, '/feedback');
    expect(res.status).toBe(422);
  });
});

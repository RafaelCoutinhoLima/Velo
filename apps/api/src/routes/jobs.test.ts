import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { createJobsPlugin } from './jobs';

const JOB_ROW = {
  id: 'job-uuid',
  status: 'pending',
  result: null,
  error: null,
  created_at: '2026-05-01T00:00:00Z',
  finished_at: null,
};

type DbError = { message: string } | null;

function makeMockDb(
  opts: {
    getJobData?: typeof JOB_ROW | null;
    getJobError?: DbError;
    insertJobData?: { id: string } | null;
    insertJobError?: DbError;
  } = {},
) {
  const {
    getJobData = JOB_ROW,
    getJobError = null,
    insertJobData = { id: 'job-uuid' },
    insertJobError = null,
  } = opts;

  return {
    from: () => ({
      select: (fields: string) => {
        // GET /:id — chains: select().eq().single()
        // POST / — chains: insert().select().single()
        const _isShortSelect = fields === 'id';
        return {
          eq: () => ({
            single: async () => ({ data: getJobData, error: getJobError }),
          }),
          single: async () => ({ data: insertJobData, error: insertJobError }),
        };
      },
      insert: () => ({
        select: () => ({
          single: async () => ({ data: insertJobData, error: insertJobError }),
        }),
      }),
    }),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;

function makeApp(db: ReturnType<typeof makeMockDb>) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(createJobsPlugin(db as unknown as Parameters<typeof createJobsPlugin>[0])) as AnyElysia;
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

describe('GET /jobs/:id', () => {
  it('retorna job existente', async () => {
    const app = makeApp(makeMockDb());
    const res = await get(app, '/jobs/job-uuid');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('job-uuid');
    expect(body.status).toBe('pending');
  });

  it('retorna { error } quando job não existe', async () => {
    const app = makeApp(makeMockDb({ getJobData: null, getJobError: { message: 'Not found' } }));
    const res = await get(app, '/jobs/nonexistent');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe('Job não encontrado');
  });
});

describe('POST /jobs', () => {
  it('cria job e retorna job_id', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/jobs', {
      athlete_id: 'user-uuid',
      type: 'plan_generate',
      payload: { athlete_id: 'user-uuid' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job_id).toBe('job-uuid');
  });

  it('retorna 500 quando insert falha', async () => {
    const app = makeApp(
      makeMockDb({ insertJobData: null, insertJobError: { message: 'DB error' } }),
    );
    const res = await post(app, '/jobs', {
      athlete_id: 'user-uuid',
      type: 'feedback_generate',
      payload: {},
    });
    expect(res.status).toBe(500);
  });

  it('retorna 422 para type inválido', async () => {
    const app = makeApp(makeMockDb());
    const res = await post(app, '/jobs', {
      athlete_id: 'user-uuid',
      type: 'invalid_type',
      payload: {},
    });
    expect(res.status).toBe(422);
  });

  it('aceita todos os tipos válidos de job', async () => {
    const app = makeApp(makeMockDb());
    for (const type of ['plan_generate', 'plan_replan', 'feedback_generate'] as const) {
      const res = await post(app, '/jobs', { athlete_id: 'user-uuid', type, payload: {} });
      expect(res.status).toBe(200);
    }
  });
});

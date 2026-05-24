// Teste isolado do timeout do POST /plan/generate. Vive em arquivo separado
// porque o mock.module de generatePlan é hoisted no nível do arquivo — aqui
// queremos um promise que nunca resolve, enquanto plan.test.ts quer um
// resolvedor rápido. Cada arquivo bun:test tem seu próprio escopo de mock.

import { describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';

// generatePlan nunca resolve → força o caminho do TIMEOUT.
mock.module('../claude/client', () => ({
  generatePlan: () => new Promise(() => {}),
}));

mock.module('../garmin/client', () => ({
  garminClient: { scheduleWorkout: mock(async () => ({ ok: true })) },
}));

import { createPlanPlugin } from './plan';

const RECENT_ISO = new Date(Date.now() - 3 * 86_400_000).toISOString();

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;

function makeDb(jobInsertId: string | null = 'job-async') {
  const listP = Promise.resolve({ data: [], error: null });
  const awaitableEq = Object.assign(Promise.resolve({ data: [], error: null }), {
    order: () => ({ limit: () => listP }),
  });
  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'int-1',
                  user_id: 'user-uuid',
                  calibration_mode: true,
                  created_at: RECENT_ISO,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'jobs') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: jobInsertId ? { id: jobInsertId } : null,
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      return { select: () => ({ eq: () => awaitableEq }) };
    },
    rpc: async () => ({ data: null, error: null }),
  };
}

function makeApp(db: ReturnType<typeof makeDb>, syncTimeoutMs: number) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(
      createPlanPlugin(db as unknown as Parameters<typeof createPlanPlugin>[0], syncTimeoutMs),
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

describe('POST /plan/generate — fallback assíncrono no timeout', () => {
  it('retorna 202 com job_id quando buildPlan excede o syncTimeoutMs', async () => {
    const app = makeApp(makeDb('job-async'), 50);
    const res = await post(app, '/plan/generate', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.job_id).toBe('job-async');
    expect(body.message).toContain('preparando');
  });

  it('lida com falha do insert do job sem crashar (job_id undefined)', async () => {
    const app = makeApp(makeDb(null), 50);
    const res = await post(app, '/plan/generate', { athlete_id: 'user-uuid' });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.job_id).toBeUndefined();
  });
});

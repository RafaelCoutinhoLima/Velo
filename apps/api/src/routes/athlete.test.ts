import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import type { TokenVerifier } from '../lib/auth';
import { createAthletePlugin } from './athlete';

const alwaysAuth: TokenVerifier = async () => 'user-uuid';

function makeMockDb(opts: { athlete?: { id: string } | null; rpcThrows?: boolean } = {}) {
  const { athlete = { id: 'aid' }, rpcThrows = false } = opts;
  return {
    from: (table: string) => {
      if (table === 'athletes') {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: athlete, error: null }) }),
          }),
        };
      }
      // tabelas do titular — retornam uma linha marcada com o nome da tabela
      return {
        select: () => ({ eq: async () => ({ data: [{ table }], error: null }) }),
      };
    },
    rpc: async () => {
      if (rpcThrows) throw new Error('vault down');
      return { data: null, error: null };
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: mock type for Elysia generics
type AnyElysia = Elysia<any, any, any, any, any, any, any>;

function makeApp(
  db: ReturnType<typeof makeMockDb>,
  deleteAuthUser: (userId: string) => Promise<{ error: unknown }> = async () => ({ error: null }),
) {
  return new Elysia()
    .onError(({ error }) => ({ error: (error as Error).message }))
    .use(
      createAthletePlugin(
        db as unknown as Parameters<typeof createAthletePlugin>[0],
        alwaysAuth,
        deleteAuthUser,
      ),
    ) as AnyElysia;
}

describe('GET /athlete/export', () => {
  it('exporta athlete + tabelas do titular', async () => {
    const app = makeApp(makeMockDb());
    const res = await app.handle(new Request('http://localhost/athlete/export'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.athlete.id).toBe('aid');
    expect(body.workouts).toEqual([{ table: 'workouts' }]);
    expect(body.consents).toEqual([{ table: 'consents' }]);
    expect(typeof body.exported_at).toBe('string');
  });

  it('404 quando o atleta não existe', async () => {
    const app = makeApp(makeMockDb({ athlete: null }));
    const res = await app.handle(new Request('http://localhost/athlete/export'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /athlete', () => {
  it('exclui a conta (ok) chamando deleteAuthUser', async () => {
    let deleted = '';
    const app = makeApp(makeMockDb(), async (userId) => {
      deleted = userId;
      return { error: null };
    });
    const res = await app.handle(new Request('http://localhost/athlete', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleted).toBe('user-uuid');
  });

  it('não falha a exclusão se a limpeza do Vault (rpc) der erro', async () => {
    const app = makeApp(makeMockDb({ rpcThrows: true }), async () => ({ error: null }));
    const res = await app.handle(new Request('http://localhost/athlete', { method: 'DELETE' }));
    expect(res.status).toBe(200);
  });

  it('500 quando deleteAuthUser falha', async () => {
    const app = makeApp(makeMockDb(), async () => ({ error: { message: 'boom' } }));
    const res = await app.handle(new Request('http://localhost/athlete', { method: 'DELETE' }));
    expect(res.status).toBe(500);
  });
});

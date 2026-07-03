import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { authGuard, type TokenVerifier } from './auth';

// Verificador stub: aceita só o token "good-token" → devolve um userId fixo.
const stubVerify: TokenVerifier = async (token) => (token === 'good-token' ? 'user-123' : null);

function makeApp() {
  return new Elysia().use(authGuard(stubVerify)).get('/whoami', ({ userId }) => ({ userId }));
}

function req(app: ReturnType<typeof makeApp>, auth?: string) {
  return app.handle(
    new Request('http://localhost/whoami', {
      headers: auth ? { authorization: auth } : {},
    }),
  );
}

describe('authGuard', () => {
  it('deriva userId com token válido', async () => {
    const res = await req(makeApp(), 'Bearer good-token');
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe('user-123');
  });

  it('401 quando o header Authorization está ausente', async () => {
    const res = await req(makeApp());
    expect(res.status).toBe(401);
  });

  it('401 quando o token é inválido', async () => {
    const res = await req(makeApp(), 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('401 quando o header não tem esquema Bearer', async () => {
    const res = await req(makeApp(), 'good-token');
    expect(res.status).toBe(401);
  });
});

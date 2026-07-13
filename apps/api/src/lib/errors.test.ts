import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { AppError, mapErrorResponse } from './errors';

describe('mapErrorResponse', () => {
  it('repassa status e mensagem curada de um AppError', () => {
    const { status, body } = mapErrorResponse('UNKNOWN', new AppError('Sessão expirada', 429));
    expect(status).toBe(429);
    expect(body).toEqual({ error: 'Sessão expirada' });
  });

  it('AppError sem status explícito vira 500 com a mensagem curada', () => {
    const { status, body } = mapErrorResponse(
      'UNKNOWN',
      new AppError('Garmin não está conectado. Conecte o Garmin primeiro.'),
    );
    expect(status).toBe(500);
    expect(body.error).toBe('Garmin não está conectado. Conecte o Garmin primeiro.');
  });

  it('NUNCA vaza a mensagem de um Error genérico (Postgres/stack)', () => {
    const { status, body } = mapErrorResponse(
      'UNKNOWN',
      new Error('duplicate key value violates unique constraint "plans_pkey"'),
    );
    expect(status).toBe(500);
    expect(body.error).toBe('Tive um problema técnico, já avisamos a equipe.');
  });

  it('VALIDATION vira 400 genérico mesmo com mensagem interna no erro', () => {
    const { status, body } = mapErrorResponse('VALIDATION', new Error('Expected number for rpe'));
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Requisição inválida' });
  });

  it('NOT_FOUND vira 404 genérico', () => {
    const { status, body } = mapErrorResponse('NOT_FOUND', new Error('route not found'));
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Recurso não encontrado' });
  });
});

// Integração fim-a-fim do contrato do onError global (mesmo shape do index.ts):
// AppError chega ao cliente com status+mensagem; Error genérico fica opaco.
describe('onError com mapErrorResponse (contrato do index.ts)', () => {
  const app = new Elysia()
    .onError(({ error, code, set }) => {
      const { status, body } = mapErrorResponse(code, error);
      set.status = status;
      return body;
    })
    .get('/curado', () => {
      throw new AppError('Sua conexão Garmin expirou. Reconecte o Garmin nas configurações.');
    })
    .get('/cota', () => {
      throw new AppError('Limite de 30 gerações por mês atingido', 429);
    })
    .get('/interno', () => {
      throw new Error('connection refused at 10.0.0.5:5432');
    });

  it('mensagem curada de rota chega ao cliente em produção', async () => {
    const res = await app.handle(new Request('http://localhost/curado'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Reconecte o Garmin');
  });

  it('AppError com status próprio (429 de cota) chega com o status certo', async () => {
    const res = await app.handle(new Request('http://localhost/cota'));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Limite de 30');
  });

  it('erro interno continua opaco (não vaza host/porta/mensagem)', async () => {
    const res = await app.handle(new Request('http://localhost/interno'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Tive um problema técnico, já avisamos a equipe.');
  });
});

import { expect, test } from '@playwright/test';

const FAKE_ATHLETE_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Garmin', () => {
  test.describe('POST /garmin/connect', () => {
    test('rejeita body sem athlete_id', async ({ request }) => {
      const res = await request.post('/garmin/connect', {
        data: { email: 'test@test.com', password: 'abc' },
      });
      expect(res.status()).toBe(422);
    });

    test('rejeita password vazia', async ({ request }) => {
      const res = await request.post('/garmin/connect', {
        data: { athlete_id: FAKE_ATHLETE_ID, email: 'test@test.com', password: '' },
      });
      expect(res.status()).toBe(422);
    });

    test('retorna 500 para atleta inexistente (não 422)', async ({ request }) => {
      const res = await request.post('/garmin/connect', {
        data: {
          athlete_id: FAKE_ATHLETE_ID,
          email: 'nao_existe@test.com',
          password: 'senha_fake',
        },
      });
      // Atleta não existe no banco → 500
      expect(res.status()).toBe(500);
    });
  });

  test.describe('POST /garmin/sync', () => {
    test('rejeita body sem athlete_id', async ({ request }) => {
      const res = await request.post('/garmin/sync', { data: {} });
      expect(res.status()).toBe(422);
    });

    test('retorna 500 para atleta sem Garmin conectado', async ({ request }) => {
      const res = await request.post('/garmin/sync', {
        data: { athlete_id: FAKE_ATHLETE_ID },
      });
      expect(res.status()).toBe(500);
    });
  });
});

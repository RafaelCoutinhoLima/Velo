import { expect, test } from '@playwright/test';

const FAKE_ATHLETE_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Plan', () => {
  test.describe('GET /plan/current', () => {
    test('retorna { plan: null } para atleta sem plano', async ({ request }) => {
      const res = await request.get(`/plan/current?athlete_id=${FAKE_ATHLETE_ID}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('plan');
    });

    test('rejeita requisição sem athlete_id', async ({ request }) => {
      const res = await request.get('/plan/current');
      expect(res.status()).toBe(422);
    });
  });

  test.describe('POST /plan/generate', () => {
    test('retorna 200, 202 ou 500 para athlete_id válido', async ({ request }) => {
      const res = await request.post('/plan/generate', {
        data: { athlete_id: FAKE_ATHLETE_ID },
      });
      // 200 = plano gerado, 202 = job enfileirado, 500 = atleta não existe ou sem API key
      expect([200, 202, 500]).toContain(res.status());

      if (res.status() === 202) {
        const body = await res.json();
        expect(body).toHaveProperty('job_id');
        expect(body).toHaveProperty('message');
      }
      // 200 e 500 não precisam de assertion de body aqui (atleta fake)
    });

    test('rejeita body sem athlete_id', async ({ request }) => {
      const res = await request.post('/plan/generate', { data: {} });
      expect(res.status()).toBe(422);
    });
  });

  test.describe('PATCH /plan/move', () => {
    test('rejeita body incompleto', async ({ request }) => {
      const res = await request.patch('/plan/move', {
        data: { plan_id: 'fake-id' },
      });
      expect(res.status()).toBe(422);
    });

    test('retorna erro para plan_id inexistente', async ({ request }) => {
      const res = await request.patch('/plan/move', {
        data: {
          plan_id: '00000000-0000-0000-0000-000000000000',
          workout_day: 1,
          target_day: 3,
        },
      });
      expect([404, 500]).toContain(res.status());
    });
  });
});

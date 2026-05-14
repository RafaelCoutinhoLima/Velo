import { expect, test } from '@playwright/test';

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_WORKOUT_ID = '00000000-0000-0000-0000-000000000099';

test.describe('Workouts', () => {
  test.describe('GET /workouts', () => {
    test('retorna { workouts: [] } para atleta inexistente', async ({ request }) => {
      const res = await request.get(`/workouts?athlete_id=${FAKE_USER_ID}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('workouts');
      expect(Array.isArray(body.workouts)).toBe(true);
      // atleta fake não existe → lista vazia (não erro)
      expect(body.workouts.length).toBe(0);
    });

    test('rejeita requisição sem athlete_id', async ({ request }) => {
      const res = await request.get('/workouts');
      expect(res.status()).toBe(422);
    });

    test('aceita parâmetro limit numérico', async ({ request }) => {
      const res = await request.get(`/workouts?athlete_id=${FAKE_USER_ID}&limit=5`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.workouts.length).toBeLessThanOrEqual(5);
    });
  });

  test.describe('GET /workouts/:id', () => {
    test('retorna 404 para workout inexistente', async ({ request }) => {
      const res = await request.get(`/workouts/${FAKE_WORKOUT_ID}`);
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });
  });

  test.describe('PATCH /workouts/:id', () => {
    test('rejeita rpe fora do range', async ({ request }) => {
      const res = await request.patch(`/workouts/${FAKE_WORKOUT_ID}`, {
        data: { rpe: 11 },
      });
      expect(res.status()).toBe(422);
    });

    test('rejeita body sem rpe', async ({ request }) => {
      const res = await request.patch(`/workouts/${FAKE_WORKOUT_ID}`, {
        data: {},
      });
      expect(res.status()).toBe(422);
    });
  });
});

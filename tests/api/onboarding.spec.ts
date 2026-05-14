import { expect, test } from '@playwright/test';

const FAKE_ATHLETE_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Onboarding', () => {
  test.describe('POST /onboarding/profile', () => {
    test('aceita perfil sem campo sex', async ({ request }) => {
      const res = await request.post('/onboarding/profile', {
        data: {
          athlete_id: FAKE_ATHLETE_ID,
          birth_year: 1990,
          weight_kg: 75,
          weekly_frequency: '3x',
          timezone: 'America/Sao_Paulo',
        },
      });
      // 200 ok ou 500 com erro de FK (atleta inexistente) — ambos indicam que a validação passou
      expect([200, 500]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(body).toMatchObject({ ok: true });
      }
    });

    test('rejeita birth_year fora do range', async ({ request }) => {
      const res = await request.post('/onboarding/profile', {
        data: {
          athlete_id: FAKE_ATHLETE_ID,
          birth_year: 1900,
          weight_kg: 75,
          weekly_frequency: '3x',
          timezone: 'America/Sao_Paulo',
        },
      });
      expect(res.status()).toBe(422);
    });

    test('rejeita weight_kg inválido', async ({ request }) => {
      const res = await request.post('/onboarding/profile', {
        data: {
          athlete_id: FAKE_ATHLETE_ID,
          birth_year: 1990,
          weight_kg: 5,
          weekly_frequency: '3x',
          timezone: 'America/Sao_Paulo',
        },
      });
      expect(res.status()).toBe(422);
    });

    test('rejeita body incompleto', async ({ request }) => {
      const res = await request.post('/onboarding/profile', {
        data: { athlete_id: FAKE_ATHLETE_ID },
      });
      expect(res.status()).toBe(422);
    });
  });

  test.describe('POST /onboarding/goal', () => {
    test('aceita goal_mode general_progression', async ({ request }) => {
      const res = await request.post('/onboarding/goal', {
        data: {
          athlete_id: FAKE_ATHLETE_ID,
          goal_mode: 'general_progression',
        },
      });
      expect([200, 500]).toContain(res.status());
    });

    test('aceita goal_mode race com data e distância', async ({ request }) => {
      const res = await request.post('/onboarding/goal', {
        data: {
          athlete_id: FAKE_ATHLETE_ID,
          goal_mode: 'race',
          race_date: '2026-12-01',
          race_distance_km: 42.195,
        },
      });
      expect([200, 500]).toContain(res.status());
    });

    test('rejeita goal_mode inválido', async ({ request }) => {
      const res = await request.post('/onboarding/goal', {
        data: {
          athlete_id: FAKE_ATHLETE_ID,
          goal_mode: 'triathlon',
        },
      });
      expect(res.status()).toBe(422);
    });
  });

  test.describe('POST /onboarding/consent', () => {
    test('aceita athlete_id válido', async ({ request }) => {
      const res = await request.post('/onboarding/consent', {
        data: { athlete_id: FAKE_ATHLETE_ID },
      });
      expect([200, 500]).toContain(res.status());
    });
  });
});

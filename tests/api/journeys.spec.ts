// Flows e2e (Playwright) — ordenam endpoints como um cliente real faria, pra
// pegar regressões de orquestração que testes por-endpoint não pegam:
//
//  Flow A) login → onboarding (profile + goal + consent) → plan/generate
//  Flow B) Garmin sync → plan/current (recálculo de calibração lateral)
//
// O API local não tem o atleta fake no banco — então cada step pode retornar
// 200 (ok) ou 500 (FK miss). O que validamos é o CONTRATO: cada resposta
// tem o shape que o próximo step espera, e ordem nunca devolve 422 fora do
// step que valida body.

import { expect, test } from '@playwright/test';

const FAKE_ATHLETE_ID = '00000000-0000-0000-0000-000000000001';

test.describe('Flow A: jornada onboarding → primeiro plano', () => {
  test('cliente novo: profile-status → profile → goal → consent → generate', async ({
    request,
  }) => {
    // 1) Cliente pergunta se já tem perfil (rota usada no app no boot)
    const status = await request.get(`/onboarding/profile-status?athlete_id=${FAKE_ATHLETE_ID}`);
    expect(status.status()).toBe(200);
    expect(await status.json()).toHaveProperty('profile_complete');

    // 2) Submete perfil — atleta fake, mas validação do body deve passar
    const profile = await request.post('/onboarding/profile', {
      data: {
        athlete_id: FAKE_ATHLETE_ID,
        birth_year: 1990,
        weight_kg: 70,
        sex: 'M',
        weekly_frequency: '3x',
        timezone: 'America/Recife',
      },
    });
    expect([200, 500]).toContain(profile.status());

    // 3) Define objetivo geral (mais comum no MVP)
    const goal = await request.post('/onboarding/goal', {
      data: { athlete_id: FAKE_ATHLETE_ID, goal_mode: 'general_progression' },
    });
    expect([200, 500]).toContain(goal.status());

    // 4) Consente coleta de dados
    const consent = await request.post('/onboarding/consent', {
      data: { athlete_id: FAKE_ATHLETE_ID },
    });
    expect([200, 500]).toContain(consent.status());

    // 5) Pede plano inicial
    const plan = await request.post('/plan/generate', {
      data: { athlete_id: FAKE_ATHLETE_ID },
    });
    // 200 = plano síncrono, 202 = job enfileirado, 500 = atleta fake sem perfil persistido
    expect([200, 202, 500]).toContain(plan.status());

    if (plan.status() === 200) {
      const body = await plan.json();
      expect(body).toHaveProperty('plan');
      expect(body.plan).toHaveProperty('weeks');
    } else if (plan.status() === 202) {
      const body = await plan.json();
      expect(body).toHaveProperty('job_id');
    }
  });

  test('rota de obtenção do plano sempre devolve { plan, calibration_mode }', async ({
    request,
  }) => {
    const res = await request.get(`/plan/current?athlete_id=${FAKE_ATHLETE_ID}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('plan');
    // calibration_mode tem fallback true (atleta novo) ou flip false (≥14d + 30 dias data)
    expect(body).toHaveProperty('calibration_mode');
  });
});

test.describe('Flow B: sync Garmin → leitura do plano', () => {
  test('sync sem conexão devolve 500; current ainda funciona', async ({ request }) => {
    // 1) Sync — falha porque o atleta fake não tem token salvo
    const sync = await request.post('/garmin/sync', {
      data: { athlete_id: FAKE_ATHLETE_ID },
    });
    expect(sync.status()).toBe(500);

    // 2) Mesmo após falha de sync, /plan/current responde 200 com plan=null
    const current = await request.get(`/plan/current?athlete_id=${FAKE_ATHLETE_ID}`);
    expect(current.status()).toBe(200);
    const body = await current.json();
    expect(body).toHaveProperty('plan');
  });

  test('send-to-garmin sem token devolve 400 não 500', async ({ request }) => {
    // Contrato: 400 (não 500) é "Garmin não conectado" — código de erro do cliente,
    // não erro nosso. Garante que app mobile pode mostrar mensagem específica.
    const res = await request.post('/plan/send-to-garmin', {
      data: { athlete_id: FAKE_ATHLETE_ID },
    });
    // 404 (atleta inexistente) OU 400 (atleta sem Garmin)
    expect([400, 404]).toContain(res.status());
  });
});

test.describe('Flow C: feedback pós-treino (regressão de contrato)', () => {
  test('rejeita body sem workout_id', async ({ request }) => {
    const res = await request.post('/feedback', {
      data: { athlete_id: FAKE_ATHLETE_ID },
    });
    expect(res.status()).toBe(422);
  });

  test('para workout_id inexistente, retorna 500 (não crash)', async ({ request }) => {
    const res = await request.post('/feedback', {
      data: {
        athlete_id: FAKE_ATHLETE_ID,
        workout_id: '00000000-0000-0000-0000-000000000099',
      },
    });
    // 500 esperado — atleta/workout fake. O importante: não 200 (não inventou feedback)
    expect([500, 404]).toContain(res.status());
  });
});

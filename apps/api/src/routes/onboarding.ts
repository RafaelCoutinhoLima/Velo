import { Elysia, t } from 'elysia';
import { supabase } from '../db/client';
import { logger } from '../lib/logger';

export const onboardingRoutes = new Elysia({ prefix: '/onboarding' })
  .post(
    '/profile',
    async ({ body }) => {
      const { athlete_id, birth_year, weight_kg, sex, weekly_frequency, timezone } = body;

      const { error } = await supabase.from('athletes').upsert({
        user_id: athlete_id,
        email: '[REDACTED]',
        birth_year,
        weight_kg,
        sex,
        modality: 'running',
        weekly_frequency,
        timezone,
        goal_mode: 'general_progression',
        calibration_mode: true,
      });

      if (error) {
        logger.error({ err: error }, 'Falha ao salvar perfil');
        throw new Error('Falha ao salvar perfil');
      }

      return { ok: true };
    },
    {
      body: t.Object({
        athlete_id: t.String(),
        birth_year: t.Number({ minimum: 1930, maximum: 2013 }),
        weight_kg: t.Number({ minimum: 30, maximum: 200 }),
        sex: t.Union([t.Literal('M'), t.Literal('F'), t.Literal('other')]),
        weekly_frequency: t.String(),
        timezone: t.String(),
      }),
    },
  )
  .post(
    '/goal',
    async ({ body }) => {
      const { athlete_id, goal_mode, race_date, race_distance_km } = body;

      const { error } = await supabase
        .from('athletes')
        .update({
          goal_mode,
          race_date: race_date ?? null,
          race_distance_km: race_distance_km ?? null,
        })
        .eq('user_id', athlete_id);

      if (error) {
        logger.error({ err: error }, 'Falha ao salvar objetivo');
        throw new Error('Falha ao salvar objetivo');
      }

      return { ok: true };
    },
    {
      body: t.Object({
        athlete_id: t.String(),
        goal_mode: t.Union([t.Literal('race'), t.Literal('general_progression')]),
        race_date: t.Optional(t.String()),
        race_distance_km: t.Optional(t.Number()),
      }),
    },
  )
  .post(
    '/consent',
    async ({ body }) => {
      const { athlete_id } = body;

      const { data: athlete, error: athleteErr } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', athlete_id)
        .single();

      if (athleteErr || !athlete) throw new Error('Atleta não encontrado');

      const { error } = await supabase.from('consents').insert({
        athlete_id: athlete.id,
        consent_text:
          'FitSync não substitui acompanhamento médico ou profissional. Em caso de dor, pare e procure médico esportivo.',
        version: '1.0',
      });

      if (error) {
        logger.error({ err: error }, 'Falha ao salvar consentimento');
        throw new Error('Falha ao salvar consentimento');
      }

      return { ok: true };
    },
    {
      body: t.Object({ athlete_id: t.String() }),
    },
  );

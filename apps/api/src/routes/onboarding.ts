import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

const CONSENT_TEXT =
  'FitSync não substitui acompanhamento médico ou profissional. Em caso de dor, pare e procure médico esportivo.';
const CONSENT_VERSION = '1.0';

export function createOnboardingPlugin(db: Db = defaultSupabase) {
  return new Elysia({ prefix: '/onboarding' })
    .get(
      '/profile-status',
      async ({ query }) => {
        const { athlete_id } = query;
        const { data } = await db.from('athletes').select('id').eq('user_id', athlete_id).single();
        return { profile_complete: !!data };
      },
      { query: t.Object({ athlete_id: t.String() }) },
    )
    .post(
      '/profile',
      async ({ body }) => {
        const {
          athlete_id,
          birth_year,
          weight_kg,
          sex,
          weekly_frequency,
          timezone,
          available_days,
        } = body;

        const { error } = await db.from('athletes').upsert(
          {
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
            ...(available_days ? { available_days } : {}),
          },
          { onConflict: 'user_id' },
        );

        if (error) {
          logger.error({ err: error }, 'Falha ao salvar perfil');
          return new Response(JSON.stringify({ error: `${error.message} [${error.code}]` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Backfill consent if it wasn't stored yet (new user flow: consent runs before athlete exists)
        try {
          const { data: athlete } = await db
            .from('athletes')
            .select('id')
            .eq('user_id', athlete_id)
            .single();

          if (athlete) {
            const { data: existing } = await db
              .from('consents')
              .select('id')
              .eq('athlete_id', (athlete as { id: string }).id)
              .limit(1)
              .single();

            if (!existing) {
              await db.from('consents').insert({
                athlete_id: (athlete as { id: string }).id,
                consent_text: CONSENT_TEXT,
                version: CONSENT_VERSION,
              });
            }
          }
        } catch {
          // Consent backfill is non-critical; don't fail the profile step
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
          available_days: t.Optional(t.Array(t.String())),
        }),
      },
    )
    .post(
      '/goal',
      async ({ body }) => {
        const { athlete_id, goal_mode, race_date, race_distance_km } = body;

        const { error } = await db
          .from('athletes')
          .update({
            goal_mode,
            race_date: race_date ?? null,
            race_distance_km: race_distance_km ?? null,
          })
          .eq('user_id', athlete_id);

        if (error) {
          logger.error({ err: error }, 'Falha ao salvar objetivo');
          throw new Error(`Falha ao salvar objetivo: ${error.message} (${error.code})`);
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

        const { data: athlete } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', athlete_id)
          .single();

        // If athlete record doesn't exist yet (new user hasn't completed profile),
        // we accept the consent and store it during profile creation instead.
        if (athlete) {
          const { error } = await db.from('consents').insert({
            athlete_id: (athlete as { id: string }).id,
            consent_text: CONSENT_TEXT,
            version: CONSENT_VERSION,
          });

          if (error) {
            logger.error({ err: error }, 'Falha ao salvar consentimento');
            throw new Error('Falha ao salvar consentimento');
          }
        }

        return { ok: true };
      },
      {
        body: t.Object({ athlete_id: t.String() }),
      },
    )
    .patch(
      '/profile',
      async ({ body }) => {
        const { athlete_id, weekly_frequency, timezone, available_days } = body;
        const updates: Record<string, unknown> = {};
        if (weekly_frequency) updates.weekly_frequency = weekly_frequency;
        if (timezone) updates.timezone = timezone;
        if (available_days) updates.available_days = available_days;
        if (Object.keys(updates).length === 0) return { ok: true };
        const { error } = await db.from('athletes').update(updates).eq('user_id', athlete_id);
        if (error) throw new Error(`Falha ao atualizar perfil: ${error.message}`);
        return { ok: true };
      },
      {
        body: t.Object({
          athlete_id: t.String(),
          weekly_frequency: t.Optional(t.String()),
          timezone: t.Optional(t.String()),
          available_days: t.Optional(t.Array(t.String())),
        }),
      },
    )
    .post(
      '/zones',
      async ({ body }) => {
        const { athlete_id, fc_max, fc_rest } = body;
        const { error } = await db
          .from('athletes')
          .update({ fc_max, fc_rest })
          .eq('user_id', athlete_id);
        if (error) throw new Error(`Falha ao salvar zonas: ${error.message}`);
        return { ok: true };
      },
      {
        body: t.Object({
          athlete_id: t.String(),
          fc_max: t.Number({ minimum: 100, maximum: 230 }),
          fc_rest: t.Number({ minimum: 30, maximum: 100 }),
        }),
      },
    );
}

export const onboardingRoutes = createOnboardingPlugin();

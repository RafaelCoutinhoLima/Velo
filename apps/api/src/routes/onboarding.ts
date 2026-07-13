import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { authGuard, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

// Resumo material do que o usuário aceita na tela de disclaimer
// (apps/mobile/app/onboarding/index.tsx). Precisa refletir o que ele viu:
// finalidade, limite médico, tratamento de dados de saúde e — crucial p/ LGPD
// (transferência internacional, art. 33) — o envio de dados fisiológicos ao
// Claude (Anthropic, EUA) para gerar os planos. v2.0 substitui o texto antigo
// que só gravava o disclaimer médico com a marca antiga "FitSync".
const CONSENT_TEXT =
  'Aceito que a Velo colete meus dados de treino do Garmin, perfil esportivo e ' +
  'métricas fisiológicas (FC, rTSS, ACWR, HRV) para gerar planos de corrida ' +
  'personalizados. Entendo que meus dados fisiológicos são enviados ao Claude ' +
  '(Anthropic, EUA) para a geração dos planos e que a Velo não substitui ' +
  'acompanhamento médico, fisioterapêutico ou de treinador — em caso de dor ou ' +
  'lesão devo procurar um profissional de saúde. Posso exportar ou excluir meus ' +
  'dados a qualquer momento nas configurações.';
const CONSENT_VERSION = '2.0';

export function createOnboardingPlugin(
  db: Db = defaultSupabase,
  verify: TokenVerifier = verifySupabaseToken,
) {
  return new Elysia({ prefix: '/onboarding' })
    .use(authGuard(verify))
    .get('/profile-status', async ({ userId }) => {
      const { data } = await db.from('athletes').select('id').eq('user_id', userId).single();
      return { profile_complete: !!data };
    })
    .post(
      '/profile',
      async ({ userId, body }) => {
        const { birth_year, weight_kg, sex, weekly_frequency, timezone, available_days } = body;

        const { error } = await db.from('athletes').upsert(
          {
            user_id: userId,
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
          return new Response(JSON.stringify({ error: 'Falha ao salvar perfil' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Backfill consent if it wasn't stored yet (new user flow: consent runs before athlete exists)
        try {
          const { data: athlete } = await db
            .from('athletes')
            .select('id')
            .eq('user_id', userId)
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
          birth_year: t.Number({ minimum: 1930, maximum: 2013 }),
          weight_kg: t.Number({ minimum: 30, maximum: 200 }),
          sex: t.Optional(t.Union([t.Literal('M'), t.Literal('F'), t.Literal('other')])),
          weekly_frequency: t.String(),
          timezone: t.String(),
          available_days: t.Optional(t.Array(t.String())),
        }),
      },
    )
    .post(
      '/goal',
      async ({ userId, body }) => {
        const { goal_mode, race_date, race_distance_km } = body;

        const { error } = await db
          .from('athletes')
          .update({
            goal_mode,
            race_date: race_date ?? null,
            race_distance_km: race_distance_km ?? null,
          })
          .eq('user_id', userId);

        if (error) {
          logger.error({ err: error }, 'Falha ao salvar objetivo');
          throw new AppError('Falha ao salvar objetivo');
        }

        return { ok: true };
      },
      {
        body: t.Object({
          goal_mode: t.Union([t.Literal('race'), t.Literal('general_progression')]),
          race_date: t.Optional(t.String()),
          race_distance_km: t.Optional(t.Number()),
        }),
      },
    )
    .post('/consent', async ({ userId }) => {
      const { data: athlete } = await db
        .from('athletes')
        .select('id')
        .eq('user_id', userId)
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
          throw new AppError('Falha ao salvar consentimento');
        }
      }

      return { ok: true };
    })
    .patch(
      '/profile',
      async ({ userId, body }) => {
        const { weekly_frequency, timezone, available_days } = body;
        const updates: Record<string, unknown> = {};
        if (weekly_frequency) updates.weekly_frequency = weekly_frequency;
        if (timezone) updates.timezone = timezone;
        if (available_days) updates.available_days = available_days;
        if (Object.keys(updates).length === 0) return { ok: true };
        const { error } = await db.from('athletes').update(updates).eq('user_id', userId);
        if (error) throw new AppError('Falha ao atualizar perfil');
        return { ok: true };
      },
      {
        body: t.Object({
          weekly_frequency: t.Optional(t.String()),
          timezone: t.Optional(t.String()),
          available_days: t.Optional(t.Array(t.String())),
        }),
      },
    )
    .post(
      '/zones',
      async ({ userId, body }) => {
        const { fc_max, fc_rest } = body;
        const { error } = await db
          .from('athletes')
          .update({ fc_max, fc_rest })
          .eq('user_id', userId);
        if (error) throw new AppError('Falha ao salvar zonas');
        return { ok: true };
      },
      {
        body: t.Object({
          fc_max: t.Number({ minimum: 100, maximum: 230 }),
          fc_rest: t.Number({ minimum: 30, maximum: 100 }),
        }),
      },
    );
}

export const onboardingRoutes = createOnboardingPlugin();

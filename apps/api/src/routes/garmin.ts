import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

const SIDECAR_URL = process.env.GARMIN_SIDECAR_URL ?? 'http://localhost:8001';

export function createGarminPlugin(db: Db = defaultSupabase) {
  return new Elysia({ prefix: '/garmin' })
    .post(
      '/connect',
      async ({ body }) => {
        const { athlete_id, email, password, mfa_code } = body;

        const { data: athlete, error: athleteErr } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', athlete_id)
          .single();

        if (athleteErr || !athlete) throw new Error('Atleta não encontrado');

        const sidecarRes = await fetch(`${SIDECAR_URL}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, mfa_code }),
        });

        if (!sidecarRes.ok) {
          const err = (await sidecarRes.json().catch(() => ({}))) as { detail?: string };
          logger.warn({ status: sidecarRes.status }, 'Sidecar auth falhou');
          throw new Error(err.detail ?? 'Falha ao conectar com o Garmin');
        }

        const { session } = (await sidecarRes.json()) as { session: Record<string, unknown> };

        const { error: vaultErr } = await db.rpc('store_garmin_token', {
          p_athlete_id: (athlete as { id: string }).id,
          p_tokens: JSON.stringify(session),
        });

        if (vaultErr) {
          logger.error({ err: vaultErr }, 'Falha ao salvar token Garmin no Vault');
          throw new Error('Falha ao salvar credenciais Garmin');
        }

        logger.info({ athlete_id: (athlete as { id: string }).id }, 'Garmin conectado');
        return { ok: true };
      },
      {
        body: t.Object({
          athlete_id: t.String(),
          email: t.String(),
          password: t.String({ minLength: 1 }),
          mfa_code: t.Optional(t.String()),
        }),
      },
    )
    .post(
      '/sync',
      async ({ body }) => {
        const { athlete_id, days = 90 } = body;

        const { data: athlete, error: athleteErr } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', athlete_id)
          .single();

        if (athleteErr || !athlete) throw new Error('Atleta não encontrado');

        const internalId = (athlete as { id: string }).id;

        const { data: tokenJson, error: vaultErr } = await db.rpc('get_garmin_token', {
          p_athlete_id: internalId,
        });

        if (vaultErr || !tokenJson) {
          throw new Error('Garmin não está conectado. Conecte o Garmin primeiro.');
        }

        const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        const sidecarRes = await fetch(`${SIDECAR_URL}/metrics?date=${since}&days=${days}`, {
          headers: { 'x-garmin-token': tokenJson as string },
        });

        if (!sidecarRes.ok) {
          logger.error(
            { status: sidecarRes.status, athlete_id: internalId },
            'Sidecar metrics falhou',
          );
          throw new Error('Não consegui sincronizar com o Garmin');
        }

        const { activities } = (await sidecarRes.json()) as {
          activities: Record<string, unknown>[];
        };

        let synced = 0;
        for (const act of activities) {
          const { error } = await db.from('workouts').upsert(
            {
              athlete_id: internalId,
              garmin_id: act.garmin_id,
              date: act.date,
              distance_m: act.distance_m,
              duration_s: act.duration_s,
              avg_hr: act.avg_hr ?? null,
              raw_payload: act.raw,
            },
            { onConflict: 'athlete_id,garmin_id', ignoreDuplicates: false },
          );
          if (!error) synced++;
        }

        logger.info({ athlete_id: internalId, synced }, 'Sync Garmin concluído');
        return { synced };
      },
      {
        body: t.Object({
          athlete_id: t.String(),
          days: t.Optional(t.Number({ minimum: 1, maximum: 365 })),
        }),
      },
    );
}

export const garminRoutes = createGarminPlugin();

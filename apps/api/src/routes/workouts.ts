import { Elysia, t } from 'elysia';
import { supabase } from '../db/client';
import { garminClient } from '../garmin/client';
import { logger } from '../lib/logger';

export const workoutRoutes = new Elysia({ prefix: '/workouts' })
  .get(
    '/',
    async ({ query }) => {
      const { athlete_id, limit = 30 } = query;

      // athlete_id from session = Supabase user UUID; resolve to internal athletes.id
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', athlete_id)
        .single();

      if (!athlete) return { workouts: [] };

      const { data, error } = await supabase
        .from('workouts')
        .select('id, date, sport, distance_m, duration_s, avg_hr, rtss, rpe')
        .eq('athlete_id', (athlete as { id: string }).id)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw new Error('Falha ao buscar treinos');
      return { workouts: data ?? [] };
    },
    {
      query: t.Object({
        athlete_id: t.String(),
        limit: t.Optional(t.Number()),
      }),
    },
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      const { id } = params;
      const { data, error } = await supabase
        .from('workouts')
        .select('id, date, sport, distance_m, duration_s, avg_hr, rtss, rpe, raw_payload')
        .eq('id', id)
        .single();

      if (error || !data) {
        set.status = 404;
        return { error: 'Treino não encontrado' };
      }

      const raw = (data.raw_payload ?? {}) as Record<string, unknown>;
      const avgSpeedMs = typeof raw.averageSpeed === 'number' ? raw.averageSpeed : null;

      const workout = {
        id: data.id,
        date: data.date,
        sport: data.sport ?? 'run',
        distance_m: data.distance_m,
        duration_s: data.duration_s,
        avg_hr: data.avg_hr,
        rtss: data.rtss,
        rpe: data.rpe,
        max_hr: typeof raw.maxHR === 'number' ? raw.maxHR : null,
        calories: typeof raw.calories === 'number' ? raw.calories : null,
        elevation_gain:
          typeof raw.elevationGain === 'number' ? Math.round(raw.elevationGain) : null,
        elevation_loss:
          typeof raw.elevationLoss === 'number' ? Math.round(raw.elevationLoss) : null,
        avg_pace_s: avgSpeedMs && avgSpeedMs > 0 ? Math.round(1000 / avgSpeedMs) : null,
        vo2max: typeof raw.vO2MaxValue === 'number' ? raw.vO2MaxValue : null,
        steps: typeof raw.steps === 'number' ? raw.steps : null,
        activity_name: typeof raw.activityName === 'string' ? raw.activityName : null,
        location: typeof raw.locationName === 'string' ? raw.locationName : null,
      };

      return { workout };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .patch(
    '/:id',
    async ({ params, body, set }) => {
      const { id } = params;
      const { rpe } = body;

      const { error } = await supabase.from('workouts').update({ rpe }).eq('id', id);

      if (error) {
        set.status = 500;
        return { error: 'Falha ao salvar RPE' };
      }
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ rpe: t.Number({ minimum: 1, maximum: 10 }) }),
    },
  )
  .post(
    '/sync',
    async ({ body }) => {
      const { athlete_id, days = 90 } = body;

      const { data: athlete } = await supabase
        .from('athletes')
        .select('id')
        .eq('id', athlete_id)
        .single();

      if (!athlete) throw new Error('Atleta não encontrado');

      try {
        const activities = await garminClient.getActivities(athlete_id, days);
        let synced = 0;

        for (const act of activities) {
          const { error } = await supabase.from('workouts').upsert(
            {
              athlete_id,
              garmin_id: act.garmin_id,
              date: act.date,
              distance_m: act.distance_m,
              duration_s: act.duration_s,
              avg_hr: act.avg_hr,
              raw_payload: act.raw,
            },
            { onConflict: 'athlete_id,garmin_id', ignoreDuplicates: false },
          );
          if (!error) synced++;
        }

        logger.info({ athlete_id, synced }, 'Sync Garmin concluído');
        return { synced };
      } catch (err) {
        logger.error({ err, athlete_id }, 'Falha no sync Garmin');
        throw new Error('Não consegui sincronizar com o Garmin');
      }
    },
    {
      body: t.Object({
        athlete_id: t.String(),
        days: t.Optional(t.Number()),
      }),
    },
  );

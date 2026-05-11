import { Elysia, t } from 'elysia';
import { supabase } from '../db/client';
import { garminClient } from '../garmin/client';
import { logger } from '../lib/logger';

export const workoutRoutes = new Elysia({ prefix: '/workouts' })
  .get(
    '/',
    async ({ query }) => {
      const { athlete_id, limit = 30 } = query;

      const { data, error } = await supabase
        .from('workouts')
        .select('id, date, distance_m, duration_s, avg_hr, rtss, rpe')
        .eq('athlete_id', athlete_id)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw new Error('Falha ao buscar treinos');
      return { workouts: data };
    },
    {
      query: t.Object({
        athlete_id: t.String(),
        limit: t.Optional(t.Number()),
      }),
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

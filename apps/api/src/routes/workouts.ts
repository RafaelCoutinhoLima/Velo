import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { classifySport } from '../garmin/sport';
import { authGuard, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { resolveInternalId } from '../lib/internalId';

type Db = Pick<typeof defaultSupabase, 'from'>;

export function createWorkoutsPlugin(
  db: Db = defaultSupabase,
  verify: TokenVerifier = verifySupabaseToken,
) {
  return new Elysia({ prefix: '/workouts' })
    .use(authGuard(verify))
    .get(
      '/',
      async ({ userId, query }) => {
        const { limit = 30 } = query;

        const internalId = await resolveInternalId(db, userId);
        if (!internalId) return { workouts: [] };

        const { data, error } = await db
          .from('workouts')
          .select(
            'id, date, distance_m, duration_s, avg_hr, rtss, rpe, type_key:raw_payload->activityType->>typeKey',
          )
          .eq('athlete_id', internalId)
          .order('date', { ascending: false })
          .limit(limit);

        if (error) throw new Error('Falha ao buscar treinos');

        // Deriva o esporte do typeKey (sem coluna dedicada) e remove o campo cru.
        const workouts = ((data ?? []) as Array<Record<string, unknown>>).map((w) => {
          const { type_key, ...rest } = w;
          return { ...rest, sport: classifySport(type_key as string | null) };
        });
        return { workouts };
      },
      {
        query: t.Object({
          limit: t.Optional(t.Number()),
        }),
      },
    )
    .get(
      '/:id',
      async ({ userId, params, set }) => {
        const { id } = params;

        // Escopa o treino ao dono: sem isto GET /workouts/<uuid> lê raw_payload
        // (locationName/GPS) de outro atleta.
        const internalId = await resolveInternalId(db, userId);
        if (!internalId) {
          set.status = 404;
          return { error: 'Treino não encontrado' };
        }

        const { data, error } = await db
          .from('workouts')
          .select('id, date, distance_m, duration_s, avg_hr, rtss, rpe, raw_payload')
          .eq('id', id)
          .eq('athlete_id', internalId)
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
          sport: classifySport(
            (raw.activityType as { typeKey?: string } | undefined)?.typeKey ?? null,
          ),
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
      async ({ userId, params, body, set }) => {
        const { id } = params;
        const { rpe } = body;

        const internalId = await resolveInternalId(db, userId);
        if (!internalId) {
          set.status = 404;
          return { error: 'Treino não encontrado' };
        }

        const { error } = await db
          .from('workouts')
          .update({ rpe })
          .eq('id', id)
          .eq('athlete_id', internalId);

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
    );
}

export const workoutRoutes = createWorkoutsPlugin();

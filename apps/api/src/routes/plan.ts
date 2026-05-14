import { Elysia, t } from 'elysia';
import { generatePlan } from '../claude/client';
import { supabase as defaultSupabase } from '../db/client';
import { garminClient } from '../garmin/client';
import { buildGarminWorkout, planDayDate } from '../garmin/workoutBuilder';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

const SYNC_TIMEOUT_MS = 30_000;

export function createPlanPlugin(db: Db = defaultSupabase) {
  return new Elysia({ prefix: '/plan' })
    .get(
      '/current',
      async ({ query }) => {
        const { athlete_id } = query;

        const { data: athlete } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', athlete_id)
          .single();

        if (!athlete) return { plan: null };

        const { data, error } = await db
          .from('plans')
          .select('*')
          .eq('athlete_id', (athlete as { id: string }).id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) return { plan: null };
        return { plan: data };
      },
      { query: t.Object({ athlete_id: t.String() }) },
    )
    .post(
      '/generate',
      async ({ body, set }) => {
        const { athlete_id: userId } = body;

        const { data: athlete, error: athleteErr } = await db
          .from('athletes')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (athleteErr || !athlete)
          throw new Error('Atleta não encontrado. Complete o onboarding primeiro.');

        const internalId = (athlete as { id: string }).id;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), SYNC_TIMEOUT_MS),
        );

        const planPromise = buildPlan(internalId, athlete as Record<string, unknown>, db);

        try {
          const plan = await Promise.race([planPromise, timeoutPromise]);
          return { plan };
        } catch (err) {
          if (err instanceof Error && err.message === 'TIMEOUT') {
            const { data: job } = await db
              .from('jobs')
              .insert({
                athlete_id: internalId,
                type: 'plan_generate',
                payload: { athlete_id: userId },
                status: 'running',
              })
              .select('id')
              .single();

            const jobId = job?.id;

            // buildPlan is still running — update job when it finishes
            planPromise
              .then(async (plan) => {
                if (!jobId) return;
                await db
                  .from('jobs')
                  .update({
                    status: 'done',
                    result: { plan },
                    finished_at: new Date().toISOString(),
                  })
                  .eq('id', jobId);
              })
              .catch(async (buildErr) => {
                if (!jobId) return;
                await db
                  .from('jobs')
                  .update({
                    status: 'failed',
                    error: buildErr instanceof Error ? buildErr.message : String(buildErr),
                    finished_at: new Date().toISOString(),
                  })
                  .eq('id', jobId);
              });

            set.status = 202;
            return { job_id: jobId, message: 'Continuamos preparando seu plano. Te avisaremos.' };
          }
          logger.error({ err, athlete_id: userId }, 'Falha ao gerar plano');
          throw err;
        }
      },
      { body: t.Object({ athlete_id: t.String() }) },
    )
    .post(
      '/send-to-garmin',
      async ({ body, set }) => {
        const { athlete_id, week_number = 1 } = body;

        const { data: athlete } = await db
          .from('athletes')
          .select('*')
          .eq('user_id', athlete_id)
          .single();

        if (!athlete) {
          set.status = 404;
          return { error: 'Atleta não encontrado' };
        }

        const internalId = (athlete as { id: string }).id;

        const { data: tokenJson } = await db.rpc('get_garmin_token', { p_athlete_id: internalId });
        if (!tokenJson) {
          set.status = 400;
          return { error: 'Garmin não conectado. Conecte o Garmin primeiro.' };
        }

        const { data: planRow } = await db
          .from('plans')
          .select('plan_json')
          .eq('athlete_id', internalId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!planRow) {
          set.status = 404;
          return { error: 'Nenhum plano ativo encontrado' };
        }

        const planJson = (planRow as { plan_json: { weeks: TrainingWeek[] } }).plan_json;
        const week = planJson.weeks[week_number - 1];
        if (!week) {
          set.status = 404;
          return { error: 'Semana não encontrada no plano' };
        }

        const fcMax = Number((athlete as Record<string, unknown>).fc_max ?? 0);
        const fcRest = Number((athlete as Record<string, unknown>).fc_rest ?? 60);
        const zonesMap = karvonenZonesMap(fcMax > 0 ? fcMax : 180, fcRest);

        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilMonday = dayOfWeek === 1 ? 0 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        const weekStart = new Date(today.getTime() + daysUntilMonday * 86_400_000)
          .toISOString()
          .slice(0, 10);

        let sent = 0;
        for (const day of week.days) {
          if (day.type === 'rest') continue;
          const date = planDayDate(weekStart, day.day);
          const dayLabel = `${day.type.charAt(0).toUpperCase() + day.type.slice(1)} D${day.day}`;
          const workout = buildGarminWorkout(day, zonesMap, `FitSync — ${dayLabel}`);
          await garminClient.scheduleWorkout(internalId, tokenJson as string, workout, date);
          sent++;
          logger.info(
            { athlete_id: internalId, date, type: day.type },
            'Workout enviado ao Garmin (manual)',
          );
        }

        return { ok: true, sent };
      },
      {
        body: t.Object({
          athlete_id: t.String(),
          week_number: t.Optional(t.Number({ minimum: 1 })),
        }),
      },
    )
    .patch(
      '/move',
      async ({ body }) => {
        const { plan_id, workout_day, target_day, force } = body;

        const { data: plan } = await db
          .from('plans')
          .select('plan_json')
          .eq('id', plan_id)
          .single();

        if (!plan) throw new Error('Plano não encontrado');

        const planJson = plan.plan_json as {
          weeks: { days: { day: number; type: string }[] }[];
        };
        const allDays = planJson.weeks.flatMap((w) => w.days);

        const movingDay = allDays.find((d) => d.day === workout_day);
        const targetDayObj = allDays.find((d) => d.day === target_day);

        if (!movingDay || !targetDayObj) throw new Error('Dia não encontrado');

        const highTypes = new Set(['interval', 'tempo']);
        const prevDay = allDays.find((d) => d.day === target_day - 1);
        const nextDay = allDays.find((d) => d.day === target_day + 1);

        const wouldViolate =
          highTypes.has(movingDay.type) &&
          ((prevDay && prevDay.day !== workout_day && highTypes.has(prevDay.type)) ||
            (nextDay && nextDay.day !== workout_day && highTypes.has(nextDay.type)));

        if (wouldViolate && !force) {
          return {
            ok: false,
            warning: 'Esse arranjo pode comprometer sua recuperação. Confirma mesmo assim?',
            requires_confirmation: true,
          };
        }

        for (const week of planJson.weeks) {
          const i1 = week.days.findIndex((d) => d.day === workout_day);
          const i2 = week.days.findIndex((d) => d.day === target_day);
          if (i1 === -1 || i2 === -1) continue;

          const { day: _d1, ...content1 } = week.days[i1] as Record<string, unknown>;
          const { day: _d2, ...content2 } = week.days[i2] as Record<string, unknown>;

          week.days[i1] = {
            ...content2,
            day: workout_day,
            ...(force ? { manual_override: true } : {}),
          } as (typeof week.days)[0];
          week.days[i2] = { ...content1, day: target_day } as (typeof week.days)[0];
          break;
        }

        await db.from('plans').update({ plan_json: planJson }).eq('id', plan_id);

        return { ok: true };
      },
      {
        body: t.Object({
          plan_id: t.String(),
          workout_day: t.Number(),
          target_day: t.Number(),
          force: t.Optional(t.Boolean()),
        }),
      },
    )
    .get(
      '/metrics',
      async ({ query }) => {
        const { athlete_id } = query;

        const { data: athlete } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', athlete_id)
          .single();

        if (!athlete) return { current: null, history: [] };

        const internalId = (athlete as { id: string }).id;

        const [currentResult, historyResult] = await Promise.all([
          db
            .from('metrics_daily')
            .select('date, atl, ctl, tsb, acwr')
            .eq('athlete_id', internalId)
            .order('date', { ascending: false })
            .limit(1)
            .single(),
          db
            .from('metrics_daily')
            .select('date, ctl, tsb, acwr')
            .eq('athlete_id', internalId)
            .order('date', { ascending: false })
            .limit(42),
        ]);

        return {
          current: currentResult.data ?? null,
          history: (currentResult.data ? (historyResult.data ?? []) : []).reverse(),
        };
      },
      { query: t.Object({ athlete_id: t.String() }) },
    );
}

export const planRoutes = createPlanPlugin();

type TrainingDay = {
  day: number;
  type: string;
  duration_min: number;
  zones: number[];
  description: string;
};

type TrainingWeek = {
  week_number: number;
  days: TrainingDay[];
};

async function sendPlanToGarmin(
  internalId: string,
  plan: { weeks: TrainingWeek[] },
  athlete: Record<string, unknown>,
  db: Db,
): Promise<void> {
  const { data: tokenJson } = await db.rpc('get_garmin_token', { p_athlete_id: internalId });
  if (!tokenJson) return; // Garmin not connected — silently skip

  // Zones from athlete profile for HR targets
  const fcMax = Number(athlete.fc_max ?? 0);
  const fcRest = Number(athlete.fc_rest ?? 60);
  const zonesMap = karvonenZonesMap(fcMax > 0 ? fcMax : 180, fcRest);

  const today = new Date();
  // Week start = next Monday (or today if already Monday)
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = dayOfWeek === 1 ? 0 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const weekStart = new Date(today.getTime() + daysUntilMonday * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const firstWeek = plan.weeks[0];
  if (!firstWeek) return;

  for (const day of firstWeek.days) {
    if (day.type === 'rest') continue;
    const date = planDayDate(weekStart, day.day);
    const dayLabel = `${day.type.charAt(0).toUpperCase() + day.type.slice(1)} D${day.day}`;
    const workout = buildGarminWorkout(day, zonesMap, `FitSync — ${dayLabel}`);
    await garminClient.scheduleWorkout(internalId, tokenJson as string, workout, date);
    logger.info({ athlete_id: internalId, date, type: day.type }, 'Workout enviado ao Garmin');
  }
}

function karvonenZonesMap(fcMax: number, fcRest: number) {
  const pcts: [number, number][] = [
    [0.5, 0.65],
    [0.65, 0.75],
    [0.75, 0.85],
    [0.85, 0.92],
    [0.92, 1.0],
  ];
  return pcts.map(([lo, hi]) => ({
    fc_min: Math.round(fcRest + lo * (fcMax - fcRest)),
    fc_max: Math.round(fcRest + hi * (fcMax - fcRest)),
  }));
}

async function buildPlan(internalId: string, athlete: Record<string, unknown>, db: Db) {
  const [workoutsResult, metricsHistoryResult] = await Promise.all([
    db
      .from('workouts')
      .select('date, distance_m, duration_s, avg_hr, rtss, rpe')
      .eq('athlete_id', internalId)
      .order('date', { ascending: false })
      .limit(30),
    db
      .from('metrics_daily')
      .select('date, atl, ctl, tsb, acwr')
      .eq('athlete_id', internalId)
      .order('date', { ascending: false })
      .limit(14),
  ]);

  const metricsHistory = ((metricsHistoryResult.data ?? []) as Record<string, unknown>[]).reverse();
  const latestMetrics = metricsHistory.at(-1) ?? null;

  const result = await generatePlan({
    athleteId: internalId,
    profile: athlete,
    recentWorkouts: (workoutsResult.data ?? []) as Record<string, unknown>[],
    metrics: latestMetrics,
    metricsHistory,
    calibrationMode: (athlete as { calibration_mode?: boolean }).calibration_mode ?? true,
  });

  const { data: savedPlan, error: saveErr } = await db
    .from('plans')
    .insert({
      athlete_id: internalId,
      week_start: new Date().toISOString().slice(0, 10),
      plan_json: result.plan,
      why_text: result.plan.weeks[0]?.why_text ?? '',
      prompt_version: result.promptVersion,
    })
    .select('id')
    .single();

  if (saveErr) throw new Error(`Falha ao salvar plano: ${saveErr.message}`);

  await db.from('plan_history').insert({
    athlete_id: internalId,
    plan_id: (savedPlan as { id: string }).id,
    plan_snapshot: result.plan,
    prompt_version: result.promptVersion,
    input_json: result.inputJson,
    tokens_used: result.tokensUsed.input + result.tokensUsed.output,
    cost_usd: result.costUsd,
  });

  // Non-blocking: try to push workouts to Garmin; failure must not affect plan response
  sendPlanToGarmin(internalId, result.plan, athlete, db).catch((err) =>
    logger.warn({ err, athlete_id: internalId }, 'Falha ao enviar plano pro Garmin (não crítico)'),
  );

  return result.plan;
}

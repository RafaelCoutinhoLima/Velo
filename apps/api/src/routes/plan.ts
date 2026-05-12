import { Elysia, t } from 'elysia';
import { generatePlan } from '../claude/client';
import { PLAN_PROMPT_VERSION } from '../claude/prompts/plan_v1';
import { supabase as defaultSupabase } from '../db/client';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from'>;

const SYNC_TIMEOUT_MS = 25_000;

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
        const { athlete_id } = body;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), SYNC_TIMEOUT_MS),
        );

        try {
          const plan = await Promise.race([buildPlan(athlete_id, db), timeoutPromise]);
          return { plan };
        } catch (err) {
          if (err instanceof Error && err.message === 'TIMEOUT') {
            const { data: job } = await db
              .from('jobs')
              .insert({ athlete_id, type: 'plan_generate', payload: { athlete_id } })
              .select('id')
              .single();

            set.status = 202;
            return { job_id: job?.id, message: 'Continuamos preparando seu plano. Te avisaremos.' };
          }
          logger.error({ err, athlete_id }, 'Falha ao gerar plano');
          throw err;
        }
      },
      { body: t.Object({ athlete_id: t.String() }) },
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

        // Guardrail: sem dois estímulos altos consecutivos
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

        // Swap workout content between the two day slots (replace in weeks array to avoid stale props)
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

async function buildPlan(userId: string, db: Db) {
  const { data: athlete, error: athleteErr } = await db
    .from('athletes')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (athleteErr || !athlete)
    throw new Error('Atleta não encontrado. Complete o onboarding primeiro.');

  const internalId = (athlete as { id: string }).id;

  const { data: workouts } = await db
    .from('workouts')
    .select('date, distance_m, duration_s, avg_hr, rtss')
    .eq('athlete_id', internalId)
    .order('date', { ascending: false })
    .limit(30);

  const { data: metrics } = await db
    .from('metrics_daily')
    .select('date, atl, ctl, tsb, acwr')
    .eq('athlete_id', internalId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  const plan = await generatePlan({
    athleteId: internalId,
    profile: athlete,
    recentWorkouts: workouts ?? [],
    metrics: metrics ?? {},
    calibrationMode: (athlete as { calibration_mode?: boolean }).calibration_mode ?? true,
  });

  const { data: savedPlan, error: saveErr } = await db
    .from('plans')
    .insert({
      athlete_id: internalId,
      week_start: new Date().toISOString().slice(0, 10),
      plan_json: plan,
      why_text: plan.weeks[0]?.why_text ?? '',
      prompt_version: PLAN_PROMPT_VERSION,
    })
    .select('id')
    .single();

  if (saveErr) throw new Error(`Falha ao salvar plano: ${saveErr.message}`);

  await db.from('plan_history').insert({
    athlete_id: internalId,
    plan_id: (savedPlan as { id: string }).id,
    plan_snapshot: plan,
    prompt_version: PLAN_PROMPT_VERSION,
  });

  return plan;
}

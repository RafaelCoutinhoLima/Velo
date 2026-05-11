import { Elysia, t } from 'elysia';
import { generatePlan } from '../claude/client';
import { PLAN_PROMPT_VERSION } from '../claude/prompts/plan_v1';
import { supabase } from '../db/client';
import { logger } from '../lib/logger';

const SYNC_TIMEOUT_MS = 25_000;

export const planRoutes = new Elysia({ prefix: '/plan' })
  .get(
    '/current',
    async ({ query }) => {
      const { athlete_id } = query;

      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('athlete_id', athlete_id)
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
        const plan = await Promise.race([buildPlan(athlete_id), timeoutPromise]);
        return { plan };
      } catch (err) {
        if (err instanceof Error && err.message === 'TIMEOUT') {
          // Cai para async — enfileira job
          const { data: job } = await supabase
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
      const { plan_id, workout_day, target_day } = body;

      const { data: plan } = await supabase
        .from('plans')
        .select('plan_json')
        .eq('id', plan_id)
        .single();

      if (!plan) throw new Error('Plano não encontrado');

      // Guardrail local sem Claude: sem dois estímulos altos consecutivos
      const highTypes = new Set(['interval', 'tempo']);
      const weeks = (plan.plan_json as { weeks: { days: { day: number; type: string }[] }[] })
        .weeks;
      const allDays = weeks.flatMap((w) => w.days);
      const targetDayData = allDays.find((d) => d.day === target_day);
      const prevDay = allDays.find((d) => d.day === target_day - 1);
      const nextDay = allDays.find((d) => d.day === target_day + 1);
      const movingDay = allDays.find((d) => d.day === workout_day);

      const wouldViolate =
        movingDay &&
        highTypes.has(movingDay.type) &&
        ((prevDay && highTypes.has(prevDay.type)) || (nextDay && highTypes.has(nextDay.type)));

      if (wouldViolate) {
        return {
          ok: false,
          warning: 'Esse arranjo pode comprometer sua recuperação. Confirma mesmo assim?',
          requires_confirmation: true,
        };
      }

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
  );

async function buildPlan(athleteId: string) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', athleteId)
    .single();

  const { data: workouts } = await supabase
    .from('workouts')
    .select('date, distance_m, duration_s, avg_hr, rtss')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false })
    .limit(30);

  const { data: metrics } = await supabase
    .from('metrics_daily')
    .select('date, atl, ctl, tsb, acwr')
    .eq('athlete_id', athleteId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  const plan = await generatePlan({
    athleteId,
    profile: athlete ?? {},
    recentWorkouts: workouts ?? [],
    metrics: metrics ?? {},
    calibrationMode: athlete?.calibration_mode ?? true,
  });

  const { data: savedPlan } = await supabase
    .from('plans')
    .insert({
      athlete_id: athleteId,
      week_start: new Date().toISOString().slice(0, 10),
      plan_json: plan,
      why_text: plan.weeks[0]?.why_text ?? '',
      prompt_version: PLAN_PROMPT_VERSION,
    })
    .select('id')
    .single();

  // Arquiva no histórico
  if (savedPlan) {
    await supabase.from('plan_history').insert({
      athlete_id: athleteId,
      plan_id: savedPlan.id,
      plan_snapshot: plan,
      prompt_version: PLAN_PROMPT_VERSION,
    });
  }

  return plan;
}

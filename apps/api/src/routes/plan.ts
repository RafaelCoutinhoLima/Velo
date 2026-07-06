import { Elysia, t } from 'elysia';
import { generatePlan } from '../claude/client';
import { supabase as defaultSupabase } from '../db/client';
import { garminClient } from '../garmin/client';
import { classifySport } from '../garmin/sport';
import { buildGarminWorkout, planDayDate } from '../garmin/workoutBuilder';
import { authGuard, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { evaluateCalibration } from '../lib/calibration';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

const DEFAULT_SYNC_TIMEOUT_MS = 30_000;

export function createPlanPlugin(
  db: Db = defaultSupabase,
  syncTimeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
  verify: TokenVerifier = verifySupabaseToken,
) {
  return (
    new Elysia({ prefix: '/plan' })
      .use(authGuard(verify))
      .get('/current', async ({ userId }) => {
        const { data: athlete } = await db
          .from('athletes')
          .select('id, calibration_mode, created_at')
          .eq('user_id', userId)
          .single();

        if (!athlete) return { plan: null, calibration_mode: true };

        const a = athlete as { id: string; calibration_mode?: boolean; created_at?: string };

        // US-017: avalia calibração na leitura também — flip de 14 dias
        // acontece mesmo se o atleta só abrir o app (sem sync nem gerar plano).
        // Em paralelo com a busca do plano: são independentes, e essa rota roda
        // em TODA abertura da home — economiza um round-trip inteiro.
        const [{ calibrationMode }, { data, error }] = await Promise.all([
          evaluateCalibration(db, a.id, {
            athleteRow: { calibration_mode: a.calibration_mode, created_at: a.created_at },
          }),
          db
            .from('plans')
            .select('*')
            .eq('athlete_id', a.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
        ]);

        if (error || !data) return { plan: null, calibration_mode: calibrationMode };
        // Fallback determinístico grava prompt_version com sufixo _fallback —
        // o app usa isso pra avisar que o plano não é personalizado.
        const promptVersion = String((data as { prompt_version?: string }).prompt_version ?? '');
        return {
          plan: data,
          calibration_mode: calibrationMode,
          used_fallback: promptVersion.endsWith('_fallback'),
        };
      })
      .post('/generate', async ({ userId, set }) => {
        const { data: athlete, error: athleteErr } = await db
          .from('athletes')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (athleteErr || !athlete)
          throw new Error('Atleta não encontrado. Complete o onboarding primeiro.');

        const internalId = (athlete as { id: string }).id;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), syncTimeoutMs),
        );

        const planPromise = buildPlan(internalId, athlete as Record<string, unknown>, db);

        try {
          const { plan, usedFallback } = await Promise.race([planPromise, timeoutPromise]);
          return { plan, used_fallback: usedFallback };
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
              .then(async ({ plan, usedFallback }) => {
                if (!jobId) return;
                await db
                  .from('jobs')
                  .update({
                    status: 'done',
                    result: { plan, used_fallback: usedFallback },
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
      })
      // US-019: replanejamento sob demanda — a realidade mudou (viagem, dor,
      // treino perdido) e o atleta pede uma semana recalculada. Rate limit de
      // 1 por semana (via plans.source='replan'); devolve o diff (US-020) entre
      // o plano anterior e o novo pra tela "Plano atualizado" mostrar o que mudou.
      .post('/replan', async ({ userId, set }) => {
        const { data: athlete, error: athleteErr } = await db
          .from('athletes')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (athleteErr || !athlete)
          throw new Error('Atleta não encontrado. Complete o onboarding primeiro.');

        const internalId = (athlete as { id: string }).id;

        // Replan sem plano ativo não faz sentido — o fluxo certo é /generate.
        const { data: prevRow } = await db
          .from('plans')
          .select('id, plan_json, created_at')
          .eq('athlete_id', internalId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!prevRow) {
          set.status = 404;
          return { error: 'Nenhum plano ativo. Gere um plano primeiro.' };
        }

        // Rate limit: 1 replanejamento por semana (RF do Sprint 4).
        const { data: lastReplan } = await db
          .from('plans')
          .select('created_at')
          .eq('athlete_id', internalId)
          .eq('source', 'replan')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const lastTs = (lastReplan as { created_at?: string } | null)?.created_at;
        if (lastTs && Date.now() - new Date(lastTs).getTime() < REPLAN_COOLDOWN_MS) {
          const next = new Date(new Date(lastTs).getTime() + REPLAN_COOLDOWN_MS);
          set.status = 429;
          return {
            error: `Você já replanejou esta semana. Próximo replanejamento: ${next.toLocaleDateString('pt-BR')}.`,
          };
        }

        const { plan, usedFallback } = await buildPlan(
          internalId,
          athlete as Record<string, unknown>,
          db,
          'replan',
        );

        const prevPlan = (prevRow as { plan_json: { weeks: TrainingWeek[] } }).plan_json;
        return {
          plan,
          used_fallback: usedFallback,
          diff: diffWeeks(prevPlan.weeks?.[0], plan.weeks?.[0]),
        };
      })
      .post(
        '/send-to-garmin',
        async ({ userId, body, set }) => {
          const { week_number = 1 } = body;

          const { data: athlete } = await db
            .from('athletes')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (!athlete) {
            set.status = 404;
            return { error: 'Atleta não encontrado' };
          }

          const internalId = (athlete as { id: string }).id;

          const { data: tokenJson } = await db.rpc('get_garmin_token', {
            p_athlete_id: internalId,
          });
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

          // Agenda os treinos da semana em PARALELO — cada scheduleWorkout é uma
          // ida sidecar→Garmin (~0.5-2s); em série, 5 treinos seguravam a
          // resposta por até 10s. Falha parcial não aborta os demais.
          const runDays = week.days.filter((day) => day.type !== 'rest');
          const results = await Promise.allSettled(
            runDays.map((day) => {
              const date = planDayDate(weekStart, day.day);
              const dayLabel = `${day.type.charAt(0).toUpperCase() + day.type.slice(1)} D${day.day}`;
              const workout = buildGarminWorkout(day, zonesMap, `FitSync — ${dayLabel}`);
              return garminClient
                .scheduleWorkout(internalId, tokenJson as string, workout, date)
                .then(() => {
                  logger.info(
                    { athlete_id: internalId, date, type: day.type },
                    'Workout enviado ao Garmin (manual)',
                  );
                });
            }),
          );
          const sent = results.filter((r) => r.status === 'fulfilled').length;

          // Falha total continua virando erro pro usuário (mesma semântica de
          // antes, quando o primeiro throw abortava a rota).
          if (runDays.length > 0 && sent === 0) {
            const first = results.find((r) => r.status === 'rejected') as
              | PromiseRejectedResult
              | undefined;
            throw first?.reason instanceof Error
              ? first.reason
              : new Error('Falha ao enviar treinos pro Garmin');
          }

          return { ok: true, sent };
        },
        {
          body: t.Object({
            week_number: t.Optional(t.Number({ minimum: 1 })),
          }),
        },
      )
      .patch(
        '/move',
        async ({ userId, body }) => {
          const { plan_id, workout_day, target_day, force } = body;

          // Escopa o plano ao atleta autenticado: sem isto qualquer um adivinha
          // um plan_id e reescreve o plano de outra pessoa (BOLA).
          const { data: athlete } = await db
            .from('athletes')
            .select('id')
            .eq('user_id', userId)
            .single();
          if (!athlete) throw new Error('Plano não encontrado');
          const ownerId = (athlete as { id: string }).id;

          const { data: plan } = await db
            .from('plans')
            .select('plan_json')
            .eq('id', plan_id)
            .eq('athlete_id', ownerId)
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

          await db
            .from('plans')
            .update({ plan_json: planJson })
            .eq('id', plan_id)
            .eq('athlete_id', ownerId);

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
      .get('/metrics', async ({ userId }) => {
        const { data: athlete } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', userId)
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
      })
  );
}

export const planRoutes = createPlanPlugin();

type TrainingDay = {
  day: number;
  type: string;
  duration_min: number;
  distance_km?: number;
  zones: number[];
  description: string;
};

type TrainingWeek = {
  week_number: number;
  days: TrainingDay[];
};

// ─── US-019/US-020: replanejamento + diff ────────────────────────────────────

const REPLAN_COOLDOWN_MS = 7 * 86_400_000;

type DaySnapshot = { type: string; distance_km: number; duration_min: number };
type DayDiff = {
  day: number;
  before: DaySnapshot | null;
  after: DaySnapshot | null;
  changed: boolean;
};

// Diff dia a dia da primeira semana: o que a tela "Plano atualizado" mostra.
// Compara só o que o atleta percebe (tipo/distância/duração) — descrição e
// zonas mudam a cada geração sem alterar o treino de fato.
function diffWeeks(before: TrainingWeek | undefined, after: TrainingWeek | undefined) {
  const snap = (d: TrainingDay | undefined): DaySnapshot | null =>
    d ? { type: d.type, distance_km: d.distance_km ?? 0, duration_min: d.duration_min } : null;

  const days: DayDiff[] = [];
  for (let dayNum = 1; dayNum <= 7; dayNum++) {
    const b = snap(before?.days.find((x) => x.day === dayNum));
    const a = snap(after?.days.find((x) => x.day === dayNum));
    days.push({
      day: dayNum,
      before: b,
      after: a,
      changed: JSON.stringify(b) !== JSON.stringify(a),
    });
  }

  const totalKm = (w?: TrainingWeek) =>
    Math.round((w?.days ?? []).reduce((s, d) => s + (d.distance_km ?? 0), 0) * 10) / 10;

  return {
    days,
    changed_days: days.filter((d) => d.changed).length,
    total_km_before: totalKm(before),
    total_km_after: totalKm(after),
  };
}

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

async function buildPlan(
  internalId: string,
  athlete: Record<string, unknown>,
  db: Db,
  source: 'generate' | 'replan' = 'generate',
) {
  const [workoutsResult, metricsHistoryResult, firstWorkoutResult] = await Promise.all([
    db
      .from('workouts')
      .select(
        'date, distance_m, duration_s, avg_hr, rtss, rpe, type_key:raw_payload->activityType->>typeKey',
      )
      .eq('athlete_id', internalId)
      .order('date', { ascending: false })
      .limit(60),
    db
      .from('metrics_daily')
      .select('date, atl, ctl, tsb, acwr')
      .eq('athlete_id', internalId)
      .order('date', { ascending: false })
      .limit(14),
    db
      .from('workouts')
      .select('date')
      .eq('athlete_id', internalId)
      .order('date', { ascending: true })
      .limit(1)
      .single(),
  ]);

  const metricsHistory = ((metricsHistoryResult.data ?? []) as Record<string, unknown>[]).reverse();
  const latestMetrics = metricsHistory.at(-1) ?? null;

  // Deriva o esporte do typeKey (sem coluna) pro briefing distinguir corrida
  // de cross-training no cálculo de volume.
  const recentWorkouts = ((workoutsResult.data ?? []) as Record<string, unknown>[]).map((w) => ({
    ...w,
    sport: classifySport(w.type_key as string | null),
  }));

  // US-017: reavalia (e persiste) calibração antes de gerar — garante que o
  // prompt receba o estado correto mesmo sem um sync Garmin recente.
  const { calibrationMode } = await evaluateCalibration(db, internalId, {
    athleteRow: athlete as { calibration_mode?: boolean; created_at?: string },
  });

  const firstWorkoutDate = (firstWorkoutResult.data as { date?: string } | null)?.date ?? undefined;

  const result = await generatePlan({
    athleteId: internalId,
    profile: athlete,
    recentWorkouts,
    metrics: latestMetrics,
    metricsHistory,
    calibrationMode,
    firstWorkoutDate,
  });

  // Um plano ativo por atleta: desativa os anteriores ANTES de inserir o novo
  // (o /current pegava o mais novo por created_at, mas múltiplos ativos
  // poluíam o diff do replan e o histórico).
  await db.from('plans').update({ is_active: false }).eq('athlete_id', internalId);

  const { data: savedPlan, error: saveErr } = await db
    .from('plans')
    .insert({
      athlete_id: internalId,
      week_start: new Date().toISOString().slice(0, 10),
      plan_json: result.plan,
      why_text: result.plan.weeks[0]?.why_text ?? '',
      prompt_version: result.promptVersion,
      source,
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

  return { plan: result.plan, usedFallback: result.usedFallback === true };
}

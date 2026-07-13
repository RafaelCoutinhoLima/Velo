import { Elysia, t } from 'elysia';
import { generateFeedback } from '../claude/client';
import { FeedbackInputSchema } from '../claude/schemas';
import { supabase as defaultSupabase } from '../db/client';
import { authGuard, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { AppError } from '../lib/errors';
import { resolveInternalId } from '../lib/internalId';
import { logger } from '../lib/logger';

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/_(.+?)_/gs, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

type Db = Pick<typeof defaultSupabase, 'from'>;

export function createFeedbackPlugin(
  db: Db = defaultSupabase,
  verify: TokenVerifier = verifySupabaseToken,
) {
  return new Elysia({ prefix: '/feedback' })
    .use(authGuard(verify))
    .get('/', async ({ userId }) => {
      const internalId = await resolveInternalId(db, userId);
      if (!internalId) return { feedbacks: [] };

      const { data, error } = await db
        .from('feedback')
        .select('id, workout_id, feedback_md, created_at')
        .eq('athlete_id', internalId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw new AppError('Falha ao buscar feedbacks');
      return { feedbacks: data };
    })
    .post(
      '/',
      async ({ userId, body, set }) => {
        const { workout_id } = body;

        // Resolve internal athlete ID a partir do dono autenticado
        const { data: athlete } = await db
          .from('athletes')
          .select('id, birth_year, calibration_mode')
          .eq('user_id', userId)
          .single();

        if (!athlete) {
          set.status = 404;
          return { error: 'Atleta não encontrado' };
        }
        const internalId = (
          athlete as { id: string; birth_year: number; calibration_mode: boolean }
        ).id;

        // Prevent duplicate feedback for the same workout
        const { data: existing } = await db
          .from('feedback')
          .select('id, feedback_md, created_at')
          .eq('athlete_id', internalId)
          .eq('workout_id', workout_id)
          .single();

        if (existing) {
          const cachedMd = (existing as { feedback_md: string }).feedback_md;
          return {
            id: (existing as { id: string }).id,
            workout_id,
            texto_principal: stripMarkdown(cachedMd),
            created_at: (existing as { created_at: string }).created_at,
            cached: true,
          };
        }

        // Fetch workout data
        const { data: workout } = await db
          .from('workouts')
          .select('id, date, distance_m, duration_s, avg_hr, rtss, rpe, raw_payload')
          .eq('id', workout_id)
          .eq('athlete_id', internalId)
          .single();

        if (!workout) {
          set.status = 404;
          return { error: 'Treino não encontrado' };
        }

        const w = workout as {
          id: string;
          date: string;
          distance_m: number;
          duration_s: number;
          avg_hr: number | null;
          rtss: number | null;
          rpe: number | null;
        };

        const distKm = w.distance_m / 1000;
        const durationMin = Math.round(w.duration_s / 60);
        const paceAvgSkm = distKm > 0 ? Math.round(w.duration_s / distKm) : 360;

        const feedbackInput = FeedbackInputSchema.parse({
          workout_id,
          athlete_id: internalId,
          workout_date: w.date,
          distance_km: Math.round(distKm * 100) / 100,
          duration_min: durationMin,
          avg_hr: w.avg_hr ?? undefined,
          pace_avg_s_km: paceAvgSkm,
          rpe: w.rpe ?? undefined,
          calibration_mode: (athlete as { calibration_mode: boolean }).calibration_mode,
        });

        let feedbackOutput: Awaited<ReturnType<typeof generateFeedback>>;
        try {
          feedbackOutput = await generateFeedback(feedbackInput);
        } catch (err) {
          // Cota mensal (AppError 429) não é falha técnica: repassa ao onError
          // global, que devolve a mensagem curada com o status certo.
          if (err instanceof AppError) throw err;
          logger.error({ err, workout_id, athleteId: internalId }, 'Falha ao gerar feedback');
          set.status = 500;
          return { error: 'Tive um problema técnico ao gerar o feedback. Tente novamente.' };
        }

        const { data: saved, error: saveErr } = await db
          .from('feedback')
          .insert({
            athlete_id: internalId,
            workout_id,
            feedback_md: feedbackOutput.feedback_md,
          })
          .select('id, created_at')
          .single();

        if (saveErr) {
          logger.error({ err: saveErr, athleteId: internalId }, 'Falha ao salvar feedback');
          set.status = 500;
          return { error: 'Tive um problema técnico ao salvar o feedback.' };
        }

        return {
          id: (saved as { id: string }).id,
          workout_id,
          texto_principal: feedbackOutput.texto_principal,
          destaque_positivo: feedbackOutput.destaque_positivo,
          sugestao: feedbackOutput.sugestao,
          emoji_resumo: feedbackOutput.emoji_resumo,
          created_at: (saved as { created_at: string }).created_at,
        };
      },
      {
        body: t.Object({
          workout_id: t.String(),
        }),
      },
    );
}

export const feedbackRoutes = createFeedbackPlugin();

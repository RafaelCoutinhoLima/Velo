import { timingSafeEqual } from 'node:crypto';
import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { bearer, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { resolveInternalId } from '../lib/internalId';
import { logger } from '../lib/logger';
import { sendExpoPush } from '../lib/push';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

// Janela do sweep de lembrete de RPE. O cron Railway chama
// POST /push/rpe-reminders periodicamente (~30min após o treino, US-015
// Camada 2). Sem coluna de "já lembrado" no MVP: a janela curta + cadência
// do cron mantém ~1 lembrete por treino (aceitável p/ 2 atletas em
// dogfooding). Migrar p/ flag dedicada se virar ruído.
const RPE_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

// Comparação em tempo constante do segredo do cron — `!==` retorna no primeiro
// byte diferente e vira oráculo de timing pra adivinhar o segredo byte a byte.
function secretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createPushPlugin(
  db: Db = defaultSupabase,
  verify: TokenVerifier = verifySupabaseToken,
  // Segredo do cron: sem ele o sweep de push fica aberto (qualquer um dispara
  // lembretes a todos os atletas). Injetável para testes.
  cronSecret: string | undefined = process.env.CRON_SECRET,
) {
  return (
    new Elysia({ prefix: '/push' })
      .post(
        '/register',
        async ({ headers, body, set }) => {
          // Auth de usuário: o push_token é gravado para o dono autenticado,
          // nunca para um athlete_id arbitrário do corpo.
          const userId = await verify(bearer(headers.authorization));
          if (!userId) {
            set.status = 401;
            return { error: 'Não autenticado' };
          }
          const { token } = body;

          const internalId = await resolveInternalId(db, userId);
          if (!internalId) {
            set.status = 404;
            return { error: 'Atleta não encontrado' };
          }

          const { error } = await db
            .from('athletes')
            .update({ push_token: token })
            .eq('id', internalId);

          if (error) {
            set.status = 500;
            return { error: 'Falha ao registrar token' };
          }
          return { ok: true };
        },
        {
          body: t.Object({
            token: t.String({ minLength: 1 }),
          }),
        },
      )
      // Cron-triggered (Railway). Protegido por segredo compartilhado — não é
      // um endpoint de usuário. Lembra atletas com treino recente sem RPE.
      .post('/rpe-reminders', async ({ headers, set }) => {
        if (!cronSecret || !secretMatches(headers['x-cron-secret'], cronSecret)) {
          set.status = 401;
          return { error: 'Não autorizado' };
        }

        const cutoff = new Date(Date.now() - RPE_REMINDER_WINDOW_MS).toISOString();

        const { data: workouts } = await db
          .from('workouts')
          .select('id, athlete_id')
          .is('rpe', null)
          .gte('created_at', cutoff);

        const rows = (workouts ?? []) as { id: string; athlete_id: string }[];
        if (rows.length === 0) return { reminded: 0 };

        // Um lembrete por atleta, mesmo com vários treinos sem RPE. Guarda um
        // workout_id por atleta pro deep link: o tap na notificação abre a
        // tela do treino direto no input de RPE.
        const athleteIds = [...new Set(rows.map((w) => w.athlete_id))];
        const workoutByAthlete = new Map<string, string>();
        for (const w of rows) {
          if (!workoutByAthlete.has(w.athlete_id)) workoutByAthlete.set(w.athlete_id, w.id);
        }

        // Uma query pros tokens de todos os candidatos (era 1 por atleta) e
        // envios em paralelo — o sweep roda em cron e escala linear no nº de
        // atletas. sendExpoPush nunca lança.
        const { data: athletes } = await db
          .from('athletes')
          .select('id, push_token')
          .in('id', athleteIds);

        const targets = ((athletes ?? []) as { id: string; push_token?: string | null }[]).filter(
          (a): a is { id: string; push_token: string } => !!a.push_token,
        );

        await Promise.all(
          targets.map((a) =>
            sendExpoPush(
              a.push_token,
              'Como foi o treino?',
              'Toca aqui e me conta o esforço de 1 a 10 💪',
              {
                type: 'rpe_reminder',
                workout_id: workoutByAthlete.get(a.id),
              },
            ),
          ),
        );
        const reminded = targets.length;

        logger.info({ reminded, candidates: athleteIds.length }, 'Sweep de lembrete de RPE');
        return { reminded };
      })
  );
}

export const pushRoutes = createPushPlugin();

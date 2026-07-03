import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { bearer, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { logger } from '../lib/logger';
import { sendExpoPush } from '../lib/push';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

// Janela do sweep de lembrete de RPE. O cron Railway chama
// POST /push/rpe-reminders periodicamente (~30min após o treino, US-015
// Camada 2). Sem coluna de "já lembrado" no MVP: a janela curta + cadência
// do cron mantém ~1 lembrete por treino (aceitável p/ 2 atletas em
// dogfooding). Migrar p/ flag dedicada se virar ruído.
const RPE_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

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

          const { data: athlete } = await db
            .from('athletes')
            .select('id')
            .eq('user_id', userId)
            .single();

          if (!athlete) {
            set.status = 404;
            return { error: 'Atleta não encontrado' };
          }

          const { error } = await db
            .from('athletes')
            .update({ push_token: token })
            .eq('id', (athlete as { id: string }).id);

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
        if (!cronSecret || headers['x-cron-secret'] !== cronSecret) {
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

        // Um lembrete por atleta, mesmo com vários treinos sem RPE.
        const athleteIds = [...new Set(rows.map((w) => w.athlete_id))];

        let reminded = 0;
        for (const id of athleteIds) {
          const { data: athlete } = await db
            .from('athletes')
            .select('push_token')
            .eq('id', id)
            .single();
          const token = (athlete as { push_token?: string } | null)?.push_token;
          if (!token) continue;
          await sendExpoPush(
            token,
            'Como foi o treino?',
            'Toca aqui e me conta o esforço de 1 a 10 💪',
            { type: 'rpe_reminder' },
          );
          reminded++;
        }

        logger.info({ reminded, candidates: athleteIds.length }, 'Sweep de lembrete de RPE');
        return { reminded };
      })
  );
}

export const pushRoutes = createPushPlugin();

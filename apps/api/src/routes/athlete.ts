import { Elysia } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { authGuard, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;
// Apaga o usuário no Supabase Auth — a FK athletes.user_id ON DELETE CASCADE
// remove athletes e, em cascata, todos os dados. Injetável para testes.
type DeleteAuthUser = (userId: string) => Promise<{ error: unknown }>;

const defaultDeleteAuthUser: DeleteAuthUser = (userId) =>
  defaultSupabase.auth.admin.deleteUser(userId).then((r) => ({ error: r.error }));

// Tabelas do titular exportadas/inclusas no direito de portabilidade (LGPD
// art. 18 V/VI). Todas têm athlete_id apontando para athletes.id.
const OWNED_TABLES = [
  'workouts',
  'metrics_daily',
  'plans',
  'plan_history',
  'feedback',
  'consents',
] as const;

export function createAthletePlugin(
  db: Db = defaultSupabase,
  verify: TokenVerifier = verifySupabaseToken,
  deleteAuthUser: DeleteAuthUser = defaultDeleteAuthUser,
) {
  return (
    new Elysia({ prefix: '/athlete' })
      .use(authGuard(verify))
      // Portabilidade: devolve todos os dados do titular num JSON (LGPD art. 18 V).
      .get('/export', async ({ userId, set }) => {
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
        const out: Record<string, unknown> = {
          exported_at: new Date().toISOString(),
          athlete,
        };
        for (const table of OWNED_TABLES) {
          const { data } = await db.from(table).select('*').eq('athlete_id', internalId);
          out[table] = data ?? [];
        }
        return out;
      })
      // Eliminação (LGPD art. 18 VI): apaga o segredo Garmin do Vault (fora do
      // cascade) e depois o usuário Auth, que cascateia todo o resto por FK.
      .delete('/', async ({ userId, set }) => {
        const { data: athlete } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (athlete) {
          const internalId = (athlete as { id: string }).id;
          try {
            await db.rpc('delete_garmin_token', { p_athlete_id: internalId });
          } catch (err) {
            // Não bloqueia a exclusão da conta por causa do Vault; só registra.
            logger.warn({ err, userId }, 'Falha ao limpar token Garmin no Vault');
          }
        }

        const { error } = await deleteAuthUser(userId);
        if (error) {
          logger.error({ err: error, userId }, 'Falha ao excluir conta');
          set.status = 500;
          return { error: 'Falha ao excluir conta' };
        }

        logger.info({ userId }, 'Conta excluída a pedido do titular (LGPD)');
        return { ok: true };
      })
  );
}

export const athleteRoutes = createAthletePlugin();

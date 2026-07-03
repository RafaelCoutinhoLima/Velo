import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { authGuard, type TokenVerifier, verifySupabaseToken } from '../lib/auth';

type Db = Pick<typeof defaultSupabase, 'from'>;

export function createJobsPlugin(
  db: Db = defaultSupabase,
  verify: TokenVerifier = verifySupabaseToken,
) {
  return new Elysia({ prefix: '/jobs' })
    .use(authGuard(verify))
    .get(
      '/:id',
      async ({ userId, params, set }) => {
        // Escopa o job ao atleta autenticado: sem isto qualquer um enumera
        // UUIDs de job e lê o plano completo gerado por outra pessoa (BOLA).
        const { data: athlete } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', userId)
          .single();
        if (!athlete) {
          set.status = 404;
          return { error: 'Job não encontrado' };
        }

        const { data, error } = await db
          .from('jobs')
          .select('id, status, result, error, created_at, finished_at')
          .eq('id', params.id)
          .eq('athlete_id', (athlete as { id: string }).id)
          .single();

        if (error || !data) {
          set.status = 404;
          return { error: 'Job não encontrado' };
        }
        return data;
      },
      { params: t.Object({ id: t.String() }) },
    )
    .post(
      '/',
      async ({ userId, body, set }) => {
        const { type, payload } = body;

        // athlete_id sempre derivado do dono autenticado — nunca do corpo.
        const { data: athlete } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', userId)
          .single();
        if (!athlete) {
          set.status = 404;
          return { error: 'Atleta não encontrado' };
        }

        const { data, error } = await db
          .from('jobs')
          .insert({ athlete_id: (athlete as { id: string }).id, type, payload })
          .select('id')
          .single();

        if (error || !data) throw new Error('Falha ao criar job');
        return { job_id: data.id };
      },
      {
        body: t.Object({
          type: t.Union([
            t.Literal('plan_generate'),
            t.Literal('plan_replan'),
            t.Literal('feedback_generate'),
          ]),
          payload: t.Record(t.String(), t.Unknown()),
        }),
      },
    );
}

export const jobRoutes = createJobsPlugin();

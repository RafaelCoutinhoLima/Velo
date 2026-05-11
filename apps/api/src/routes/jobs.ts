import { Elysia, t } from 'elysia';
import { supabase } from '../db/client';

export const jobRoutes = new Elysia({ prefix: '/jobs' })
  .get(
    '/:id',
    async ({ params }) => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, status, result, error, created_at, finished_at')
        .eq('id', params.id)
        .single();

      if (error || !data) return { error: 'Job não encontrado' };
      return data;
    },
    { params: t.Object({ id: t.String() }) },
  )
  .post(
    '/',
    async ({ body }) => {
      const { athlete_id, type, payload } = body;

      const { data, error } = await supabase
        .from('jobs')
        .insert({ athlete_id, type, payload })
        .select('id')
        .single();

      if (error || !data) throw new Error('Falha ao criar job');
      return { job_id: data.id };
    },
    {
      body: t.Object({
        athlete_id: t.String(),
        type: t.Union([
          t.Literal('plan_generate'),
          t.Literal('plan_replan'),
          t.Literal('feedback_generate'),
        ]),
        payload: t.Record(t.String(), t.Unknown()),
      }),
    },
  );

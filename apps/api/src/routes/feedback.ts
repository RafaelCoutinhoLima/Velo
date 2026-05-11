import { Elysia, t } from 'elysia';
import { supabase } from '../db/client';
import { logger } from '../lib/logger';

export const feedbackRoutes = new Elysia({ prefix: '/feedback' }).get(
  '/',
  async ({ query }) => {
    const { athlete_id } = query;

    const { data, error } = await supabase
      .from('feedback')
      .select('id, workout_id, feedback_md, created_at')
      .eq('athlete_id', athlete_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error('Falha ao buscar feedbacks');
    return { feedbacks: data };
  },
  { query: t.Object({ athlete_id: t.String() }) },
);

import { Elysia, t } from 'elysia';
import { supabase } from '../db/client';
import { logger } from '../lib/logger';

export const authRoutes = new Elysia({ prefix: '/auth' }).post(
  '/callback',
  async ({ body }) => {
    const { code } = body;
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn({ err: error }, 'OAuth callback falhou');
      throw new Error('Falha na autenticação');
    }
    return { athlete_id: data.user?.id };
  },
  {
    body: t.Object({ code: t.String() }),
  },
);

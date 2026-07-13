import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { AppError, mapErrorResponse } from './lib/errors';
import { logger } from './lib/logger';
import { athleteRoutes } from './routes/athlete';
import { authRoutes } from './routes/auth';
import { feedbackRoutes } from './routes/feedback';
import { garminRoutes } from './routes/garmin';
import { jobRoutes } from './routes/jobs';
import { onboardingRoutes } from './routes/onboarding';
import { planRoutes } from './routes/plan';
import { pushRoutes } from './routes/push';
import { workoutRoutes } from './routes/workouts';

// Validação de env no boot — um caractere errado na key não dá erro visível:
// a geração cai 3× em 401 e devolve o plano fallback silenciosamente.
const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';
if (!/^sk-ant-[A-Za-z0-9_-]{24,}$/.test(anthropicKey)) {
  logger.error(
    { keyPrefix: anthropicKey.slice(0, 10) || '(vazia)' },
    'ANTHROPIC_API_KEY ausente ou com formato inválido (esperado sk-ant-…) — toda geração de plano vai cair no fallback determinístico',
  );
}
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[name]) {
    logger.error({ env: name }, 'Variável de ambiente obrigatória ausente');
  }
}
if (!process.env.CRON_SECRET) {
  logger.warn(
    'CRON_SECRET ausente — POST /push/rpe-reminders vai rejeitar todas as chamadas (401)',
  );
}
if (!process.env.SIDECAR_SECRET) {
  logger.warn(
    'SIDECAR_SECRET ausente — chamadas ao sidecar Garmin irão sem o segredo compartilhado',
  );
}

const isProd = process.env.NODE_ENV === 'production';

// CORS travado: a auth é por Bearer token (não cookie), então credentials fica
// desligado — isso remove o combo perigoso "origin refletido + credentials".
// Origens explícitas via CORS_ORIGINS (lista separada por vírgula) em produção.
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = new Elysia()
  .use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : !isProd,
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  )
  // Swagger só fora de produção — não expõe o schema completo da API em prod.
  .use(isProd ? new Elysia() : swagger({ path: '/docs' }))
  .get('/health', () => ({ status: 'ok', ts: new Date().toISOString() }))
  .use(authRoutes)
  .use(onboardingRoutes)
  .use(garminRoutes)
  .use(planRoutes)
  .use(workoutRoutes)
  .use(jobRoutes)
  .use(feedbackRoutes)
  .use(pushRoutes)
  .use(athleteRoutes)
  .onError(({ error, code, set }) => {
    // Nunca devolve error.message cru ao cliente (nem em dev) — mensagens do
    // Postgres/Garmin/stack viravam reconhecimento pra atacante. A única
    // exceção é AppError: mensagem curada por construção (lib/errors.ts), que
    // é fluxo operacional esperado (warn), não erro não tratado (error).
    if (error instanceof AppError) {
      logger.warn({ code, status: error.status, err: error }, 'Erro de domínio');
    } else {
      logger.error({ code, err: error }, 'Unhandled error');
    }
    const { status, body } = mapErrorResponse(code, error);
    set.status = status;
    return body;
  })
  .listen(process.env.PORT ?? 3000);

logger.info(`API rodando em http://localhost:${app.server?.port}`);

export type App = typeof app;

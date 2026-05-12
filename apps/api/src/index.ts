import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { logger } from './lib/logger';
import { authRoutes } from './routes/auth';
import { feedbackRoutes } from './routes/feedback';
import { garminRoutes } from './routes/garmin';
import { jobRoutes } from './routes/jobs';
import { onboardingRoutes } from './routes/onboarding';
import { planRoutes } from './routes/plan';
import { workoutRoutes } from './routes/workouts';

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .get('/health', () => ({ status: 'ok', ts: new Date().toISOString() }))
  .use(authRoutes)
  .use(onboardingRoutes)
  .use(garminRoutes)
  .use(planRoutes)
  .use(workoutRoutes)
  .use(jobRoutes)
  .use(feedbackRoutes)
  .onError(({ error, code }) => {
    logger.error({ code, err: error }, 'Unhandled error');
    return { error: 'Tive um problema técnico, já avisamos a equipe.' };
  })
  .listen(process.env.PORT ?? 3000);

logger.info(`API rodando em http://localhost:${app.server?.port}`);

export type App = typeof app;

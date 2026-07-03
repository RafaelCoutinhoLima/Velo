import Anthropic from '@anthropic-ai/sdk';
import { ZodError } from 'zod';
import { supabase } from '../db/client';
import { logger } from '../lib/logger';
import { buildBriefing } from './briefing';
import { applyGuardrails } from './guardrails';
import { extractJsonWithFallback } from './parseResponse';
import { FEEDBACK_PROMPT_V1 } from './prompts/feedback_v1';
import { PLAN_PROMPT_V4, PLAN_PROMPT_VERSION } from './prompts/plan_v4';
import {
  type FeedbackInput,
  type FeedbackOutput,
  FeedbackOutputSchema,
  type PlanResponse,
  PlanResponseSchema,
} from './schemas';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CLAUDE_HARD_CAP = 30;
// Custo por token via env (default Sonnet 4.6: $3/MTok input, $15/MTok output).
// Extraído para env porque o preço muda ao migrar de modelo — ver .env.example.
const COST_INPUT_PER_TOKEN = Number(process.env.CLAUDE_COST_INPUT_PER_MTOK ?? 3) / 1_000_000;
const COST_OUTPUT_PER_TOKEN = Number(process.env.CLAUDE_COST_OUTPUT_PER_MTOK ?? 15) / 1_000_000;

export interface PlanInput {
  athleteId: string;
  profile: Record<string, unknown>;
  recentWorkouts: Record<string, unknown>[];
  metrics: Record<string, unknown> | null;
  metricsHistory: Record<string, unknown>[];
  calibrationMode: boolean;
  firstWorkoutDate?: string;
}

export interface PlanResult {
  plan: PlanResponse;
  tokensUsed: { input: number; output: number };
  costUsd: number;
  inputJson: Record<string, unknown>;
  promptVersion: string;
  usedFallback: boolean;
}

export async function generatePlan(input: PlanInput): Promise<PlanResult> {
  // Reserva atômica ANTES de gastar tokens: increment_claude_usage devolve o
  // novo contador do mês; se passar do teto, rejeita sem chamar o Claude.
  // Corrige o TOCTOU do antigo check-then-act (duas gerações concorrentes liam
  // 29 e ambas passavam).
  await reserveUsageOrThrow(input.athleteId);

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const briefing = buildBriefing(input, lastError);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: PLAN_PROMPT_V4,
        messages: [{ role: 'user', content: JSON.stringify(briefing, null, 2) }],
      });

      const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonStr = extractJsonWithFallback(rawText);

      const parsed = PlanResponseSchema.parse(JSON.parse(jsonStr));

      const ctx = {
        atl: Number(input.metrics?.atl ?? 0),
        ctl: Number(input.metrics?.ctl ?? 0),
        calibrationMode: input.calibrationMode,
        weeksToRace: input.profile.race_date
          ? Math.round(
              (new Date(String(input.profile.race_date)).getTime() - Date.now()) / (7 * 86400000),
            )
          : null,
      };
      const guarded = applyGuardrails(parsed, input.athleteId, ctx);

      const tokensUsed = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      };
      const costUsd =
        tokensUsed.input * COST_INPUT_PER_TOKEN + tokensUsed.output * COST_OUTPUT_PER_TOKEN;

      return {
        plan: guarded,
        tokensUsed,
        costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
        inputJson: briefing,
        promptVersion: PLAN_PROMPT_VERSION,
        usedFallback: false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // ZodError: logar os issues (campo exato que falhou), não só a mensagem genérica.
      if (err instanceof ZodError) {
        logger.warn(
          { attempt, athleteId: input.athleteId, issues: err.issues },
          'Tentativa de geração falhou — schema Zod rejeitou a resposta do Claude',
        );
      } else {
        logger.warn(
          { attempt, athleteId: input.athleteId, error: lastError },
          'Tentativa de geração falhou',
        );
      }
      if (attempt === 3) break;
    }
  }

  logger.error(
    { athleteId: input.athleteId, lastError },
    'Usando fallback determinístico após 3 falhas',
  );
  // Torna o evento consultável via SQL (não há Sentry na Fase 1). Reaproveita a tabela
  // guardrail_violations existente — não cria tabela nova (CLAUDE.md §5.5).
  logFallbackViolation(input.athleteId);
  const fallback = buildFallbackPlan(input);
  return {
    plan: fallback,
    tokensUsed: { input: 0, output: 0 },
    costUsd: 0,
    inputJson: buildBriefing(input),
    promptVersion: `${PLAN_PROMPT_VERSION}_fallback`,
    usedFallback: true,
  };
}

export async function generateFeedback(feedbackInput: FeedbackInput): Promise<FeedbackOutput> {
  // Mesma cota mensal das gerações de plano — antes o feedback chamava o Claude
  // sem NENHUM teto (DoS de custo). Feedback em cache nem chega aqui.
  await reserveUsageOrThrow(feedbackInput.athlete_id);

  const userMessage = JSON.stringify(feedbackInput, null, 2);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: FEEDBACK_PROMPT_V1,
        messages: [{ role: 'user', content: userMessage }],
      });

      const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonStr = extractJsonWithFallback(rawText);

      return FeedbackOutputSchema.parse(JSON.parse(jsonStr));
    } catch (err) {
      logger.warn({ attempt, error: String(err) }, 'Tentativa de geração de feedback falhou');
      if (attempt === 2) throw err;
    }
  }

  throw new Error('Geração de feedback falhou');
}

// Karvonen p/ Z2 (60-70% FCR) — generation_spec §1; defaults seguros se faltar FC
function fallbackZ2Bpm(profile: Record<string, unknown>): { min: number; max: number } {
  const fcMax = Number(profile.fc_max ?? 0);
  const fcRest = Number(profile.fc_rest ?? 0);
  if (fcMax > 100 && fcRest >= 30 && fcRest < fcMax) {
    const reserve = fcMax - fcRest;
    return {
      min: Math.round(fcRest + 0.6 * reserve),
      max: Math.round(fcRest + 0.7 * reserve),
    };
  }
  return { min: 120, max: 145 };
}

function buildFallbackPlan(input: PlanInput): PlanResponse {
  const freq = String(input.profile.weekly_frequency ?? '3-5');
  const daysPerWeek = freq.includes('5') ? 5 : freq.includes('3') ? 4 : 3;
  const z2 = fallbackZ2Bpm(input.profile);

  const days = Array.from({ length: 7 }, (_, i) => {
    const dayNum = i + 1;
    const isRunDay = dayNum <= daysPerWeek;
    const durationMin = isRunDay ? (dayNum === 3 ? 60 : 40) : 0;
    return {
      day: dayNum,
      type: (isRunDay ? (dayNum === 3 ? 'long' : 'easy') : 'rest') as 'easy' | 'long' | 'rest',
      duration_min: durationMin,
      distance_km: isRunDay ? (dayNum === 3 ? 8 : 5) : 0,
      zones: isRunDay ? [2] : [],
      description: isRunDay
        ? 'Corrida leve em zona 2. Mantenha uma conversa confortável durante todo o treino. Foque na consistência.'
        : 'Dia de descanso — recuperação é parte do treinamento.',
      garmin_steps: [],
      ...(isRunDay
        ? {
            rtss_estimado: Math.round(durationMin * 1.2),
            aquecimento: { duracao_min: 8, zona: 'Z1' as const },
            parte_principal: {
              descricao: 'Corrida contínua confortável em ritmo conversável',
              zona_alvo: 'Z2' as const,
              fc_alvo_bpm: z2,
            },
            desaquecimento: { duracao_min: 5, zona: 'Z1' as const },
          }
        : { rtss_estimado: 0 }),
    };
  });

  return {
    weeks: [
      {
        week_number: 1,
        total_km: days.reduce((s, d) => s + d.distance_km, 0),
        why_text:
          'Semana de início conservador. Estamos calibrando seu treinamento com segurança enquanto o sistema aprende seu perfil.',
        days,
      },
    ],
    summary:
      'Plano inicial de base aeróbica. Foco em consistência e construção de hábito de treino.',
  };
}

// Reserva 1 chamada na cota mensal de forma ATÔMICA e rejeita se ultrapassar o
// teto. increment_claude_usage (migração 007) faz o upsert e devolve o novo
// call_count numa única operação — sob concorrência, cada request recebe um
// número distinto, então no máximo CLAUDE_HARD_CAP chamadas passam por mês.
async function reserveUsageOrThrow(athleteId: string): Promise<void> {
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  const { data, error } = await supabase.rpc('increment_claude_usage', {
    p_athlete_id: athleteId,
    p_month: month,
  });

  if (error) {
    // Erro de infra ao reservar: não bloqueia o usuário legítimo (fail-open só
    // aqui). A janela de bypass por concorrência — o achado real — segue fechada
    // pela atomicidade quando o banco responde.
    logger.error({ error, athleteId }, 'Falha ao reservar cota Claude');
    return;
  }

  const count = typeof data === 'number' ? data : Number(data ?? 0);
  if (count > CLAUDE_HARD_CAP) {
    throw new Error(`Limite de ${CLAUDE_HARD_CAP} gerações por mês atingido`);
  }
}

// Registra o fallback determinístico em guardrail_violations (fire-and-forget) para o
// evento ficar consultável via SQL. value = tentativas consumidas (3), threshold = 0.
function logFallbackViolation(athleteId: string): void {
  supabase
    .from('guardrail_violations')
    .insert({ athlete_id: athleteId, rule: 'plan_generation_fallback', value: 3, threshold: 0 })
    .then(({ error }) => {
      if (error) logger.error({ error }, 'Falha ao logar violação de fallback de geração');
    });
}

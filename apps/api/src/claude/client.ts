import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../db/client';
import { logger } from '../lib/logger';
import { applyGuardrails } from './guardrails';
import { PLAN_PROMPT_V1 } from './prompts/plan_v1';
import { type PlanResponse, PlanResponseSchema } from './schemas';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CLAUDE_HARD_CAP = 30;

export interface PlanInput {
  athleteId: string;
  profile: Record<string, unknown>;
  recentWorkouts: Record<string, unknown>[];
  metrics: Record<string, unknown>;
  calibrationMode: boolean;
}

export async function generatePlan(input: PlanInput): Promise<PlanResponse> {
  await assertUnderCap(input.athleteId);

  const userMessage = JSON.stringify(input, null, 2);

  for (let attempt = 1; attempt <= 3; attempt++) {
    let rawText = '';
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: PLAN_PROMPT_V1,
        messages: [{ role: 'user', content: userMessage }],
      });

      rawText = response.content[0].type === 'text' ? response.content[0].text : '';

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Nenhum JSON encontrado na resposta');

      const parsed = PlanResponseSchema.parse(JSON.parse(jsonMatch[0]));
      const guarded = applyGuardrails(parsed, input.athleteId);

      await incrementUsage(input.athleteId);
      return guarded;
    } catch (err) {
      logger.warn({ attempt, err }, 'Tentativa de geração de plano falhou');
      if (attempt === 3) throw err;
    }
  }

  throw new Error('Geração de plano falhou após 3 tentativas');
}

async function assertUnderCap(athleteId: string): Promise<void> {
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  const { data } = await supabase
    .from('claude_usage')
    .select('call_count')
    .eq('athlete_id', athleteId)
    .eq('month', month)
    .single();

  if (data && data.call_count >= CLAUDE_HARD_CAP) {
    throw new Error(`Limite de ${CLAUDE_HARD_CAP} planos por mês atingido`);
  }
}

async function incrementUsage(athleteId: string): Promise<void> {
  const month = `${new Date().toISOString().slice(0, 7)}-01`;
  await supabase.rpc('increment_claude_usage', { p_athlete_id: athleteId, p_month: month });
}

import { supabase } from '../db/client';
import { logger } from '../lib/logger';
import type { PlanResponse, PlanWeek } from './schemas';

const ACWR_MAX = 1.3;
const WEEKLY_PROGRESSION_MAX = 0.1;

export function applyGuardrails(plan: PlanResponse, athleteId: string): PlanResponse {
  for (const week of plan.weeks) {
    checkConsecutiveHighIntensity(week, athleteId);
  }
  checkWeeklyProgression(plan, athleteId);
  return plan;
}

function checkConsecutiveHighIntensity(week: PlanWeek, athleteId: string): void {
  const highIntensityTypes = new Set(['interval', 'tempo']);
  const days = week.days;

  for (let i = 0; i < days.length - 1; i++) {
    const today = days[i];
    const tomorrow = days[i + 1];
    if (highIntensityTypes.has(today.type) && highIntensityTypes.has(tomorrow.type)) {
      logger.warn(
        { athleteId, week: week.week_number, day: i + 1 },
        'Guardrail: dois estímulos altos consecutivos detectados',
      );
      logViolation(athleteId, 'consecutive_high_intensity', i + 1, 1);
      // Converte o segundo dia para easy
      tomorrow.type = 'easy';
      tomorrow.description = `[Ajustado automaticamente] ${tomorrow.description}`;
    }
  }
}

function checkWeeklyProgression(plan: PlanResponse, athleteId: string): void {
  let prevKm = 0;
  for (const week of plan.weeks) {
    if (prevKm > 0) {
      const progression = (week.total_km - prevKm) / prevKm;
      if (progression > WEEKLY_PROGRESSION_MAX) {
        logger.warn(
          { athleteId, week: week.week_number, progression },
          'Guardrail: progressão semanal excede 10%',
        );
        logViolation(athleteId, 'weekly_progression', progression, WEEKLY_PROGRESSION_MAX);
        week.total_km = prevKm * (1 + WEEKLY_PROGRESSION_MAX);
      }
    }
    prevKm = week.total_km;
  }
}

function logViolation(athleteId: string, rule: string, value: number, threshold: number): void {
  supabase
    .from('guardrail_violations')
    .insert({ athlete_id: athleteId, rule, value, threshold })
    .then(({ error }) => {
      if (error) logger.error({ error }, 'Falha ao logar violação de guardrail');
    });
}

export { ACWR_MAX };

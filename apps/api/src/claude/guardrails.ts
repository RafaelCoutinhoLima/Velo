import { supabase } from '../db/client';
import { logger } from '../lib/logger';
import type { PlanResponse, PlanWeek } from './schemas';

export const ACWR_MAX = 1.3;
const WEEKLY_PROGRESSION_MAX = 0.1;
const HIGH_INTENSITY_TYPES = new Set(['interval', 'tempo']);
const CALIBRATION_ALLOWED_TYPES = new Set(['easy', 'long', 'rest', 'cross']);
const RTSS_PER_MIN_EASY = 1.2; // rough: 72 rTSS/hour for easy
const RTSS_PER_MIN_HARD = 2.2; // rough: 132 rTSS/hour for intervals

export interface GuardrailContext {
  atl: number;
  ctl: number;
  calibrationMode: boolean;
  weeksToRace?: number | null;
}

export function applyGuardrails(
  plan: PlanResponse,
  athleteId: string,
  ctx: GuardrailContext,
): PlanResponse {
  for (const week of plan.weeks) {
    if (ctx.calibrationMode) enforceCalibrationMode(week, athleteId);
    checkConsecutiveHighIntensity(week, athleteId);
    checkZ3Overuse(week, athleteId);
    checkDescriptionQuality(week, athleteId);
    checkRtssPerSession(week, athleteId);
    if (ctx.weeksToRace != null && ctx.weeksToRace <= 2) {
      checkTaperLongRun(week, athleteId);
    }
  }

  checkWeeklyProgression(plan, athleteId);
  checkAcwrProjected(plan, athleteId, ctx);
  checkDeloadPattern(plan, athleteId);

  return plan;
}

// G2 — Calibração: apenas Z1/Z2
function enforceCalibrationMode(week: PlanWeek, athleteId: string): void {
  for (const day of week.days) {
    if (!CALIBRATION_ALLOWED_TYPES.has(day.type)) {
      logger.warn(
        { athleteId, week: week.week_number, originalType: day.type },
        'G2: sessão de alta intensidade bloqueada em modo calibração',
      );
      logViolation(athleteId, 'calibration_high_intensity', 1, 0);
      day.type = 'easy';
      day.zones = [2];
      day.description = `[Modo calibração] ${day.description}`;
    }
  }
}

// G3 — Dois estímulos altos consecutivos
function checkConsecutiveHighIntensity(week: PlanWeek, athleteId: string): void {
  const days = week.days;
  for (let i = 0; i < days.length - 1; i++) {
    const today = days[i];
    const tomorrow = days[i + 1];
    if (HIGH_INTENSITY_TYPES.has(today.type) && HIGH_INTENSITY_TYPES.has(tomorrow.type)) {
      logger.warn(
        { athleteId, week: week.week_number, day: i + 1 },
        'G3: dois estímulos altos consecutivos detectados',
      );
      logViolation(athleteId, 'consecutive_high_intensity', i + 1, 1);
      tomorrow.type = 'easy';
      tomorrow.zones = [1];
      tomorrow.description = `[Ajustado automaticamente — recuperação necessária] ${tomorrow.description}`;
    }
  }
}

// G4 — Z3 como zona isolada (buraco negro)
function checkZ3Overuse(week: PlanWeek, athleteId: string): void {
  const tempoCount = week.days.filter((d) => d.type === 'tempo').length;
  const totalQuality = week.days.filter((d) => !['rest', 'cross'].includes(d.type)).length;
  if (totalQuality > 0 && tempoCount / totalQuality > 0.4) {
    logger.warn(
      { athleteId, week: week.week_number, tempoCount, totalQuality },
      'G4: Z3 (tempo) acima de 40% das sessões de qualidade',
    );
    logViolation(athleteId, 'z3_overuse', tempoCount / totalQuality, 0.4);
  }
}

// G5 — Progressão semanal ≤ 10%
function checkWeeklyProgression(plan: PlanResponse, athleteId: string): void {
  let prevKm = 0;
  for (const week of plan.weeks) {
    if (prevKm > 0) {
      const progression = (week.total_km - prevKm) / prevKm;
      if (progression > WEEKLY_PROGRESSION_MAX) {
        logger.warn(
          { athleteId, week: week.week_number, progression },
          'G5: progressão semanal excede 10%',
        );
        logViolation(athleteId, 'weekly_progression', progression, WEEKLY_PROGRESSION_MAX);
        week.total_km = Math.round(prevKm * (1 + WEEKLY_PROGRESSION_MAX) * 10) / 10;
      }
    }
    prevKm = week.total_km;
  }
}

// G6 — Long run > 90 min nas últimas 2 semanas de taper
function checkTaperLongRun(week: PlanWeek, athleteId: string): void {
  for (const day of week.days) {
    if (day.type === 'long' && day.duration_min > 90) {
      logger.warn(
        { athleteId, week: week.week_number, duration: day.duration_min },
        'G6: long run > 90 min em semana de taper',
      );
      logViolation(athleteId, 'taper_long_run', day.duration_min, 90);
      day.duration_min = 90;
      day.distance_km = Math.round(day.distance_km * 0.85 * 10) / 10;
      day.description = `[Ajustado para taper] ${day.description}`;
    }
  }
}

// G1 — ACWR projetado
function checkAcwrProjected(plan: PlanResponse, athleteId: string, ctx: GuardrailContext): void {
  if (ctx.ctl <= 0) return;

  const week1 = plan.weeks[0];
  if (!week1) return;

  const estimatedRtss = week1.days.reduce((sum, d) => {
    const rpm = HIGH_INTENSITY_TYPES.has(d.type) ? RTSS_PER_MIN_HARD : RTSS_PER_MIN_EASY;
    return sum + d.duration_min * rpm;
  }, 0);

  const projectedAtl = (ctx.atl * 6 + estimatedRtss / 7) / 7;
  const projectedAcwr = projectedAtl / ctx.ctl;

  if (projectedAcwr > ACWR_MAX) {
    logger.warn(
      { athleteId, projectedAcwr, ctl: ctx.ctl, estimatedRtss },
      'G1: ACWR projetado excede 1.30 — reduzindo volume da semana 1',
    );
    logViolation(athleteId, 'acwr_projected', projectedAcwr, ACWR_MAX);

    const scaleFactor = ACWR_MAX / projectedAcwr;
    for (const day of week1.days) {
      if (!['rest', 'cross'].includes(day.type)) {
        day.duration_min = Math.max(20, Math.round(day.duration_min * scaleFactor));
        day.distance_km = Math.round(day.distance_km * scaleFactor * 10) / 10;
      }
    }
    week1.total_km = Math.round(week1.total_km * scaleFactor * 10) / 10;
  }
}

// G7 — Padrão 3+1: verificar se há semana de deload a cada 4 semanas
function checkDeloadPattern(plan: PlanResponse, athleteId: string): void {
  if (plan.weeks.length < 4) return;

  let consecProgressive = 0;
  let prevKm = 0;
  for (const week of plan.weeks) {
    if (week.total_km >= prevKm && prevKm > 0) {
      consecProgressive++;
      if (consecProgressive >= 4) {
        logger.warn(
          { athleteId, week: week.week_number },
          'G7: 4+ semanas progressivas sem deload detectado',
        );
        logViolation(athleteId, 'missing_deload', consecProgressive, 4);
      }
    } else {
      consecProgressive = 0;
    }
    prevKm = week.total_km;
  }
}

// G8/G9 — Qualidade das descrições
function checkDescriptionQuality(week: PlanWeek, athleteId: string): void {
  for (const day of week.days) {
    if (day.type === 'rest') continue;
    if (day.description.length < 50) {
      logger.warn(
        { athleteId, week: week.week_number, day: day.day, len: day.description.length },
        'G9: descrição muito curta',
      );
      logViolation(athleteId, 'short_description', day.description.length, 50);
    }
    if (
      HIGH_INTENSITY_TYPES.has(day.type) &&
      !/(\d+\s*bpm|\d+:\d+\/km|Z[45]|FC|pace)/i.test(day.description)
    ) {
      logger.warn(
        { athleteId, week: week.week_number, day: day.day },
        'G8: sessão de alta intensidade sem alvo de FC/pace na descrição',
      );
      logViolation(athleteId, 'missing_intensity_target', 1, 0);
    }
  }
}

// G10 — rTSS por sessão absurdamente alto
function checkRtssPerSession(week: PlanWeek, athleteId: string): void {
  for (const day of week.days) {
    const rpm = HIGH_INTENSITY_TYPES.has(day.type) ? RTSS_PER_MIN_HARD : RTSS_PER_MIN_EASY;
    const estimatedRtss = day.duration_min * rpm;
    if (estimatedRtss > 200) {
      logger.warn(
        { athleteId, week: week.week_number, day: day.day, estimatedRtss },
        'G10: rTSS estimado > 200 em sessão única',
      );
      logViolation(athleteId, 'rtss_too_high', estimatedRtss, 200);
      day.duration_min = Math.round(200 / rpm);
      day.distance_km = Math.round(day.distance_km * 0.8 * 10) / 10;
      day.description = `[Duração ajustada para segurança] ${day.description}`;
    }
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

export { WEEKLY_PROGRESSION_MAX };

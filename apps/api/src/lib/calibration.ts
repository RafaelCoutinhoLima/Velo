import type { supabase as defaultSupabase } from '../db/client';
import { logger } from './logger';
import { sendExpoPush } from './push';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

// US-017 / RF-030 — Modo calibração nas 2 primeiras semanas.
//
// Critério de aceite:
//  - calibration_mode = true por padrão enquanto days_with_data < 30
//    OU o atleta ainda está nas primeiras 2 semanas de app.
//  - Após 14 dias (desde created_at) E com ≥30 dias de dados, vira false
//    automaticamente ("calibração concluída").
//
// Regra de saída = `daysSinceCreated >= 14 && distinctWorkoutDays >= 30`.
// Enquanto qualquer das duas condições não fechou, segue em calibração.
const MIN_DAYS_IN_APP = 14;
const MIN_DAYS_WITH_DATA = 30;

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso);
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

interface AthleteCalibrationRow {
  calibration_mode?: boolean;
  created_at?: string;
}

/**
 * Avalia (e persiste, de forma idempotente) o estado de calibração do atleta.
 *
 * Chamável de qualquer ponto que já tenha contexto do atleta (sync Garmin,
 * geração de plano, leitura de /plan/current). Se a regra de saída fechou e o
 * atleta ainda estava em calibração, faz o update no banco e loga a conclusão
 * (sem PII — só athlete_id UUID).
 *
 * @param distinctWorkoutDays passe se já tiver contado (evita query extra)
 * @param athleteRow passe se já tiver o row carregado (evita query extra)
 */
export async function evaluateCalibration(
  db: Db,
  athleteInternalId: string,
  opts: { athleteRow?: AthleteCalibrationRow; distinctWorkoutDays?: number } = {},
): Promise<{ calibrationMode: boolean; justExited: boolean }> {
  let row = opts.athleteRow;
  if (row?.calibration_mode === undefined || row.created_at === undefined) {
    const { data } = await db
      .from('athletes')
      .select('calibration_mode, created_at')
      .eq('id', athleteInternalId)
      .single();
    row = (data as AthleteCalibrationRow | null) ?? {};
  }

  // Já fora de calibração → nada a fazer (idempotente, sem custo de query).
  if (row.calibration_mode === false) return { calibrationMode: false, justExited: false };
  if (!row.created_at) return { calibrationMode: true, justExited: false };

  const daysSinceCreated = daysBetween(row.created_at, new Date());

  let distinctWorkoutDays = opts.distinctWorkoutDays;
  if (distinctWorkoutDays === undefined) {
    const { data: workouts } = await db
      .from('workouts')
      .select('date')
      .eq('athlete_id', athleteInternalId);
    distinctWorkoutDays = new Set(((workouts ?? []) as { date: string }[]).map((w) => w.date)).size;
  }

  const shouldExit =
    daysSinceCreated >= MIN_DAYS_IN_APP && distinctWorkoutDays >= MIN_DAYS_WITH_DATA;

  if (!shouldExit) return { calibrationMode: true, justExited: false };

  await db.from('athletes').update({ calibration_mode: false }).eq('id', athleteInternalId);
  logger.info(
    { athlete_id: athleteInternalId, daysSinceCreated, distinctWorkoutDays },
    'Modo calibração concluído',
  );

  // US-017: notificação "Calibração concluída" (US-015 entrega o canal push).
  // Evento raro (1x na vida do atleta) → 1 query extra do token é ok.
  // Fire-and-forget: sendExpoPush nunca lança.
  const { data: tokenRow } = await db
    .from('athletes')
    .select('push_token')
    .eq('id', athleteInternalId)
    .single();
  await sendExpoPush(
    (tokenRow as { push_token?: string } | null)?.push_token,
    'Calibração concluída 🎉',
    'Já conhecemos seu condicionamento — seu plano agora progride normalmente.',
    { type: 'calibration_done' },
  );

  return { calibrationMode: false, justExited: true };
}

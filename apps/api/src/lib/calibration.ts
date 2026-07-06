import type { supabase as defaultSupabase } from '../db/client';
import { logger } from './logger';
import { sendExpoPush } from './push';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

// US-017 / RF-030 — Modo calibração nas 2 primeiras semanas.
//
// Critério de aceite (decisão do dono, 2026-05-17: histórico Garmin
// importado CONTA para a janela de 14 dias — quem chega com histórico
// não precisa esperar 14 dias de conta nova):
//  - A "janela de observação" é contada a partir do sinal mais antigo
//    disponível: o treino mais antigo importado OU a criação da conta,
//    o que for mais antigo. Sem histórico → cai na criação da conta.
//  - Após ≥14 dias dessa janela E com ≥30 dias distintos de dados, vira
//    false automaticamente ("calibração concluída").
//
// Regra de saída = `daysObserved >= 14 && distinctWorkoutDays >= 30`.
// Enquanto qualquer das duas condições não fechou, segue em calibração.
const MIN_DAYS_IN_APP = 14;
const MIN_DAYS_WITH_DATA = 30;

// Menor (mais antiga) entre duas datas ISO; ignora undefined.
function earliestIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

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
 * @param earliestWorkoutDate treino mais antigo, p/ a janela contar histórico
 * @param athleteRow passe se já tiver o row carregado (evita query extra)
 */
export async function evaluateCalibration(
  db: Db,
  athleteInternalId: string,
  opts: {
    athleteRow?: AthleteCalibrationRow;
    distinctWorkoutDays?: number;
    earliestWorkoutDate?: string;
  } = {},
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

  // Precisamos do nº de dias distintos E da data do treino mais antigo
  // (para a janela contar o histórico importado). Uma query só serve aos
  // dois — buscamos se algum não veio pronto do caller.
  let distinctWorkoutDays = opts.distinctWorkoutDays;
  let earliestWorkoutDate = opts.earliestWorkoutDate;
  if (distinctWorkoutDays === undefined || earliestWorkoutDate === undefined) {
    // 1 round-trip agregado (migração 009) em vez de ler TODAS as datas —
    // essa avaliação roda em cada abertura da home durante a calibração e o
    // scan crescia sem teto com o histórico importado.
    const { data: stats } = await db.rpc('workout_calibration_stats', {
      p_athlete_id: athleteInternalId,
    });
    const row = (Array.isArray(stats) ? stats[0] : stats) as
      | { distinct_days?: number; earliest_date?: string | null }
      | null
      | undefined;

    if (row && typeof row.distinct_days === 'number') {
      if (distinctWorkoutDays === undefined) distinctWorkoutDays = row.distinct_days;
      if (earliestWorkoutDate === undefined) earliestWorkoutDate = row.earliest_date ?? undefined;
    } else {
      // Função ausente (migração não aplicada / mock de teste) → scan antigo.
      const { data: workouts } = await db
        .from('workouts')
        .select('date')
        .eq('athlete_id', athleteInternalId);
      const dates = ((workouts ?? []) as { date: string }[]).map((w) => w.date).filter(Boolean);
      if (distinctWorkoutDays === undefined) distinctWorkoutDays = new Set(dates).size;
      if (earliestWorkoutDate === undefined) {
        earliestWorkoutDate = dates.length
          ? dates.reduce((a, b) => (new Date(a).getTime() <= new Date(b).getTime() ? a : b))
          : undefined;
      }
    }
  }

  // Janela de observação: do sinal mais antigo (histórico OU conta) até hoje.
  const referenceStart = earliestIso(row.created_at, earliestWorkoutDate);
  if (!referenceStart) return { calibrationMode: true, justExited: false };

  const daysObserved = daysBetween(referenceStart, new Date());

  const shouldExit = daysObserved >= MIN_DAYS_IN_APP && distinctWorkoutDays >= MIN_DAYS_WITH_DATA;

  if (!shouldExit) return { calibrationMode: true, justExited: false };

  await db.from('athletes').update({ calibration_mode: false }).eq('id', athleteInternalId);
  logger.info(
    { athlete_id: athleteInternalId, daysObserved, distinctWorkoutDays },
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

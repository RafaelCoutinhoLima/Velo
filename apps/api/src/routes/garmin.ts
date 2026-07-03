import {
  calculateACWR,
  calculateATL,
  calculateCTL,
  calculateRTSS,
  calculateTrimp,
  calculateTSB,
} from '@fitsync/metrics';
import { Elysia, t } from 'elysia';
import { supabase as defaultSupabase } from '../db/client';
import { classifySport } from '../garmin/sport';
import { authGuard, type TokenVerifier, verifySupabaseToken } from '../lib/auth';
import { evaluateCalibration } from '../lib/calibration';
import { logger } from '../lib/logger';

type Db = Pick<typeof defaultSupabase, 'from' | 'rpc'>;

const SIDECAR_URL = process.env.GARMIN_SIDECAR_URL ?? 'http://localhost:8001';
// Segredo compartilhado API↔sidecar. O sidecar rejeita chamadas sem ele, de
// modo que a porta interna não fica operável por qualquer processo na rede.
const SIDECAR_SECRET = process.env.SIDECAR_SECRET ?? '';
const DEFAULT_FTP_PACE_S = 330; // 5:30/km — fallback para atletas sem histórico

function sidecarHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'x-sidecar-secret': SIDECAR_SECRET, ...extra };
}

export function createGarminPlugin(
  db: Db = defaultSupabase,
  verify: TokenVerifier = verifySupabaseToken,
) {
  return new Elysia({ prefix: '/garmin' })
    .use(authGuard(verify))
    .post(
      '/connect',
      async ({ userId, body }) => {
        const { email, password, mfa_code } = body;

        const { data: athlete, error: athleteErr } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (athleteErr || !athlete) throw new Error('Atleta não encontrado');

        const sidecarRes = await fetch(`${SIDECAR_URL}/auth`, {
          method: 'POST',
          headers: sidecarHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ email, password, mfa_code }),
        });

        if (!sidecarRes.ok) {
          // Detalhe do sidecar (que pode ecoar motivo de auth Garmin / e-mail)
          // fica só no log do servidor; ao cliente vai mensagem genérica.
          const err = (await sidecarRes.json().catch(() => ({}))) as { detail?: string };
          logger.warn({ status: sidecarRes.status, detail: err.detail }, 'Sidecar auth falhou');
          throw new Error('Falha ao conectar com o Garmin. Verifique suas credenciais.');
        }

        const { session } = (await sidecarRes.json()) as { session: Record<string, unknown> };

        const { error: vaultErr } = await db.rpc('store_garmin_token', {
          p_athlete_id: (athlete as { id: string }).id,
          p_tokens: JSON.stringify(session),
        });

        if (vaultErr) {
          logger.error({ err: vaultErr }, 'Falha ao salvar token Garmin no Vault');
          throw new Error('Falha ao salvar credenciais Garmin');
        }

        logger.info({ athlete_id: (athlete as { id: string }).id }, 'Garmin conectado');
        return { ok: true };
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String({ minLength: 1 }),
          mfa_code: t.Optional(t.String()),
        }),
      },
    )
    .post(
      '/sync',
      async ({ userId, body }) => {
        const { days = 90 } = body;

        const { data: athlete, error: athleteErr } = await db
          .from('athletes')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (athleteErr || !athlete) throw new Error('Atleta não encontrado');

        const internalId = (athlete as { id: string }).id;

        const { data: tokenJson, error: vaultErr } = await db.rpc('get_garmin_token', {
          p_athlete_id: internalId,
        });

        if (vaultErr || !tokenJson) {
          throw new Error('Garmin não está conectado. Conecte o Garmin primeiro.');
        }

        const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        const sidecarRes = await fetch(`${SIDECAR_URL}/metrics?date=${since}&days=${days}`, {
          headers: sidecarHeaders({ 'x-garmin-token': tokenJson as string }),
        });

        if (!sidecarRes.ok) {
          logger.error(
            { status: sidecarRes.status, athlete_id: internalId },
            'Sidecar metrics falhou',
          );
          throw new Error('Não consegui sincronizar com o Garmin');
        }

        const { activities } = (await sidecarRes.json()) as {
          activities: Record<string, unknown>[];
        };

        let synced = 0;
        for (const act of activities) {
          // US-015 Camada 1: se o Garmin já trouxe RPE (perceivedEffort),
          // importa automaticamente. `rpe` só entra no payload quando há
          // valor válido 1–10 — assim um re-sync não sobrescreve um RPE
          // digitado pelo atleta com null (upsert só atualiza colunas
          // presentes no objeto em caso de conflito).
          const importedRpe = normalizeRpe(act.perceived_effort);
          const row: Record<string, unknown> = {
            athlete_id: internalId,
            garmin_id: act.garmin_id,
            date: act.date,
            distance_m: act.distance_m,
            duration_s: act.duration_s,
            avg_hr: act.avg_hr ?? null,
            // raw_payload guarda activityType.typeKey → esporte derivado na
            // leitura (sem coluna dedicada, sem migração de banco).
            raw_payload: act.raw,
            // rtss zerado força recálculo (fórmula depende do esporte)
            rtss: null,
          };
          if (importedRpe !== null) row.rpe = importedRpe;

          const { error } = await db
            .from('workouts')
            .upsert(row, { onConflict: 'athlete_id,garmin_id', ignoreDuplicates: false });
          if (!error) synced++;
        }

        if (synced > 0) {
          await computeAndSaveMetrics(internalId, db).catch((err) =>
            logger.error({ err, athlete_id: internalId }, 'Falha ao computar métricas'),
          );
        }

        logger.info({ athlete_id: internalId, synced }, 'Sync Garmin concluído');
        return { synced };
      },
      {
        body: t.Object({
          days: t.Optional(t.Number({ minimum: 1, maximum: 365 })),
        }),
      },
    );
}

export const garminRoutes = createGarminPlugin();

// ─── helpers ──────────────────────────────────────────────────────────────────

type WorkoutRow = {
  garmin_id: string;
  date: string;
  type_key: string | null; // raw_payload->activityType->>typeKey (derivamos o esporte daqui)
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  rtss: number | null;
};

type AthleteHr = { fc_max: number | null; fc_rest: number | null; sex: string | null };

// Carga de UM treino, escolhendo a fórmula pelo esporte/dados disponíveis:
//  - corrida com pace válido → rTSS (pace-based, mais preciso pra corrida)
//  - qualquer esporte com FC + zonas do atleta → TRIMP de Banister
//  - sem nada disso → estimativa por duração (1 carga/min, piso de segurança)
// Mantém a carga comparável entre esportes pra somar no ACWR/CTL/ATL.
function workoutLoad(w: WorkoutRow, ftpPace: number, hr: AthleteHr): number {
  const sport = classifySport(w.type_key);
  if (sport === 'run' && w.distance_m > 0 && w.duration_s > 0) {
    return calculateRTSS(
      {
        date: w.date,
        distance_m: w.distance_m,
        duration_s: w.duration_s,
        avg_hr: w.avg_hr ?? 0,
        max_hr: 0,
      },
      ftpPace,
    );
  }
  if (w.avg_hr && hr.fc_max && hr.fc_rest) {
    const sex = hr.sex === 'M' || hr.sex === 'F' ? hr.sex : 'other';
    return calculateTrimp(w.duration_s, w.avg_hr, hr.fc_rest, hr.fc_max, sex);
  }
  // Fallback grosseiro: 1 ponto de carga por minuto (melhor que ignorar).
  return Math.round((w.duration_s / 60) * 10) / 10;
}

async function computeAndSaveMetrics(athleteId: string, db: Db): Promise<void> {
  const { data: workouts } = (await db
    .from('workouts')
    .select(
      'garmin_id, date, distance_m, duration_s, avg_hr, rtss, type_key:raw_payload->activityType->>typeKey',
    )
    .eq('athlete_id', athleteId)
    .order('date', { ascending: true })
    .limit(90)) as { data: WorkoutRow[] | null };

  if (!workouts || workouts.length === 0) return;

  // Parâmetros de FC do atleta — necessários pro TRIMP dos não-corrida.
  const { data: athleteHr } = (await db
    .from('athletes')
    .select('fc_max, fc_rest, sex')
    .eq('id', athleteId)
    .single()) as { data: AthleteHr | null };
  const hr: AthleteHr = athleteHr ?? { fc_max: null, fc_rest: null, sex: null };

  // FTP pace estimado SÓ das corridas (pace de bike/natação não faz sentido).
  const runs = workouts.filter((w) => classifySport(w.type_key) === 'run');
  const ftpPace = estimateFtpPace(runs);

  // Agrega carga por DIA (soma todos os esportes do mesmo dia). Crucial: as
  // funções de ATL/CTL aplicam decaimento por ENTRADA tratando 1 entrada = 1
  // dia, então 2 treinos no mesmo dia precisam virar 1 entrada somada.
  const loadByDate = new Map<string, number>();
  for (const w of workouts) {
    let load = w.rtss;
    if (load === null) {
      load = workoutLoad(w, ftpPace, hr);
      await db
        .from('workouts')
        .update({ rtss: load })
        .eq('athlete_id', athleteId)
        .eq('garmin_id', w.garmin_id);
    }
    loadByDate.set(w.date, (loadByDate.get(w.date) ?? 0) + load);
  }

  const dailyLoads = [...loadByDate.entries()]
    .map(([date, rtss]) => ({ date, rtss }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const atl = calculateATL(dailyLoads);
  const ctl = calculateCTL(dailyLoads);
  const tsb = calculateTSB(ctl, atl);
  const acwr = calculateACWR(dailyLoads);
  const today = new Date().toISOString().slice(0, 10);

  await db.from('metrics_daily').upsert(
    {
      athlete_id: athleteId,
      date: today,
      atl,
      ctl,
      tsb,
      acwr,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'athlete_id,date' },
  );

  // US-017: a saída de calibração tem regra própria (≥14 dias de janela E
  // ≥30 dias de dados). `workouts` vem ordenado por date asc → [0] é o mais
  // antigo (histórico importado conta para a janela — decisão 2026-05-17).
  const distinctWorkoutDays = new Set(workouts.map((w) => w.date)).size;
  const earliestWorkoutDate = workouts[0]?.date;
  await evaluateCalibration(db, athleteId, { distinctWorkoutDays, earliestWorkoutDate });
}

// Garmin `perceivedEffort` chega como número (ou ausente). Aceita só
// 1–10 inteiro (escala RPE de US-015 / workouts.rpe); fora disso → null
// (estado válido, não bloqueia nada — Camada 3).
function normalizeRpe(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

function estimateFtpPace(workouts: Pick<WorkoutRow, 'distance_m' | 'duration_s'>[]): number {
  const sustained = workouts
    .filter((w) => w.distance_m >= 5000 && w.duration_s >= 1200)
    .map((w) => w.duration_s / (w.distance_m / 1000));

  if (sustained.length === 0) return DEFAULT_FTP_PACE_S;

  const bestPace = Math.min(...sustained);
  return Math.round(bestPace * 1.05);
}

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
import { resolveInternalId } from '../lib/internalId';
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

        const internalId = await resolveInternalId(db, userId);
        if (!internalId) throw new Error('Atleta não encontrado');

        const sidecarRes = await fetch(`${SIDECAR_URL}/auth`, {
          method: 'POST',
          headers: sidecarHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ email, password, mfa_code }),
        });

        if (!sidecarRes.ok) {
          // O detalhe do sidecar é uma mensagem CURADA (credenciais inválidas,
          // muitas tentativas, etc. — sem interno cru do Garmin), então é seguro
          // e útil repassar ao usuário. Fallback genérico se vier vazio.
          const err = (await sidecarRes.json().catch(() => ({}))) as { detail?: string };
          logger.warn({ status: sidecarRes.status, detail: err.detail }, 'Sidecar auth falhou');
          throw new Error(err.detail ?? 'Falha ao conectar com o Garmin.');
        }

        const { session } = (await sidecarRes.json()) as { session: Record<string, unknown> };

        const { error: vaultErr } = await db.rpc('store_garmin_token', {
          p_athlete_id: internalId,
          p_tokens: JSON.stringify(session),
        });

        if (vaultErr) {
          logger.error({ err: vaultErr }, 'Falha ao salvar token Garmin no Vault');
          throw new Error('Falha ao salvar credenciais Garmin');
        }

        logger.info({ athlete_id: internalId }, 'Garmin conectado');
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

        const internalId = await resolveInternalId(db, userId);
        if (!internalId) throw new Error('Atleta não encontrado');

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
          const detail = (await sidecarRes.json().catch(() => ({}))) as { detail?: string };
          logger.error(
            { status: sidecarRes.status, detail: detail.detail, athlete_id: internalId },
            'Sidecar metrics falhou',
          );
          // 401 "Sessão Garmin expirada" → o token OAuth do Vault caducou; o
          // atleta precisa reconectar (não é falha genérica de rede/sync).
          if (sidecarRes.status === 401 && detail.detail === 'Sessão Garmin expirada') {
            throw new Error('Sua conexão Garmin expirou. Reconecte o Garmin nas configurações.');
          }
          throw new Error('Não consegui sincronizar com o Garmin');
        }

        const { activities } = (await sidecarRes.json()) as {
          activities: Record<string, unknown>[];
        };

        // Upsert em LOTE (antes: 1 round-trip por atividade — sync de 90 dias
        // com 60 treinos = 60 idas sequenciais ao banco, segurando o spinner).
        // Dois lotes porque o upsert atualiza toda coluna presente no objeto:
        // US-015 Camada 1 — `rpe` (perceivedEffort do Garmin) só entra quando
        // há valor válido 1–10, senão um re-sync sobrescreveria o RPE digitado
        // pelo atleta com null.
        const withRpe: Record<string, unknown>[] = [];
        const withoutRpe: Record<string, unknown>[] = [];
        for (const act of activities) {
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
          if (importedRpe !== null) {
            row.rpe = importedRpe;
            withRpe.push(row);
          } else {
            withoutRpe.push(row);
          }
        }

        let synced = 0;
        for (const batch of [withRpe, withoutRpe]) {
          if (batch.length === 0) continue;
          const { error } = await db
            .from('workouts')
            .upsert(batch, { onConflict: 'athlete_id,garmin_id', ignoreDuplicates: false });
          if (error) {
            logger.error({ error, athlete_id: internalId }, 'Upsert em lote do sync falhou');
          } else {
            synced += batch.length;
          }
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
  // Acumula os rtss recalculados e grava UMA vez em lote no final — o sync
  // zera rtss de todas as linhas, então antes isso era 1 UPDATE por treino
  // (90 round-trips sequenciais depois dos upserts do sync).
  const recomputed: Record<string, unknown>[] = [];
  for (const w of workouts) {
    let load = w.rtss;
    if (load === null) {
      load = workoutLoad(w, ftpPace, hr);
      recomputed.push({ athlete_id: athleteId, garmin_id: w.garmin_id, rtss: load });
    }
    loadByDate.set(w.date, (loadByDate.get(w.date) ?? 0) + load);
  }
  if (recomputed.length > 0) {
    // Linhas recém-lidas do banco → o upsert vira UPDATE das colunas presentes.
    const { error } = await db
      .from('workouts')
      .upsert(recomputed, { onConflict: 'athlete_id,garmin_id', ignoreDuplicates: false });
    if (error) logger.error({ error, athlete_id: athleteId }, 'Falha ao gravar rtss em lote');
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

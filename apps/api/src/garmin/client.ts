import { logger } from '../lib/logger';

const SIDECAR_URL = process.env.GARMIN_SIDECAR_URL ?? 'http://localhost:8001';

export interface GarminActivity {
  garmin_id: string;
  date: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  raw: Record<string, unknown>;
}

async function getSidecarToken(athleteId: string): Promise<string> {
  // Token é buscado do Supabase Vault pelo sidecar
  return athleteId;
}

export const garminClient = {
  async getActivities(athleteId: string, days: number): Promise<GarminActivity[]> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    const res = await fetch(`${SIDECAR_URL}/metrics?date=${since}&days=${days}`, {
      headers: { 'X-Athlete-Id': athleteId },
    });

    if (!res.ok) {
      logger.error({ status: res.status, athleteId }, 'Sidecar retornou erro');
      throw new Error('Falha ao buscar atividades do Garmin');
    }

    return res.json();
  },

  async scheduleWorkout(
    athleteId: string,
    workout: Record<string, unknown>,
    date: string,
  ): Promise<void> {
    const res = await fetch(`${SIDECAR_URL}/workout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Athlete-Id': athleteId,
      },
      body: JSON.stringify({ workout, schedule_date: date }),
    });

    if (!res.ok) {
      logger.error({ status: res.status, athleteId, date }, 'Falha ao enviar workout pro Garmin');
      throw new Error('Não consegui enviar para o relógio');
    }
  },
};

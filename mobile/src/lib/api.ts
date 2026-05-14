import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface ZoneResult {
  hr_zones: Array<{ zone: number; min_bpm: number; max_bpm: number }>;
  pace_zones: Array<{ zone: number; min_sec: number; max_sec: number }>;
}

export interface TrainingDay {
  day: number;
  type: 'easy' | 'interval' | 'tempo' | 'long' | 'rest' | 'cross';
  duration_min: number;
  distance_km: number;
  zones: number[];
  description: string;
}

export interface TrainingWeek {
  week_number: number;
  total_km: number;
  why_text: string;
  days: TrainingDay[];
}

export interface TrainingPlan {
  weeks: TrainingWeek[];
  summary: string;
}

export async function calculateZones(params: {
  max_hr: number;
  resting_hr: number;
  threshold_pace_sec: number;
}) {
  const res = await fetch(`${API_URL}/zones/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Erro ao calcular zonas: ${res.status}`);
  return res.json();
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Usuário não autenticado');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchActivities() {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Usuário não autenticado');
  const res = await fetch(`${API_URL}/workouts/?athlete_id=${encodeURIComponent(userId)}`, { headers });
  if (!res.ok) throw new Error(`Erro ao buscar atividades: ${res.status}`);
  const json = await res.json();
  return json.workouts ?? [];
}

export async function fetchCurrentPlan(): Promise<TrainingPlan | null> {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  const res = await fetch(`${API_URL}/plan/current?athlete_id=${encodeURIComponent(userId)}`, { headers });
  if (!res.ok) return null;
  const json = await res.json();
  return (json.plan?.plan_json as TrainingPlan) ?? null;
}

export async function pollJobResult(jobId: string, maxWaitMs = 120_000): Promise<TrainingPlan> {
  const headers = await getAuthHeaders();
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${API_URL}/jobs/${jobId}`, { headers });
    if (!res.ok) continue;
    const job = await res.json();
    if (job.status === 'done' && job.result?.plan) return job.result.plan as TrainingPlan;
    if (job.status === 'failed') throw new Error(job.error ?? 'Geração de plano falhou');
  }
  throw new Error('Plano ainda está sendo gerado. Abra o app em alguns minutos.');
}

export async function saveProfile(params: {
  birth_year: number;
  weight_kg: number;
  sex: 'M' | 'F' | 'other';
  weekly_frequency?: string;
}) {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Usuário não autenticado');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await fetch(`${API_URL}/onboarding/profile`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ athlete_id: userId, timezone, weekly_frequency: '3-5', ...params }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Erro ao salvar perfil: ${res.status}`);
  }
}

export async function saveZones(fc_max: number, fc_rest: number) {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Usuário não autenticado');
  const res = await fetch(`${API_URL}/onboarding/zones`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ athlete_id: userId, fc_max, fc_rest }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Erro ao salvar zonas: ${res.status}`);
  }
}

export async function generatePlan(params: {
  goal_distance_km: number;
  days_per_week: number;
  weeks_to_goal?: number;
}): Promise<TrainingPlan | { job_id: string; message: string }> {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Usuário não autenticado');

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weeksToGoal = params.weeks_to_goal ?? 8;
  const raceDate = new Date(Date.now() + weeksToGoal * 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const weeklyFrequency =
    params.days_per_week <= 3 ? '1-3' : params.days_per_week <= 5 ? '3-5' : '5+';

  // Update weekly_frequency and timezone; profile (birth_year, weight_kg, sex) was set in ProfileForm
  await fetch(`${API_URL}/onboarding/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ athlete_id: userId, weekly_frequency: weeklyFrequency, timezone }),
  });

  await fetch(`${API_URL}/onboarding/goal`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      athlete_id: userId,
      goal_mode: 'race',
      race_distance_km: params.goal_distance_km,
      race_date: raceDate,
    }),
  });

  const res = await fetch(`${API_URL}/plan/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ athlete_id: userId }),
  });

  if (res.status === 202) {
    const json = await res.json();
    return { job_id: json.job_id, message: json.message };
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `Erro ao gerar plano: ${res.status}`);
  }

  const json = await res.json();
  return json.plan as TrainingPlan;
}

export async function requestFeedback(workout_id: string): Promise<{
  texto_principal: string;
  destaque_positivo?: string;
  sugestao?: string;
  emoji_resumo?: string;
}> {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Usuário não autenticado');
  const res = await fetch(`${API_URL}/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workout_id, athlete_id: userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Erro ao gerar feedback: ${res.status}`);
  }
  return res.json();
}

export async function fetchFeedbacks(): Promise<{ id: string; workout_id: string; feedback_md: string; created_at: string }[]> {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return [];
  const res = await fetch(`${API_URL}/feedback?athlete_id=${encodeURIComponent(userId)}`, { headers });
  if (!res.ok) return [];
  const json = await res.json();
  return json.feedbacks ?? [];
}

export async function connectGarmin(params: {
  email: string;
  password: string;
  mfa_code?: string;
}) {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Usuário não autenticado');
  const res = await fetch(`${API_URL}/garmin/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ athlete_id: userId, ...params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Erro ao conectar Garmin: ${res.status}`);
  }
  return res.json();
}

export async function syncGarmin(days = 90) {
  const headers = await getAuthHeaders();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Usuário não autenticado');
  const res = await fetch(`${API_URL}/garmin/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ athlete_id: userId, days }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Erro ao sincronizar Garmin: ${res.status}`);
  }
  return res.json();
}

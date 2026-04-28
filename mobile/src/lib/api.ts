import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface ZoneResult {
  hr_zones: Array<{ zone: number; min_bpm: number; max_bpm: number }>;
  pace_zones: Array<{ zone: number; min_sec: number; max_sec: number }>;
}

export interface TrainingDay {
  day_of_week: number;
  workout_type: string;
  duration_minutes: number;
  target_zone: number | null;
  instruction: string;
}

export interface TrainingWeek {
  week_number: number;
  days: TrainingDay[];
  total_km: number;
}

export interface TrainingPlan {
  user_id: string;
  goal_distance_km: number;
  weeks: TrainingWeek[];
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
  const res = await fetch(`${API_URL}/activities`, { headers });
  if (!res.ok) throw new Error(`Erro ao buscar atividades: ${res.status}`);
  return res.json();
}

export async function generatePlan(payload: {
  goal_distance_km: number;
  weeks: number;
  days_per_week: number;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/plans/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Erro ao gerar plano: ${res.status}`);
  return res.json();
}

export async function postFeedback(workout_id: string, rating: 'easy' | 'medium' | 'hard') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workout_id, rating }),
  });
  if (!res.ok) throw new Error(`Erro ao salvar feedback: ${res.status}`);
  return res.json();
}

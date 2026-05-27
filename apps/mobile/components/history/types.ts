import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../../lib/theme';

export type Sport = 'run' | 'bike' | 'swim' | 'strength' | 'other';

export interface Workout {
  id: string;
  date: string;
  sport?: Sport;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  rtss: number | null;
  rpe: number | null;
}

// Config por esporte — ícone Ionicons + label PT. Cobre os 5 esportes que o
// sidecar classifica; default 'run' pra registros antigos sem o campo.
export const SPORT_META: Record<Sport, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  run: { label: 'Corrida', icon: 'footsteps-outline' },
  bike: { label: 'Pedal', icon: 'bicycle-outline' },
  swim: { label: 'Natação', icon: 'water-outline' },
  strength: { label: 'Força', icon: 'barbell-outline' },
  other: { label: 'Atividade', icon: 'fitness-outline' },
};

export function sportColor(theme: Theme, sport: Sport): string {
  switch (sport) {
    case 'run':
      return theme.colors.workoutEasy;
    case 'bike':
      return theme.colors.workoutLong;
    case 'swim':
      return theme.colors.accent;
    case 'strength':
      return theme.colors.workoutTempo;
    case 'other':
      return theme.colors.workoutCross;
  }
}

export function sportOf(w: Workout): Sport {
  return w.sport ?? 'run';
}

export const PT_MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export const PT_MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${PT_MONTHS[parseInt(m, 10) - 1] ?? ''}`;
}

export function formatDuration(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}`;
}

export function formatPace(distanceM: number, durationS: number): string | null {
  if (distanceM <= 0 || durationS <= 0) return null;
  const paceS = Math.round(durationS / (distanceM / 1000));
  const m = Math.floor(paceS / 60);
  const s = paceS % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

import type { WorkoutInput } from './types';

/**
 * rTSS (Running Training Stress Score) — baseado em TrainingPeaks/Firstbeat.
 * Formula: rTSS = (duration_s * NGP * IF) / (FTP * 3600) * 100
 * onde IF = NGP / FTP, NGP ≈ avg_pace ajustado por intensidade de FC.
 */
export function calculateRTSS(workout: WorkoutInput, ftpPaceSecPerKm: number): number {
  if (workout.duration_s <= 0 || workout.distance_m <= 0) return 0;

  const pace = workout.duration_s / (workout.distance_m / 1000); // s/km
  const intensityFactor = ftpPaceSecPerKm / pace; // IF < 1 = abaixo do limiar
  const tss = (workout.duration_s / 3600) * intensityFactor * intensityFactor * 100;

  return Math.round(Math.max(0, tss) * 10) / 10;
}

import type { WorkoutInput } from './types';

const HR_OUTLIER_THRESHOLD_BPM_PER_SEC = 20;

/**
 * Remove outliers de FC óptica (variação > 20bpm/s).
 */
export function filterHROutliers(hrSeries: number[]): number[] {
  if (hrSeries.length === 0) return [];

  const filtered: number[] = [hrSeries[0]];
  for (let i = 1; i < hrSeries.length; i++) {
    const delta = Math.abs(hrSeries[i] - hrSeries[i - 1]);
    if (delta <= HR_OUTLIER_THRESHOLD_BPM_PER_SEC) {
      filtered.push(hrSeries[i]);
    }
  }
  return filtered;
}

/**
 * Decoupling Pa:HR (aerobic decoupling).
 * Compara eficiência de pace/HR na primeira vs segunda metade do treino.
 * Valor < 5% = boa eficiência aeróbica.
 */
export function calculateDecoupling(workout: WorkoutInput): number {
  const series = workout.hr_series ? filterHROutliers(workout.hr_series) : [];

  if (series.length < 10) return 0;

  const mid = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, mid);
  const secondHalf = series.slice(mid);

  const avgHR1 = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgHR2 = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  if (avgHR1 === 0) return 0;

  // Decoupling = quanto a FC subiu na segunda metade (mesmo pace)
  const decoupling = ((avgHR2 - avgHR1) / avgHR1) * 100;
  return Math.round(decoupling * 100) / 100;
}

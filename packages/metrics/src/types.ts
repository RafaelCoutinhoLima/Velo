export interface WorkoutInput {
  date: string;
  distance_m: number;
  duration_s: number;
  avg_hr: number;
  max_hr: number;
  hr_series?: number[];
}

export interface DailyLoad {
  date: string;
  rtss: number;
}

export interface MetricsResult {
  atl: number;
  ctl: number;
  tsb: number;
  acwr: number;
}

import { z } from 'zod';

export const WorkoutDaySchema = z.object({
  day: z.number().int().min(1).max(7),
  type: z.enum(['easy', 'interval', 'tempo', 'long', 'rest', 'cross']),
  duration_min: z.number().int().min(0).max(300),
  distance_km: z.number().min(0).max(50),
  zones: z.array(z.number().int().min(1).max(5)).default([]),
  description: z.string().min(1).max(500),
  garmin_steps: z.array(z.record(z.unknown())).optional(),
});

export const PlanWeekSchema = z.object({
  week_number: z.number().int().min(1),
  total_km: z.number().min(0).max(200),
  days: z.array(WorkoutDaySchema).length(7),
  why_text: z.string().min(1).max(800),
});

export const PlanResponseSchema = z.object({
  weeks: z.array(PlanWeekSchema).min(1).max(12),
  summary: z.string().min(1).max(1000),
});

export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type PlanWeek = z.infer<typeof PlanWeekSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

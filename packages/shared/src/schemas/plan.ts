import { z } from 'zod';

export const WorkoutDaySchema = z.object({
  day: z.number().int().min(1).max(7),
  type: z.enum(['easy', 'interval', 'tempo', 'long', 'rest', 'cross']),
  duration_min: z.number().int().min(0).max(300),
  distance_km: z.number().min(0).max(50),
  zones: z.array(z.number().int().min(1).max(5)),
  description: z.string(),
});

export const PlanWeekSchema = z.object({
  week_number: z.number().int().min(1),
  total_km: z.number().min(0),
  days: z.array(WorkoutDaySchema),
  why_text: z.string(),
});

export const PlanSchema = z.object({
  id: z.string().uuid(),
  week_start: z.string(),
  why_text: z.string(),
  plan_json: z.object({ weeks: z.array(PlanWeekSchema) }),
  is_active: z.boolean(),
});

export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type PlanWeek = z.infer<typeof PlanWeekSchema>;
export type Plan = z.infer<typeof PlanSchema>;

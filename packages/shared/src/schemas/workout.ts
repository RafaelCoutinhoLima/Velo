import { z } from 'zod';

export const WorkoutSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  distance_m: z.number().int().positive(),
  duration_s: z.number().int().positive(),
  avg_hr: z.number().int().nullable(),
  rtss: z.number().nullable(),
  rpe: z.number().int().min(1).max(10).nullable(),
});

export type Workout = z.infer<typeof WorkoutSchema>;

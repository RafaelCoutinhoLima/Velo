import { z } from 'zod';

export const AthleteProfileSchema = z.object({
  birth_year: z.number().int().min(1930).max(2013),
  weight_kg: z.number().min(30).max(200),
  sex: z.enum(['M', 'F', 'other']),
  weekly_frequency: z.string(),
  timezone: z.string().default('America/Recife'),
  goal_mode: z.enum(['race', 'general_progression']),
  race_date: z.string().optional(),
  race_distance_km: z.number().optional(),
});

export type AthleteProfile = z.infer<typeof AthleteProfileSchema>;

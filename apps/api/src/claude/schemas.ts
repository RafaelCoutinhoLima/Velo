import { z } from 'zod';

export const ZoneLabelSchema = z.enum(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);

// Bloco de aquecimento / desaquecimento (generation_spec.md §2.3)
export const WarmCoolSchema = z.object({
  duracao_min: z.number().min(0).max(60),
  zona: ZoneLabelSchema,
  pace_alvo: z.string().max(24).optional(),
});

// Parte principal estruturada (generation_spec.md §2.3)
export const PartePrincipalSchema = z.object({
  descricao: z.string().min(1).max(500),
  zona_alvo: ZoneLabelSchema,
  fc_alvo_bpm: z.object({
    min: z.number().int().min(60).max(230),
    max: z.number().int().min(60).max(230),
  }),
  pace_alvo: z.string().max(24).optional(),
  repeticoes: z.number().int().min(1).max(30).optional(),
  duracao_repeticao_min: z.number().min(0).max(120).optional(),
  recuperacao_min: z.number().min(0).max(30).optional(),
  recuperacao_zona: ZoneLabelSchema.optional(),
});

export const WorkoutDaySchema = z.object({
  day: z.number().int().min(1).max(7),
  type: z.enum(['easy', 'interval', 'tempo', 'long', 'rest', 'cross', 'fartlek', 'progressivo']),
  duration_min: z.number().int().min(0).max(300),
  distance_km: z.number().min(0).max(50),
  zones: z.array(z.number().int().min(1).max(5)).default([]),
  description: z.string().min(1).max(500),
  garmin_steps: z.array(z.record(z.string(), z.unknown())).optional(),
  // ─── Superset estruturado (generation_spec.md §2.3) — opcional p/ compat ───
  rtss_estimado: z.number().min(0).max(300).optional(),
  aquecimento: WarmCoolSchema.optional(),
  parte_principal: PartePrincipalSchema.optional(),
  desaquecimento: WarmCoolSchema.optional(),
  notas_tecnicas: z.string().max(500).optional(),
});

export const TIDSchema = z.object({
  z1z2_pct: z.number().min(0).max(100),
  z3_pct: z.number().min(0).max(100),
  z4z5_pct: z.number().min(0).max(100),
});

export const PlanWeekSchema = z.object({
  week_number: z.number().int().min(1),
  total_km: z.number().min(0).max(200),
  days: z.array(WorkoutDaySchema).min(1).max(7),
  why_text: z.string().min(1).max(800),
  acwr_projetado: z.number().min(0).max(3).optional(),
  tid_realizada: TIDSchema.optional(),
  // ─── Raciocínio do Claude (generation_spec.md §2.3) — opcional p/ compat ───
  avaliacao: z.string().max(600).optional(),
  objetivo_semana: z.string().max(300).optional(),
});

export const PlanResponseSchema = z.object({
  weeks: z.array(PlanWeekSchema).min(1).max(12),
  summary: z.string().min(1).max(1000),
});

export const FeedbackInputSchema = z.object({
  workout_id: z.string().uuid(),
  athlete_id: z.string().uuid(),
  workout_date: z.string(),
  distance_km: z.number(),
  duration_min: z.number(),
  avg_hr: z.number().optional(),
  pace_avg_s_km: z.number(),
  rpe: z.number().min(1).max(10).optional(),
  zones_planned: z.array(z.number()).optional(),
  calibration_mode: z.boolean().default(false),
});

export const FeedbackOutputSchema = z.object({
  texto_principal: z.string().min(10).max(600),
  destaque_positivo: z.string().min(5).max(200),
  sugestao: z.string().min(5).max(200),
  emoji_resumo: z.string().max(8),
  feedback_md: z.string().min(10).max(1000),
});

export type ZoneLabel = z.infer<typeof ZoneLabelSchema>;
export type WarmCool = z.infer<typeof WarmCoolSchema>;
export type PartePrincipal = z.infer<typeof PartePrincipalSchema>;
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type PlanWeek = z.infer<typeof PlanWeekSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;
export type FeedbackOutput = z.infer<typeof FeedbackOutputSchema>;

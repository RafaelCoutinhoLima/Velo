import { describe, expect, it } from 'bun:test';
import { extractJsonObject } from './parseResponse';
import { PartePrincipalSchema, PlanResponseSchema } from './schemas';

describe('PartePrincipalSchema — fc_alvo_bpm', () => {
  it('aceita FC decimal e arredonda para inteiro', () => {
    const r = PartePrincipalSchema.parse({
      descricao: '6x800m no ritmo alvo',
      zona_alvo: 'Z4',
      fc_alvo_bpm: { min: 165.5, max: 179.2 },
    });
    expect(r.fc_alvo_bpm).toEqual({ min: 166, max: 179 });
  });

  it('aceita parte_principal sem fc_alvo_bpm (campo opcional)', () => {
    const r = PartePrincipalSchema.parse({
      descricao: 'Corrida contínua confortável em ritmo conversável',
      zona_alvo: 'Z2',
    });
    expect(r.fc_alvo_bpm).toBeUndefined();
  });
});

describe('PlanResponseSchema — parsing ponta a ponta', () => {
  const validPlan = {
    weeks: [
      {
        week_number: 1,
        total_km: 30,
        why_text: 'Semana de base aeróbica',
        days: [
          {
            day: 1,
            type: 'easy',
            duration_min: 40,
            distance_km: 6,
            zones: [2],
            description: 'Corrida leve em zona 2 mantendo conversa confortável o tempo todo.',
          },
        ],
      },
    ],
    summary: 'Plano de base aeróbica com foco em consistência',
  };

  it('plano válido embrulhado em ruído: extrai e valida', () => {
    const raw = `Aqui está o plano: ${JSON.stringify(validPlan)} — bom treino!`;
    const parsed = PlanResponseSchema.parse(JSON.parse(extractJsonObject(raw)));
    expect(parsed.weeks[0].days[0].type).toBe('easy');
  });
});

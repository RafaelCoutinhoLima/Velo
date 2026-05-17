import { describe, expect, it } from 'bun:test';
import { buildGarminWorkout, type PlanDay, planDayDate } from './workoutBuilder';

const ZONES = [
  { fc_min: 90, fc_max: 110 }, // Z1
  { fc_min: 110, fc_max: 140 }, // Z2
  { fc_min: 140, fc_max: 160 }, // Z3
  { fc_min: 160, fc_max: 175 }, // Z4
  { fc_min: 175, fc_max: 190 }, // Z5
];

type Step = Record<string, unknown>;
function steps(w: Record<string, unknown>): Step[] {
  const seg = (w.workoutSegments as Step[])[0];
  return seg.workoutSteps as Step[];
}
function key(s: Step): string {
  return (s.stepType as { stepTypeKey: string }).stepTypeKey;
}

describe('planDayDate', () => {
  it('dia 1 = week_start; dia 7 = +6', () => {
    expect(planDayDate('2026-05-18', 1)).toBe('2026-05-18');
    expect(planDayDate('2026-05-18', 7)).toBe('2026-05-24');
  });

  it('cruza fronteira de mês', () => {
    expect(planDayDate('2026-05-30', 3)).toBe('2026-06-01');
  });
});

describe('buildGarminWorkout — caminho simples (sem parte_principal)', () => {
  const day: PlanDay = {
    type: 'easy',
    duration_min: 60,
    zones: [2],
    description: 'Corrida leve',
  };

  it('monta warmup/interval/cooldown com alvo de FC da zona', () => {
    const w = buildGarminWorkout(day, ZONES, 'Treino A');
    expect(w.workoutName).toBe('Treino A');
    const s = steps(w);
    expect(s.map(key)).toEqual(['warmup', 'interval', 'cooldown']);
    expect(s[0].endConditionValue).toBe(300); // min(300, 3600*0.1)
    expect(s[1].targetValueOne).toBe(110); // ZONES[1].fc_min
    expect(s[1].targetValueTwo).toBe(140);
    expect((s[1].targetType as { workoutTargetTypeKey: string }).workoutTargetTypeKey).toBe(
      'heart.rate.zone',
    );
  });

  it('zona ausente → sem alvo de FC (no.target)', () => {
    const w = buildGarminWorkout(day, [], 'Sem zona');
    const s = steps(w);
    expect((s[1].targetType as { workoutTargetTypeKey: string }).workoutTargetTypeKey).toBe(
      'no.target',
    );
    expect(s[1].targetValueOne).toBeUndefined();
  });

  it('zones vazio cai no default Z2', () => {
    const w = buildGarminWorkout({ ...day, zones: [] }, ZONES, 'Default');
    expect(steps(w)[1].targetValueOne).toBe(110);
  });

  it('trunca a descrição em 500 chars', () => {
    const w = buildGarminWorkout({ ...day, description: 'x'.repeat(600) }, ZONES, 'L');
    expect((w.description as string).length).toBe(500);
  });
});

describe('buildGarminWorkout — estruturado com repetições', () => {
  const day: PlanDay = {
    type: 'interval',
    duration_min: 50,
    zones: [4],
    description: '5x3min Z4',
    aquecimento: { duracao_min: 10, zona: 'Z2' },
    parte_principal: {
      zona_alvo: 'Z4',
      fc_alvo_bpm: { min: 160, max: 175 },
      repeticoes: 5,
      duracao_repeticao_min: 3,
      recuperacao_min: 2,
      recuperacao_zona: 'Z1',
    },
    desaquecimento: { duracao_min: 5, zona: 'Z1' },
  };

  it('gera warmup + RepeatGroup(work+recovery) + cooldown', () => {
    const s = steps(buildGarminWorkout(day, ZONES, 'Intervalado'));
    expect(s.map(key)).toEqual(['warmup', 'repeat', 'cooldown']);
    const repeat = s[1];
    expect(repeat.type).toBe('RepeatGroupDTO');
    expect(repeat.numberOfIterations).toBe(5);
    const child = repeat.workoutSteps as Step[];
    expect(child.map(key)).toEqual(['interval', 'recovery']);
    expect(child[0].endConditionValue).toBe(180); // 3min
    expect(child[0].targetValueOne).toBe(160);
    expect(child[1].endConditionValue).toBe(120); // 2min recuperação
  });

  it('aquecimento sem zona válida → warmup sem alvo de FC', () => {
    const s = steps(
      buildGarminWorkout({ ...day, aquecimento: { duracao_min: 10, zona: '' } }, ZONES, 'X'),
    );
    expect((s[0].targetType as { workoutTargetTypeKey: string }).workoutTargetTypeKey).toBe(
      'no.target',
    );
  });
});

describe('buildGarminWorkout — estruturado contínuo (sem repetições)', () => {
  it('parte principal ocupa o tempo total menos aquece/desaquece', () => {
    const day: PlanDay = {
      type: 'tempo',
      duration_min: 40,
      zones: [3],
      description: 'Tempo run contínuo',
      aquecimento: { duracao_min: 10, zona: 'Z2' },
      parte_principal: { zona_alvo: 'Z3', fc_alvo_bpm: { min: 140, max: 160 } },
      desaquecimento: { duracao_min: 5, zona: 'Z1' },
    };
    const s = steps(buildGarminWorkout(day, ZONES, 'Tempo'));
    expect(s.map(key)).toEqual(['warmup', 'interval', 'cooldown']);
    expect(s[1].endConditionValue).toBe(1500); // 40*60 - 600 - 300
    expect(s[1].targetValueOne).toBe(140);
  });

  it('parte principal sozinha (sem aquece/desaquece) usa duração total', () => {
    const day: PlanDay = {
      type: 'tempo',
      duration_min: 30,
      zones: [3],
      description: 'Só parte principal',
      parte_principal: { zona_alvo: 'Z3', fc_alvo_bpm: { min: 140, max: 160 } },
    };
    const s = steps(buildGarminWorkout(day, ZONES, 'PP'));
    expect(s.map(key)).toEqual(['interval']);
    expect(s[0].endConditionValue).toBe(1800); // 30*60
  });
});

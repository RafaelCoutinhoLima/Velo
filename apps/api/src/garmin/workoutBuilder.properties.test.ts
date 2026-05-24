// Property-based tests do buildGarminWorkout/planDayDate.
// Complementam workoutBuilder.test.ts (exemplos curados): aqui buscamos
// invariantes válidos pra QUALQUER PlanDay plausível.

import { describe, test } from 'bun:test';
import * as fc from 'fast-check';
import { buildGarminWorkout, type PlanDay, planDayDate } from './workoutBuilder';

// ── Geradores ────────────────────────────────────────────────────────────────

const arbZonesMap = fc
  .array(
    fc.record({
      // Garante fc_min < fc_max e range plausível (FC humana).
      fc_min: fc.integer({ min: 60, max: 170 }),
      fc_max: fc.integer({ min: 60, max: 200 }),
    }),
    { minLength: 5, maxLength: 5 },
  )
  .map((zs) =>
    zs.map((z) => ({
      fc_min: Math.min(z.fc_min, z.fc_max),
      fc_max: Math.max(z.fc_min, z.fc_max) + 1,
    })),
  );

const arbZoneLabel = fc.integer({ min: 1, max: 5 }).map((n) => `Z${n}`);

const arbWarmCool = fc.record({
  duracao_min: fc.integer({ min: 0, max: 30 }),
  zona: arbZoneLabel,
});

const arbPartePrincipalContinuous = fc.record({
  zona_alvo: arbZoneLabel,
  fc_alvo_bpm: fc
    .record({ min: fc.integer({ min: 80, max: 180 }), max: fc.integer({ min: 80, max: 200 }) })
    .map((r) => ({ min: Math.min(r.min, r.max), max: Math.max(r.min, r.max) })),
});

const arbPartePrincipalRepeated = fc.record({
  zona_alvo: arbZoneLabel,
  fc_alvo_bpm: fc
    .record({ min: fc.integer({ min: 80, max: 180 }), max: fc.integer({ min: 80, max: 200 }) })
    .map((r) => ({ min: Math.min(r.min, r.max), max: Math.max(r.min, r.max) })),
  repeticoes: fc.integer({ min: 2, max: 12 }),
  duracao_repeticao_min: fc.integer({ min: 1, max: 10 }),
  recuperacao_min: fc.integer({ min: 0, max: 5 }),
  recuperacao_zona: arbZoneLabel,
});

const arbSimpleDay: fc.Arbitrary<PlanDay> = fc.record({
  type: fc.constantFrom('easy', 'long', 'tempo'),
  duration_min: fc.integer({ min: 10, max: 180 }),
  zones: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 2 }),
  description: fc.string({ maxLength: 200 }),
});

const arbStructuredDay: fc.Arbitrary<PlanDay> = fc.record({
  type: fc.constantFrom('interval', 'tempo', 'long'),
  duration_min: fc.integer({ min: 30, max: 180 }),
  zones: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 2 }),
  description: fc.string({ maxLength: 200 }),
  aquecimento: arbWarmCool,
  parte_principal: fc.oneof(arbPartePrincipalContinuous, arbPartePrincipalRepeated),
  desaquecimento: arbWarmCool,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

type Step = Record<string, unknown>;
const stepsOf = (w: Record<string, unknown>): Step[] =>
  (w.workoutSegments as Step[])[0].workoutSteps as Step[];
const stepKey = (s: Step) => (s.stepType as { stepTypeKey: string }).stepTypeKey;

// ── Propriedades de buildGarminWorkout ───────────────────────────────────────

describe('buildGarminWorkout — propriedades', () => {
  test('preserva o workoutName passado', () => {
    fc.assert(
      fc.property(
        arbSimpleDay,
        arbZonesMap,
        fc.string({ minLength: 1, maxLength: 50 }),
        (day, zones, name) => {
          const w = buildGarminWorkout(day, zones, name);
          return w.workoutName === name;
        },
      ),
    );
  });

  test('sempre devolve sportType running', () => {
    fc.assert(
      fc.property(arbSimpleDay, arbZonesMap, (day, zones) => {
        const w = buildGarminWorkout(day, zones, 'X');
        const sport = w.sportType as { sportTypeKey: string };
        return sport.sportTypeKey === 'running';
      }),
    );
  });

  test('description é truncado a 500 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 500, maxLength: 1000 }),
        arbZonesMap,
        (description, zones) => {
          const day: PlanDay = {
            type: 'easy',
            duration_min: 60,
            zones: [2],
            description,
          };
          const w = buildGarminWorkout(day, zones, 'X');
          return (w.description as string).length <= 500;
        },
      ),
    );
  });

  test('caminho simples: 3 steps na ordem warmup/interval/cooldown', () => {
    fc.assert(
      fc.property(arbSimpleDay, arbZonesMap, (day, zones) => {
        const w = buildGarminWorkout(day, zones, 'X');
        const s = stepsOf(w);
        return s.length === 3 && s.map(stepKey).join(',') === 'warmup,interval,cooldown';
      }),
    );
  });

  test('caminho simples: soma das durações = duration_min·60 (exato)', () => {
    fc.assert(
      fc.property(arbSimpleDay, arbZonesMap, (day, zones) => {
        const w = buildGarminWorkout(day, zones, 'X');
        const s = stepsOf(w);
        const sum = s.reduce((acc, st) => acc + (st.endConditionValue as number), 0);
        return sum === day.duration_min * 60;
      }),
    );
  });

  test('caminho estruturado com repetições: inclui um RepeatGroupDTO', () => {
    fc.assert(
      fc.property(
        arbStructuredDay.filter((d) => (d.parte_principal?.repeticoes ?? 0) > 1),
        arbZonesMap,
        (day, zones) => {
          const w = buildGarminWorkout(day, zones, 'X');
          const s = stepsOf(w);
          return s.some((st) => st.type === 'RepeatGroupDTO');
        },
      ),
    );
  });

  test('caminho estruturado: stepOrder estritamente crescente nos top-level steps', () => {
    fc.assert(
      fc.property(arbStructuredDay, arbZonesMap, (day, zones) => {
        const w = buildGarminWorkout(day, zones, 'X');
        const s = stepsOf(w);
        for (let i = 1; i < s.length; i++) {
          if ((s[i].stepOrder as number) <= (s[i - 1].stepOrder as number)) return false;
        }
        return true;
      }),
    );
  });

  test('sempre devolve >= 1 step', () => {
    fc.assert(
      fc.property(fc.oneof(arbSimpleDay, arbStructuredDay), arbZonesMap, (day, zones) => {
        const w = buildGarminWorkout(day, zones, 'X');
        return stepsOf(w).length >= 1;
      }),
    );
  });

  test('endConditionValue de cada step é positivo', () => {
    fc.assert(
      fc.property(fc.oneof(arbSimpleDay, arbStructuredDay), arbZonesMap, (day, zones) => {
        const w = buildGarminWorkout(day, zones, 'X');
        // Flatten — Repeat tem workoutSteps[] aninhado
        function flatten(steps: Step[]): Step[] {
          return steps.flatMap((s) =>
            s.type === 'RepeatGroupDTO' ? flatten((s.workoutSteps as Step[]) ?? []) : [s],
          );
        }
        return flatten(stepsOf(w)).every((s) => (s.endConditionValue as number) > 0);
      }),
    );
  });
});

// ── planDayDate ──────────────────────────────────────────────────────────────

describe('planDayDate — propriedades', () => {
  // Datas geradas como offset de dias para evitar Invalid Date.
  const arbWeekStart = fc.integer({ min: 0, max: 365 * 5 }).map((offset) => {
    const base = new Date('2024-01-01T00:00:00Z').getTime();
    return new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
  });

  test('dia 1 sempre == week_start', () => {
    fc.assert(fc.property(arbWeekStart, (ws) => planDayDate(ws, 1) === ws));
  });

  test('dia N+7 == dia N + 7 dias (calendar shift)', () => {
    fc.assert(
      fc.property(arbWeekStart, fc.integer({ min: 1, max: 7 }), (ws, n) => {
        const a = new Date(planDayDate(ws, n));
        const b = new Date(planDayDate(ws, n + 7));
        return (b.getTime() - a.getTime()) / 86_400_000 === 7;
      }),
    );
  });

  test('output sempre tem formato YYYY-MM-DD', () => {
    fc.assert(
      fc.property(arbWeekStart, fc.integer({ min: 1, max: 30 }), (ws, n) =>
        /^\d{4}-\d{2}-\d{2}$/.test(planDayDate(ws, n)),
      ),
    );
  });

  test('é monotônico em dayNumber', () => {
    fc.assert(
      fc.property(arbWeekStart, fc.integer({ min: 1, max: 30 }), (ws, n) => {
        const a = new Date(planDayDate(ws, n));
        const b = new Date(planDayDate(ws, n + 1));
        return b.getTime() > a.getTime();
      }),
    );
  });
});

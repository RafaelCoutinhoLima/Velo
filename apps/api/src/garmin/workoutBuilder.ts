// ─── Adaptador de dispositivo: GARMIN ───────────────────────────────────────
// Fonte ÚNICA da conversão "treino FitSync → formato do relógio". Era
// duplicado em Python (services/garmin-sidecar/app/converters.py, removido):
// o sidecar agora só faz upload do DTO montado aqui.
//
// Cada relógio tem seu padrão próprio. Hoje só Garmin (MVP = Garmin only,
// CLAUDE.md). Fase 2 (Apple/Coros) entra como NOVOS adaptadores irmãos deste
// arquivo (ex: appleWorkoutBuilder.ts) consumindo o mesmo PlanDay — sem
// duplicar lógica e sem tocar no sidecar.
//
// Converts a FitSync plan day into the Garmin Connect workout JSON format.
// Ref: garminconnect upload_workout — expects the standard Garmin workout DTO.
// Suporta o superset estruturado (generation_spec.md §2.3/§5): aquecimento,
// parte_principal (com repetições/recuperação) e desaquecimento. Quando esses
// campos não vêm, cai no comportamento simples (warmup 10% / main / cooldown 10%).

const SPORT_RUNNING = { sportTypeId: 1, sportTypeKey: 'running' };

const STEP_TYPES = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  interval: { stepTypeId: 3, stepTypeKey: 'interval' },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery' },
  repeat: { stepTypeId: 6, stepTypeKey: 'repeat' },
};

const END_CONDITION_TIME = { conditionTypeId: 2, conditionTypeKey: 'time' };
const END_CONDITION_ITERATIONS = { conditionTypeId: 7, conditionTypeKey: 'iterations' };

const TARGET_NONE = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' };
const TARGET_HR = { workoutTargetTypeId: 2, workoutTargetTypeKey: 'heart.rate.zone' };

type ZoneRange = { fc_min: number; fc_max: number };

interface WarmCool {
  duracao_min: number;
  zona: string; // "Z1".."Z5"
}

interface PartePrincipal {
  zona_alvo: string;
  fc_alvo_bpm: { min: number; max: number };
  repeticoes?: number;
  duracao_repeticao_min?: number;
  recuperacao_min?: number;
  recuperacao_zona?: string;
}

export interface PlanDay {
  type: string;
  duration_min: number;
  zones: number[];
  description: string;
  aquecimento?: WarmCool;
  parte_principal?: PartePrincipal;
  desaquecimento?: WarmCool;
}

function zoneRange(label: string | undefined, zonesMap: ZoneRange[]): ZoneRange | undefined {
  if (!label) return undefined;
  const idx = Number(label.replace(/[^\d]/g, '')) - 1;
  return zonesMap[idx];
}

function execStep(
  order: number,
  stepType: keyof typeof STEP_TYPES,
  durationSec: number,
  hrLow?: number,
  hrHigh?: number,
): Record<string, unknown> {
  const hasHr = typeof hrLow === 'number' && typeof hrHigh === 'number' && hrLow > 0 && hrHigh > 0;
  return {
    stepOrder: order,
    type: 'ExecutableStepDTO',
    stepType: STEP_TYPES[stepType],
    endCondition: END_CONDITION_TIME,
    endConditionValue: durationSec,
    targetType: hasHr ? TARGET_HR : TARGET_NONE,
    ...(hasHr ? { targetValueOne: hrLow, targetValueTwo: hrHigh } : {}),
  };
}

function repeatStep(
  order: number,
  iterations: number,
  childSteps: Record<string, unknown>[],
): Record<string, unknown> {
  return {
    stepOrder: order,
    type: 'RepeatGroupDTO',
    stepType: STEP_TYPES.repeat,
    numberOfIterations: iterations,
    smartRepeat: false,
    endCondition: END_CONDITION_ITERATIONS,
    endConditionValue: iterations,
    workoutSteps: childSteps,
  };
}

// Constrói os steps estruturados a partir de aquecimento/parte_principal/desaquecimento.
function buildStructuredSteps(day: PlanDay, zonesMap: ZoneRange[]): Record<string, unknown>[] {
  const pp = day.parte_principal;
  if (!pp) return [];
  const steps: Record<string, unknown>[] = [];
  let order = 1;

  if (day.aquecimento && day.aquecimento.duracao_min > 0) {
    const wz = zoneRange(day.aquecimento.zona, zonesMap);
    steps.push(
      execStep(order++, 'warmup', day.aquecimento.duracao_min * 60, wz?.fc_min, wz?.fc_max),
    );
  }

  const { min: hrLow, max: hrHigh } = pp.fc_alvo_bpm;

  if (pp.repeticoes && pp.repeticoes > 1 && pp.duracao_repeticao_min) {
    const work = execStep(1, 'interval', Math.round(pp.duracao_repeticao_min * 60), hrLow, hrHigh);
    const child = [work];
    if (pp.recuperacao_min && pp.recuperacao_min > 0) {
      const rz = zoneRange(pp.recuperacao_zona ?? 'Z1', zonesMap);
      child.push(
        execStep(2, 'recovery', Math.round(pp.recuperacao_min * 60), rz?.fc_min, rz?.fc_max),
      );
    }
    steps.push(repeatStep(order++, pp.repeticoes, child));
  } else {
    // Contínuo: parte principal ocupa o tempo total menos aquecimento/desaquecimento
    const warmSec = (day.aquecimento?.duracao_min ?? 0) * 60;
    const coolSec = (day.desaquecimento?.duracao_min ?? 0) * 60;
    const mainSec = Math.max(60, day.duration_min * 60 - warmSec - coolSec);
    steps.push(execStep(order++, 'interval', mainSec, hrLow, hrHigh));
  }

  if (day.desaquecimento && day.desaquecimento.duracao_min > 0) {
    const cz = zoneRange(day.desaquecimento.zona, zonesMap);
    steps.push(
      execStep(order++, 'cooldown', day.desaquecimento.duracao_min * 60, cz?.fc_min, cz?.fc_max),
    );
  }

  return steps;
}

// Comportamento simples (legado) quando não há parte_principal estruturada.
function buildSimpleSteps(day: PlanDay, zonesMap: ZoneRange[]): Record<string, unknown>[] {
  const totalSec = day.duration_min * 60;
  const warmupSec = Math.min(300, Math.round(totalSec * 0.1));
  const cooldownSec = Math.min(300, Math.round(totalSec * 0.1));
  const mainSec = totalSec - warmupSec - cooldownSec;

  const zone = zonesMap[(day.zones[0] ?? 2) - 1];

  return [
    execStep(1, 'warmup', warmupSec),
    execStep(2, 'interval', mainSec, zone?.fc_min, zone?.fc_max),
    execStep(3, 'cooldown', cooldownSec),
  ];
}

export function buildGarminWorkout(
  day: PlanDay,
  zonesMap: ZoneRange[],
  name: string,
): Record<string, unknown> {
  const steps = day.parte_principal
    ? buildStructuredSteps(day, zonesMap)
    : buildSimpleSteps(day, zonesMap);

  return {
    workoutName: name,
    description: day.description.slice(0, 500),
    sportType: SPORT_RUNNING,
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType: SPORT_RUNNING,
        workoutSteps: steps,
      },
    ],
  };
}

// Returns the ISO date string (YYYY-MM-DD) for a given day offset from the plan week start.
// weekStart: ISO date string of Monday; dayNumber: 1-indexed day in the week.
export function planDayDate(weekStart: string, dayNumber: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayNumber - 1);
  return d.toISOString().slice(0, 10);
}

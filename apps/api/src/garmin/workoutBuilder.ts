// Converts a FitSync plan day into the Garmin Connect workout JSON format.
// Ref: garminconnect upload_workout — expects the standard Garmin workout DTO.

const SPORT_RUNNING = { sportTypeId: 1, sportTypeKey: 'running' };

const STEP_TYPES = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup' },
  interval: { stepTypeId: 3, stepTypeKey: 'interval' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
};

const END_CONDITION_TIME = { conditionTypeId: 2, conditionTypeKey: 'time' };

const TARGET_NONE = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' };
const TARGET_HR = { workoutTargetTypeId: 2, workoutTargetTypeKey: 'heart.rate.zone' };

type ZoneRange = { fc_min: number; fc_max: number };

export interface PlanDay {
  type: string;
  duration_min: number;
  zones: number[];
  description: string;
}

function step(
  order: number,
  stepType: keyof typeof STEP_TYPES,
  durationSec: number,
  hrLow?: number,
  hrHigh?: number,
): Record<string, unknown> {
  return {
    stepOrder: order,
    type: 'ExecutableStepDTO',
    stepType: STEP_TYPES[stepType],
    endCondition: END_CONDITION_TIME,
    endConditionValue: durationSec,
    targetType: hrLow && hrHigh ? TARGET_HR : TARGET_NONE,
    ...(hrLow && hrHigh ? { targetValueOne: hrLow, targetValueTwo: hrHigh } : {}),
  };
}

export function buildGarminWorkout(
  day: PlanDay,
  zonesMap: ZoneRange[],
  name: string,
): Record<string, unknown> {
  const totalSec = day.duration_min * 60;

  const warmupSec = Math.min(300, Math.round(totalSec * 0.1));
  const cooldownSec = Math.min(300, Math.round(totalSec * 0.1));
  const mainSec = totalSec - warmupSec - cooldownSec;

  // Primary zone: use first zone in array, fallback to Z2
  const primaryZoneIdx = (day.zones[0] ?? 2) - 1;
  const zone = zonesMap[primaryZoneIdx];
  const hrLow = zone?.fc_min;
  const hrHigh = zone?.fc_max;

  const steps = [
    step(1, 'warmup', warmupSec),
    step(2, 'interval', mainSec, hrLow, hrHigh),
    step(3, 'cooldown', cooldownSec),
  ];

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

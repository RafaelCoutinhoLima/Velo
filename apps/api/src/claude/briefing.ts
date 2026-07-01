import type { PlanInput } from './client';

// Karvonen: FC_alvo = FC_repouso + (pct × (FC_max - FC_repouso))
function karvonenZones(fcMax: number, fcRest: number) {
  const pcts: [number, number][] = [
    [0.5, 0.65],
    [0.65, 0.75],
    [0.75, 0.85],
    [0.85, 0.92],
    [0.92, 1.0],
  ];
  return pcts.map(([lo, hi], i) => ({
    zona: i + 1,
    fc_min: Math.round(fcRest + lo * (fcMax - fcRest)),
    fc_max: Math.round(fcRest + hi * (fcMax - fcRest)),
  }));
}

function estimatePaceZones(thresholdPaceSKm: number) {
  const pcts: [number, number][] = [
    [1.33, 1.54],
    [1.14, 1.33],
    [1.05, 1.14],
    [0.95, 1.05],
    [0.83, 0.95],
  ];
  return pcts.map(([lo, hi], i) => ({
    zona: i + 1,
    pace_min_s_km: Math.round(thresholdPaceSKm * lo),
    pace_max_s_km: Math.round(thresholdPaceSKm * hi),
  }));
}

function tanaka(age: number): number {
  return Math.round(208 - 0.7 * age);
}

function formatPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function currentYear(): number {
  return new Date().getFullYear();
}

function determineFase(calibrationMode: boolean, weeksToRace: number | null): string {
  if (calibrationMode) return 'calibracao';
  if (weeksToRace === null) return 'base';
  if (weeksToRace <= 3) return 'taper';
  if (weeksToRace <= 6) return 'peak';
  if (weeksToRace <= 12) return 'build';
  return 'base';
}

function computeTendenciaCTL(history: Record<string, unknown>[]): {
  label: 'subindo' | 'estavel' | 'caindo' | 'desconhecida';
  delta_pct: number | null;
} {
  if (history.length < 3) return { label: 'desconhecida', delta_pct: null };

  const oldest = Number(history[0]?.ctl ?? 0);
  const newest = Number(history[history.length - 1]?.ctl ?? 0);

  if (oldest <= 0) return { label: 'desconhecida', delta_pct: null };

  const deltaPct = Math.round(((newest - oldest) / oldest) * 100 * 10) / 10;

  let label: 'subindo' | 'estavel' | 'caindo';
  if (deltaPct > 3) label = 'subindo';
  else if (deltaPct < -3) label = 'caindo';
  else label = 'estavel';

  return { label, delta_pct: deltaPct };
}

function estimateVO2max(fcMax: number, fcRest: number): number {
  return Math.round(15 * (fcMax / fcRest) * 10) / 10;
}

function computeProntidao(workouts: Record<string, unknown>[]): {
  status: 'descansado' | 'normal' | 'fatigado' | 'desconhecida';
  nota: string;
} {
  const now = Date.now();

  const recent7 = workouts.filter((w) => {
    const age_d = (now - new Date(String(w.date ?? '')).getTime()) / 86400000;
    return age_d <= 7;
  });
  const prev7 = workouts.filter((w) => {
    const age_d = (now - new Date(String(w.date ?? '')).getTime()) / 86400000;
    return age_d > 7 && age_d <= 14;
  });

  const avgRpe = (ws: Record<string, unknown>[]) => {
    const valid = ws.map((w) => Number(w.rpe ?? 0)).filter((r) => r > 0);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const rpeRecent = avgRpe(recent7);
  const rpePrev = avgRpe(prev7);

  const hrEff = (ws: Record<string, unknown>[]) => {
    const valid = ws
      .filter((w) => Number(w.avg_hr ?? 0) > 100 && Number(w.distance_m ?? 0) > 500)
      .map((w) => {
        const pace = Number(w.duration_s) / (Number(w.distance_m) / 1000);
        return Number(w.avg_hr) / pace;
      });
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const effRecent = hrEff(recent7);
  const effPrev = hrEff(prev7);

  const rpeFatigado = rpeRecent !== null && rpePrev !== null && rpeRecent > rpePrev + 1.5;
  const effFatigado = effRecent !== null && effPrev !== null && effRecent > effPrev * 1.05;
  const rpeDescansado = rpeRecent !== null && rpePrev !== null && rpeRecent < rpePrev - 1;

  if (rpeFatigado || effFatigado) {
    return {
      status: 'fatigado',
      nota: `RPE médio recente ${rpeRecent?.toFixed(1) ?? '?'} vs ${rpePrev?.toFixed(1) ?? '?'} anterior. Eficiência aeróbica degradando.`,
    };
  }
  if (rpeDescansado || recent7.length === 0) {
    return {
      status: 'descansado',
      nota:
        recent7.length === 0
          ? 'Sem treinos nos últimos 7 dias — atleta descansado'
          : `RPE médio recente ${rpeRecent?.toFixed(1) ?? '?'} — abaixo da semana anterior`,
    };
  }
  if (rpeRecent === null && rpePrev === null) {
    return { status: 'desconhecida', nota: 'Sem dados de RPE disponíveis' };
  }
  return {
    status: 'normal',
    nota: `RPE médio recente ${rpeRecent?.toFixed(1) ?? '?'} — dentro do esperado`,
  };
}

// Inferência de dias disponíveis quando atleta não configurou os dias específicos.
// Padrão baseado nos dias mais comuns de treino por frequência.
function inferDiasFromFrequency(freq: string): string[] {
  const n = Number(freq.replace(/\D/g, '')) || 3;
  if (n <= 2) return ['ter', 'qui'];
  if (n === 3) return ['seg', 'qua', 'sex'];
  if (n === 4) return ['seg', 'ter', 'qui', 'sab'];
  if (n === 5) return ['seg', 'ter', 'qua', 'qui', 'sab'];
  return ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
}

// Melhor pace por faixa de distância — âncora de performance para prescrição de paces.
function computeMelhoresPaces(workouts: Record<string, unknown>[]) {
  const runs = workouts.filter(
    (w) =>
      (w.sport ?? 'run') === 'run' &&
      Number(w.distance_m ?? 0) > 0 &&
      Number(w.duration_s ?? 0) > 0,
  );

  const bestPace = (minDist: number, maxDist: number): string | null => {
    const candidates = runs
      .filter((w) => {
        const d = Number(w.distance_m);
        return d >= minDist && d <= maxDist;
      })
      .map((w) => Number(w.duration_s) / (Number(w.distance_m) / 1000));
    if (candidates.length === 0) return null;
    return formatPace(Math.round(Math.min(...candidates)));
  };

  return {
    melhor_pace_5km: bestPace(4000, 6000),
    melhor_pace_10km: bestPace(8500, 12000),
    melhor_pace_21km: bestPace(18000, 24000),
  };
}

// Treinos individuais das últimas 4 semanas para o Claude detectar padrões.
function buildTreinosIndividuais(workouts: Record<string, unknown>[]) {
  const now = Date.now();
  return workouts
    .filter((w) => {
      const age_d = (now - new Date(String(w.date ?? '')).getTime()) / 86400000;
      return age_d <= 28;
    })
    .map((w) => {
      const sport = String(w.sport ?? 'run');
      const durationMin = Math.round(Number(w.duration_s ?? 0) / 60);
      const distKm =
        sport === 'run' && Number(w.distance_m) > 0
          ? Math.round((Number(w.distance_m) / 1000) * 10) / 10
          : undefined;
      const paceS =
        sport === 'run' && Number(w.distance_m) > 0 && Number(w.duration_s) > 0
          ? Math.round(Number(w.duration_s) / (Number(w.distance_m) / 1000))
          : undefined;
      return {
        data: w.date,
        esporte: sport,
        duracao_min: durationMin,
        ...(distKm !== undefined ? { distancia_km: distKm } : {}),
        ...(paceS !== undefined ? { pace_medio: formatPace(paceS) } : {}),
        fc_media: w.avg_hr ? Number(w.avg_hr) : null,
        rpe: w.rpe ? Number(w.rpe) : null,
        rtss: w.rtss ? Math.round(Number(w.rtss)) : null,
      };
    });
}

export function buildBriefing(input: PlanInput, errorAnterior?: string): Record<string, unknown> {
  const profile = input.profile as Record<string, unknown>;
  const metrics = input.metrics as Record<string, unknown> | null;
  const history = input.metricsHistory;

  const age = currentYear() - Number(profile.birth_year ?? 1990);
  const storedFcRest = Number(profile.fc_rest ?? 0);
  const storedFcMax = Number(profile.fc_max ?? 0);
  const fcRest = storedFcRest >= 30 ? storedFcRest : 60;

  // FC máxima: cooper calibrado > garmin proxy > tanaka
  const recentHRs = (input.recentWorkouts as Array<Record<string, unknown>>)
    .map((w) => Number(w.avg_hr ?? 0))
    .filter((h) => h > 100);
  const maxObservedHR = recentHRs.length > 0 ? Math.max(...recentHRs) : 0;
  const fcMaxMeasured = maxObservedHR > 0 ? Math.round(maxObservedHR * 1.08) : 0;
  const fcMaxTanaka = tanaka(age);
  const fcMax = storedFcMax > 140 ? storedFcMax : fcMaxMeasured > 140 ? fcMaxMeasured : fcMaxTanaka;
  const fcMaxFonte =
    storedFcMax > 140
      ? 'cooper_calibrado'
      : fcMaxMeasured > 140
        ? 'garmin_proxy'
        : 'tanaka_estimada';

  // Threshold pace estimado do pace médio recente
  const recentPaces = (input.recentWorkouts as Array<Record<string, unknown>>)
    .filter((w) => Number(w.duration_s ?? 0) > 600 && Number(w.distance_m ?? 0) > 1000)
    .map((w) => Number(w.duration_s) / (Number(w.distance_m) / 1000))
    .filter((p) => p > 200 && p < 900);
  const medianPace =
    recentPaces.length > 0
      ? recentPaces.sort((a, b) => a - b)[Math.floor(recentPaces.length / 2)]
      : 360;
  const thresholdPaceSkm = Math.round(medianPace * 0.92);

  const zonas = karvonenZones(fcMax, fcRest);
  const zonaPaces = estimatePaceZones(thresholdPaceSkm);
  const zonasCal = zonas.map((z, i) => ({
    zona: z.zona,
    fc_min: z.fc_min,
    fc_max: z.fc_max,
    pace_min_s_km: zonaPaces[i].pace_min_s_km,
    pace_max_s_km: zonaPaces[i].pace_max_s_km,
    pace_min_fmt: formatPace(zonaPaces[i].pace_min_s_km),
    pace_max_fmt: formatPace(zonaPaces[i].pace_max_s_km),
  }));

  const workouts = input.recentWorkouts as Array<Record<string, unknown>>;
  const isRun = (w: Record<string, unknown>) => (w.sport ?? 'run') === 'run';

  // Volumes semanais — corrida separada de cross-training (fadiga é sistêmica)
  const weeklyVolumes: number[] = [0, 0, 0, 0];
  const weeklyRtss: number[] = [0, 0, 0, 0];
  const now = Date.now();
  for (const w of workouts) {
    const age_d = (now - new Date(String(w.date ?? '')).getTime()) / 86400000;
    const weekIdx = Math.floor(age_d / 7);
    if (weekIdx < 4) {
      if (isRun(w)) weeklyVolumes[weekIdx] += Number(w.distance_m ?? 0) / 1000;
      weeklyRtss[weekIdx] += Number(w.rtss ?? 0);
    }
  }

  // Cross-training por esporte (o coach precisa descontar fadiga sistêmica)
  const crossBySport = new Map<string, { sessoes: number; carga: number; minutos: number }>();
  for (const w of workouts) {
    if (isRun(w)) continue;
    const age_d = (now - new Date(String(w.date ?? '')).getTime()) / 86400000;
    if (age_d >= 28) continue;
    const sport = String(w.sport ?? 'other');
    const cur = crossBySport.get(sport) ?? { sessoes: 0, carga: 0, minutos: 0 };
    cur.sessoes += 1;
    cur.carga += Number(w.rtss ?? 0);
    cur.minutos += Math.round(Number(w.duration_s ?? 0) / 60);
    crossBySport.set(sport, cur);
  }
  const crossTrainingRecente = [...crossBySport.entries()].map(([esporte, v]) => ({
    esporte,
    sessoes: v.sessoes,
    carga_total: Math.round(v.carga),
    minutos_total: v.minutos,
  }));

  const ultimas4Semanas = weeklyVolumes
    .map((km, i) => ({
      semana: i === 0 ? 'atual' : `ha_${i}_semana${i > 1 ? 's' : ''}`,
      volume_km: Math.round(km * 10) / 10,
      rtss_total: Math.round(weeklyRtss[i]),
      n_sessoes: workouts.filter((w) => {
        const age_d = (now - new Date(String(w.date ?? '')).getTime()) / 86400000;
        return Math.floor(age_d / 7) === i;
      }).length,
    }))
    .reverse();

  // Métricas de carga
  const atl = Number(metrics?.atl ?? 0);
  const ctl = Number(metrics?.ctl ?? 0);
  const acwr = ctl > 0 ? atl / ctl : null;
  const tsb = ctl - atl;

  const tendencia = computeTendenciaCTL(history);
  const vo2max = estimateVO2max(fcMax, fcRest);
  const prontidao = computeProntidao(workouts);

  // Fase e restrições
  let weeksToRace: number | null = null;
  if (profile.race_date) {
    const raceMs = new Date(String(profile.race_date)).getTime();
    weeksToRace = Math.max(0, Math.round((raceMs - now) / (7 * 86400000)));
  }
  const fase = determineFase(input.calibrationMode, weeksToRace);

  // Restrições completas — todos os campos do generation_spec §3.1
  const volumeAtualKm = weeklyVolumes[0] ?? 0;
  const volumePrevKm = weeklyVolumes[1] ?? 0;
  const baseVolumeKm = Math.max(volumeAtualKm, volumePrevKm, ctl * 0.7);
  const freqNum = Math.max(2, Number(String(profile.weekly_frequency ?? '3x').replace(/\D/g, '')) || 3);
  const treinos_quality_max = input.calibrationMode ? 0 : fase === 'peak' || fase === 'build' ? 2 : 1;
  const restricoes: Record<string, unknown> = {
    volume_max_km: Math.round(baseVolumeKm * 1.10),
    volume_max_min: Math.round(baseVolumeKm * 1.10 * 6.5),
    acwr_max_aceitavel: input.calibrationMode ? 1.1 : 1.3,
    treinos_quality_max,
    dias_descanso_min: freqNum >= 5 ? 2 : 1,
  };

  // anos_correndo: estimado do histórico real (melhor do que hardcoded 1)
  const anosCorrenndo = input.firstWorkoutDate
    ? Math.max(
        0.5,
        Math.round(
          ((now - new Date(input.firstWorkoutDate).getTime()) / (365.25 * 86400000)) * 10,
        ) / 10,
      )
    : 1;

  // Dias disponíveis: perfil explícito > inferência por frequência
  const storedDays = profile.available_days as string[] | null | undefined;
  const diasDisponiveis =
    storedDays && storedDays.length > 0
      ? storedDays
      : inferDiasFromFrequency(String(profile.weekly_frequency ?? '3x'));

  // Melhor performance histórica derivada dos workouts
  const melhoresPaces = computeMelhoresPaces(workouts);

  // Treinos individuais das últimas 4 semanas
  const treinosIndividuais = buildTreinosIndividuais(workouts);

  const briefing: Record<string, unknown> = {
    perfil_atleta: {
      idade: age,
      peso_kg: profile.weight_kg ?? null,
      sexo: profile.sex ?? null,
      fc_max: fcMax,
      fc_max_fonte: fcMaxFonte,
      fc_repouso: fcRest,
      vo2max_estimado: vo2max,
      threshold_pace_s_km: thresholdPaceSkm,
      threshold_pace_fmt: formatPace(thresholdPaceSkm),
      anos_correndo: anosCorrenndo,
      objetivo_prova_km: profile.race_distance_km ?? null,
      lesoes_passadas: [],
    },
    objetivo: {
      modo: profile.goal_mode ?? 'general_progression',
      distancia_km: profile.race_distance_km ?? null,
      data_prova: profile.race_date ?? null,
      semanas_ate_prova: weeksToRace,
    },
    preferencias: {
      dias_disponiveis: diasDisponiveis,
      frequencia_semanal: freqNum,
      timezone: profile.timezone ?? 'America/Recife',
      dias_configurados_manualmente: !!(storedDays && storedDays.length > 0),
    },
    zonas_calibradas: zonasCal,
    // Treinos individuais: padrões visíveis por sessão (pace, FC, RPE, tipo)
    treinos_individuais: treinosIndividuais,
    ultimas_4_semanas: ultimas4Semanas,
    cross_training_recente: crossTrainingRecente,
    // Âncoras de performance derivadas do histórico real
    referencias_performance: melhoresPaces,
    carga_atual: {
      atl: Math.round(atl * 10) / 10,
      ctl: Math.round(ctl * 10) / 10,
      acwr: acwr !== null ? Math.round(acwr * 100) / 100 : null,
      tsb: Math.round(tsb * 10) / 10,
      tendencia_ctl_14d: tendencia.label,
      tendencia_ctl_delta_pct: tendencia.delta_pct,
    },
    prontidao: {
      status: prontidao.status,
      nota: prontidao.nota,
    },
    fase_atual: fase,
    calibracao_ativa: input.calibrationMode,
    restricoes_calculadas: restricoes,
  };

  if (errorAnterior) {
    briefing.erro_tentativa_anterior = errorAnterior;
  }

  return briefing;
}

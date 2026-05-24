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

// Tendência CTL: compara CTL mais antigo disponível vs mais recente
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

// VO2max estimado via Uth et al.: VO2max ≈ 15 × (FCmax / FCrepouso)
function estimateVO2max(fcMax: number, fcRest: number): number {
  return Math.round(15 * (fcMax / fcRest) * 10) / 10;
}

// Prontidão: baseada em RPE recente e tendência de FC
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

  // HR efficiency: avg_hr / pace — subindo significa maior FC para mesmo pace (fadiga)
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

  // Sinais de fadiga: RPE subindo ou eficiência piorando (HR/pace subindo)
  const rpeFatigado = rpeRecent !== null && rpePrev !== null && rpeRecent > rpePrev + 1.5;
  const effFatigado = effRecent !== null && effPrev !== null && effRecent > effPrev * 1.05;
  const rpeDescansado = rpeRecent !== null && rpePrev !== null && rpeRecent < rpePrev - 1;

  if (rpeFatigado || effFatigado) {
    return {
      status: 'fatigado',
      nota: `RPE médio recente ${rpeRecent?.toFixed(1) ?? '?'} vs ${rpePrev?.toFixed(1) ?? '?'} anterior`,
    };
  }
  if (rpeDescansado || recent7.length === 0) {
    return {
      status: 'descansado',
      nota:
        recent7.length === 0
          ? 'Sem treinos recentes'
          : `RPE médio recente ${rpeRecent?.toFixed(1) ?? '?'}`,
    };
  }
  if (rpeRecent === null && rpePrev === null) {
    return { status: 'desconhecida', nota: 'Sem dados de RPE disponíveis' };
  }
  return {
    status: 'normal',
    nota: `RPE médio recente ${rpeRecent?.toFixed(1) ?? '?'}`,
  };
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

  // Resumo últimas 4 semanas. `volume_km` conta SÓ corrida (km de natação/bike
  // não somam com km de corrida); a carga (rtss_total) conta TODOS os esportes,
  // porque fadiga é sistêmica — o coach precisa enxergar o volume total mesmo
  // prescrevendo só corrida.
  const workouts = input.recentWorkouts as Array<Record<string, unknown>>;
  const isRun = (w: Record<string, unknown>) => (w.sport ?? 'run') === 'run';
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

  // Cross-training (não-corrida) das últimas 4 semanas, por esporte — o LLM usa
  // isso pra NÃO prescrever volume demais quando o atleta já carrega fadiga de
  // bike/natação/força.
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

  // Tendência CTL 14 dias — calculada do histórico
  const tendencia = computeTendenciaCTL(history);

  // VO2max estimado via Uth et al.
  const vo2max = estimateVO2max(fcMax, fcRest);

  // Prontidão baseada em RPE e eficiência aeróbica
  const prontidao = computeProntidao(workouts);

  // Fase e restrições
  let weeksToRace: number | null = null;
  if (profile.race_date) {
    const raceMs = new Date(String(profile.race_date)).getTime();
    weeksToRace = Math.max(0, Math.round((raceMs - now) / (7 * 86400000)));
  }
  const fase = determineFase(input.calibrationMode, weeksToRace);

  const restricoes: Record<string, unknown> = {};
  if (acwr !== null && acwr > 1.1) {
    const safeKm = ctl > 0 ? Math.round((ctl * 1.3 * 7) / 5) : null;
    if (safeKm) restricoes.max_km_semana = safeKm;
  }

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
      anos_correndo: 1,
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
      dias_disponiveis: profile.weekly_frequency ?? '3-5',
      timezone: profile.timezone ?? 'America/Recife',
    },
    zonas_calibradas: zonasCal,
    ultimas_4_semanas: ultimas4Semanas,
    // Treinos não-corrida que contribuem pra fadiga total (US do volume real).
    // Vazio = atleta só corre. Coach deve descontar essa carga ao prescrever.
    cross_training_recente: crossTrainingRecente,
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

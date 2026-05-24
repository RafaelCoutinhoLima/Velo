// Classificação de esporte a partir do `typeKey` do Garmin — espelha a lógica
// do sidecar (services/garmin-sidecar/app/garmin/client.py:_classify_sport).
// Vive aqui pra a API derivar o esporte do `raw_payload` SEM precisar de uma
// coluna dedicada no banco (evita migração; o typeKey já está salvo em todo
// workout sincronizado).

export type Sport = 'run' | 'bike' | 'swim' | 'strength' | 'other';

const SPORT_MAP: Record<string, Sport> = {
  // corrida (todas as superfícies/modos)
  running: 'run',
  trail_running: 'run',
  treadmill_running: 'run',
  track_running: 'run',
  street_running: 'run',
  virtual_run: 'run',
  indoor_running: 'run',
  obstacle_run: 'run',
  // bike
  cycling: 'bike',
  road_biking: 'bike',
  mountain_biking: 'bike',
  gravel_cycling: 'bike',
  cyclocross: 'bike',
  track_cycling: 'bike',
  indoor_cycling: 'bike',
  virtual_ride: 'bike',
  recumbent_cycling: 'bike',
  e_bike_fitness: 'bike',
  bmx: 'bike',
  // natação
  lap_swimming: 'swim',
  open_water_swimming: 'swim',
  swimming: 'swim',
  // força / cardio estruturado
  strength_training: 'strength',
  indoor_cardio: 'strength',
  pilates: 'strength',
  yoga: 'strength',
};

export function classifySport(typeKey: string | null | undefined): Sport {
  if (!typeKey) return 'run'; // sem info → assume corrida (histórico só tinha corrida)
  if (SPORT_MAP[typeKey]) return SPORT_MAP[typeKey];
  if (typeKey.includes('running') || typeKey === 'run') return 'run';
  if (typeKey.includes('cycling') || typeKey.includes('biking') || typeKey.includes('bike'))
    return 'bike';
  if (typeKey.includes('swimming')) return 'swim';
  return 'other';
}

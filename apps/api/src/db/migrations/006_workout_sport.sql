-- 006_workout_sport.sql — Suporte multi-esporte.
-- O coach prescreve só corrida, mas precisa enxergar TODA a carga de treino
-- (bike, natação, força) pra estimar fadiga/ACWR corretamente. Antes só
-- corrida era importada; agora importamos tudo e marcamos o esporte.

-- Esporte normalizado: 'run' | 'bike' | 'swim' | 'strength' | 'other'.
-- Default 'run' mantém compatível os registros antigos (eram todos corrida).
alter table workouts add column if not exists sport text not null default 'run';

-- Backfill: tenta inferir o esporte dos registros antigos pelo raw_payload.
-- typeKey do Garmin → nosso enum. O que não casar fica como 'run' (default),
-- já que historicamente só corrida entrava.
update workouts
set sport = case
  when raw_payload->'activityType'->>'typeKey' like '%cycling%' then 'bike'
  when raw_payload->'activityType'->>'typeKey' like '%biking%'  then 'bike'
  when raw_payload->'activityType'->>'typeKey' like '%swimming%' then 'swim'
  when raw_payload->'activityType'->>'typeKey' in ('strength_training', 'indoor_cardio') then 'strength'
  when raw_payload->'activityType'->>'typeKey' like '%running%' then 'run'
  else sport
end
where raw_payload is not null;

-- Índice pra filtrar por esporte (ex: só corrida no cálculo de pace/rTSS).
create index if not exists workouts_sport_idx on workouts (athlete_id, sport);

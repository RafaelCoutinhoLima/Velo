-- 004_profile_zones.sql — Campos de calibração fisiológica no perfil do atleta

-- sex passa a ter default para compatibilidade com upserts parciais
alter table athletes alter column sex set default 'other';

-- FC máxima e de repouso medidas (Cooper test ou wearable)
-- Opcionais: quando null, briefing usa estimativas (Tanaka / 60bpm)
alter table athletes add column if not exists fc_max   smallint;
alter table athletes add column if not exists fc_rest  smallint;

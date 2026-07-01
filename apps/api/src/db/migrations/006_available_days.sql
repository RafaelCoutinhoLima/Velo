-- 006_available_days.sql — Dias preferidos de treino por atleta
-- Armazena os dias da semana que o atleta tem disponibilidade.
-- Exemplo: ["seg","qua","sex"] ou ["ter","qui","sab","dom"]
-- Quando null, o briefing infere a partir de weekly_frequency.
alter table athletes add column if not exists available_days text[];

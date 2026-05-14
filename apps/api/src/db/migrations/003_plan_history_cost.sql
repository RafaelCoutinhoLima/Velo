-- 003_plan_history_cost.sql — Adiciona rastreamento de custo e input no histórico de planos
alter table plan_history
  add column if not exists input_json   jsonb,
  add column if not exists tokens_used  int,
  add column if not exists cost_usd     numeric(8,6);

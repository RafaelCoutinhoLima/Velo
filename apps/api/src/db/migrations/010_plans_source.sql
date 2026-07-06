-- 010 — US-019: replanejamento sob demanda com rate limit semanal
--
-- `source` distingue como o plano nasceu: 'generate' (fluxo normal) ou
-- 'replan' (replanejamento pedido pelo atleta). O rate limit de 1 replan
-- por semana é verificado pelo created_at do último plano com source='replan'
-- — sem tabela nova (replan_requests virou desnecessária).

alter table public.plans
  add column if not exists source text not null default 'generate';

-- O rate limit consulta (athlete_id, source) ordenado por created_at.
create index if not exists plans_athlete_source_idx
  on public.plans (athlete_id, source, created_at desc);

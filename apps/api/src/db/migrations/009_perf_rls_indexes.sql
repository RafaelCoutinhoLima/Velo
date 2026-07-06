-- 009 — Performance e higiene (advisors do Supabase, 2026-07-06)
--
-- 1. RLS initplan: `auth.uid()` cru nas políticas é reavaliado POR LINHA;
--    `(select auth.uid())` vira InitPlan (avaliado 1x por query). Mesmíssima
--    semântica de autorização, só muda o plano de execução.
-- 2. Índices cobrindo FKs sem índice (feedback.workout_id é consultado no
--    fluxo de feedback; os outros protegem deletes em cascata).
-- 3. Remove pg_trgm: criado na 001 e nunca usado (zero dependências no banco
--    e nenhuma referência no código) — e morava no schema public (advisor de
--    segurança).

-- ── 1. Políticas RLS com (select auth.uid()) ────────────────────────────────

drop policy if exists "own data" on public.athletes;
create policy "own data" on public.athletes
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'claude_usage', 'consents', 'feedback', 'guardrail_violations', 'jobs',
    'metrics_daily', 'plan_history', 'plans', 'workouts'
  ]
  loop
    execute format('drop policy if exists "own data" on public.%I', t);
    execute format(
      $p$create policy "own data" on public.%I
        for all
        using (athlete_id in (select id from public.athletes where user_id = (select auth.uid())))
        with check (athlete_id in (select id from public.athletes where user_id = (select auth.uid())))$p$,
      t
    );
  end loop;
end $$;

-- ── 2. Índices de FK ────────────────────────────────────────────────────────

create index if not exists feedback_workout_id_idx on public.feedback (workout_id);
create index if not exists guardrail_violations_plan_id_idx on public.guardrail_violations (plan_id);
create index if not exists plan_history_plan_id_idx on public.plan_history (plan_id);

-- ── 3. pg_trgm fora ─────────────────────────────────────────────────────────

drop extension if exists pg_trgm;

-- ── 4. Stats de calibração em 1 round-trip ──────────────────────────────────
-- evaluateCalibration precisava de TODAS as datas de workouts (full-scan sem
-- limit) em cada abertura da home durante a calibração. Esta função devolve
-- os dois agregados de que a regra precisa numa linha só.
create or replace function public.workout_calibration_stats(p_athlete_id uuid)
returns table (distinct_days integer, earliest_date date)
language sql
stable
as $$
  select count(distinct date)::integer, min(date)
  from public.workouts
  where athlete_id = p_athlete_id
$$;

-- Mesma postura da 007: funções internas só para o service_role.
revoke execute on function public.workout_calibration_stats(uuid) from public, anon, authenticated;
grant execute on function public.workout_calibration_stats(uuid) to service_role;

-- 007_security_hardening.sql — Endurecimento de segurança (auditoria 2026-07-03)
-- Executar no SQL Editor do Supabase (região sa-east-1).
--
-- Contexto: as funções SECURITY DEFINER de 002 foram criadas em `public` e,
-- por padrão do Postgres, EXECUTE é concedido a PUBLIC. No Supabase toda função
-- em `public` vira endpoint PostgREST (POST /rest/v1/rpc/<fn>) chamável pelos
-- roles `anon` e `authenticated`. Como get_garmin_token roda como owner (lê
-- vault.decrypted_secrets) e não valida o chamador, QUALQUER portador da anon
-- key pública podia exfiltrar a sessão Garmin decifrada de qualquer atleta.
-- Esta migração revoga esse acesso e deixa as funções chamáveis só pelo
-- service_role (que a API usa server-side).

-- ─── 1. increment_claude_usage: agora ATÔMICO (reserva de cota) ───────────────
-- Antes retornava void e o app fazia check-then-act (TOCTOU): duas gerações
-- concorrentes liam call_count=29, ambas passavam e ambas chamavam o Claude.
-- Agora retorna o novo contador — a app reserva a cota ANTES de chamar o Claude
-- e rejeita se o valor devolvido ultrapassar o teto. Trocar o tipo de retorno
-- exige DROP (create-or-replace não muda return type).
drop function if exists public.increment_claude_usage(uuid, date);
create function public.increment_claude_usage(p_athlete_id uuid, p_month date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.claude_usage (athlete_id, month, call_count)
  values (p_athlete_id, p_month, 1)
  on conflict (athlete_id, month)
  do update set call_count = public.claude_usage.call_count + 1
  returning call_count into v_count;
  return v_count;
end;
$$;

-- ─── 2. delete_garmin_token: limpeza do Vault na exclusão de conta (LGPD) ──────
-- O segredo garmin_<athlete_id> vive em vault.secrets, FORA do cascade de FKs.
-- Sem isto, apagar a conta deixa a sessão OAuth do Garmin órfã e retida.
create or replace function public.delete_garmin_token(p_athlete_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name text := 'garmin_' || p_athlete_id::text;
begin
  delete from vault.secrets where name = v_name;
end;
$$;

-- ─── 3. REVOKE EXECUTE de public/anon/authenticated; GRANT só service_role ────
-- Recriar funções reseta grants para o default (PUBLIC), então revogamos ao fim.
revoke execute on function public.increment_claude_usage(uuid, date) from public;
revoke execute on function public.get_garmin_token(uuid)            from public;
revoke execute on function public.store_garmin_token(uuid, text)    from public;
revoke execute on function public.delete_garmin_token(uuid)         from public;

-- anon/authenticated são os roles que a borda PostgREST expõe ao cliente.
revoke execute on function public.increment_claude_usage(uuid, date) from anon, authenticated;
revoke execute on function public.get_garmin_token(uuid)            from anon, authenticated;
revoke execute on function public.store_garmin_token(uuid, text)    from anon, authenticated;
revoke execute on function public.delete_garmin_token(uuid)         from anon, authenticated;

-- service_role é o que a API usa server-side (SUPABASE_SERVICE_ROLE_KEY).
grant execute on function public.increment_claude_usage(uuid, date) to service_role;
grant execute on function public.get_garmin_token(uuid)            to service_role;
grant execute on function public.store_garmin_token(uuid, text)    to service_role;
grant execute on function public.delete_garmin_token(uuid)         to service_role;

-- ─── 4. RLS: WITH CHECK nas políticas de escrita (defesa em profundidade) ──────
-- As políticas de 001 só têm USING; para INSERT/UPDATE o escopo do dono precisa
-- de WITH CHECK, senão um caminho autenticado direto (fora do service_role)
-- poderia gravar linhas de outro atleta. O service_role continua bypassando RLS;
-- isto protege caso algum acesso passe a usar a anon/authenticated key.
drop policy if exists "own data" on athletes;
create policy "own data" on athletes
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'workouts','metrics_daily','plans','plan_history','jobs',
    'consents','feedback','claude_usage','guardrail_violations'
  ]
  loop
    execute format('drop policy if exists "own data" on %I', t);
    execute format(
      'create policy "own data" on %I using (athlete_id in (select id from athletes where user_id = auth.uid())) with check (athlete_id in (select id from athletes where user_id = auth.uid()))',
      t
    );
  end loop;
end $$;

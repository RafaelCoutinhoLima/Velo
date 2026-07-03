-- 008_lockdown_rls_auto_enable.sql — Endurecimento (auditoria 2026-07-03)
-- Executar no SQL Editor do Supabase.
--
-- rls_auto_enable() é uma função de EVENT TRIGGER (auto-habilita RLS em tabelas
-- novas do schema public). Não deveria ser chamável via PostgREST, mas o
-- advisor do Supabase apontou que anon/authenticated tinham EXECUTE — mesma
-- classe do achado das funções do Vault. Revogar não afeta o event trigger que
-- a dispara (ele roda no contexto do DDL, não via este GRANT).
--
-- Guardado por existência: em bancos onde a função não foi criada (ela é um
-- extra gerenciado no Supabase, fora de 001–006), o bloco simplesmente não faz
-- nada em vez de quebrar a migração.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

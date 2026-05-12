-- 002_functions.sql — Funções RPC e helpers Vault

-- increment_claude_usage: upsert atômico do contador mensal de chamadas Claude
create or replace function public.increment_claude_usage(p_athlete_id uuid, p_month date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.claude_usage (athlete_id, month, call_count)
  values (p_athlete_id, p_month, 1)
  on conflict (athlete_id, month)
  do update set call_count = public.claude_usage.call_count + 1;
end;
$$;

-- store_garmin_token: cifra e persiste a sessão Garmin no Vault
create or replace function public.store_garmin_token(p_athlete_id uuid, p_tokens text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name text := 'garmin_' || p_athlete_id::text;
  v_id   uuid;
begin
  select id into v_id from vault.secrets where name = v_name limit 1;
  if v_id is not null then
    perform vault.update_secret(v_id, p_tokens);
  else
    perform vault.create_secret(p_tokens, v_name, 'Garmin OAuth session tokens');
  end if;
end;
$$;

-- get_garmin_token: recupera e decifra a sessão Garmin do Vault
create or replace function public.get_garmin_token(p_athlete_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name  text := 'garmin_' || p_athlete_id::text;
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = v_name
  limit 1;
  return v_token;
end;
$$;

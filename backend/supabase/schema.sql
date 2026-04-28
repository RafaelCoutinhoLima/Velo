-- FitSync AI — Schema inicial (Sprint 1)
-- Executar no SQL Editor do Supabase

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ─── garmin_tokens ────────────────────────────────────────────────────────────
-- Armazena os tokens OAuth do Garmin por usuário.
create table if not exists garmin_tokens (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    tokens      jsonb not null,
    updated_at  timestamptz default now(),
    unique (user_id)
);

-- ─── activities ───────────────────────────────────────────────────────────────
-- Cache das atividades importadas do Garmin.
create table if not exists activities (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    garmin_id           text not null,
    date                date not null,
    distance_km         numeric(6,2) not null check (distance_km > 0),
    duration_seconds    integer not null check (duration_seconds > 0),
    avg_pace_sec        integer,
    avg_hr              integer,
    max_hr              integer,
    activity_type       text not null default 'running',
    created_at          timestamptz default now(),
    unique (user_id, garmin_id)
);

-- ─── athlete_profile ──────────────────────────────────────────────────────────
-- Zonas e métricas calculadas a partir do teste de 3 km.
create table if not exists athlete_profile (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    max_hr              integer not null,
    resting_hr          integer not null,
    threshold_pace_sec  integer not null,
    hr_zones            jsonb not null,   -- lista de 5 zonas {zone, min_bpm, max_bpm}
    pace_zones          jsonb not null,   -- lista de 3 zonas {zone, min_sec, max_sec}
    source_activity_id  uuid references activities(id),
    updated_at          timestamptz default now(),
    unique (user_id)
);

-- ─── training_goals ───────────────────────────────────────────────────────────
create table if not exists training_goals (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    goal_distance_km    numeric(6,1) not null,
    weeks               integer not null check (weeks between 4 and 16),
    days_per_week       integer not null check (days_per_week between 3 and 5),
    target_time         text,
    created_at          timestamptz default now()
);

-- ─── training_plans ───────────────────────────────────────────────────────────
create table if not exists training_plans (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    goal_id     uuid references training_goals(id),
    plan_json   jsonb not null,
    is_active   boolean default true,
    created_at  timestamptz default now()
);

-- ─── workout_feedback ─────────────────────────────────────────────────────────
create table if not exists workout_feedback (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    workout_id      text not null,
    rating          text not null check (rating in ('easy', 'medium', 'hard')),
    created_at      timestamptz default now()
);

-- ─── plan_memory ──────────────────────────────────────────────────────────────
-- Segunda memória da IA: casos históricos de planos com outcome de feedback.
-- Injetados no system prompt como few-shot context na próxima geração.
create table if not exists plan_memory (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    goal_distance_km    numeric(6,1) not null,
    profile_snapshot    jsonb not null,  -- {max_hr, resting_hr, threshold_pace_sec}
    goals_snapshot      jsonb not null,  -- {weeks, days_per_week}
    plan_stats          jsonb not null,  -- {avg_km_per_week, week1_km, interval_sessions}
    feedback_ratings    jsonb not null default '[]',  -- ["medium","hard",...]
    outcome             text not null default 'pending'
                            check (outcome in ('pending','appropriate','too_easy','too_hard')),
    created_at          timestamptz default now(),
    updated_at          timestamptz default now()
);

alter table plan_memory enable row level security;
create policy "own data only" on plan_memory using (auth.uid() = user_id);

-- ─── llm_logs ─────────────────────────────────────────────────────────────────
-- Log de todas as chamadas à Claude API para debug e custo.
create table if not exists llm_logs (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid references auth.users(id),
    prompt_tokens   integer,
    output_tokens   integer,
    model           text,
    success         boolean,
    error_msg       text,
    created_at      timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table garmin_tokens      enable row level security;
alter table activities         enable row level security;
alter table athlete_profile    enable row level security;
alter table training_goals     enable row level security;
alter table training_plans     enable row level security;
alter table workout_feedback   enable row level security;

-- Política padrão: usuário só acessa seus próprios dados
create policy "own data only" on garmin_tokens    using (auth.uid() = user_id);
create policy "own data only" on activities       using (auth.uid() = user_id);
create policy "own data only" on athlete_profile  using (auth.uid() = user_id);
create policy "own data only" on training_goals   using (auth.uid() = user_id);
create policy "own data only" on training_plans   using (auth.uid() = user_id);
create policy "own data only" on workout_feedback using (auth.uid() = user_id);

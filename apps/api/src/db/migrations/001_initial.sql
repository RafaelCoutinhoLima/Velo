-- 001_initial.sql — Schema inicial FitSync AI
-- Executar no SQL Editor do Supabase (região sa-east-1)

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ─── athletes ────────────────────────────────────────────────────────────────
create table athletes (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade unique not null,
  email            text not null,
  birth_year       smallint not null,
  weight_kg        numeric(5,2) not null,
  sex              text not null check (sex in ('M','F','other')),
  modality         text not null default 'running',
  weekly_frequency text not null,
  timezone         text not null default 'America/Recife',
  goal_mode        text not null check (goal_mode in ('race','general_progression')),
  race_date        date,
  race_distance_km numeric(5,2),
  calibration_mode boolean not null default true,
  created_at       timestamptz not null default now()
);

create index athletes_user_id_idx on athletes (user_id);

-- ─── workouts ────────────────────────────────────────────────────────────────
create table workouts (
  id              uuid primary key default uuid_generate_v4(),
  athlete_id      uuid references athletes(id) on delete cascade not null,
  garmin_id       text not null,
  date            date not null,
  distance_m      integer not null,
  duration_s      integer not null,
  avg_hr          integer,
  rtss            numeric(6,2),
  rpe             smallint check (rpe between 1 and 10),
  raw_payload     jsonb,
  created_at      timestamptz not null default now(),
  unique (athlete_id, garmin_id)
);

create index workouts_athlete_id_idx on workouts (athlete_id);
create index workouts_date_idx on workouts (athlete_id, date desc);

-- ─── metrics_daily ───────────────────────────────────────────────────────────
create table metrics_daily (
  id         uuid primary key default uuid_generate_v4(),
  athlete_id uuid references athletes(id) on delete cascade not null,
  date       date not null,
  atl        numeric(6,2),
  ctl        numeric(6,2),
  tsb        numeric(6,2),
  acwr       numeric(5,3),
  updated_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create index metrics_daily_athlete_id_idx on metrics_daily (athlete_id);

-- ─── plans ───────────────────────────────────────────────────────────────────
create table plans (
  id            uuid primary key default uuid_generate_v4(),
  athlete_id    uuid references athletes(id) on delete cascade not null,
  week_start    date not null,
  plan_json     jsonb not null,
  why_text      text,
  is_active     boolean not null default true,
  prompt_version text not null,
  created_at    timestamptz not null default now()
);

create index plans_athlete_id_idx on plans (athlete_id);

-- ─── plan_history ────────────────────────────────────────────────────────────
create table plan_history (
  id             uuid primary key default uuid_generate_v4(),
  athlete_id     uuid references athletes(id) on delete cascade not null,
  plan_id        uuid references plans(id) on delete cascade not null,
  plan_snapshot  jsonb not null,
  prompt_version text not null,
  created_at     timestamptz not null default now()
);

create index plan_history_athlete_id_idx on plan_history (athlete_id);

-- ─── jobs ────────────────────────────────────────────────────────────────────
create table jobs (
  id          uuid primary key default uuid_generate_v4(),
  athlete_id  uuid references athletes(id) on delete cascade not null,
  type        text not null check (type in ('plan_generate','plan_replan','feedback_generate')),
  payload     jsonb not null,
  status      text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts    int not null default 0,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz
);

create index jobs_pending_idx on jobs (status, created_at) where status = 'pending';
create index jobs_athlete_id_idx on jobs (athlete_id);

-- ─── consents ────────────────────────────────────────────────────────────────
create table consents (
  id           uuid primary key default uuid_generate_v4(),
  athlete_id   uuid references athletes(id) on delete cascade not null,
  consent_text text not null,
  version      text not null,
  accepted_at  timestamptz not null default now()
);

create index consents_athlete_id_idx on consents (athlete_id);

-- ─── feedback ────────────────────────────────────────────────────────────────
create table feedback (
  id          uuid primary key default uuid_generate_v4(),
  athlete_id  uuid references athletes(id) on delete cascade not null,
  workout_id  uuid references workouts(id) on delete cascade not null,
  feedback_md text not null,
  created_at  timestamptz not null default now()
);

create index feedback_athlete_id_idx on feedback (athlete_id);

-- ─── claude_usage ────────────────────────────────────────────────────────────
create table claude_usage (
  athlete_id uuid references athletes(id) on delete cascade not null,
  month      date not null,
  call_count int not null default 0,
  primary key (athlete_id, month)
);

-- ─── guardrail_violations ────────────────────────────────────────────────────
create table guardrail_violations (
  id          uuid primary key default uuid_generate_v4(),
  athlete_id  uuid references athletes(id) on delete cascade not null,
  plan_id     uuid references plans(id),
  rule        text not null,
  value       numeric,
  threshold   numeric,
  created_at  timestamptz not null default now()
);

create index guardrail_violations_athlete_id_idx on guardrail_violations (athlete_id);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table athletes            enable row level security;
alter table workouts            enable row level security;
alter table metrics_daily       enable row level security;
alter table plans               enable row level security;
alter table plan_history        enable row level security;
alter table jobs                enable row level security;
alter table consents            enable row level security;
alter table feedback            enable row level security;
alter table claude_usage        enable row level security;
alter table guardrail_violations enable row level security;

-- Política base: atleta só vê seus próprios dados
create policy "own data" on athletes            using (auth.uid() = user_id);
create policy "own data" on workouts            using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on metrics_daily       using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on plans               using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on plan_history        using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on jobs                using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on consents            using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on feedback            using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on claude_usage        using (athlete_id in (select id from athletes where user_id = auth.uid()));
create policy "own data" on guardrail_violations using (athlete_id in (select id from athletes where user_id = auth.uid()));

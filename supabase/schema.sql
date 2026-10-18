-- GymBoy database. Run once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Every row belongs to one user, and row-level security means a user can only ever read or
-- change their own rows, even though the browser talks to the database directly.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,                       -- the onboarding answers + weigh-ins
  updated_at timestamptz not null default now()
);

create table if not exists public.scans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz,
  report      jsonb not null,                      -- the AI report (see ai/scan-report.schema.json)
  created_at  timestamptz not null default now()
);

create index if not exists scans_user_created_idx on public.scans (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.scans    enable row level security;

drop policy if exists "profiles: own rows" on public.profiles;
create policy "profiles: own rows" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scans: own rows" on public.scans;
create policy "scans: own rows" on public.scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

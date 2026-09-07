-- SB & YJ Daily 기록 · Supabase 스키마
-- SQL Editor에서 한 번 실행하세요.

create table if not exists attendance (
  id text primary key,
  user_id text not null check (user_id in ('seongbae', 'lovely')),
  date date not null,
  clock_in text,
  clock_out text,
  updated_at timestamptz not null default now()
);

create index if not exists attendance_date_idx on attendance (date);
create index if not exists attendance_user_date_idx on attendance (user_id, date);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (user_id in ('seongbae', 'lovely')),
  date date not null,
  type text not null,
  minutes int,
  note text default '',
  created_at timestamptz not null default now()
);

create index if not exists workouts_date_idx on workouts (date);
create index if not exists workouts_user_date_idx on workouts (user_id, date);

create table if not exists fatigue (
  id text primary key,
  user_id text not null check (user_id in ('seongbae', 'lovely')),
  date date not null,
  level int not null check (level between 1 and 10),
  updated_at timestamptz not null default now()
);

create index if not exists fatigue_date_idx on fatigue (date);
create index if not exists fatigue_user_date_idx on fatigue (user_id, date);

alter table attendance enable row level security;
alter table workouts enable row level security;
alter table fatigue enable row level security;

-- 둘만 쓰는 비공개 앱용: anon 키로 읽기/쓰기 허용
-- (공개 URL을 아무에게나 공유하지 마세요)
drop policy if exists "attendance_all" on attendance;
create policy "attendance_all" on attendance
  for all
  using (true)
  with check (true);

drop policy if exists "workouts_all" on workouts;
create policy "workouts_all" on workouts
  for all
  using (true)
  with check (true);

drop policy if exists "fatigue_all" on fatigue;
create policy "fatigue_all" on fatigue
  for all
  using (true)
  with check (true);

-- Realtime (Dashboard > Database > Replication 에서도 켤 수 있음)
-- 이미 publication에 있으면 건너뜀 → 재실행 안전
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table attendance;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workouts'
  ) then
    alter publication supabase_realtime add table workouts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fatigue'
  ) then
    alter publication supabase_realtime add table fatigue;
  end if;
end $$;

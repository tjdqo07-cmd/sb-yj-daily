-- 이미 프로젝트를 만든 경우: 이 파일만 SQL Editor에서 실행하세요.
-- (주간 먹고싶은것 / 하고싶은것)

create table if not exists weekly_wishes (
  id text primary key,
  user_id text not null check (user_id in ('seongbae', 'lovely')),
  week_start date not null,
  food_note text default '',
  food_tags text[] default '{}',
  wish_note text default '',
  wish_tags text[] default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists weekly_wishes_week_idx on weekly_wishes (week_start);
create index if not exists weekly_wishes_user_week_idx on weekly_wishes (user_id, week_start);

alter table weekly_wishes enable row level security;

drop policy if exists "weekly_wishes_all" on weekly_wishes;
create policy "weekly_wishes_all" on weekly_wishes
  for all
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weekly_wishes'
  ) then
    alter publication supabase_realtime add table weekly_wishes;
  end if;
end $$;

-- Phase 4: 기체 누적시간 · 정비 주기 · 방문 비행장
--
-- 전부 추가뿐이다. 기존 데이터는 그대로 남고 재실행해도 안전하다.
-- 방문 비행장은 기존 기록에서 계산해 내므로 테이블이 필요 없다.

begin;

-- ── 기록 시작 전 기체에 쌓여 있던 시간 ──────────────────────
-- 이 앱으로 기록하기 전에도 기체는 날았다. 그 시간을 더해야
-- 정비 주기 판단에 쓸 수 있는 진짜 누적시간이 나온다.
alter table public.aircraft
  add column if not exists initial_hours numeric(8,1) not null default 0;

comment on column public.aircraft.initial_hours is
  '이 앱으로 기록을 시작하기 전까지 기체에 쌓여 있던 비행시간';

-- ── 정비 주기 ────────────────────────────────────────────────
-- 오일 교환, 100시간 점검처럼 기체시간 기준으로 돌아오는 항목.
-- 마지막 수행 시점의 기체 누적시간을 적어두면 남은 시간이 계산된다.
create table if not exists public.maintenance_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  aircraft_id uuid references public.aircraft(id) on delete cascade not null,
  name text not null,
  interval_hours numeric(7,1) not null check (interval_hours > 0),
  last_done_hours numeric(8,1),
  last_done_on date,
  note text,
  created_at timestamptz default now() not null
);

alter table public.maintenance_items enable row level security;

drop policy if exists "Users can view own maintenance" on public.maintenance_items;
create policy "Users can view own maintenance"
  on public.maintenance_items for select using (user_id = auth.uid());

drop policy if exists "Users can insert own maintenance" on public.maintenance_items;
create policy "Users can insert own maintenance"
  on public.maintenance_items for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own maintenance" on public.maintenance_items;
create policy "Users can update own maintenance"
  on public.maintenance_items for update using (user_id = auth.uid());

drop policy if exists "Users can delete own maintenance" on public.maintenance_items;
create policy "Users can delete own maintenance"
  on public.maintenance_items for delete using (user_id = auth.uid());

create index if not exists idx_maintenance_aircraft
  on public.maintenance_items (user_id, aircraft_id);

commit;

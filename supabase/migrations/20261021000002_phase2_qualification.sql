-- Phase 2: 기체 · 단독/동승 · 야외비행 · 자격 진행률
--
-- 1단계와 달리 기존 데이터를 지우지 않는다. 전부 추가뿐이고
-- 기존 기록은 기본값(동승 · 야외비행 아님 · 기체 미지정)으로 남는다.
-- 재실행해도 안전하다.

begin;

-- ── 기체 ─────────────────────────────────────────────────────
-- 텍스트 한 칸이 아니라 테이블로 둔다. 기종별로 자격 요건이 다르고,
-- 면허 이후에는 안전성인증·보험 만료일과 정비 주기가 여기에 붙는다.
create table if not exists public.aircraft (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  registration text not null,
  -- 항공안전법상 경량항공기 5종
  category text not null check (category in (
    '타면조종형비행기', '체중이동형비행기', '경량헬리콥터', '자이로플레인', '동력패러슈트'
  )),
  model text,
  note text,
  created_at timestamptz default now() not null
);

alter table public.aircraft enable row level security;

drop policy if exists "Users can view own aircraft" on public.aircraft;
create policy "Users can view own aircraft"
  on public.aircraft for select using (user_id = auth.uid());

drop policy if exists "Users can insert own aircraft" on public.aircraft;
create policy "Users can insert own aircraft"
  on public.aircraft for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own aircraft" on public.aircraft;
create policy "Users can update own aircraft"
  on public.aircraft for update using (user_id = auth.uid());

drop policy if exists "Users can delete own aircraft" on public.aircraft;
create policy "Users can delete own aircraft"
  on public.aircraft for delete using (user_id = auth.uid());

create unique index if not exists idx_aircraft_registration
  on public.aircraft (user_id, registration);

-- ── 비행기록에 자격 요건용 항목 추가 ─────────────────────────
alter table public.flight_logs
  add column if not exists aircraft_id uuid references public.aircraft(id) on delete set null;

-- 단독 5시간 요건을 집계하려면 구분이 있어야 한다.
-- 기존 기록은 교관 동승으로 둔다 (훈련 기록이 대부분이므로 안전한 기본값).
alter table public.flight_logs
  add column if not exists pilot_role text not null default 'dual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'flight_logs_pilot_role_check'
  ) then
    alter table public.flight_logs
      add constraint flight_logs_pilot_role_check
      check (pilot_role in ('solo', 'dual'));
  end if;
end $$;

-- 야외비행 여부와 구간 거리. 거리는 좌표가 있을 때 자동 계산되지만
-- 조종사가 직접 고칠 수 있어야 하므로 따로 저장한다.
alter table public.flight_logs
  add column if not exists is_cross_country boolean not null default false;
alter table public.flight_logs
  add column if not exists leg_distance_km numeric(7,1);

create index if not exists idx_flight_logs_role
  on public.flight_logs (user_id, pilot_role);

commit;

-- 확인용
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_name = 'flight_logs' order by ordinal_position;

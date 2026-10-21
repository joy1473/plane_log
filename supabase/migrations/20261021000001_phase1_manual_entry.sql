-- Phase 1: 직접 입력 · 수정 · 출발/도착 분리 · 사설 이착륙장 · 임시저장

-- ── 출발 / 도착 이착륙장 분리 ────────────────────────────────
-- 야외비행은 정의상 출발지와 착륙지가 다르다. 기존 airfield 단일 칸으로는
-- 기록할 수 없어 두 칸으로 나눈다.
alter table public.flight_logs add column if not exists departure_airfield text;
alter table public.flight_logs add column if not exists arrival_airfield text;

-- 기존 기록은 출발 = 도착 = 기존 값으로 채운다 (대부분 장주비행)
update public.flight_logs
   set departure_airfield = coalesce(departure_airfield, airfield),
       arrival_airfield   = coalesce(arrival_airfield, airfield)
 where departure_airfield is null or arrival_airfield is null;

-- airfield 는 not null 이고 PDF·CSV·지도가 아직 참조하므로 남겨둔다.
-- 신규 입력에서는 출발지와 같은 값을 넣어 호환을 유지한다.
comment on column public.flight_logs.airfield is
  '하위호환용. 신규 입력은 departure_airfield 와 같은 값이 들어간다';

-- ── 임시저장 ─────────────────────────────────────────────────
-- 격납고에서 기억나는 것만 적어두고 나중에 보완하는 용도.
-- 6단계 GPS 자동 기록의 초안도 이 상태로 올라온다.
alter table public.flight_logs add column if not exists is_draft boolean not null default false;
alter table public.flight_logs add column if not exists updated_at timestamptz;

create index if not exists idx_flight_logs_draft
  on public.flight_logs (user_id, is_draft)
  where is_draft = true;

-- ── 사설 이착륙장 ────────────────────────────────────────────
-- 국내 경량항공기는 내장 목록에 없는 사설 이착륙장을 많이 쓴다.
-- 좌표를 함께 받아야 야외비행 구간 거리 계산으로 이어진다.
create table if not exists public.user_airfields (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  lat double precision,
  lng double precision,
  note text,
  created_at timestamptz default now() not null
);

alter table public.user_airfields enable row level security;

-- create policy 에는 if not exists 가 없어서, 재실행해도 안전하도록 먼저 지운다
drop policy if exists "Users can view own airfields" on public.user_airfields;
create policy "Users can view own airfields"
  on public.user_airfields for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own airfields" on public.user_airfields;
create policy "Users can insert own airfields"
  on public.user_airfields for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own airfields" on public.user_airfields;
create policy "Users can update own airfields"
  on public.user_airfields for update
  using (user_id = auth.uid());

drop policy if exists "Users can delete own airfields" on public.user_airfields;
create policy "Users can delete own airfields"
  on public.user_airfields for delete
  using (user_id = auth.uid());

-- 같은 사용자가 같은 이름을 두 번 등록하지 못하게
create unique index if not exists idx_user_airfields_name
  on public.user_airfields (user_id, name);

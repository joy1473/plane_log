-- Phase 1: 직접 입력 · 수정 · 출발/도착 분리 · 사설 이착륙장 · 임시저장
--
-- ⚠️ 이 스크립트는 기존 비행기록을 전부 삭제합니다. 되돌릴 수 없습니다.
--    지금까지 쌓인 기록은 CSV 업로드로 넣은 시험 데이터뿐이라는 전제입니다.
--    남겨야 할 기록이 있다면 먼저 CSV로 내보낸 뒤 실행하세요.
--
-- 데이터를 비우는 덕분에 단일 airfield 칸을 호환용으로 끌고 가지 않고
-- 바로 걷어낼 수 있습니다. 두 칸(출발/도착)만 남겨 모호함을 없앱니다.

begin;

-- ── 1. 기존 기록 삭제 ────────────────────────────────────────
delete from public.flight_logs;

-- ── 2. 출발 / 도착 이착륙장 ──────────────────────────────────
-- 야외비행은 정의상 출발지와 착륙지가 다르다. 한 칸으로는 기록할 수 없다.
alter table public.flight_logs add column if not exists departure_airfield text;
alter table public.flight_logs add column if not exists arrival_airfield text;

-- 테이블이 비어 있으므로 곧바로 필수로 세울 수 있다
alter table public.flight_logs alter column departure_airfield set not null;
alter table public.flight_logs alter column arrival_airfield set not null;

-- 단일 이착륙장 칸은 역할이 끝났다. 어느 쪽이 정본인지 헷갈릴 여지를 없앤다.
alter table public.flight_logs drop column if exists airfield;

-- ── 3. 임시저장 ──────────────────────────────────────────────
-- 격납고에서 기억나는 것만 적어두고 나중에 보완하는 용도.
-- 6단계 GPS 자동 기록의 초안도 이 상태로 올라온다.
alter table public.flight_logs add column if not exists is_draft boolean not null default false;
alter table public.flight_logs add column if not exists updated_at timestamptz;

create index if not exists idx_flight_logs_draft
  on public.flight_logs (user_id, is_draft)
  where is_draft = true;

-- ── 4. 사설 이착륙장 ─────────────────────────────────────────
-- 국내 경량항공기는 내장 목록에 없는 곳에서 많이 뜨고 내린다.
-- 좌표까지 받아야 야외비행 구간 거리 계산으로 이어진다.
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

create unique index if not exists idx_user_airfields_name
  on public.user_airfields (user_id, name);

commit;

-- 확인용
-- select count(*) as 남은기록 from public.flight_logs;
-- select column_name, is_nullable from information_schema.columns
--  where table_name = 'flight_logs' order by ordinal_position;

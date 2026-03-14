-- Phase 1: flight_logs 테이블 생성
create table if not exists public.flight_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  flight_date date not null,
  departure_time time,
  arrival_time time,
  flight_duration_min integer not null,
  airfield text not null,
  instructor_name text,
  training_purpose text,
  landing_count integer default 1,
  flight_altitude_ft integer,
  remarks text,
  created_at timestamptz default now() not null
);

-- RLS 활성화
alter table public.flight_logs enable row level security;

-- RLS 정책: 본인 데이터만 SELECT
create policy "Users can view own flight logs"
  on public.flight_logs for select
  using (user_id = auth.uid());

-- RLS 정책: 본인 데이터만 INSERT
create policy "Users can insert own flight logs"
  on public.flight_logs for insert
  with check (user_id = auth.uid());

-- RLS 정책: 본인 데이터만 UPDATE
create policy "Users can update own flight logs"
  on public.flight_logs for update
  using (user_id = auth.uid());

-- RLS 정책: 본인 데이터만 DELETE
create policy "Users can delete own flight logs"
  on public.flight_logs for delete
  using (user_id = auth.uid());

-- 인덱스: user_id + flight_date 조합 조회 최적화
create index idx_flight_logs_user_date on public.flight_logs (user_id, flight_date desc);

-- 중복 방지: 같은 사용자, 같은 날짜, 같은 출발 시간
create unique index idx_flight_logs_dedup
  on public.flight_logs (user_id, flight_date, departure_time)
  where departure_time is not null;

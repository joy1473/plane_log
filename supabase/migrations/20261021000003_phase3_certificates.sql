-- Phase 3: 교관 확인 · 증명서류 만료 관제 · 비행경력 집계
--
-- 전부 추가뿐이다. 기존 데이터는 그대로 남고 재실행해도 안전하다.

begin;

-- ── 조종사 정보 ──────────────────────────────────────────────
-- 생년월일이 필요한 이유: 항공신체검사 제2종의 유효기간이 나이 구간에 따라
-- 달라진다(40세 미만 60개월 / 40~50세 24개월 / 50세 이상 12개월). 생년월일만
-- 있으면 앱이 만료일을 직접 계산할 수 있다.
create table if not exists public.user_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  birth_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz
);

alter table public.user_profile enable row level security;

drop policy if exists "Users can view own profile" on public.user_profile;
create policy "Users can view own profile"
  on public.user_profile for select using (user_id = auth.uid());

drop policy if exists "Users can upsert own profile" on public.user_profile;
create policy "Users can upsert own profile"
  on public.user_profile for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own profile" on public.user_profile;
create policy "Users can update own profile"
  on public.user_profile for update using (user_id = auth.uid());

-- ── 증명서류 ─────────────────────────────────────────────────
-- 면허가 있어도 이 중 하나가 만료되면 그날 비행은 불법이 된다.
-- 보험과 안전성인증은 기체에 묶이므로 aircraft_id 를 둔다.
create table if not exists public.certificates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null check (kind in ('medical', 'insurance', 'airworthiness', 'rating')),
  label text,
  aircraft_id uuid references public.aircraft(id) on delete cascade,
  issued_on date,
  expires_on date not null,
  note text,
  created_at timestamptz default now() not null
);

alter table public.certificates enable row level security;

drop policy if exists "Users can view own certificates" on public.certificates;
create policy "Users can view own certificates"
  on public.certificates for select using (user_id = auth.uid());

drop policy if exists "Users can insert own certificates" on public.certificates;
create policy "Users can insert own certificates"
  on public.certificates for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own certificates" on public.certificates;
create policy "Users can update own certificates"
  on public.certificates for update using (user_id = auth.uid());

drop policy if exists "Users can delete own certificates" on public.certificates;
create policy "Users can delete own certificates"
  on public.certificates for delete using (user_id = auth.uid());

create index if not exists idx_certificates_expiry
  on public.certificates (user_id, expires_on);

-- ── 교관 확인 ────────────────────────────────────────────────
-- 종이 로그북의 교관 서명란에 해당한다. 교관 이름을 적는 것과
-- 교관이 확인했다는 것은 다른 사실이므로 따로 기록한다.
alter table public.flight_logs
  add column if not exists instructor_confirmed_at timestamptz;
alter table public.flight_logs
  add column if not exists instructor_confirmed_name text;

commit;

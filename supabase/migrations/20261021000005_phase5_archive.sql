-- Phase 5: 비행 아카이브 · 비용 기록
--
-- 전부 추가뿐이다. 재실행해도 안전하다.
-- 추이 차트, 지도 구간 선, 백업 내보내기는 기존 데이터에서 계산하므로
-- 스키마가 필요 없다.

begin;

-- 훈련 중에는 기록이 증빙이지만 면허 이후에는 기록이 곧 추억이다.
-- 누구와 날았는지가 남아야 한다.
alter table public.flight_logs
  add column if not exists passenger_name text;

-- 연간 취미 비용 집계. 기체를 공동 소유하면 정산 근거가 된다.
-- 원 단위라 소수점을 두지 않는다.
alter table public.flight_logs
  add column if not exists fuel_cost numeric(10,0);
alter table public.flight_logs
  add column if not exists other_cost numeric(10,0);

commit;

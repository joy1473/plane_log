-- Phase 6: GPS 트랙
--
-- 추가뿐이고 재실행해도 안전하다.
-- 트랙은 300점으로 줄여 저장하므로 한 비행당 수 KB 수준이다.
-- 지도 썸네일과 타임라인에 쓰기에는 충분하고, 원본 파일은 보관하지 않는다.

begin;

alter table public.flight_logs
  add column if not exists track_points jsonb;

comment on column public.flight_logs.track_points is
  '간소화한 GPS 궤적 [{lat,lng,ele,time}]. 원본 파일은 저장하지 않는다';

commit;

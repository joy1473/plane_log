-- Phase 1: flight_logs 테이블에 training_institution 컬럼 추가
alter table public.flight_logs
  add column if not exists training_institution text;

-- 코멘트
comment on column public.flight_logs.training_institution is '전문교육기관명 (국토교통부 지정 목록 기반)';

# KoreanLightAircraftEFB (plane_log)

## Project Overview
- 한국 경량항공기(탑승형 초경량비행장치) 조종자격증 취득·운영자를 위한 PWA 앱
- ForeFlight 대안 EFB (Electronic Flight Bag)
- Phase 1 MVP: CSV 수동 업로드 → Supabase 저장 → 조회/누적 시간 계산/지도 표시

## Tech Stack
- React (Vite), TypeScript, Tailwind CSS
- Supabase (Auth, DB, RLS)
- Leaflet/Mapbox (지도)
- Workbox (PWA/오프라인)
- PapaParse (CSV 파싱)

## Key Constraints
- 한국교통안전공단 초경량 비행기록 시스템 공식 API 없음 (2026.03 기준)
- CSV/엑셀 수동 업로드만 가능
- Phase 2 이후: Neo4j 그래프 DB 도입 고려

## Current Phase
- Phase 1 (MVP)

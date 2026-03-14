## plan.md: 한국 경량항공기 PWA 앱 개발 계획 (Phase 1)

### 개요 - Phase 1
- 프로젝트 이름: KoreanLightAircraftEFB (plane_log)
- 목표: ForeFlight 대안으로 경량항공기 조종자용 EFB PWA
- Phase 1 MVP: CSV 수동 업로드 → Supabase 저장 → 기본 조회/누적
- 타겟: 경량항공기 자격증 취득 중인 사용자 (훈련 기록 증빙용)
- 스택: React(Vite), TypeScript, Tailwind, Supabase, Leaflet/Mapbox, Workbox(PWA), Papa(CSV)
- Phase 2 이후 고려: Neo4j 그래프 DB 도입 (관계 분석 강화)

### Research (Phase 1)
- 한국교통안전공단 초경량 비행기록 시스템 API 조사 완료
- 공식 개인 비행기록 API 없음 → CSV 수동 업로드 전략 확정
- 상세: research-light-aircraft-logs.md 참조

### Plan (Phase 1)
- Supabase 프로젝트 설정 및 flight_logs 테이블 설계
- CSV 업로드 → 파싱 → DB 저장 파이프라인
- 오프라인 지원 (IndexedDB + Workbox)
- 기본 지도 표시 (이착륙장 위치)

### Annotate (Phase 1)
- CSV 열 이름 한국어/영어 매핑 테이블 정의
- Supabase RLS 정책 문서화
- PWA manifest 및 서비스 워커 설정

### Implement (Phase 1)
- 아래 Todo 리스트 참조

### Feedback (Phase 1)
- 실제 CSV 파일로 업로드 테스트
- 오프라인 모드 전환 테스트
- 누적 시간 계산 정확도 검증

---

## Todo 리스트 (경량항공기 비행 기록 CSV 업로드 MVP - Phase 1)

- [x] Supabase flight_logs 테이블 생성 및 RLS 설정 (Phase 1)
  - 파일: migrations/001_create_flight_logs.sql
- [x] CSV 업로드 컴포넌트 UI 구현 (Phase 1)
  - 파일: src/components/LightAircraftLogUpload.tsx
- [x] Papa.parse를 이용한 CSV 파싱 로직 (한국어 열 이름 지원, Phase 1)
  - 파일: src/lib/csv-parser-light.ts
- [x] 파싱된 데이터를 Supabase에 insert (Phase 1)
  - 파일: src/lib/supabase-flight-log.ts
- [x] 오프라인 캐싱 (IndexedDB + Workbox, Phase 1)
  - 파일: src/lib/offline-store.ts
- [x] 비행 기록 조회 페이지 (누적 시간, 리스트, 기본 지도 표시 - Phase 1)
  - 파일: src/pages/FlightLogList.tsx
- [x] Vitest 단위 테스트 (파싱, insert, 오프라인 시나리오 - Phase 1)
  - 파일: tests/csv-parser-light.test.ts (9/9 통과)
- [x] SNS 로그인 추가 (카카오 + 네이버 OAuth via Supabase Auth, Phase 1)
  - 파일: src/components/Login.tsx, src/lib/supabase-auth.ts
  - 설명: Phase 1 사용자 편의성 향상. Supabase Providers에서 Kakao/Naver 활성화 후 버튼 UI 구현
- [x] 전문교육기관 선택 드롭다운 UI (국토교통부 PDF 기반, Phase 1)
  - 파일: src/data/training-institutions.json (doc 폴더 PDF에서 수동 추출한 최신 목록 JSON)
  - 파일: src/components/TrainingInstitutionSelect.tsx
  - 설명: 로그 업로드/프로필 시 기관 선택 드롭다운. "기타" 옵션으로 자유 입력 허용. Supabase flight_logs 테이블에 training_institution 컬럼 추가
  - 마이그레이션: migrations/002_add_training_institution.sql

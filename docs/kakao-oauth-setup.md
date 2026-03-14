# 카카오 OAuth 연동 설정 가이드

## 전체 흐름

```
[사용자] → 카카오로 시작하기 클릭
    → [Supabase] → 카카오 로그인 페이지로 리다이렉트
        → [카카오] → 사용자 인증 후 code 발급
            → [Supabase] → code를 access_token으로 교환
                → [App] → 세션 생성, 메인 화면 표시
```

## 1단계: 카카오 개발자 앱 등록

1. https://developers.kakao.com 접속 → 로그인
2. "내 애플리케이션" → "애플리케이션 추가하기"
3. 앱 이름: `KoreanLightAircraftEFB`
4. 앱 생성 후 **REST API 키** 복사 (= Client ID)

## 2단계: 카카오 로그인 활성화

1. 좌측 메뉴 → "카카오 로그인" → 활성화 ON
2. "Redirect URI" 추가:
   ```
   https://<your-project>.supabase.co/auth/v1/callback
   ```
3. 좌측 메뉴 → "카카오 로그인" → "동의항목":
   - 닉네임: 필수
   - 프로필 사진: 선택
   - 카카오계정(이메일): 선택 (이메일 수집 시)
4. "보안" 메뉴 → **Client Secret** 생성 → 복사

## 3단계: Supabase 대시보드 설정

1. https://supabase.com/dashboard → 프로젝트 선택
2. Authentication → Providers → **Kakao** 활성화
3. 입력:
   - **Client ID**: 카카오 REST API 키
   - **Client Secret**: 카카오 Client Secret
4. 저장

## 4단계: .env 파일 업데이트

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

- Supabase 대시보드 → Settings → API에서 확인
- **절대 service_role 키를 프론트엔드에 넣지 마세요**

## 5단계: Supabase에서 SQL 마이그레이션 실행

Supabase SQL Editor에서:
```sql
-- migrations/001_create_flight_logs.sql 내용 실행
-- migrations/002_add_training_institution.sql 내용 실행
```

## 6단계: 확인

1. `npm run dev` → http://localhost:5173
2. "카카오로 시작하기" 클릭
3. 카카오 로그인 → 동의 → 앱으로 리다이렉트
4. 헤더에 카카오 닉네임 + 프로필 사진 표시되면 성공

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| "invalid_client" | REST API 키 오류 | 카카오 콘솔에서 키 재확인 |
| 리다이렉트 안 됨 | Redirect URI 불일치 | 카카오 콘솔의 URI = Supabase callback URL |
| 이메일 안 들어옴 | 동의항목 미설정 | 카카오 로그인 → 동의항목 → 이메일 선택 |
| CORS 에러 | localhost 미등록 | 카카오 콘솔 → 플랫폼 → Web → http://localhost:5173 추가 |

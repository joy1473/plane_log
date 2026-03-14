import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY as string
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const REDIRECT_URI = `${window.location.origin}/auth/kakao/callback`

/**
 * 카카오 로그인 페이지로 리다이렉트 (이메일 없이 프로필만 요청)
 */
export function redirectToKakaoLogin(): void {
  const params = new URLSearchParams({
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'profile_nickname profile_image',
  })
  window.location.href = `https://kauth.kakao.com/oauth/authorize?${params}`
}

/**
 * 카카오 콜백에서 code를 감지하고 세션을 생성
 */
export async function handleKakaoCallback(): Promise<Session | null> {
  const url = new URL(window.location.href)

  // /auth/kakao/callback 경로가 아니면 무시
  if (!url.pathname.includes('/auth/kakao/callback')) return null

  const code = url.searchParams.get('code')
  if (!code) return null

  try {
    // Edge Function 호출: 카카오 code → Supabase magic link 토큰
    const res = await fetch(`${SUPABASE_URL}/functions/v1/kakao-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error)

    // magic link 토큰으로 Supabase 세션 생성
    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      token_hash: data.token,
      type: data.type,
    })

    if (authError) throw authError

    // URL 정리 (콜백 경로 → 홈으로)
    window.history.replaceState({}, '', '/')
    return authData.session
  } catch (err) {
    console.error('카카오 로그인 처리 실패:', err)
    const msg = err instanceof Error ? err.message : String(err)
    window.history.replaceState({}, '', `/?auth_error=${encodeURIComponent(msg)}`)
    return null
  }
}

/**
 * 현재 URL이 카카오 콜백인지 확인
 */
export function isKakaoCallback(): boolean {
  return window.location.pathname.includes('/auth/kakao/callback') &&
    new URLSearchParams(window.location.search).has('code')
}

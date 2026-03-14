import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'

const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_CLIENT_ID as string
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const REDIRECT_URI = `${window.location.origin}/auth/naver/callback`

/**
 * 네이버 로그인 페이지로 리다이렉트
 */
export function redirectToNaverLogin(): void {
  const state = crypto.randomUUID()
  sessionStorage.setItem('naver_oauth_state', state)

  const params = new URLSearchParams({
    client_id: NAVER_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state,
  })
  window.location.href = `https://nid.naver.com/oauth2.0/authorize?${params}`
}

/**
 * 네이버 콜백에서 code를 감지하고 세션을 생성
 */
export async function handleNaverCallback(): Promise<Session | null> {
  const url = new URL(window.location.href)

  if (!url.pathname.includes('/auth/naver/callback')) return null

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return null

  // CSRF 검증
  const savedState = sessionStorage.getItem('naver_oauth_state')
  if (state !== savedState) {
    window.history.replaceState({}, '', '/?auth_error=' + encodeURIComponent('CSRF 검증 실패'))
    return null
  }
  sessionStorage.removeItem('naver_oauth_state')

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/naver-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state, redirect_uri: REDIRECT_URI }),
    })

    const data = await res.json()
    if (data.error) throw new Error(`Edge Function 오류: ${data.error}`)
    if (!data.token) throw new Error('Edge Function이 토큰을 반환하지 않았습니다')

    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      token_hash: data.token,
      type: data.type,
    })

    if (authError) throw new Error(`OTP 검증 오류: ${authError.message}`)
    if (!authData.session) throw new Error('세션 생성 실패')

    window.history.replaceState({}, '', '/')
    return authData.session
  } catch (err) {
    console.error('네이버 로그인 처리 실패:', err)
    const msg = err instanceof Error ? err.message : String(err)
    window.history.replaceState({}, '', `/?auth_error=${encodeURIComponent(msg)}`)
    return null
  }
}

/**
 * 현재 URL이 네이버 콜백인지 확인
 */
export function isNaverCallback(): boolean {
  return window.location.pathname.includes('/auth/naver/callback') &&
    new URLSearchParams(window.location.search).has('code')
}

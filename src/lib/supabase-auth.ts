import { supabase, isSupabaseConfigured } from './supabase'
import { redirectToKakaoLogin, handleKakaoCallback, isKakaoCallback } from './kakao-auth'
import type { Session, User } from '@supabase/supabase-js'

export type AuthProvider = 'kakao' | 'naver'

export async function signInWithProvider(provider: AuthProvider): Promise<void> {
  if (provider === 'kakao') {
    redirectToKakaoLogin()
    return
  }
  // 네이버는 Phase 2에서 동일한 수동 OAuth 패턴으로 구현
  throw new Error('네이버 로그인은 준비 중입니다')
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(`로그아웃 오류: ${error.message}`)
}

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

/** 초기화 시 OAuth 콜백 처리 (카카오) */
export async function handleAuthCallback(): Promise<Session | null> {
  // 카카오 콜백 처리
  if (isKakaoCallback()) {
    return handleKakaoCallback()
  }

  // Supabase 기본 콜백 (해시 기반)
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return null

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return null

  window.history.replaceState({}, '', window.location.pathname)
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}

export function getDisplayName(user: User | null | undefined): string {
  if (!user) return '사용자'
  const meta = user.user_metadata
  return (
    meta?.full_name ??
    meta?.name ??
    meta?.preferred_username ??
    user.email?.replace(/@kakao\.local$/, '') ??
    '사용자'
  )
}

export function getAvatarUrl(user: User | null | undefined): string | null {
  if (!user) return null
  const meta = user.user_metadata
  return meta?.avatar_url ?? meta?.picture ?? null
}

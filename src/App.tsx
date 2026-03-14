import { useState, useEffect, Component, type ReactNode } from 'react'
import { onAuthStateChange, signOut, getSession, handleAuthCallback, getDisplayName, getAvatarUrl } from './lib/supabase-auth'
import Login from './components/Login'
import LightAircraftLogUpload from './components/LightAircraftLogUpload'
import FlightLogList from './pages/FlightLogList'
import { registerReconnectSync } from './lib/offline-store'
import type { Session } from '@supabase/supabase-js'

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(err: Error) {
    return { error: err }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
            <p className="text-red-600 font-semibold mb-2">오류가 발생했습니다</p>
            <p className="text-gray-500 text-sm">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-600"
            >
              새로고침
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// 앱 시작 시 재연결 자동 동기화 리스너 등록
registerReconnectSync()

// PWA 설치 프롬프트 이벤트 저장
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstallPrompt = e as BeforeInstallPromptEvent
})

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [devBypass, setDevBypass] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authMessage, setAuthMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    async function initAuth() {
      try {
        // 1) OAuth 리다이렉트 콜백 처리 (URL에 ?code= 가 있을 때)
        const callbackSession = await handleAuthCallback()
        if (callbackSession) {
          setSession(callbackSession)
          setAuthMessage(`${getDisplayName(callbackSession.user)}님 환영합니다!`)
          setTimeout(() => setAuthMessage(''), 3000)
          setLoading(false)
          return
        }

        // 2) 기존 세션 복원
        const existingSession = await getSession()
        setSession(existingSession)
      } catch {
        // Supabase 미연결 시 무시
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // PWA 설치 가능 여부 확인
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone)
    setIsStandalone(!!standalone)

    if (!standalone) {
      // beforeinstallprompt가 이미 발생했을 수 있음
      if (deferredInstallPrompt) {
        setShowInstallBanner(true)
      }
      const handler = () => setShowInstallBanner(true)
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }

    // 3) 실시간 인증 상태 변경 감지
    const { data: { subscription } } = onAuthStateChange((s) => {
      setSession(s)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    const isCallback = window.location.search.includes('code=') || window.location.pathname.includes('/auth/kakao') || window.location.pathname.includes('/auth/naver')
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">{isCallback ? '로그인 처리 중...' : '로딩 중...'}</p>
      </div>
    )
  }

  // 카카오 로그인 에러 표시
  const authError = new URLSearchParams(window.location.search).get('auth_error')

  const isDev = import.meta.env.DEV && import.meta.env.VITE_SUPABASE_URL?.includes('placeholder')

  if (!session && !devBypass) {
    return (
      <>
        {authError && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm text-center py-3 px-4">
            카카오 로그인 실패: {authError}
          </div>
        )}
        <Login onDevBypass={isDev ? () => setDevBypass(true) : undefined} />
      </>
    )
  }

  async function handleInstall() {
    if (!deferredInstallPrompt) return
    await deferredInstallPrompt.prompt()
    const { outcome } = await deferredInstallPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
      setIsStandalone(true)
    }
    deferredInstallPrompt = null
  }

  const displayName = session ? getDisplayName(session.user) : '개발 모드'
  const avatarUrl = session ? getAvatarUrl(session.user) : null

  return (
    <div className="min-h-screen bg-gray-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-800 focus:text-white focus:rounded"
      >
        본문으로 바로가기
      </a>
      <header className="bg-blue-800 text-white py-4 px-6 shadow flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">KoreanLightAircraftEFB</h1>
          <p className="text-blue-200 text-sm">경량항공기 비행 기록 관리</p>
        </div>
        <div className="flex items-center gap-3">
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full border-2 border-blue-400" />
          )}
          <span className="text-blue-200 text-sm">{displayName}</span>
          {session && (
            <button
              onClick={() => signOut()}
              className="text-sm bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded"
            >
              로그아웃
            </button>
          )}
        </div>
      </header>

      {showInstallBanner && !isStandalone && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-800 text-sm text-center py-2 px-4 flex items-center justify-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          <span>홈 화면에 추가하여 앱처럼 사용하세요!</span>
          <button
            onClick={handleInstall}
            className="px-3 py-1 bg-blue-700 text-white text-xs rounded hover:bg-blue-600"
          >
            설치
          </button>
          <button
            onClick={() => setShowInstallBanner(false)}
            className="text-blue-400 hover:text-blue-600 text-xs ml-1"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}

      {authMessage && (
        <div className="bg-green-50 border-b border-green-200 text-green-700 text-sm text-center py-2">
          {authMessage}
        </div>
      )}

      <main id="main-content" className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <LightAircraftLogUpload onUploadComplete={() => setRefreshKey((k) => k + 1)} />
        <FlightLogList key={refreshKey} />
      </main>
    </div>
  )
}

export default function AppWithErrorBoundary() {
  return (
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  )
}

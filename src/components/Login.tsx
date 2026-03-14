import { useState } from 'react'
import { signInWithProvider, type AuthProvider } from '../lib/supabase-auth'
import { isSupabaseConfigured } from '../lib/supabase'

interface LoginProps {
  onDevBypass?: () => void
}

export default function Login({ onDevBypass }: LoginProps) {
  const [loading, setLoading] = useState<AuthProvider | null>(null)
  const [error, setError] = useState('')

  async function handleLogin(provider: AuthProvider) {
    if (!isSupabaseConfigured) {
      setError('Supabase가 연결되지 않았습니다. .env 파일에 실제 URL과 Key를 설정하세요.')
      return
    }

    setLoading(provider)
    setError('')
    try {
      await signInWithProvider(provider)
      // OAuth 리다이렉트가 일어나므로 여기 도달 시 로딩 유지
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-800">KoreanLightAircraftEFB</h1>
          <p className="text-gray-500 text-sm mt-2">경량항공기 비행 기록 관리</p>
        </div>

        <div className="space-y-3">
          {/* 카카오 로그인 */}
          <button
            onClick={() => handleLogin('kakao')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-colors bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0.6C4.029 0.6 0 3.713 0 7.55c0 2.486 1.656 4.672 4.148 5.913l-1.059 3.87c-.094.343.298.614.592.41L8.04 14.94c.316.024.637.037.96.037 4.971 0 9-3.113 9-6.95S13.971.6 9 .6" fill="#191919"/>
            </svg>
            {loading === 'kakao' ? '카카오 로그인 중...' : '카카오로 시작하기'}
          </button>

          {/* 네이버 로그인 */}
          <button
            onClick={() => handleLogin('naver')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-colors bg-[#03C75A] text-white hover:bg-[#02B550] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M12.21 9.36L5.55 0H0v18h5.79V8.64L12.45 18H18V0h-5.79v9.36z" fill="white"/>
            </svg>
            {loading === 'naver' ? '네이버 로그인 중...' : '네이버로 시작하기'}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          로그인 시 비행 기록이 안전하게 클라우드에 저장됩니다
        </p>

        {onDevBypass && (
          <button
            onClick={onDevBypass}
            className="mt-4 w-full py-2 px-4 rounded-lg text-xs text-gray-400 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-500 transition-colors"
          >
            개발 모드로 진입 (Supabase 미연결)
          </button>
        )}
      </div>
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경변수가 설정되지 않았습니다. ' +
    '.env.local 파일에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 추가하세요.'
  )
}

export const isSupabaseConfigured = !(supabaseUrl as string).includes('placeholder')

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string)

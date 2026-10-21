import { supabase, isSupabaseConfigured } from './supabase'
import type { Certificate, CertificateKind, UserProfile } from '../types/flight-log'

export async function fetchCertificates(): Promise<Certificate[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .order('expires_on')

  if (error) throw new Error(`증명서류 조회 오류: ${error.message}`)
  return data ?? []
}

export async function createCertificate(input: {
  kind: CertificateKind
  label?: string | null
  aircraft_id?: string | null
  issued_on?: string | null
  expires_on: string
  note?: string | null
}): Promise<Certificate> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const user = await supabase.auth.getUser()
  if (!user.data.user) throw new Error('로그인이 필요합니다')

  const { data, error } = await supabase
    .from('certificates')
    .insert({
      user_id: user.data.user.id,
      kind: input.kind,
      label: input.label?.trim() || null,
      aircraft_id: input.aircraft_id ?? null,
      issued_on: input.issued_on || null,
      expires_on: input.expires_on,
      note: input.note?.trim() || null,
    })
    .select()
    .single()

  if (error) throw new Error(`등록 오류: ${error.message}`)
  return data
}

export async function deleteCertificate(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('certificates').delete().eq('id', id)
  if (error) throw new Error(`삭제 오류: ${error.message}`)
}

export async function fetchProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`조종사 정보 조회 오류: ${error.message}`)
  return data
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const user = await supabase.auth.getUser()
  if (!user.data.user) throw new Error('로그인이 필요합니다')

  const { error } = await supabase
    .from('user_profile')
    .upsert({
      user_id: user.data.user.id,
      name: profile.name?.trim() || null,
      birth_date: profile.birth_date || null,
      updated_at: new Date().toISOString(),
    })

  if (error) throw new Error(`저장 오류: ${error.message}`)
}

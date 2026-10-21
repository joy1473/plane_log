import { supabase, isSupabaseConfigured } from './supabase'
import type { Aircraft, AircraftCategory } from '../types/flight-log'

/**
 * 기체는 텍스트 한 칸이 아니라 별도 테이블이다. 기종에 따라 자격 요건이
 * 달라지고, 면허 이후에는 안전성인증·보험 만료일과 정비 주기가 여기 붙는다.
 */
export async function fetchAircraft(): Promise<Aircraft[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('aircraft')
    .select('*')
    .order('registration')

  if (error) throw new Error(`기체 조회 오류: ${error.message}`)
  return data ?? []
}

export async function createAircraft(input: {
  registration: string
  category: AircraftCategory
  model?: string | null
  note?: string | null
  initial_hours?: number
}): Promise<Aircraft> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const user = await supabase.auth.getUser()
  if (!user.data.user) throw new Error('로그인이 필요합니다')

  const { data, error } = await supabase
    .from('aircraft')
    .insert({
      user_id: user.data.user.id,
      registration: input.registration.trim(),
      category: input.category,
      model: input.model?.trim() || null,
      note: input.note?.trim() || null,
      initial_hours: input.initial_hours ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('같은 등록기호의 기체가 이미 있습니다')
    throw new Error(`기체 등록 오류: ${error.message}`)
  }
  return data
}

export async function deleteAircraft(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('aircraft').delete().eq('id', id)
  if (error) throw new Error(`기체 삭제 오류: ${error.message}`)
}

/** 진행률 계산에서 기록 → 기종을 빠르게 찾기 위한 색인 */
export function categoryIndex(list: Aircraft[]): Map<string, AircraftCategory> {
  return new Map(list.map((a) => [a.id, a.category]))
}

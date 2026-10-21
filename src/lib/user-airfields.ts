import { supabase, isSupabaseConfigured } from './supabase'
import { AIRFIELDS, type Airfield } from '../data/airfields'
import type { UserAirfield } from '../types/flight-log'

/**
 * 내장 목록에 없는 사설 이착륙장. 국내 경량항공기는 이런 곳에서 많이 뜨고 내린다.
 * 좌표까지 받아 두어야 지도 표시와 야외비행 구간 거리 계산으로 이어진다.
 */
export async function fetchUserAirfields(): Promise<UserAirfield[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('user_airfields')
    .select('*')
    .order('name')

  if (error) throw new Error(`이착륙장 조회 오류: ${error.message}`)
  return data ?? []
}

export async function createUserAirfield(
  input: { name: string; lat: number | null; lng: number | null; note?: string | null }
): Promise<UserAirfield> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const user = await supabase.auth.getUser()
  if (!user.data.user) throw new Error('로그인이 필요합니다')

  const { data, error } = await supabase
    .from('user_airfields')
    .insert({
      user_id: user.data.user.id,
      name: input.name.trim(),
      lat: input.lat,
      lng: input.lng,
      note: input.note ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('같은 이름의 이착륙장이 이미 있습니다')
    throw new Error(`등록 오류: ${error.message}`)
  }
  return data
}

export async function deleteUserAirfield(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('user_airfields').delete().eq('id', id)
  if (error) throw new Error(`삭제 오류: ${error.message}`)
}

export interface AirfieldOption {
  name: string
  lat: number | null
  lng: number | null
  /** 내장 목록인지 사용자가 등록한 것인지 */
  source: 'builtin' | 'user'
  type?: Airfield['type']
}

/** 내장 목록과 사설 이착륙장을 합쳐 선택지로 만든다. 이름이 겹치면 사설이 이긴다 */
export function mergeAirfieldOptions(userAirfields: UserAirfield[]): AirfieldOption[] {
  const userNames = new Set(userAirfields.map((a) => a.name))

  const builtin: AirfieldOption[] = AIRFIELDS
    .filter((a) => !userNames.has(a.name))
    .map((a) => ({ name: a.name, lat: a.lat, lng: a.lng, source: 'builtin', type: a.type }))

  const custom: AirfieldOption[] = userAirfields.map((a) => ({
    name: a.name, lat: a.lat, lng: a.lng, source: 'user',
  }))

  return [...custom, ...builtin]
}

/** 두 지점 사이 거리(km). 야외비행 120km 판정에 쓰인다 */
export function distanceKm(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null }
): number | null {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null

  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10
}

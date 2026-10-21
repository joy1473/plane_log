import { supabase, isSupabaseConfigured } from './supabase'
import type { Aircraft, FlightLog, MaintenanceItem } from '../types/flight-log'

/**
 * 기체 누적시간과 정비 주기.
 *
 * 누적시간은 따로 입력받지 않는다 — 비행기록을 합산하고, 기록을 시작하기
 * 전까지 쌓여 있던 시간(initial_hours)을 더하면 나온다. 사람이 두 군데에
 * 같은 숫자를 적게 만들면 언젠가 어긋난다.
 */

export async function fetchMaintenanceItems(): Promise<MaintenanceItem[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .order('name')

  if (error) throw new Error(`정비 항목 조회 오류: ${error.message}`)
  return data ?? []
}

export async function createMaintenanceItem(input: {
  aircraft_id: string
  name: string
  interval_hours: number
  last_done_hours?: number | null
  last_done_on?: string | null
  note?: string | null
}): Promise<MaintenanceItem> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const user = await supabase.auth.getUser()
  if (!user.data.user) throw new Error('로그인이 필요합니다')

  const { data, error } = await supabase
    .from('maintenance_items')
    .insert({
      user_id: user.data.user.id,
      aircraft_id: input.aircraft_id,
      name: input.name.trim(),
      interval_hours: input.interval_hours,
      last_done_hours: input.last_done_hours ?? null,
      last_done_on: input.last_done_on || null,
      note: input.note?.trim() || null,
    })
    .select()
    .single()

  if (error) throw new Error(`정비 항목 등록 오류: ${error.message}`)
  return data
}

export async function deleteMaintenanceItem(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('maintenance_items').delete().eq('id', id)
  if (error) throw new Error(`삭제 오류: ${error.message}`)
}

/** 정비 수행을 기록한다. 그 시점의 기체 누적시간을 함께 남긴다 */
export async function markMaintenanceDone(
  id: string,
  atHours: number,
  onDate: string
): Promise<void> {
  if (!isSupabaseConfigured) return

  const { error } = await supabase
    .from('maintenance_items')
    .update({ last_done_hours: atHours, last_done_on: onDate })
    .eq('id', id)

  if (error) throw new Error(`정비 기록 오류: ${error.message}`)
}

/** 기체별 누적 비행시간(시간 단위). 임시저장은 제외한다 */
export function aircraftHours(logs: FlightLog[], aircraft: Aircraft): number {
  const logged = logs
    .filter((l) => !l.is_draft && l.aircraft_id === aircraft.id)
    .reduce((sum, l) => sum + l.flight_duration_min, 0)
  return Math.round((aircraft.initial_hours + logged / 60) * 10) / 10
}

export interface MaintenanceStatus {
  item: MaintenanceItem
  /** 다음 수행까지 남은 시간. 음수면 이미 지났다 */
  remainingHours: number | null
  dueAtHours: number | null
  level: 'overdue' | 'due' | 'soon' | 'ok' | 'unknown'
}

/**
 * 남은 시간은 "마지막 수행 시점 + 주기 - 현재"다.
 * 마지막 수행을 적지 않았으면 계산할 수 없다 — 추측하지 않고 unknown 으로 둔다.
 */
export function maintenanceStatus(
  item: MaintenanceItem,
  currentHours: number
): MaintenanceStatus {
  if (item.last_done_hours === null || item.last_done_hours === undefined) {
    return { item, remainingHours: null, dueAtHours: null, level: 'unknown' }
  }

  const dueAtHours = Math.round((item.last_done_hours + item.interval_hours) * 10) / 10
  const remainingHours = Math.round((dueAtHours - currentHours) * 10) / 10

  let level: MaintenanceStatus['level']
  if (remainingHours < 0) level = 'overdue'
  else if (remainingHours <= 1) level = 'due'
  else if (remainingHours <= item.interval_hours * 0.1) level = 'soon'
  else level = 'ok'

  return { item, remainingHours, dueAtHours, level }
}

import { supabase, isSupabaseConfigured } from './supabase'
import type { FlightLog } from '../types/flight-log'

export interface InsertResult {
  inserted: number
  duplicates: number
  errors: string[]
}

export async function insertFlightLogs(logs: FlightLog[]): Promise<InsertResult> {
  if (!isSupabaseConfigured) {
    return { inserted: logs.length, duplicates: 0, errors: [] }
  }

  const user = await supabase.auth.getUser()
  if (!user.data.user) {
    return { inserted: 0, duplicates: 0, errors: ['로그인이 필요합니다'] }
  }

  const userId = user.data.user.id
  const logsWithUser = logs.map((log) => ({ ...log, user_id: userId }))

  const errors: string[] = []

  // 배치 삽입 시도 (N+1 방지)
  const { data, error } = await supabase
    .from('flight_logs')
    .insert(logsWithUser)
    .select('id')

  if (!error) {
    return { inserted: data?.length ?? logsWithUser.length, duplicates: 0, errors }
  }

  // 배치 실패 시 (중복 등) 개별 삽입으로 폴백
  let inserted = 0
  let duplicates = 0

  for (const log of logsWithUser) {
    const { error: rowError } = await supabase
      .from('flight_logs')
      .insert(log)

    if (rowError) {
      if (rowError.code === '23505') {
        duplicates++
      } else {
        errors.push(`${log.flight_date}: ${rowError.message}`)
      }
    } else {
      inserted++
    }
  }

  return { inserted, duplicates, errors }
}

export async function fetchFlightLogs(): Promise<FlightLog[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('flight_logs')
    .select('*')
    .order('flight_date', { ascending: false })

  if (error) throw new Error(`비행 기록 조회 오류: ${error.message}`)
  return data ?? []
}

export async function deleteFlightLog(id: string): Promise<void> {
  if (!isSupabaseConfigured) return

  const { error } = await supabase.from('flight_logs').delete().eq('id', id)
  if (error) throw new Error(`삭제 오류: ${error.message}`)
}

export function calculateTotalHours(logs: FlightLog[]): {
  totalMinutes: number
  totalHours: string
  totalFlights: number
  totalLandings: number
} {
  const totalMinutes = logs.reduce((sum, log) => sum + log.flight_duration_min, 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return {
    totalMinutes,
    totalHours: `${hours}시간 ${mins}분`,
    totalFlights: logs.length,
    totalLandings: logs.reduce((sum, log) => sum + (log.landing_count ?? 0), 0),
  }
}

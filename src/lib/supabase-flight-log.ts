import { supabase, isSupabaseConfigured } from './supabase'
import type { FlightLog } from '../types/flight-log'

export interface InsertResult {
  inserted: number
  duplicates: number
  errors: string[]
}

async function requireUserId(): Promise<string> {
  const user = await supabase.auth.getUser()
  if (!user.data.user) throw new Error('로그인이 필요합니다')
  return user.data.user.id
}

/** 도착지를 비워두면 장주비행으로 보고 출발지와 같게 둔다 */
function normalize(log: FlightLog): FlightLog {
  return {
    ...log,
    arrival_airfield: log.arrival_airfield || log.departure_airfield,
  }
}

export async function insertFlightLogs(logs: FlightLog[]): Promise<InsertResult> {
  if (!isSupabaseConfigured) {
    return { inserted: logs.length, duplicates: 0, errors: [] }
  }

  let userId: string
  try {
    userId = await requireUserId()
  } catch (err) {
    return { inserted: 0, duplicates: 0, errors: [err instanceof Error ? err.message : '로그인이 필요합니다'] }
  }

  const logsWithUser = logs.map((log) => ({ ...normalize(log), user_id: userId }))

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

/** 직접 입력 폼에서 기록 한 건을 저장한다 */
export async function createFlightLog(log: FlightLog): Promise<FlightLog & { id: string }> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('flight_logs')
    .insert({ ...normalize(log), user_id: userId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('같은 날짜·출발시간의 기록이 이미 있습니다')
    }
    throw new Error(`저장 오류: ${error.message}`)
  }
  return data
}

/**
 * 기존 기록을 수정한다. 지금까지는 삭제 후 재등록밖에 방법이 없었다.
 * 법정 기록이라 오타 하나에 행을 날리는 상황을 만들면 안 된다.
 */
export async function updateFlightLog(
  id: string,
  log: FlightLog
): Promise<FlightLog & { id: string }> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const patch = { ...normalize(log), updated_at: new Date().toISOString() }
  delete patch.id
  delete patch.user_id
  delete patch.created_at

  const { data, error } = await supabase
    .from('flight_logs')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('같은 날짜·출발시간의 기록이 이미 있습니다')
    }
    throw new Error(`수정 오류: ${error.message}`)
  }
  return data
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

/**
 * 임시저장은 아직 확정하지 않은 기록이므로 합계에서 뺀다.
 * 제출용 수치에 미확정 값이 섞이면 안 된다.
 */
export function calculateTotalHours(logs: FlightLog[]): {
  totalMinutes: number
  totalHours: string
  totalFlights: number
  totalLandings: number
  draftCount: number
} {
  const confirmed = logs.filter((log) => !log.is_draft)
  const totalMinutes = confirmed.reduce((sum, log) => sum + log.flight_duration_min, 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return {
    totalMinutes,
    totalHours: `${hours}시간 ${mins}분`,
    totalFlights: confirmed.length,
    totalLandings: confirmed.reduce((sum, log) => sum + (log.landing_count ?? 0), 0),
    draftCount: logs.length - confirmed.length,
  }
}

/**
 * 교관 확인. 교관 이름을 적어두는 것과 교관이 확인했다는 것은 다른 사실이라
 * 시각과 확인자 이름을 따로 남긴다. 종이 로그북의 서명란에 해당한다.
 */
export async function setInstructorConfirmation(
  id: string,
  confirmedName: string | null
): Promise<void> {
  if (!isSupabaseConfigured) return

  const { error } = await supabase
    .from('flight_logs')
    .update({
      instructor_confirmed_at: confirmedName ? new Date().toISOString() : null,
      instructor_confirmed_name: confirmedName,
    })
    .eq('id', id)

  if (error) throw new Error(`교관 확인 오류: ${error.message}`)
}

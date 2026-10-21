export interface FlightLog {
  id?: string
  user_id?: string
  flight_date: string
  departure_time: string | null
  arrival_time: string | null
  flight_duration_min: number
  departure_airfield: string
  /** 장주비행이면 출발지와 같은 값 */
  arrival_airfield: string
  aircraft_id?: string | null
  /** 단독 5시간 요건 집계에 쓰인다 */
  pilot_role?: PilotRole
  is_cross_country?: boolean
  /** 출발·도착 좌표로 자동 계산되지만 직접 고칠 수 있다 */
  leg_distance_km?: number | null
  instructor_name: string | null
  training_purpose: string | null
  landing_count: number
  flight_altitude_ft: number | null
  training_institution: string | null
  remarks: string | null
  /** 아직 확정하지 않은 기록. 통계와 내보내기에서 제외된다 */
  is_draft?: boolean
  created_at?: string
  updated_at?: string | null
}

export interface CsvParseResult {
  data: FlightLog[]
  errors: string[]
  skipped: number
}

/** 사용자가 직접 등록한 이착륙장 */
export interface UserAirfield {
  id: string
  user_id?: string
  name: string
  lat: number | null
  lng: number | null
  note: string | null
  created_at?: string
}

/**
 * 훈련 모드는 교관·훈련목적·교육기관을 묻고, 일지 모드는 묻지 않는다.
 * 훈련은 길어야 몇 달이고 그 뒤는 수십 년이라 둘 다 기본 모드로 둔다.
 */
export type LogMode = 'training' | 'logbook'

/** 항공안전법상 경량항공기 5종. 종류별로 자격 요건이 다르다 */
export const AIRCRAFT_CATEGORIES = [
  '타면조종형비행기',
  '체중이동형비행기',
  '경량헬리콥터',
  '자이로플레인',
  '동력패러슈트',
] as const

export type AircraftCategory = typeof AIRCRAFT_CATEGORIES[number]

/** 단독 비행인지 교관 동승인지 */
export type PilotRole = 'solo' | 'dual'

export interface Aircraft {
  id: string
  user_id?: string
  /** 등록기호 */
  registration: string
  category: AircraftCategory
  model: string | null
  note: string | null
  created_at?: string
}

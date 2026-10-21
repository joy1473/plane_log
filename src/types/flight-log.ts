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
  /** 간소화한 GPS 궤적. 원본 파일은 저장하지 않는다 */
  track_points?: { lat: number; lng: number; ele: number | null; time: string | null }[] | null
  /** 누구와 날았는지. 면허 이후에는 기록이 곧 추억이다 */
  passenger_name?: string | null
  fuel_cost?: number | null
  other_cost?: number | null
  /** 교관이 확인한 시각. 교관 이름을 적는 것과는 다른 사실이다 */
  instructor_confirmed_at?: string | null
  instructor_confirmed_name?: string | null
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
  /** 이 앱으로 기록하기 전까지 기체에 쌓여 있던 비행시간 */
  initial_hours: number
  created_at?: string
}

/** 증명서류 종류. 보험과 안전성인증은 기체에 묶인다 */
export const CERTIFICATE_KINDS = ['medical', 'insurance', 'airworthiness', 'rating'] as const
export type CertificateKind = typeof CERTIFICATE_KINDS[number]

export const CERTIFICATE_LABELS: Record<CertificateKind, string> = {
  medical: '항공신체검사증명',
  insurance: '보험',
  airworthiness: '안전성인증',
  rating: '자격증명 한정',
}

export interface Certificate {
  id: string
  user_id?: string
  kind: CertificateKind
  label: string | null
  aircraft_id: string | null
  issued_on: string | null
  expires_on: string
  note: string | null
  created_at?: string
}

export interface UserProfile {
  user_id?: string
  name: string | null
  birth_date: string | null
}

/** 기체시간 기준으로 돌아오는 정비 항목 */
export interface MaintenanceItem {
  id: string
  user_id?: string
  aircraft_id: string
  name: string
  interval_hours: number
  /** 마지막 수행 시점의 기체 누적시간. 없으면 남은 시간을 계산할 수 없다 */
  last_done_hours: number | null
  last_done_on: string | null
  note: string | null
  created_at?: string
}

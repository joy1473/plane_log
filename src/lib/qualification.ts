import type { FlightLog, AircraftCategory } from '../types/flight-log'

/**
 * 경량항공기 조종사 자격증명 응시경력 요건.
 *
 * ⚠️ 출처 주의 — 항공안전법 시행규칙 [별표 4] 를 인용한 2차 자료 두 곳에서
 * 가져왔고, 원문 별표 PDF 는 직접 열어 확인하지 못했다. 개정 이력도 있다.
 * 제출 전에 현행 원문으로 반드시 확인할 것.
 * https://law.go.kr/flDownload.do?flSeq=97691881
 *
 * 불확실한 칸은 "더 많이 요구하는" 쪽으로 잡았다. 진행률 표시는
 * 덜 요구해서 다 됐다고 말하는 쪽이 훨씬 위험하기 때문이다.
 * 체중이동형비행기의 야외비행 요건이 특히 확실하지 않다.
 *
 * 전문교육기관 과정을 이수한 경우는 요건이 달라지므로 여기서 다루지 않는다.
 */
export interface Requirement {
  /** 총 비행시간 (분) */
  totalMinutes: number
  /** 단독 비행시간 (분) */
  soloMinutes: number
  /** 야외비행 시간 (분). 0이면 해당 없음 */
  crossCountryMinutes: number
  /** 다른 지점 이착륙을 요구하는 최소 구간 거리 (km). null이면 해당 없음 */
  legDistanceKm: number | null
}

const H = 60

export const REQUIREMENTS: Record<AircraftCategory, Requirement> = {
  타면조종형비행기: { totalMinutes: 20 * H, soloMinutes: 5 * H, crossCountryMinutes: 5 * H, legDistanceKm: 120 },
  체중이동형비행기: { totalMinutes: 20 * H, soloMinutes: 5 * H, crossCountryMinutes: 5 * H, legDistanceKm: 120 },
  경량헬리콥터:     { totalMinutes: 20 * H, soloMinutes: 5 * H, crossCountryMinutes: 5 * H, legDistanceKm: 120 },
  자이로플레인:     { totalMinutes: 20 * H, soloMinutes: 5 * H, crossCountryMinutes: 5 * H, legDistanceKm: 120 },
  // 동력패러슈트는 야외비행·구간거리 요건이 없는 것으로 확인됨
  동력패러슈트:     { totalMinutes: 20 * H, soloMinutes: 5 * H, crossCountryMinutes: 0, legDistanceKm: null },
}

export interface ProgressItem {
  label: string
  /** 현재 값 (분 또는 횟수) */
  current: number
  /** 목표 값 */
  target: number
  unit: 'minutes' | 'count'
  met: boolean
}

export interface QualificationProgress {
  category: AircraftCategory
  items: ProgressItem[]
  /** 기체를 지정하지 않아 집계에서 빠진 기록 수 */
  unassigned: number
  allMet: boolean
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}시간 ${m}분`
}

/**
 * 해당 기종으로 날아온 기록만 모아 진행률을 계산한다.
 * 임시저장과 기체 미지정 기록은 제외한다 — 미확정 값이 섞이면
 * "다 됐다"는 잘못된 신호를 줄 수 있다.
 */
export function calculateProgress(
  logs: FlightLog[],
  category: AircraftCategory,
  categoryByAircraftId: Map<string, AircraftCategory>
): QualificationProgress {
  const confirmed = logs.filter((l) => !l.is_draft)
  const unassigned = confirmed.filter((l) => !l.aircraft_id).length

  const mine = confirmed.filter(
    (l) => l.aircraft_id && categoryByAircraftId.get(l.aircraft_id) === category
  )

  const req = REQUIREMENTS[category]
  const sum = (ls: FlightLog[]) => ls.reduce((s, l) => s + l.flight_duration_min, 0)

  const total = sum(mine)
  const solo = sum(mine.filter((l) => l.pilot_role === 'solo'))
  const crossCountry = sum(mine.filter((l) => l.is_cross_country))
  const longLegs = req.legDistanceKm === null
    ? 0
    : mine.filter((l) =>
        l.is_cross_country &&
        l.leg_distance_km != null &&
        l.leg_distance_km >= req.legDistanceKm! &&
        l.departure_airfield !== l.arrival_airfield
      ).length

  const items: ProgressItem[] = [
    { label: '총 비행시간', current: total, target: req.totalMinutes, unit: 'minutes', met: total >= req.totalMinutes },
    { label: '단독 비행', current: solo, target: req.soloMinutes, unit: 'minutes', met: solo >= req.soloMinutes },
  ]

  if (req.crossCountryMinutes > 0) {
    items.push({
      label: '야외비행',
      current: crossCountry,
      target: req.crossCountryMinutes,
      unit: 'minutes',
      met: crossCountry >= req.crossCountryMinutes,
    })
  }

  if (req.legDistanceKm !== null) {
    items.push({
      label: `${req.legDistanceKm}km 이상 타 지점 이착륙`,
      current: longLegs,
      target: 1,
      unit: 'count',
      met: longLegs >= 1,
    })
  }

  return {
    category,
    items,
    unassigned,
    allMet: items.every((i) => i.met),
  }
}

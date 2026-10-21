import { describe, it, expect } from 'vitest'
import { calculateProgress, REQUIREMENTS, formatMinutes } from '../qualification'
import type { AircraftCategory, FlightLog } from '../../types/flight-log'

const AC = 'ac-1'
const OTHER_AC = 'ac-2'

function makeLog(overrides: Partial<FlightLog> = {}): FlightLog {
  return {
    flight_date: '2026-10-01',
    departure_time: null,
    arrival_time: null,
    flight_duration_min: 60,
    departure_airfield: '울진비행장',
    arrival_airfield: '울진비행장',
    instructor_name: null,
    training_purpose: null,
    landing_count: 1,
    flight_altitude_ft: null,
    training_institution: null,
    remarks: null,
    aircraft_id: AC,
    pilot_role: 'dual',
    is_cross_country: false,
    leg_distance_km: null,
    ...overrides,
  }
}

const index = new Map<string, AircraftCategory>([
  [AC, '타면조종형비행기'],
  [OTHER_AC, '자이로플레인'],
])

describe('calculateProgress', () => {
  it('타면조종형비행기 요건 4개를 모두 내놓는다', () => {
    const p = calculateProgress([], '타면조종형비행기', index)
    expect(p.items.map((i) => i.label)).toEqual([
      '총 비행시간', '단독 비행', '야외비행', '120km 이상 타 지점 이착륙',
    ])
  })

  it('동력패러슈트는 야외비행과 구간거리 요건이 없다', () => {
    const p = calculateProgress([], '동력패러슈트', index)
    expect(p.items.map((i) => i.label)).toEqual(['총 비행시간', '단독 비행'])
  })

  it('다른 기종의 기록은 집계하지 않는다', () => {
    const logs = [makeLog({ aircraft_id: OTHER_AC, flight_duration_min: 600 })]
    const p = calculateProgress(logs, '타면조종형비행기', index)
    expect(p.items[0].current).toBe(0)
  })

  it('임시저장은 집계에서 뺀다', () => {
    const logs = [makeLog({ flight_duration_min: 600, is_draft: true })]
    const p = calculateProgress(logs, '타면조종형비행기', index)
    expect(p.items[0].current).toBe(0)
  })

  it('기체 미지정 기록은 집계에서 빼고 따로 센다', () => {
    const logs = [makeLog({ aircraft_id: null, flight_duration_min: 600 })]
    const p = calculateProgress(logs, '타면조종형비행기', index)
    expect(p.items[0].current).toBe(0)
    expect(p.unassigned).toBe(1)
  })

  it('단독 비행만 단독 시간에 쌓인다', () => {
    const logs = [
      makeLog({ flight_duration_min: 120, pilot_role: 'solo' }),
      makeLog({ flight_duration_min: 180, pilot_role: 'dual' }),
    ]
    const p = calculateProgress(logs, '타면조종형비행기', index)
    expect(p.items[0].current).toBe(300)
    expect(p.items[1].current).toBe(120)
  })

  it('구간거리 요건은 거리와 출발·도착이 다를 때만 센다', () => {
    const logs = [
      // 거리는 넘지만 출발지와 도착지가 같다 -> 인정 안 됨
      makeLog({ is_cross_country: true, leg_distance_km: 150, arrival_airfield: '울진비행장' }),
      // 다른 지점이지만 거리가 모자람 -> 인정 안 됨
      makeLog({ is_cross_country: true, leg_distance_km: 80, arrival_airfield: '양양비행장' }),
      // 둘 다 충족
      makeLog({ is_cross_country: true, leg_distance_km: 130, arrival_airfield: '양양비행장' }),
    ]
    const p = calculateProgress(logs, '타면조종형비행기', index)
    const leg = p.items.find((i) => i.label.includes('120km'))
    expect(leg?.current).toBe(1)
    expect(leg?.met).toBe(true)
  })

  it('야외비행 플래그가 꺼진 기록은 야외 시간에 쌓이지 않는다', () => {
    const logs = [makeLog({ flight_duration_min: 400, is_cross_country: false })]
    const p = calculateProgress(logs, '타면조종형비행기', index)
    expect(p.items[2].current).toBe(0)
  })

  it('요건을 다 채우면 allMet 이 된다', () => {
    const req = REQUIREMENTS.타면조종형비행기
    const logs = [
      makeLog({ flight_duration_min: req.soloMinutes, pilot_role: 'solo' }),
      makeLog({
        flight_duration_min: req.crossCountryMinutes,
        is_cross_country: true,
        leg_distance_km: 130,
        arrival_airfield: '양양비행장',
      }),
      makeLog({ flight_duration_min: req.totalMinutes }),
    ]
    const p = calculateProgress(logs, '타면조종형비행기', index)
    expect(p.allMet).toBe(true)
  })

  it('요건 수치는 20시간 / 단독 5시간 / 야외 5시간 / 120km', () => {
    const req = REQUIREMENTS.타면조종형비행기
    expect(req.totalMinutes).toBe(1200)
    expect(req.soloMinutes).toBe(300)
    expect(req.crossCountryMinutes).toBe(300)
    expect(req.legDistanceKm).toBe(120)
  })
})

describe('formatMinutes', () => {
  it('시간과 분으로 나눈다', () => {
    expect(formatMinutes(0)).toBe('0시간 0분')
    expect(formatMinutes(75)).toBe('1시간 15분')
    expect(formatMinutes(1200)).toBe('20시간 0분')
  })
})

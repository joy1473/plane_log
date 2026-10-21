import { describe, it, expect } from 'vitest'
import { aircraftHours, maintenanceStatus } from '../maintenance'
import { collectVisited } from '../visited'
import type { AirfieldOption } from '../user-airfields'
import type { Aircraft, FlightLog, MaintenanceItem } from '../../types/flight-log'

const AC: Aircraft = {
  id: 'ac-1', registration: 'HL1234', category: '타면조종형비행기',
  model: null, note: null, initial_hours: 0,
}

function log(overrides: Partial<FlightLog> = {}): FlightLog {
  return {
    flight_date: '2026-10-01',
    departure_time: null, arrival_time: null,
    flight_duration_min: 60,
    departure_airfield: '울진비행장', arrival_airfield: '울진비행장',
    instructor_name: null, training_purpose: null,
    landing_count: 1, flight_altitude_ft: null,
    training_institution: null, remarks: null,
    aircraft_id: 'ac-1',
    ...overrides,
  }
}

function item(overrides: Partial<MaintenanceItem> = {}): MaintenanceItem {
  return {
    id: 'm-1', aircraft_id: 'ac-1', name: '오일 교환',
    interval_hours: 50, last_done_hours: 0, last_done_on: null, note: null,
    ...overrides,
  }
}

describe('aircraftHours', () => {
  it('비행기록을 시간으로 합산한다', () => {
    expect(aircraftHours([log({ flight_duration_min: 90 })], AC)).toBe(1.5)
  })

  it('기록 전 누적시간을 더한다', () => {
    const used = { ...AC, initial_hours: 120.5 }
    expect(aircraftHours([log({ flight_duration_min: 30 })], used)).toBe(121)
  })

  it('다른 기체와 임시저장은 빼고 센다', () => {
    const logs = [
      log({ flight_duration_min: 60 }),
      log({ flight_duration_min: 600, aircraft_id: 'ac-2' }),
      log({ flight_duration_min: 600, is_draft: true }),
    ]
    expect(aircraftHours(logs, AC)).toBe(1)
  })
})

describe('maintenanceStatus', () => {
  it('마지막 수행을 모르면 추측하지 않는다', () => {
    const st = maintenanceStatus(item({ last_done_hours: null }), 30)
    expect(st.level).toBe('unknown')
    expect(st.remainingHours).toBeNull()
  })

  it('남은 시간은 마지막 수행 + 주기 - 현재', () => {
    const st = maintenanceStatus(item({ last_done_hours: 100, interval_hours: 50 }), 120)
    expect(st.dueAtHours).toBe(150)
    expect(st.remainingHours).toBe(30)
    expect(st.level).toBe('ok')
  })

  it('지나면 overdue 가 되고 음수로 표시된다', () => {
    const st = maintenanceStatus(item({ last_done_hours: 100, interval_hours: 50 }), 155)
    expect(st.remainingHours).toBe(-5)
    expect(st.level).toBe('overdue')
  })

  it('주기의 10% 이내로 들어오면 soon', () => {
    const st = maintenanceStatus(item({ last_done_hours: 0, interval_hours: 50 }), 46)
    expect(st.level).toBe('soon')
  })

  it('1시간 이내는 due', () => {
    const st = maintenanceStatus(item({ last_done_hours: 0, interval_hours: 50 }), 49.5)
    expect(st.level).toBe('due')
  })
})

describe('collectVisited', () => {
  const options: AirfieldOption[] = [
    { name: '울진비행장', lat: 36.75, lng: 129.34, source: 'builtin' },
    { name: '내 농장', lat: 36.0, lng: 127.0, source: 'user' },
  ]

  it('왕복은 한 비행에서 한 번만 센다', () => {
    const v = collectVisited([log()], options)
    expect(v).toHaveLength(1)
    expect(v[0].visits).toBe(1)
  })

  it('출발지와 도착지가 다르면 둘 다 센다', () => {
    const v = collectVisited([log({ arrival_airfield: '내 농장' })], options)
    expect(v.map((x) => x.name).sort()).toEqual(['내 농장', '울진비행장'])
  })

  it('사설 이착륙장과 좌표 없는 곳을 구분한다', () => {
    const v = collectVisited(
      [log({ arrival_airfield: '내 농장' }), log({ departure_airfield: '이름없는곳' })],
      options
    )
    expect(v.find((x) => x.name === '내 농장')?.custom).toBe(true)
    expect(v.find((x) => x.name === '이름없는곳')?.known).toBe(false)
  })

  it('첫 방문과 마지막 방문 날짜를 잡는다', () => {
    const v = collectVisited(
      [log({ flight_date: '2026-05-01' }), log({ flight_date: '2026-01-01' })],
      options
    )
    expect(v[0].firstVisit).toBe('2026-01-01')
    expect(v[0].lastVisit).toBe('2026-05-01')
  })

  it('임시저장은 방문으로 치지 않는다', () => {
    expect(collectVisited([log({ is_draft: true })], options)).toHaveLength(0)
  })
})

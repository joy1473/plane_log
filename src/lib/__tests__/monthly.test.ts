import { describe, it, expect } from 'vitest'
import { bucketByMonth, toHours } from '../monthly'
import type { FlightLog } from '../../types/flight-log'

function log(date: string, min: number, solo = false): FlightLog {
  return {
    flight_date: date,
    departure_time: null, arrival_time: null,
    flight_duration_min: min,
    departure_airfield: '울진비행장', arrival_airfield: '울진비행장',
    instructor_name: null, training_purpose: null,
    landing_count: 1, flight_altitude_ft: null,
    training_institution: null, remarks: null,
    pilot_role: solo ? 'solo' : 'dual',
  }
}

describe('bucketByMonth', () => {
  it('기록이 없으면 빈 배열', () => {
    expect(bucketByMonth([])).toEqual([])
  })

  it('같은 달을 합치고 단독·동승을 나눈다', () => {
    const b = bucketByMonth([
      log('2026-03-01', 60),
      log('2026-03-20', 30, true),
    ])
    expect(b).toHaveLength(1)
    expect(b[0].dualMin).toBe(60)
    expect(b[0].soloMin).toBe(30)
    expect(b[0].totalMin).toBe(90)
  })

  it('비행이 없던 달도 빈 막대로 남긴다', () => {
    const b = bucketByMonth([log('2026-01-05', 60), log('2026-04-05', 60)])
    expect(b.map((x) => x.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
    expect(b[1].totalMin).toBe(0)
  })

  it('연도를 넘겨도 순서가 이어진다', () => {
    const b = bucketByMonth([log('2025-11-01', 60), log('2026-02-01', 60)])
    expect(b.map((x) => x.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('1월에만 연도를 붙인다', () => {
    const b = bucketByMonth([log('2025-12-01', 60), log('2026-01-01', 60)])
    expect(b[0].label).toBe('12월')
    expect(b[1].label).toBe('26년 1월')
  })

  it('임시저장은 세지 않는다', () => {
    const draft = { ...log('2026-03-01', 600), is_draft: true }
    const b = bucketByMonth([log('2026-03-01', 60), draft])
    expect(b[0].totalMin).toBe(60)
  })
})

describe('toHours', () => {
  it('소수 한 자리로 떨어뜨린다', () => {
    expect(toHours(90)).toBe('1.5')
    expect(toHours(0)).toBe('0.0')
    expect(toHours(100)).toBe('1.7')
  })
})

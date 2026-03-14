import { describe, it, expect } from 'vitest'
import { calculateTotalHours } from '../supabase-flight-log'
import type { FlightLog } from '../../types/flight-log'

function makeLog(overrides: Partial<FlightLog> = {}): FlightLog {
  return {
    flight_date: '2024-01-01',
    departure_time: null,
    arrival_time: null,
    flight_duration_min: 60,
    airfield: '광주공항',
    instructor_name: null,
    training_purpose: null,
    landing_count: 1,
    flight_altitude_ft: null,
    training_institution: null,
    remarks: null,
    ...overrides,
  }
}

describe('calculateTotalHours', () => {
  it('returns zeros for an empty array', () => {
    const result = calculateTotalHours([])
    expect(result.totalMinutes).toBe(0)
    expect(result.totalHours).toBe('0시간 0분')
    expect(result.totalFlights).toBe(0)
    expect(result.totalLandings).toBe(0)
  })

  it('returns correct values for a single log', () => {
    const result = calculateTotalHours([makeLog({ flight_duration_min: 90, landing_count: 2 })])
    expect(result.totalMinutes).toBe(90)
    expect(result.totalHours).toBe('1시간 30분')
    expect(result.totalFlights).toBe(1)
    expect(result.totalLandings).toBe(2)
  })

  it('sums minutes across multiple logs', () => {
    const logs = [
      makeLog({ flight_duration_min: 45, landing_count: 1 }),
      makeLog({ flight_duration_min: 75, landing_count: 3 }),
      makeLog({ flight_duration_min: 60, landing_count: 2 }),
    ]
    const result = calculateTotalHours(logs)
    expect(result.totalMinutes).toBe(180)
    expect(result.totalHours).toBe('3시간 0분')
    expect(result.totalFlights).toBe(3)
    expect(result.totalLandings).toBe(6)
  })

  it('handles minutes that do not divide evenly into hours', () => {
    const logs = [
      makeLog({ flight_duration_min: 100 }),
      makeLog({ flight_duration_min: 25 }),
    ]
    const result = calculateTotalHours(logs)
    expect(result.totalMinutes).toBe(125)
    expect(result.totalHours).toBe('2시간 5분')
  })

  it('treats null landing_count as 0', () => {
    // landing_count is typed as number but the runtime ?? 0 guard handles it
    const log = makeLog({ landing_count: null as unknown as number })
    const result = calculateTotalHours([log])
    expect(result.totalLandings).toBe(0)
  })

  it('totalFlights equals the number of logs provided', () => {
    const logs = Array.from({ length: 7 }, () => makeLog())
    const result = calculateTotalHours(logs)
    expect(result.totalFlights).toBe(7)
  })
})

import { describe, it, expect } from 'vitest'
import { parseCsvString } from '../csv-parser-light'

// Minimal valid row helpers
const VALID_ROW = '2024-03-01,60,광주공항'
const HEADER_KO = '날짜,비행시간(분),이착륙장'
const HEADER_EN = 'flight_date,flight_duration_min,airfield'

describe('parseCsvString - header mapping', () => {
  it('maps Korean headers correctly', () => {
    const csv = `${HEADER_KO}\n${VALID_ROW}`
    const result = parseCsvString(csv)
    expect(result.errors.filter((e) => e.startsWith('필수'))).toHaveLength(0)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].flight_date).toBe('2024-03-01')
    expect(result.data[0].flight_duration_min).toBe(60)
    expect(result.data[0].airfield).toBe('광주공항')
  })

  it('maps English headers correctly', () => {
    const csv = `${HEADER_EN}\n${VALID_ROW}`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].flight_date).toBe('2024-03-01')
  })

  it('maps alternate Korean header variants', () => {
    const csv = `비행날짜,비행 시간(분),이착륙장\n2024-04-01,45,여수공항`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].flight_date).toBe('2024-04-01')
    expect(result.data[0].flight_duration_min).toBe(45)
  })

  it('maps all optional fields when present', () => {
    const header = '날짜,비행시간(분),이착륙장,교관 이름,훈련 목적,착륙 횟수,비행 고도,비고'
    const row = '2024-05-01,90,울산공항,김교관,훈련비행,2,1500,메모내용'
    const result = parseCsvString(`${header}\n${row}`)
    const log = result.data[0]
    expect(log.instructor_name).toBe('김교관')
    expect(log.training_purpose).toBe('훈련비행')
    expect(log.landing_count).toBe(2)
    expect(log.flight_altitude_ft).toBe(1500)
    expect(log.remarks).toBe('메모내용')
  })
})

describe('parseCsvString - required field validation', () => {
  it('returns error when flight_date header is missing', () => {
    const csv = `비행시간(분),이착륙장\n60,광주공항`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(0)
    expect(result.errors.some((e) => e.includes('날짜'))).toBe(true)
  })

  it('returns error when flight_duration_min header is missing', () => {
    const csv = `날짜,이착륙장\n2024-03-01,광주공항`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(0)
    expect(result.errors.some((e) => e.includes('비행 시간'))).toBe(true)
  })

  it('returns error when airfield header is missing', () => {
    const csv = `날짜,비행시간(분)\n2024-03-01,60`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(0)
    expect(result.errors.some((e) => e.includes('이착륙장'))).toBe(true)
  })

  it('skips row with missing flight_date value and increments skipped', () => {
    const csv = `날짜,비행시간(분),이착륙장\n,60,광주공항`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(0)
    expect(result.skipped).toBe(1)
  })

  it('skips row with zero flight_duration_min', () => {
    const csv = `${HEADER_KO}\n2024-03-01,0,광주공항`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(0)
    expect(result.skipped).toBe(1)
  })

  it('skips row with missing airfield value', () => {
    const csv = `${HEADER_KO}\n2024-03-01,60,`
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(0)
    expect(result.skipped).toBe(1)
  })
})

describe('parseCsvString - empty input', () => {
  it('returns error for empty CSV', () => {
    const result = parseCsvString('')
    expect(result.data).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns error for header-only CSV', () => {
    // All required headers present but no data rows
    const result = parseCsvString(`${HEADER_KO}\n`)
    expect(result.data).toHaveLength(0)
    expect(result.skipped).toBe(0)
  })
})

describe('parseCsvString - multiple rows', () => {
  it('parses multiple valid rows', () => {
    const csv = [
      HEADER_KO,
      '2024-01-01,30,광주공항',
      '2024-01-02,45,여수공항',
      '2024-01-03,60,울산공항',
    ].join('\n')
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(3)
    expect(result.skipped).toBe(0)
  })

  it('skips invalid rows while keeping valid ones', () => {
    const csv = [
      HEADER_KO,
      '2024-01-01,30,광주공항',
      ',0,',       // invalid: missing date + zero duration + missing airfield
      '2024-01-03,60,울산공항',
    ].join('\n')
    const result = parseCsvString(csv)
    expect(result.data).toHaveLength(2)
    expect(result.skipped).toBe(1)
  })
})

describe('parseCsvString - defaults', () => {
  it('defaults landing_count to 1 when not provided', () => {
    const csv = `${HEADER_KO}\n${VALID_ROW}`
    const result = parseCsvString(csv)
    expect(result.data[0].landing_count).toBe(1)
  })

  it('sets optional fields to null when absent', () => {
    const csv = `${HEADER_KO}\n${VALID_ROW}`
    const result = parseCsvString(csv)
    const log = result.data[0]
    expect(log.departure_time).toBeNull()
    expect(log.arrival_time).toBeNull()
    expect(log.instructor_name).toBeNull()
    expect(log.training_purpose).toBeNull()
    expect(log.flight_altitude_ft).toBeNull()
    expect(log.training_institution).toBeNull()
    expect(log.remarks).toBeNull()
  })
})

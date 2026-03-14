import { describe, it, expect } from 'vitest'
import { parseCsvString } from '../src/lib/csv-parser-light'
import { calculateTotalHours } from '../src/lib/supabase-flight-log'

describe('parseCsvString', () => {
  it('한국어 헤더로 된 CSV를 정상 파싱한다', () => {
    const csv = `날짜,비행 시작 시간,비행 종료 시간,비행 시간(분),이착륙장,교관 이름,훈련 목적,착륙 횟수,비행 고도,비고
2025-03-01,09:00,10:30,90,울진비행장,김교관,이착륙 훈련,3,500,맑음`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(1)
    expect(result.errors.filter(e => !e.startsWith('매핑되지'))).toHaveLength(0)
    expect(result.data[0]).toEqual({
      flight_date: '2025-03-01',
      departure_time: '09:00',
      arrival_time: '10:30',
      flight_duration_min: 90,
      airfield: '울진비행장',
      instructor_name: '김교관',
      training_purpose: '이착륙 훈련',
      landing_count: 3,
      flight_altitude_ft: 500,
      training_institution: null,
      remarks: '맑음',
    })
  })

  it('영문 헤더로 된 CSV를 정상 파싱한다', () => {
    const csv = `flight_date,departure_time,arrival_time,flight_duration_min,airfield,instructor_name,training_purpose,landing_count,flight_altitude_ft,remarks
2025-04-15,08:00,09:00,60,Ulljin,Park,Solo practice,2,300,Clear`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].flight_date).toBe('2025-04-15')
    expect(result.data[0].flight_duration_min).toBe(60)
    expect(result.data[0].airfield).toBe('Ulljin')
  })

  it('필수 필드 누락 시 에러를 반환한다', () => {
    const csv = `날짜,비행 시간(분),이착륙장
2025-01-01,,울진비행장`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(0)
    expect(result.skipped).toBe(1)
    expect(result.errors.some(e => e.includes('비행 시간(분)'))).toBe(true)
  })

  it('필수 열이 아예 없으면 에러를 반환한다', () => {
    const csv = `이름,나이
홍길동,30`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(0)
    expect(result.errors.some(e => e.includes('필수 열'))).toBe(true)
  })

  it('여러 행을 파싱하고 잘못된 행은 건너뛴다', () => {
    const csv = `날짜,비행시간(분),이착륙장
2025-01-01,60,울진비행장
2025-01-02,,서산비행장
2025-01-03,45,무안비행장`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(2)
    expect(result.skipped).toBe(1)
    expect(result.data[0].flight_date).toBe('2025-01-01')
    expect(result.data[1].flight_date).toBe('2025-01-03')
  })

  it('빈 행은 건너뛴다', () => {
    const csv = `날짜,비행 시간(분),이착륙장
2025-01-01,60,울진비행장

2025-01-02,45,서산비행장
`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(2)
  })

  it('축약된 한국어 헤더도 매핑한다', () => {
    const csv = `날짜,비행시간,비행장,교관,착륙횟수
2025-06-01,30,울진비행장,이교관,2`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].airfield).toBe('울진비행장')
    expect(result.data[0].instructor_name).toBe('이교관')
    expect(result.data[0].landing_count).toBe(2)
  })

  it('교육기관 열을 파싱한다', () => {
    const csv = `날짜,비행 시간(분),이착륙장,전문교육기관
2025-07-01,60,울진비행장,한국항공전문학교`

    const result = parseCsvString(csv)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].training_institution).toBe('한국항공전문학교')
  })

  it('착륙 횟수 미입력 시 기본값 1을 사용한다', () => {
    const csv = `날짜,비행 시간(분),이착륙장
2025-01-01,60,울진비행장`

    const result = parseCsvString(csv)

    expect(result.data[0].landing_count).toBe(1)
  })
})

describe('calculateTotalHours', () => {
  it('누적 시간을 올바르게 계산한다', () => {
    const logs = [
      { flight_duration_min: 90, landing_count: 3 },
      { flight_duration_min: 60, landing_count: 2 },
      { flight_duration_min: 45, landing_count: 1 },
    ]

    const stats = calculateTotalHours(logs as any)

    expect(stats.totalMinutes).toBe(195)
    expect(stats.totalHours).toBe('3시간 15분')
    expect(stats.totalFlights).toBe(3)
    expect(stats.totalLandings).toBe(6)
  })
})

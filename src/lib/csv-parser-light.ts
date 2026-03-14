import Papa from 'papaparse'
import type { FlightLog, CsvParseResult } from '../types/flight-log'

// 한국어 → 영문 열 이름 매핑
const HEADER_MAP: Record<string, keyof FlightLog> = {
  '날짜': 'flight_date',
  '비행날짜': 'flight_date',
  '비행 날짜': 'flight_date',
  'flight_date': 'flight_date',
  'date': 'flight_date',

  '비행 시작 시간': 'departure_time',
  '출발시간': 'departure_time',
  '시작시간': 'departure_time',
  'departure_time': 'departure_time',

  '비행 종료 시간': 'arrival_time',
  '도착시간': 'arrival_time',
  '종료시간': 'arrival_time',
  'arrival_time': 'arrival_time',

  '비행 시간(분)': 'flight_duration_min',
  '비행시간(분)': 'flight_duration_min',
  '비행시간': 'flight_duration_min',
  'flight_duration_min': 'flight_duration_min',
  'duration': 'flight_duration_min',

  '이착륙장': 'airfield',
  '비행장': 'airfield',
  '공항': 'airfield',
  'airfield': 'airfield',

  '교관 이름': 'instructor_name',
  '교관': 'instructor_name',
  '교관명': 'instructor_name',
  'instructor': 'instructor_name',
  'instructor_name': 'instructor_name',

  '훈련 목적': 'training_purpose',
  '훈련목적': 'training_purpose',
  '비행목적': 'training_purpose',
  'training_purpose': 'training_purpose',
  'purpose': 'training_purpose',

  '착륙 횟수': 'landing_count',
  '착륙횟수': 'landing_count',
  'landing_count': 'landing_count',
  'landings': 'landing_count',

  '비행 고도': 'flight_altitude_ft',
  '비행고도': 'flight_altitude_ft',
  '고도': 'flight_altitude_ft',
  'flight_altitude_ft': 'flight_altitude_ft',
  'altitude': 'flight_altitude_ft',

  '교육기관': 'training_institution',
  '전문교육기관': 'training_institution',
  '훈련기관': 'training_institution',
  'training_institution': 'training_institution',
  'institution': 'training_institution',

  '비고': 'remarks',
  '메모': 'remarks',
  'remarks': 'remarks',
  'notes': 'remarks',
}

function normalizeHeader(header: string): keyof FlightLog | null {
  const trimmed = header.trim()
  return HEADER_MAP[trimmed] ?? HEADER_MAP[trimmed.toLowerCase()] ?? null
}

function parseRow(
  row: Record<string, string>,
  headerMapping: Record<string, keyof FlightLog>,
  rowIndex: number
): { log: FlightLog | null; error: string | null } {
  const mapped: Partial<FlightLog> = {}

  for (const [csvHeader, dbField] of Object.entries(headerMapping)) {
    const value = row[csvHeader]?.trim() ?? ''
    if (!value) continue

    switch (dbField) {
      case 'flight_date':
        mapped.flight_date = value
        break
      case 'departure_time':
      case 'arrival_time':
        mapped[dbField] = value
        break
      case 'flight_duration_min':
      case 'landing_count':
      case 'flight_altitude_ft': {
        const num = parseInt(value, 10)
        if (!isNaN(num)) mapped[dbField] = num
        break
      }
      default:
        ;(mapped as Record<string, unknown>)[dbField] = value
    }
  }

  // 필수 필드 검증
  if (!mapped.flight_date) {
    return { log: null, error: `행 ${rowIndex + 1}: 날짜 누락` }
  }
  if (mapped.flight_duration_min == null || mapped.flight_duration_min <= 0) {
    return { log: null, error: `행 ${rowIndex + 1}: 비행 시간(분) 누락 또는 0 이하` }
  }
  if (!mapped.airfield) {
    return { log: null, error: `행 ${rowIndex + 1}: 이착륙장 누락` }
  }

  const log: FlightLog = {
    flight_date: mapped.flight_date,
    departure_time: mapped.departure_time ?? null,
    arrival_time: mapped.arrival_time ?? null,
    flight_duration_min: mapped.flight_duration_min,
    airfield: mapped.airfield,
    instructor_name: mapped.instructor_name ?? null,
    training_purpose: mapped.training_purpose ?? null,
    landing_count: mapped.landing_count ?? 1,
    flight_altitude_ft: mapped.flight_altitude_ft ?? null,
    training_institution: mapped.training_institution ?? null,
    remarks: mapped.remarks ?? null,
  }

  return { log, error: null }
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      beforeFirstChunk: (chunk) => chunk.replace(/^\uFEFF/, ''), // BOM 제거
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          resolve({ data: [], errors: ['CSV 헤더를 찾을 수 없습니다'], skipped: 0 })
          return
        }

        // 헤더 매핑 생성
        const headerMapping: Record<string, keyof FlightLog> = {}
        const unmappedHeaders: string[] = []

        for (const field of results.meta.fields) {
          const mapped = normalizeHeader(field)
          if (mapped) {
            headerMapping[field] = mapped
          } else {
            unmappedHeaders.push(field)
          }
        }

        // 필수 필드 매핑 확인
        const mappedValues = new Set(Object.values(headerMapping))
        const missingRequired: string[] = []
        if (!mappedValues.has('flight_date')) missingRequired.push('날짜')
        if (!mappedValues.has('flight_duration_min')) missingRequired.push('비행 시간(분)')
        if (!mappedValues.has('airfield')) missingRequired.push('이착륙장')

        if (missingRequired.length > 0) {
          resolve({
            data: [],
            errors: [`필수 열을 찾을 수 없습니다: ${missingRequired.join(', ')}`],
            skipped: 0,
          })
          return
        }

        const logs: FlightLog[] = []
        const errors: string[] = []
        let skipped = 0

        if (unmappedHeaders.length > 0) {
          errors.push(`매핑되지 않은 열: ${unmappedHeaders.join(', ')}`)
        }

        for (let i = 0; i < results.data.length; i++) {
          const { log, error } = parseRow(results.data[i], headerMapping, i)
          if (log) {
            logs.push(log)
          } else if (error) {
            errors.push(error)
            skipped++
          }
        }

        resolve({ data: logs, errors, skipped })
      },
      error: (error) => {
        resolve({ data: [], errors: [`CSV 파싱 오류: ${error.message}`], skipped: 0 })
      },
    })
  })
}

export function parseCsvString(csvString: string): CsvParseResult {
  const results = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  if (!results.meta.fields || results.meta.fields.length === 0) {
    return { data: [], errors: ['CSV 헤더를 찾을 수 없습니다'], skipped: 0 }
  }

  const headerMapping: Record<string, keyof FlightLog> = {}
  for (const field of results.meta.fields) {
    const mapped = normalizeHeader(field)
    if (mapped) headerMapping[field] = mapped
  }

  // 필수 필드 매핑 확인
  const mappedValues = new Set(Object.values(headerMapping))
  const missingRequired: string[] = []
  if (!mappedValues.has('flight_date')) missingRequired.push('날짜')
  if (!mappedValues.has('flight_duration_min')) missingRequired.push('비행 시간(분)')
  if (!mappedValues.has('airfield')) missingRequired.push('이착륙장')

  if (missingRequired.length > 0) {
    return {
      data: [],
      errors: [`필수 열을 찾을 수 없습니다: ${missingRequired.join(', ')}`],
      skipped: 0,
    }
  }

  const logs: FlightLog[] = []
  const errors: string[] = []
  let skipped = 0

  for (let i = 0; i < results.data.length; i++) {
    const { log, error } = parseRow(results.data[i], headerMapping, i)
    if (log) logs.push(log)
    else if (error) {
      errors.push(error)
      skipped++
    }
  }

  return { data: logs, errors, skipped }
}

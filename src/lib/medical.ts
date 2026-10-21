/**
 * 항공신체검사증명 유효기간 계산.
 *
 * 경량항공기 조종사는 제2종이고, 유효기간이 검사 당시 나이에 따라 갈린다.
 *   40세 미만  60개월
 *   40~50세    24개월
 *   50세 이상  12개월
 *
 * ⚠️ 출처 주의 — 검진기관 안내 페이지 기준이며 법령 원문을 직접 확인하지
 * 못했다. 나이를 검사일 기준으로 보는지 발급일 기준으로 보는지, 구간
 * 경계에서 어떻게 처리하는지도 확정하지 못했다. 갱신 전에 반드시 확인할 것.
 *
 * 이 구조에서 가장 놓치기 쉬운 지점은 50세 생일이다. 그 전까지 24개월이던
 * 주기가 갑자기 12개월로 줄어든다. 앱이 대신 세어주는 값이 바로 여기다.
 */

export const MEDICAL_CLASS_2_BANDS = [
  { minAge: 0, months: 60 },
  { minAge: 40, months: 24 },
  { minAge: 50, months: 12 },
] as const

/** 기준일 시점의 만 나이 */
export function ageOn(birthDate: string, onDate: string): number {
  const b = new Date(birthDate)
  const d = new Date(onDate)
  let age = d.getFullYear() - b.getFullYear()
  const beforeBirthday =
    d.getMonth() < b.getMonth() ||
    (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())
  if (beforeBirthday) age--
  return age
}

export function medicalValidityMonths(age: number): number {
  let months: number = MEDICAL_CLASS_2_BANDS[0].months
  for (const band of MEDICAL_CLASS_2_BANDS) {
    if (age >= band.minAge) months = band.months
  }
  return months
}

/** 검사일과 생년월일로 만료일(YYYY-MM-DD)을 구한다 */
export function medicalExpiry(birthDate: string, examDate: string): string {
  const months = medicalValidityMonths(ageOn(birthDate, examDate))
  const d = new Date(examDate)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  // 말일 보정: 1월 31일 + 1개월이 3월로 넘어가는 것을 막는다
  if (d.getDate() !== day) d.setDate(0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 오늘 기준 남은 일수. 음수면 이미 만료 */
export function daysUntil(dateIso: string, today = new Date()): number {
  const target = new Date(dateIso + 'T00:00:00')
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target.getTime() - base.getTime()) / 86400000)
}

export type ExpiryStatus = 'expired' | 'urgent' | 'soon' | 'ok'

export function expiryStatus(days: number): ExpiryStatus {
  if (days < 0) return 'expired'
  if (days <= 30) return 'urgent'
  if (days <= 90) return 'soon'
  return 'ok'
}

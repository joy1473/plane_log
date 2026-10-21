import { describe, it, expect } from 'vitest'
import { ageOn, medicalValidityMonths, medicalExpiry, daysUntil, expiryStatus } from '../medical'

describe('ageOn', () => {
  it('생일이 지나지 않았으면 한 살 덜 센다', () => {
    expect(ageOn('1990-06-15', '2026-06-14')).toBe(35)
    expect(ageOn('1990-06-15', '2026-06-15')).toBe(36)
  })
})

describe('medicalValidityMonths', () => {
  it('나이 구간별 유효기간', () => {
    expect(medicalValidityMonths(39)).toBe(60)
    expect(medicalValidityMonths(40)).toBe(24)
    expect(medicalValidityMonths(49)).toBe(24)
    expect(medicalValidityMonths(50)).toBe(12)
    expect(medicalValidityMonths(70)).toBe(12)
  })
})

describe('medicalExpiry', () => {
  it('40세 미만은 60개월 뒤', () => {
    expect(medicalExpiry('2000-01-10', '2026-03-10')).toBe('2031-03-10')
  })

  it('50세 이상은 12개월 뒤 — 갱신 주기가 갑자기 짧아지는 지점', () => {
    expect(medicalExpiry('1970-01-10', '2026-03-10')).toBe('2027-03-10')
  })

  it('말일 보정 — 넘치는 날짜를 다음 달로 밀지 않는다', () => {
    // 2026-08-31 + 12개월(50세 이상) = 2027-08-31
    expect(medicalExpiry('1970-01-01', '2026-08-31')).toBe('2027-08-31')
    // 1월 31일 + 24개월(40대)은 2월로 넘어가면 안 된다
    expect(medicalExpiry('1984-01-01', '2026-01-31')).toBe('2028-01-31')
  })
})

describe('daysUntil', () => {
  const today = new Date(2026, 9, 21) // 2026-10-21

  it('남은 일수를 센다', () => {
    expect(daysUntil('2026-10-21', today)).toBe(0)
    expect(daysUntil('2026-10-31', today)).toBe(10)
  })

  it('지난 날짜는 음수', () => {
    expect(daysUntil('2026-10-01', today)).toBe(-20)
  })
})

describe('expiryStatus', () => {
  it('남은 일수에 따라 단계가 갈린다', () => {
    expect(expiryStatus(-1)).toBe('expired')
    expect(expiryStatus(0)).toBe('urgent')
    expect(expiryStatus(30)).toBe('urgent')
    expect(expiryStatus(31)).toBe('soon')
    expect(expiryStatus(90)).toBe('soon')
    expect(expiryStatus(91)).toBe('ok')
  })
})

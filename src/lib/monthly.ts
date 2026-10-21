import type { FlightLog } from '../types/flight-log'

export interface MonthBucket {
  key: string
  label: string
  soloMin: number
  dualMin: number
  totalMin: number
}

function labelFor(year: number, month: number): string {
  // 1월에만 연도를 붙여 가로축이 길어지지 않게 한다
  return month === 1 ? `${String(year).slice(2)}년 1월` : `${month}월`
}

/**
 * 월별로 묶되 비행이 없던 달도 빈 막대로 남긴다.
 * 공백을 접어버리면 "두 달 쉬었다"가 그래프에서 사라진다.
 */
export function bucketByMonth(logs: FlightLog[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>()

  for (const log of logs) {
    if (log.is_draft) continue
    const key = log.flight_date.slice(0, 7)
    let b = map.get(key)
    if (!b) {
      const [y, m] = key.split('-').map(Number)
      b = { key, label: labelFor(y, m), soloMin: 0, dualMin: 0, totalMin: 0 }
      map.set(key, b)
    }
    if (log.pilot_role === 'solo') b.soloMin += log.flight_duration_min
    else b.dualMin += log.flight_duration_min
    b.totalMin += log.flight_duration_min
  }

  const keys = Array.from(map.keys()).sort()
  if (keys.length === 0) return []

  const out: MonthBucket[] = []
  const [sy, sm] = keys[0].split('-').map(Number)
  const [ey, em] = keys[keys.length - 1].split('-').map(Number)

  let y = sy
  let m = sm
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(map.get(key) ?? { key, label: labelFor(y, m), soloMin: 0, dualMin: 0, totalMin: 0 })
    if (m === 12) { m = 1; y++ } else { m++ }
  }
  return out
}

export function toHours(min: number): string {
  return (Math.round((min / 60) * 10) / 10).toFixed(1)
}

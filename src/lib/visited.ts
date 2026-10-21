import type { FlightLog } from '../types/flight-log'
import type { AirfieldOption } from './user-airfields'

/**
 * 방문한 이착륙장 모으기.
 *
 * 따로 기록할 것이 없다 — 비행기록의 출발지와 도착지가 곧 방문 기록이다.
 * 면허 이후에도 앱을 열게 만드는 쪽은 결국 이런 수집 요소다.
 */
export interface VisitedAirfield {
  name: string
  /** 들르거나 떠난 횟수. 왕복이면 한 비행에서 한 번만 센다 */
  visits: number
  departures: number
  arrivals: number
  firstVisit: string
  lastVisit: string
  lat: number | null
  lng: number | null
  /** 내장 목록에 없는 사설 이착륙장인지 */
  custom: boolean
  known: boolean
}

export function collectVisited(
  logs: FlightLog[],
  options: AirfieldOption[]
): VisitedAirfield[] {
  const byName = new Map<string, AirfieldOption>(options.map((o) => [o.name, o]))
  const out = new Map<string, VisitedAirfield>()

  for (const log of logs) {
    if (log.is_draft) continue

    const from = log.departure_airfield?.trim()
    const to = log.arrival_airfield?.trim()
    // 같은 곳이면 한 비행에 한 번만 센다
    const names = new Set([from, to].filter((n): n is string => !!n))

    for (const name of names) {
      let v = out.get(name)
      if (!v) {
        const opt = byName.get(name)
        v = {
          name,
          visits: 0, departures: 0, arrivals: 0,
          firstVisit: log.flight_date, lastVisit: log.flight_date,
          lat: opt?.lat ?? null, lng: opt?.lng ?? null,
          custom: opt?.source === 'user',
          known: !!opt,
        }
        out.set(name, v)
      }
      v.visits++
      if (name === from) v.departures++
      if (name === to) v.arrivals++
      if (log.flight_date < v.firstVisit) v.firstVisit = log.flight_date
      if (log.flight_date > v.lastVisit) v.lastVisit = log.flight_date
    }
  }

  return Array.from(out.values()).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name))
}

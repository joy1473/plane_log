import { useMemo, useState } from 'react'
import type { Aircraft, FlightLog } from '../types/flight-log'

interface Props {
  logs: FlightLog[]
  aircraft: Aircraft[]
}

interface Pt { lat: number; lng: number }

/**
 * 궤적을 작은 SVG 스케치로. 위경도를 뷰박스에 맞춰 정규화하되
 * 가로세로 비를 유지해서 경로 모양이 찌그러지지 않게 한다.
 */
function RouteSketch({ points }: { points: Pt[] }) {
  const path = useMemo(() => {
    if (points.length < 2) return null
    const W = 96, H = 48, PAD = 4

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lng < minLng) minLng = p.lng
      if (p.lng > maxLng) maxLng = p.lng
    }
    // 위도 1도와 경도 1도의 실제 길이가 다르다. 위도로 보정하지 않으면
    // 동서로 긴 경로가 과장된다.
    const latSpan = Math.max(maxLat - minLat, 1e-6)
    const lngSpan = Math.max((maxLng - minLng) * Math.cos((minLat * Math.PI) / 180), 1e-6)
    const scale = Math.min((W - PAD * 2) / lngSpan, (H - PAD * 2) / latSpan)
    const offX = (W - lngSpan * scale) / 2
    const offY = (H - latSpan * scale) / 2

    const xy = (p: Pt) => [
      offX + (p.lng - minLng) * Math.cos((minLat * Math.PI) / 180) * scale,
      // SVG 의 y 는 아래로 자란다. 위도는 위로 자라므로 뒤집는다.
      H - offY - (p.lat - minLat) * scale,
    ]

    const d = points.map((p, i) => {
      const [x, y] = xy(p)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join('')

    const [sx, sy] = xy(points[0])
    const [ex, ey] = xy(points[points.length - 1])
    return { d, sx, sy, ex, ey, W, H }
  }, [points])

  if (!path) return <div className="w-24 h-12 rounded bg-gray-50 shrink-0" />

  return (
    <svg
      viewBox={`0 0 ${path.W} ${path.H}`}
      className="w-24 h-12 shrink-0 rounded bg-gray-50"
      aria-hidden="true"
    >
      <path d={path.d} fill="none" stroke="#2a78d6" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={path.sx} cy={path.sy} r="2.5" fill="#2a78d6" />
      <circle cx={path.ex} cy={path.ey} r="2.5" fill="#eb6834" />
    </svg>
  )
}

function hhmm(min: number): string {
  return `${Math.floor(min / 60)}시간 ${min % 60}분`
}

/**
 * 비행 타임라인. 날짜순으로 쌓이고 각 항목에 경로 스케치가 붙는다.
 * 훈련 중에는 기록이 증빙이지만 면허 이후에는 기록이 곧 추억이다.
 */
export default function FlightTimeline({ logs, aircraft }: Props) {
  const [filterAircraft, setFilterAircraft] = useState('')
  const regById = useMemo(() => new Map(aircraft.map((a) => [a.id, a.registration])), [aircraft])

  const entries = useMemo(() => {
    return logs
      .filter((l) => !l.is_draft)
      .filter((l) => !filterAircraft || l.aircraft_id === filterAircraft)
      .slice()
      .sort((a, b) => b.flight_date.localeCompare(a.flight_date))
      .slice(0, 40)
  }, [logs, filterAircraft])

  if (entries.length === 0) return null

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold">비행 타임라인</h2>
        {aircraft.length > 1 && (
          <select
            value={filterAircraft}
            onChange={(e) => setFilterAircraft(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
            aria-label="기체로 걸러보기"
          >
            <option value="">전체 기체</option>
            {aircraft.map((a) => (
              <option key={a.id} value={a.id}>{a.registration}</option>
            ))}
          </select>
        )}
      </div>

      <ol className="space-y-2">
        {entries.map((log, i) => {
          const points = log.track_points ?? []
          const from = log.departure_airfield
          const to = log.arrival_airfield
          return (
            <li
              key={log.id ?? `${log.flight_date}-${i}`}
              className="flex items-center gap-3 border border-gray-200 rounded p-2"
            >
              <RouteSketch points={points} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {from === to ? from : `${from} → ${to}`}
                </p>
                <p className="text-xs text-gray-500">
                  {log.flight_date} · {hhmm(log.flight_duration_min)}
                  {log.aircraft_id && regById.has(log.aircraft_id) && (
                    <> · {regById.get(log.aircraft_id)}</>
                  )}
                  {log.leg_distance_km ? <> · {log.leg_distance_km}km</> : null}
                </p>
                {(log.passenger_name || points.length > 0) && (
                  <p className="text-xs text-gray-400 truncate">
                    {log.passenger_name && <>동승 {log.passenger_name}</>}
                    {log.passenger_name && points.length > 0 && ' · '}
                    {points.length > 0 && <>궤적 {points.length}점</>}
                  </p>
                )}
              </div>
              {log.pilot_role === 'solo' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded shrink-0">
                  단독
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {logs.filter((l) => !l.is_draft).length > 40 && (
        <p className="mt-2 text-[11px] text-gray-400">최근 40건만 표시합니다.</p>
      )}
    </div>
  )
}

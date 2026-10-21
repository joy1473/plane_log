import { useMemo, useState } from 'react'
import { collectVisited } from '../lib/visited'
import type { AirfieldOption } from '../lib/user-airfields'
import type { FlightLog } from '../types/flight-log'

interface Props {
  logs: FlightLog[]
  options: AirfieldOption[]
}

/**
 * 다녀온 이착륙장 모음. 따로 기록할 것이 없다 —
 * 비행기록의 출발지와 도착지가 그대로 방문 기록이다.
 */
export default function VisitedAirfields({ logs, options }: Props) {
  const [expanded, setExpanded] = useState(false)
  const visited = useMemo(() => collectVisited(logs, options), [logs, options])

  if (visited.length === 0) return null

  const shown = expanded ? visited : visited.slice(0, 8)
  const unknownCount = visited.filter((v) => !v.known).length

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-semibold">
          다녀온 이착륙장
          <span className="ml-2 text-sm font-normal text-blue-700">{visited.length}곳</span>
        </h2>
        {visited.length > 8 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-blue-700 hover:text-blue-900 underline"
          >
            {expanded ? '접기' : `전체 ${visited.length}곳 보기`}
          </button>
        )}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {shown.map((v) => (
          <li
            key={v.name}
            className="flex items-center justify-between gap-2 border border-gray-200 rounded px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm truncate">
                {v.name}
                {v.custom && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded align-middle">
                    사설
                  </span>
                )}
                {!v.known && (
                  <span
                    className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded align-middle"
                    title="좌표가 없어 지도와 거리 계산에서 빠집니다"
                  >
                    좌표 없음
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400">
                {v.firstVisit === v.lastVisit ? v.firstVisit : `${v.firstVisit} ~ ${v.lastVisit}`}
              </p>
            </div>
            <span className="text-sm font-semibold text-blue-700 tabular-nums shrink-0">
              {v.visits}
            </span>
          </li>
        ))}
      </ul>

      {unknownCount > 0 && (
        <p className="mt-3 text-xs text-amber-700">
          좌표가 없는 곳이 {unknownCount}곳 있습니다. 기록을 열어 이착륙장을 다시
          고르면서 좌표를 등록하면 지도와 야외비행 거리 계산에 반영됩니다.
        </p>
      )}
    </div>
  )
}

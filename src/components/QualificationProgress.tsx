import { useState, useMemo } from 'react'
import { calculateProgress, formatMinutes } from '../lib/qualification'
import { categoryIndex } from '../lib/aircraft'
import { AIRCRAFT_CATEGORIES, type Aircraft, type AircraftCategory, type FlightLog } from '../types/flight-log'

interface Props {
  logs: FlightLog[]
  aircraft: Aircraft[]
}

/**
 * 자격 요건 달성률. 요건이 기종별로 다르므로 어느 자격을 향해 가는지
 * 고르게 한다. 등록된 기체가 있으면 그 기종을 기본값으로 쓴다.
 */
export default function QualificationProgress({ logs, aircraft }: Props) {
  const [category, setCategory] = useState<AircraftCategory>(
    () => aircraft[0]?.category ?? '타면조종형비행기'
  )

  const progress = useMemo(
    () => calculateProgress(logs, category, categoryIndex(aircraft)),
    [logs, category, aircraft]
  )

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold">자격 요건 진행률</h2>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as AircraftCategory)}
          className="border rounded px-2 py-1 text-xs"
          aria-label="기종 선택"
        >
          {AIRCRAFT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {aircraft.length === 0 ? (
        <p className="text-sm text-gray-500">
          기체를 먼저 등록하세요. 기록에 기체를 지정해야 기종별 요건을 집계할 수 있습니다.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {progress.items.map((item) => {
              const pct = item.target > 0 ? Math.min(100, (item.current / item.target) * 100) : 0
              const currentText = item.unit === 'minutes'
                ? formatMinutes(item.current)
                : `${item.current}회`
              const targetText = item.unit === 'minutes'
                ? formatMinutes(item.target)
                : `${item.target}회`
              return (
                <div key={item.label}>
                  <div className="flex items-baseline justify-between text-sm mb-1">
                    <span className={item.met ? 'text-green-700 font-medium' : 'text-gray-700'}>
                      {item.met && '✓ '}{item.label}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {currentText} / {targetText}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${item.met ? 'bg-green-600' : 'bg-blue-600'}`}
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={item.label}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {progress.allMet && (
            <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {category} 응시경력 요건을 모두 채웠습니다. 제출 전에 원문 요건을 다시 확인하세요.
            </p>
          )}

          {progress.unassigned > 0 && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              기체를 지정하지 않은 기록 {progress.unassigned}건은 집계에서 빠져 있습니다.
              기록을 열어 기체를 지정하면 반영됩니다.
            </p>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        요건 수치는 항공안전법 시행규칙 [별표 4] 를 인용한 2차 자료 기준이며 원문을
        직접 확인하지 않았습니다. 전문교육기관 이수자는 요건이 다릅니다.
        제출 전 현행 원문으로 반드시 확인하세요.
      </p>
    </div>
  )
}

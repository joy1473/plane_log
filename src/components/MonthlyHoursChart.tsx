import { useMemo, useState } from 'react'
import { bucketByMonth, toHours as hours, type MonthBucket } from '../lib/monthly'
import type { FlightLog } from '../types/flight-log'

interface Props {
  logs: FlightLog[]
}

/**
 * 월별 비행시간 추이.
 *
 * 단독과 동승을 쌓아 보여주는 이유: 총량만으로는 훈련이 어디까지 왔는지
 * 알 수 없고, 단독 5시간이 자격 요건이라 그 비중이 곧 진도다.
 *
 * 색은 dataviz 검증기를 통과한 두 값이다 (CVD ΔE 24.7 / 일반 33.6 / 대비 3:1↑).
 * 이 앱은 라이트 모드 전용이라 다크 스텝은 두지 않았다.
 */
const DUAL = '#2a78d6'
const SOLO = '#eb6834'

export default function MonthlyHoursChart({ logs }: Props) {
  const [asTable, setAsTable] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const buckets = useMemo(() => bucketByMonth(logs), [logs])
  const maxMin = useMemo(() => Math.max(60, ...buckets.map((b) => b.totalMin)), [buckets])
  const peakKey = useMemo(() => {
    let best: MonthBucket | null = null
    for (const b of buckets) if (!best || b.totalMin > best.totalMin) best = b
    return best?.totalMin ? best.key : null
  }, [buckets])

  if (buckets.length === 0) return null

  // 마지막 24개월만. 그 이상은 막대가 너무 얇아진다.
  const shown = buckets.slice(-24)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxMin * f))

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-semibold">월별 비행시간</h2>
        <button
          onClick={() => setAsTable((v) => !v)}
          className="text-xs text-blue-700 hover:text-blue-900 underline"
        >
          {asTable ? '그래프로 보기' : '표로 보기'}
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: DUAL }} aria-hidden="true" />
          동승
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: SOLO }} aria-hidden="true" />
          단독
        </span>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left py-1 pr-4">월</th>
                <th className="text-right py-1 pr-4">동승</th>
                <th className="text-right py-1 pr-4">단독</th>
                <th className="text-right py-1">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((b) => (
                <tr key={b.key}>
                  <td className="py-1 pr-4">{b.key}</td>
                  <td className="py-1 pr-4 text-right tabular-nums">{hours(b.dualMin)}h</td>
                  <td className="py-1 pr-4 text-right tabular-nums">{hours(b.soloMin)}h</td>
                  <td className="py-1 text-right tabular-nums font-medium">{hours(b.totalMin)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* 눈금 */}
          <div className="absolute inset-0 bottom-6 pointer-events-none">
            {ticks.map((t, i) => (
              <div
                key={t + '-' + i}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ bottom: `${(t / maxMin) * 100}%` }}
              >
                <span className="absolute -top-2 -left-0 text-[10px] text-gray-400 bg-white pr-1 tabular-nums">
                  {hours(t)}h
                </span>
              </div>
            ))}
          </div>

          <div className="relative flex items-end gap-[3px] h-44 pl-8">
            {shown.map((b) => {
              const dualPct = (b.dualMin / maxMin) * 100
              const soloPct = (b.soloMin / maxMin) * 100
              const isPeak = b.key === peakKey
              return (
                <div
                  key={b.key}
                  className="relative flex-1 h-full flex flex-col justify-end min-w-[6px]"
                  onMouseEnter={() => setHovered(b.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(b.key)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${b.key} 동승 ${hours(b.dualMin)}시간, 단독 ${hours(b.soloMin)}시간`}
                >
                  {isPeak && b.totalMin > 0 && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 tabular-nums whitespace-nowrap">
                      {hours(b.totalMin)}h
                    </span>
                  )}
                  {b.soloMin > 0 && (
                    <div
                      style={{
                        height: `${soloPct}%`, background: SOLO,
                        borderTopLeftRadius: 4, borderTopRightRadius: 4,
                        marginBottom: b.dualMin > 0 ? 2 : 0,
                      }}
                    />
                  )}
                  {b.dualMin > 0 && (
                    <div
                      style={{
                        height: `${dualPct}%`, background: DUAL,
                        borderTopLeftRadius: b.soloMin > 0 ? 0 : 4,
                        borderTopRightRadius: b.soloMin > 0 ? 0 : 4,
                      }}
                    />
                  )}

                  {hovered === b.key && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 whitespace-nowrap rounded bg-gray-900 text-white text-[11px] px-2 py-1 shadow-lg">
                      <div className="font-medium mb-0.5">{b.key}</div>
                      <div className="tabular-nums">동승 {hours(b.dualMin)}h</div>
                      <div className="tabular-nums">단독 {hours(b.soloMin)}h</div>
                      <div className="tabular-nums border-t border-gray-700 mt-0.5 pt-0.5">
                        합계 {hours(b.totalMin)}h
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-[3px] pl-8 mt-1">
            {shown.map((b, i) => (
              <div key={b.key} className="flex-1 min-w-[6px] text-center">
                {(shown.length <= 12 || i % 2 === 0) && (
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{b.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {buckets.length > 24 && (
        <p className="mt-2 text-[11px] text-gray-400">
          최근 24개월만 표시합니다. 전체는 「표로 보기」에서도 같은 범위입니다.
        </p>
      )}
    </div>
  )
}

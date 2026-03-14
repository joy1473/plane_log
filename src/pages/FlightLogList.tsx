import { useState, useEffect, lazy, Suspense } from 'react'
import { fetchFlightLogs, calculateTotalHours } from '../lib/supabase-flight-log'
import { getCachedFlightLogs, cacheFlightLogs } from '../lib/offline-store'
import type { FlightLog } from '../types/flight-log'

const FlightMap = lazy(() => import('../components/FlightMap'))

export default function FlightLogList() {
  const [logs, setLogs] = useState<(FlightLog & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadLogs() {
    setLoading(true)
    setError('')

    try {
      if (navigator.onLine) {
        const data = await fetchFlightLogs()
        const withId = data.filter((d): d is FlightLog & { id: string } => !!d.id)
        setLogs(withId)
        await cacheFlightLogs(withId)
      } else {
        const cached = await getCachedFlightLogs()
        setLogs(cached.reverse())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패')
      const cached = await getCachedFlightLogs()
      if (cached.length > 0) {
        setLogs(cached.reverse())
        setError('오프라인 캐시에서 로드됨')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const stats = calculateTotalHours(logs)

  if (loading) {
    return <div className="text-center py-8 text-gray-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      {/* 누적 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="총 비행 시간" value={stats.totalHours} />
        <StatCard label="총 비행 횟수" value={`${stats.totalFlights}회`} />
        <StatCard label="총 착륙 횟수" value={`${stats.totalLandings}회`} />
        <StatCard label="총 비행 시간(분)" value={`${stats.totalMinutes}분`} />
      </div>

      {error && <p className="text-sm text-orange-600">{error}</p>}

      {/* 이착륙장 지도 */}
      {logs.length > 0 && (
        <Suspense fallback={<div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">지도 로딩 중...</div>}>
          <FlightMap logs={logs} />
        </Suspense>
      )}

      {/* 비행 기록 리스트 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">비행 기록</h2>
          <span className="text-xs text-gray-500">{logs.length}건</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-center py-8 text-gray-400">비행 기록이 없습니다. CSV 파일을 업로드하세요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">날짜</th>
                  <th className="px-3 py-2 text-left">이착륙장</th>
                  <th className="px-3 py-2 text-right">시간(분)</th>
                  <th className="px-3 py-2 text-left">교관</th>
                  <th className="px-3 py-2 text-left">훈련 목적</th>
                  <th className="px-3 py-2 text-right">착륙</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{log.flight_date}</td>
                    <td className="px-3 py-2">{log.airfield}</td>
                    <td className="px-3 py-2 text-right">{log.flight_duration_min}</td>
                    <td className="px-3 py-2">{log.instructor_name ?? '-'}</td>
                    <td className="px-3 py-2">{log.training_purpose ?? '-'}</td>
                    <td className="px-3 py-2 text-right">{log.landing_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-blue-700 mt-1">{value}</p>
    </div>
  )
}

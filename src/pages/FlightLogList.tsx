import { useState, useEffect, useMemo, lazy, Suspense, Component, type ReactNode } from 'react'
import { fetchFlightLogs, deleteFlightLog, calculateTotalHours } from '../lib/supabase-flight-log'
import { getCachedFlightLogs, cacheFlightLogs } from '../lib/offline-store'
import { exportFlightLogsPdf } from '../lib/pdf-export'
import type { FlightLog } from '../types/flight-log'

const FlightMap = lazy(() => import('../components/FlightMap'))

type FilterMode = 'all' | 'year' | 'month' | 'week' | 'custom'

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function FlightLogList() {
  const [allLogs, setAllLogs] = useState<(FlightLog & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 검색 필터 상태
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterWeekStart, setFilterWeekStart] = useState(formatDate(getMonday(new Date())))
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  async function loadLogs() {
    setLoading(true)
    setError('')

    try {
      if (navigator.onLine) {
        const data = await fetchFlightLogs()
        const withId = data.filter((d): d is FlightLog & { id: string } => !!d.id)
        setAllLogs(withId)
        await cacheFlightLogs(withId)
      } else {
        const cached = await getCachedFlightLogs()
        setAllLogs(cached.reverse())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패')
      const cached = await getCachedFlightLogs()
      if (cached.length > 0) {
        setAllLogs(cached.reverse())
        setError('오프라인 캐시에서 로드됨')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  // 필터링된 로그
  const { logs, dateLabel } = useMemo(() => {
    let filtered = allLogs
    let label = '전체'

    switch (filterMode) {
      case 'year': {
        filtered = allLogs.filter((l) => l.flight_date.startsWith(String(filterYear)))
        label = `${filterYear}년`
        break
      }
      case 'month': {
        const prefix = `${filterYear}-${String(filterMonth).padStart(2, '0')}`
        filtered = allLogs.filter((l) => l.flight_date.startsWith(prefix))
        label = `${filterYear}년 ${filterMonth}월`
        break
      }
      case 'week': {
        const start = new Date(filterWeekStart)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        const startStr = formatDate(start)
        const endStr = formatDate(end)
        filtered = allLogs.filter((l) => l.flight_date >= startStr && l.flight_date <= endStr)
        label = `${startStr} ~ ${endStr}`
        break
      }
      case 'custom': {
        if (customFrom && customTo) {
          filtered = allLogs.filter((l) => l.flight_date >= customFrom && l.flight_date <= customTo)
          label = `${customFrom} ~ ${customTo}`
        } else if (customFrom) {
          filtered = allLogs.filter((l) => l.flight_date >= customFrom)
          label = `${customFrom} ~`
        } else if (customTo) {
          filtered = allLogs.filter((l) => l.flight_date <= customTo)
          label = `~ ${customTo}`
        }
        break
      }
    }

    return { logs: filtered, dateLabel: label }
  }, [allLogs, filterMode, filterYear, filterMonth, filterWeekStart, customFrom, customTo])

  async function handleDelete(id: string, date: string) {
    if (!confirm(`${date} 비행 기록을 삭제하시겠습니까?`)) return
    setDeleting(id)
    try {
      await deleteFlightLog(id)
      setAllLogs((prev) => prev.filter((l) => l.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    } finally {
      setDeleting(null)
    }
  }

  function handleExportPdf() {
    if (logs.length === 0) return
    exportFlightLogsPdf(logs, dateLabel)
  }

  const stats = calculateTotalHours(logs)

  // 연도 목록 (데이터에서 추출)
  const availableYears = useMemo(() => {
    const years = new Set(allLogs.map((l) => parseInt(l.flight_date.slice(0, 4))))
    if (years.size === 0) years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [allLogs])

  if (loading) {
    return <div className="text-center py-8 text-gray-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      {/* 검색 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">기간 검색:</span>
          {(['all', 'year', 'month', 'week', 'custom'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterMode === mode
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {{ all: '전체', year: '년', month: '월', week: '주', custom: '기간' }[mode]}
            </button>
          ))}
        </div>

        {filterMode === 'year' && (
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        )}

        {filterMode === 'month' && (
          <div className="flex gap-2">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="border rounded px-3 py-1.5 text-sm"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="border rounded px-3 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        )}

        {filterMode === 'week' && (
          <input
            type="date"
            value={filterWeekStart}
            onChange={(e) => {
              const d = new Date(e.target.value)
              setFilterWeekStart(formatDate(getMonday(d)))
            }}
            className="border rounded px-3 py-1.5 text-sm"
          />
        )}

        {filterMode === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            />
          </div>
        )}

        {filterMode !== 'all' && (
          <p className="text-xs text-gray-500 mt-2">
            검색 결과: {logs.length}건 ({dateLabel})
          </p>
        )}
      </div>

      {/* 누적 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={filterMode === 'all' ? '총 비행 시간' : '기간 비행 시간'} value={stats.totalHours} />
        <StatCard label={filterMode === 'all' ? '총 비행 횟수' : '기간 비행 횟수'} value={`${stats.totalFlights}회`} />
        <StatCard label={filterMode === 'all' ? '총 착륙 횟수' : '기간 착륙 횟수'} value={`${stats.totalLandings}회`} />
        <StatCard label={filterMode === 'all' ? '총 비행 시간(분)' : '기간 비행 시간(분)'} value={`${stats.totalMinutes}분`} />
      </div>

      {error && <p className="text-sm text-orange-600">{error}</p>}

      {/* 이착륙장 지도 */}
      {logs.length > 0 && (
        <MapErrorBoundary>
          <Suspense fallback={<div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">지도 로딩 중...</div>}>
            <FlightMap logs={logs} />
          </Suspense>
        </MapErrorBoundary>
      )}

      {/* 비행 기록 리스트 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">비행 기록</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{logs.length}건</span>
            {logs.length > 0 && (
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9,15 12,18 15,15" />
                </svg>
                PDF 저장
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-center py-8 text-gray-400">
            {filterMode === 'all' ? '비행 기록이 없습니다. CSV 파일을 업로드하세요.' : '해당 기간의 비행 기록이 없습니다.'}
          </p>
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
                  <th className="px-3 py-2 w-10"></th>
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
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDelete(log.id, log.flight_date)}
                        disabled={deleting === log.id}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xs"
                        title="삭제"
                      >
                        {deleting === log.id ? '...' : '✕'}
                      </button>
                    </td>
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

class MapErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="bg-white rounded-lg shadow p-6 text-center text-red-400 text-sm">
          지도 로드 실패: {this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-blue-700 mt-1">{value}</p>
    </div>
  )
}

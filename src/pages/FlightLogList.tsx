import { useState, useEffect, useMemo, useCallback, lazy, Suspense, Component, type ReactNode } from 'react'
import { fetchFlightLogs, deleteFlightLog, calculateTotalHours } from '../lib/supabase-flight-log'
import { getCachedFlightLogs, cacheFlightLogs } from '../lib/offline-store'
import { fetchUserAirfields, mergeAirfieldOptions, type AirfieldOption } from '../lib/user-airfields'
import { getLogMode, setLogMode } from '../lib/log-mode'
import { exportFlightLogsPdf } from '../lib/pdf-export'
import FlightLogForm from '../components/FlightLogForm'
import type { FlightLog, LogMode } from '../types/flight-log'

const FlightMap = lazy(() => import('../components/FlightMap'))

type FilterMode = 'all' | 'year' | 'month' | 'custom'
type SortKey = 'flight_date' | 'departure_airfield' | 'flight_duration_min' | 'instructor_name' | 'training_purpose' | 'landing_count'
type SortDir = 'asc' | 'desc'

type Row = FlightLog & { id: string }

export default function FlightLogList() {
  const [allLogs, setAllLogs] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 입력 / 수정
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Row | null>(null)
  const [airfieldOptions, setAirfieldOptions] = useState<AirfieldOption[]>([])
  const [mode, setMode] = useState<LogMode>(getLogMode)

  // 검색 필터 상태
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('flight_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const loadAirfields = useCallback(async function loadAirfields() {
    try {
      const custom = await fetchUserAirfields()
      setAirfieldOptions(mergeAirfieldOptions(custom))
    } catch {
      // 사설 이착륙장을 못 불러와도 내장 목록만으로 입력은 가능해야 한다
      setAirfieldOptions(mergeAirfieldOptions([]))
    }
  }, [])

  const loadLogs = useCallback(async function loadLogs() {
    setLoading(true)
    setError('')

    try {
      if (navigator.onLine) {
        const data = await fetchFlightLogs()
        const withId = data.filter((d): d is Row => !!d.id)
        setAllLogs(withId)
        await cacheFlightLogs(withId)
      } else {
        const cached = await getCachedFlightLogs()
        setAllLogs([...cached].reverse())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패')
      const cached = await getCachedFlightLogs()
      if (cached.length > 0) {
        setAllLogs([...cached].reverse())
        setError('오프라인 캐시에서 로드됨')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
    loadAirfields()
  }, [loadLogs, loadAirfields])

  function changeMode(next: LogMode) {
    setMode(next)
    setLogMode(next)
  }

  function openNew() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(log: Row) {
    setEditTarget(log)
    setFormOpen(true)
  }

  function handleSaved() {
    setFormOpen(false)
    setEditTarget(null)
    loadLogs()
  }

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
  }, [allLogs, filterMode, filterYear, filterMonth, customFrom, customTo])

  // 정렬
  const sortedLogs = useMemo(() => {
    const sorted = [...logs]
    sorted.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (sortKey) {
        case 'flight_date': va = a.flight_date; vb = b.flight_date; break
        case 'departure_airfield': va = a.departure_airfield; vb = b.departure_airfield; break
        case 'flight_duration_min': va = a.flight_duration_min; vb = b.flight_duration_min; break
        case 'instructor_name': va = a.instructor_name ?? ''; vb = b.instructor_name ?? ''; break
        case 'training_purpose': va = a.training_purpose ?? ''; vb = b.training_purpose ?? ''; break
        case 'landing_count': va = a.landing_count ?? 0; vb = b.landing_count ?? 0; break
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [logs, sortKey, sortDir])

  /** 임시저장은 미확정 기록이라 제출용 출력에서 뺀다 */
  const confirmedLogs = useMemo(() => sortedLogs.filter((l) => !l.is_draft), [sortedLogs])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

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
    if (confirmedLogs.length === 0) return
    exportFlightLogsPdf(confirmedLogs, dateLabel)
  }

  function sanitizeCsvValue(v: string): string {
    // Prefix values starting with formula-injection characters to prevent Excel/Sheets execution
    if (v.length > 0 && ['=', '+', '-', '@', '\t', '\r'].includes(v[0])) {
      return '\t' + v
    }
    return v
  }

  function handleExportCsv() {
    if (confirmedLogs.length === 0) return
    const headers = ['날짜', '출발시간', '도착시간', '비행시간(분)', '출발', '도착', '교관', '훈련목적', '착륙횟수', '비행고도', '교육기관', '비고']
    const rows = confirmedLogs.map((l) => [
      l.flight_date,
      l.departure_time ?? '',
      l.arrival_time ?? '',
      String(l.flight_duration_min),
      l.departure_airfield,
      l.arrival_airfield,
      l.instructor_name ?? '',
      l.training_purpose ?? '',
      String(l.landing_count ?? 1),
      l.flight_altitude_ft ? String(l.flight_altitude_ft) : '',
      l.training_institution ?? '',
      l.remarks ?? '',
    ])
    const bom = '\uFEFF'
    const csv = bom + [headers, ...rows].map((r) => r.map((v) => `"${sanitizeCsvValue(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flight-log-${dateLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
      {/* 기록 추가 · 모드 전환 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition-colors shadow"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          비행 기록 추가
        </button>

        <div className="flex items-center gap-1 bg-white rounded-lg shadow p-1" role="group" aria-label="입력 모드">
          {(['training', 'logbook'] as LogMode[]).map((m) => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                mode === m ? 'bg-blue-700 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
              title={m === 'training' ? '교관·훈련목적·교육기관을 함께 기록합니다' : '날짜·구간·시간만 기록합니다'}
            >
              {m === 'training' ? '훈련 모드' : '일지 모드'}
            </button>
          ))}
        </div>
      </div>

      {formOpen && (
        <FlightLogForm
          initial={editTarget}
          mode={mode}
          options={airfieldOptions}
          onAirfieldAdded={loadAirfields}
          onSaved={handleSaved}
          onCancel={() => { setFormOpen(false); setEditTarget(null) }}
        />
      )}

      {/* 검색 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">기간 검색:</span>
          {(['all', 'year', 'month', 'custom'] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterMode === m
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {{ all: '전체', year: '년', month: '월', custom: '기간' }[m]}
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

      {stats.draftCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          임시저장 {stats.draftCount}건은 통계와 PDF·CSV 출력에서 빠져 있습니다. 확정하려면 기록을 열어 저장하세요.
        </p>
      )}

      {error && <p className="text-sm text-orange-600">{error}</p>}

      {/* 비행 기록 리스트 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">비행 기록</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{logs.length}건</span>
            {confirmedLogs.length > 0 && (
              <>
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
                  PDF
                </button>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9,15 12,18 15,15" />
                  </svg>
                  CSV
                </button>
              </>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-center py-8 text-gray-400">
            {filterMode === 'all'
              ? '비행 기록이 없습니다. 위의 「비행 기록 추가」를 누르거나 CSV 파일을 업로드하세요.'
              : '해당 기간의 비행 기록이 없습니다.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <SortTh label="날짜" sortKey="flight_date" align="left" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="구간" sortKey="departure_airfield" align="left" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="시간(분)" sortKey="flight_duration_min" align="right" current={sortKey} dir={sortDir} onSort={handleSort} />
                  {mode === 'training' && (
                    <>
                      <SortTh label="교관" sortKey="instructor_name" align="left" current={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortTh label="훈련 목적" sortKey="training_purpose" align="left" current={sortKey} dir={sortDir} onSort={handleSort} />
                    </>
                  )}
                  <SortTh label="착륙" sortKey="landing_count" align="right" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLogs.map((log) => {
                  const from = log.departure_airfield
                  const to = log.arrival_airfield
                  return (
                    <tr key={log.id} className={`hover:bg-gray-50 ${log.is_draft ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {log.flight_date}
                        {log.is_draft && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded align-middle">
                            임시
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {from === to ? from : <span>{from} <span className="text-gray-400">→</span> {to}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{log.flight_duration_min}</td>
                      {mode === 'training' && (
                        <>
                          <td className="px-3 py-2">{log.instructor_name ?? '-'}</td>
                          <td className="px-3 py-2">{log.training_purpose ?? '-'}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-right">{log.landing_count}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          onClick={() => openEdit(log)}
                          className="text-blue-500 hover:text-blue-700 text-xs mr-2"
                          title="수정"
                          aria-label={`${log.flight_date} 기록 수정`}
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(log.id, log.flight_date)}
                          disabled={deleting === log.id}
                          className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xs"
                          title="삭제"
                          aria-label={`${log.flight_date} 기록 삭제`}
                        >
                          {deleting === log.id ? '...' : '✕'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 이착륙장 지도 */}
      {logs.length > 0 && (
        <MapErrorBoundary>
          <Suspense fallback={<div className="bg-white rounded-lg shadow p-6 text-center text-gray-400">지도 로딩 중...</div>}>
            <FlightMap logs={logs} />
          </Suspense>
        </MapErrorBoundary>
      )}
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

function SortTh({ label, sortKey: key, align, current, dir, onSort }: {
  label: string; sortKey: SortKey; align: 'left' | 'right'
  current: SortKey; dir: SortDir; onSort: (k: SortKey) => void
}) {
  const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
  const active = current === key
  const ariaSortValue = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th
      className={`px-3 py-2 ${alignClass[align]} cursor-pointer select-none hover:bg-gray-100 transition-colors`}
      onClick={() => onSort(key)}
      role="button"
      tabIndex={0}
      aria-sort={ariaSortValue}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(key) } }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] ${active ? 'text-blue-700' : 'text-gray-300'}`}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '▼'}
        </span>
      </span>
    </th>
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

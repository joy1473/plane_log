import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchMaintenanceItems, createMaintenanceItem, deleteMaintenanceItem,
  markMaintenanceDone, aircraftHours, maintenanceStatus,
} from '../lib/maintenance'
import type { Aircraft, FlightLog, MaintenanceItem } from '../types/flight-log'

interface Props {
  aircraft: Aircraft[]
  logs: FlightLog[]
}

const LEVEL_STYLE = {
  overdue: 'bg-red-50 border-red-300 text-red-800',
  due: 'bg-orange-50 border-orange-300 text-orange-800',
  soon: 'bg-amber-50 border-amber-300 text-amber-800',
  ok: 'bg-white border-gray-200 text-gray-700',
  unknown: 'bg-gray-50 border-gray-200 text-gray-500',
} as const

function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 기체 현황. 누적시간은 비행기록에서 저절로 나오므로 따로 입력받지 않는다.
 * 정비 주기는 그 누적시간 위에서 계산된다.
 */
export default function AircraftBoard({ aircraft, logs }: Props) {
  const [items, setItems] = useState<MaintenanceItem[]>([])
  const [error, setError] = useState('')
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [interval, setInterval] = useState('')
  const [lastDone, setLastDone] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async function load() {
    try {
      setItems(await fetchMaintenanceItems())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '정비 항목 불러오기 실패')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const hoursById = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of aircraft) m.set(a.id, aircraftHours(logs, a))
    return m
  }, [aircraft, logs])

  async function handleAdd(aircraftId: string) {
    if (!name.trim()) { setError('정비 항목 이름을 입력하세요'); return }
    const iv = Number(interval)
    if (!iv || iv <= 0) { setError('주기를 시간 단위로 입력하세요'); return }

    setSaving(true)
    try {
      await createMaintenanceItem({
        aircraft_id: aircraftId,
        name,
        interval_hours: iv,
        last_done_hours: lastDone ? Number(lastDone) : null,
        last_done_on: lastDone ? todayIso() : null,
      })
      setAddingFor(null)
      setName(''); setInterval(''); setLastDone('')
      setError('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  async function handleDone(item: MaintenanceItem, currentHours: number) {
    if (!confirm(`「${item.name}」을 지금 수행한 것으로 기록할까요? (기체시간 ${currentHours}h)`)) return
    try {
      await markMaintenanceDone(item.id, currentHours, todayIso())
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록 실패')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 정비 항목을 삭제하시겠습니까?')) return
    try {
      await deleteMaintenanceItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  if (aircraft.length === 0) return null

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="font-semibold mb-3">기체 현황</h2>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="space-y-4">
        {aircraft.map((a) => {
          const hours = hoursById.get(a.id) ?? 0
          const mine = items.filter((i) => i.aircraft_id === a.id)
          return (
            <div key={a.id} className="border border-gray-200 rounded p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <div>
                  <span className="font-medium">{a.registration}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {a.category}{a.model ? ` · ${a.model}` : ''}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500 text-xs mr-1">누적</span>
                  <span className="font-semibold tabular-nums">{hours}h</span>
                  {a.initial_hours > 0 && (
                    <span className="text-xs text-gray-400 ml-1">
                      (기존 {a.initial_hours}h 포함)
                    </span>
                  )}
                </div>
              </div>

              {mine.length > 0 && (
                <ul className="space-y-1.5 mb-2">
                  {mine.map((item) => {
                    const st = maintenanceStatus(item, hours)
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center justify-between gap-2 border rounded px-2.5 py-1.5 text-xs ${LEVEL_STYLE[st.level]}`}
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{item.name}</span>
                          <span className="opacity-70"> · {item.interval_hours}h 주기</span>
                          <span className="block opacity-80">
                            {st.level === 'unknown'
                              ? '마지막 수행 시점을 적으면 남은 시간을 계산합니다'
                              : st.remainingHours! < 0
                                ? `${-st.remainingHours!}h 초과 — ${st.dueAtHours}h 에 예정되어 있었습니다`
                                : `${st.remainingHours}h 남음 — ${st.dueAtHours}h 에 예정`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDone(item, hours)}
                            className="underline opacity-70 hover:opacity-100"
                          >
                            수행
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="opacity-50 hover:opacity-100"
                            aria-label="삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {addingFor === a.id ? (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="항목 (예: 오일 교환)"
                      className="border rounded px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number" step="0.1" min="0.1" inputMode="decimal"
                      value={interval} onChange={(e) => setInterval(e.target.value)}
                      placeholder="주기 (시간)"
                      className="border rounded px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number" step="0.1" min="0" inputMode="decimal"
                      value={lastDone} onChange={(e) => setLastDone(e.target.value)}
                      placeholder={`마지막 수행 시 기체시간 (현재 ${hours}h)`}
                      className="border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAdd(a.id)} disabled={saving}
                      className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {saving ? '등록 중...' : '등록'}
                    </button>
                    <button
                      onClick={() => { setAddingFor(null); setError('') }}
                      className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingFor(a.id); setName(''); setInterval(''); setLastDone('') }}
                  className="text-xs text-blue-700 hover:text-blue-900 underline"
                >
                  + 정비 주기 추가
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        누적시간은 비행기록 합계에 기체 등록 시 입력한 기존 시간을 더한 값입니다.
        임시저장 기록은 빠집니다.
      </p>
    </div>
  )
}

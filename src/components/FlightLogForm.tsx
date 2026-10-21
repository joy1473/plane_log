import { useState, useEffect, useMemo } from 'react'
import AirfieldSelect from './AirfieldSelect'
import TrainingInstitutionSelect from './TrainingInstitutionSelect'
import { createFlightLog, updateFlightLog } from '../lib/supabase-flight-log'
import { distanceKm, type AirfieldOption } from '../lib/user-airfields'
import { setLastEntry, getLastEntry } from '../lib/log-mode'
import type { FlightLog, LogMode } from '../types/flight-log'

interface Props {
  /** 수정할 기록. 없으면 신규 입력 */
  initial?: (FlightLog & { id: string }) | null
  mode: LogMode
  options: AirfieldOption[]
  onAirfieldAdded: () => void
  onSaved: () => void
  onCancel: () => void
}

function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "HH:MM" 두 개로 비행시간(분)을 구한다. 자정을 넘기면 24시간을 더한다 */
function minutesBetween(from: string, to: string): number | null {
  const parse = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t)
    if (!m) return null
    const h = Number(m[1]); const min = Number(m[2])
    if (h > 23 || min > 59) return null
    return h * 60 + min
  }
  const a = parse(from); const b = parse(to)
  if (a === null || b === null) return null
  return b >= a ? b - a : b + 24 * 60 - a
}

export default function FlightLogForm({
  initial, mode, options, onAirfieldAdded, onSaved, onCancel,
}: Props) {
  const editing = !!initial
  const last = useMemo(() => (editing ? {} : getLastEntry()), [editing])

  const [flightDate, setFlightDate] = useState(initial?.flight_date ?? todayIso())
  const [departureTime, setDepartureTime] = useState(initial?.departure_time ?? '')
  const [arrivalTime, setArrivalTime] = useState(initial?.arrival_time ?? '')
  const [duration, setDuration] = useState(
    initial ? String(initial.flight_duration_min) : ''
  )
  const [durationTouched, setDurationTouched] = useState(editing)
  const [departure, setDeparture] = useState(
    initial?.departure_airfield ?? initial?.airfield ?? last.departure_airfield ?? ''
  )
  const [arrival, setArrival] = useState(
    initial?.arrival_airfield ?? initial?.airfield ?? last.arrival_airfield ?? ''
  )
  const [landings, setLandings] = useState(String(initial?.landing_count ?? 1))
  const [altitude, setAltitude] = useState(
    initial?.flight_altitude_ft != null ? String(initial.flight_altitude_ft) : ''
  )
  const [instructor, setInstructor] = useState(
    initial?.instructor_name ?? last.instructor_name ?? ''
  )
  const [purpose, setPurpose] = useState(initial?.training_purpose ?? '')
  const [institution, setInstitution] = useState(
    initial?.training_institution ?? last.training_institution ?? ''
  )
  const [remarks, setRemarks] = useState(initial?.remarks ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 시간을 넣으면 비행시간을 채워준다. 사용자가 직접 고친 뒤에는 덮어쓰지 않는다.
  useEffect(() => {
    if (durationTouched) return
    const mins = minutesBetween(departureTime, arrivalTime)
    if (mins !== null) setDuration(String(mins))
  }, [departureTime, arrivalTime, durationTouched])

  const legDistance = useMemo(() => {
    const from = options.find((o) => o.name === departure.trim())
    const to = options.find((o) => o.name === arrival.trim())
    if (!from || !to || from.name === to.name) return null
    return distanceKm(from, to)
  }, [departure, arrival, options])

  function buildLog(isDraft: boolean): FlightLog {
    return {
      flight_date: flightDate,
      departure_time: departureTime || null,
      arrival_time: arrivalTime || null,
      flight_duration_min: Number(duration) || 0,
      airfield: departure.trim(),
      departure_airfield: departure.trim(),
      arrival_airfield: (arrival.trim() || departure.trim()),
      instructor_name: mode === 'training' ? (instructor.trim() || null) : null,
      training_purpose: mode === 'training' ? (purpose.trim() || null) : null,
      training_institution: mode === 'training' ? (institution.trim() || null) : null,
      landing_count: Number(landings) || 0,
      flight_altitude_ft: altitude ? Number(altitude) : null,
      remarks: remarks.trim() || null,
      is_draft: isDraft,
    }
  }

  async function save(isDraft: boolean) {
    setError('')

    if (!flightDate) { setError('날짜를 입력하세요'); return }
    if (!departure.trim()) { setError('출발 이착륙장을 입력하세요'); return }
    // 임시저장은 미완성이어도 받아준다. 확정 저장만 비행시간을 요구한다.
    if (!isDraft && (!duration || Number(duration) <= 0)) {
      setError('비행시간을 입력하세요')
      return
    }

    setSaving(true)
    try {
      const log = buildLog(isDraft)
      if (editing) {
        await updateFlightLog(initial.id, log)
      } else {
        await createFlightLog(log)
        setLastEntry({
          departure_airfield: log.departure_airfield ?? undefined,
          arrival_airfield: log.arrival_airfield ?? undefined,
          instructor_name: log.instructor_name ?? undefined,
          training_institution: log.training_institution ?? undefined,
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {editing ? '비행 기록 수정' : '비행 기록 추가'}
          {initial?.is_draft && (
            <span className="ml-2 text-xs font-normal px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
              임시저장
            </span>
          )}
        </h2>
        <button
          type="button" onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 text-sm"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            날짜<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="date" value={flightDate}
            onChange={(e) => setFlightDate(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">착륙 횟수</label>
          <input
            type="number" min="0" inputMode="numeric" value={landings}
            onChange={(e) => setLandings(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <AirfieldSelect
          label="출발" value={departure} onChange={setDeparture}
          options={options} onAirfieldAdded={onAirfieldAdded} required
        />

        <div>
          <AirfieldSelect
            label="도착" value={arrival} onChange={setArrival}
            options={options} onAirfieldAdded={onAirfieldAdded}
          />
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => setArrival(departure)}
              className="text-xs text-blue-700 hover:text-blue-900 underline"
            >
              출발지와 같음
            </button>
            {legDistance !== null && (
              <span className={`text-xs ${legDistance >= 120 ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                구간 {legDistance}km
                {legDistance >= 120 && ' · 야외비행 거리 충족'}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">출발 시간</label>
          <input
            type="time" value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">도착 시간</label>
          <input
            type="time" value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            비행시간 (분)<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="number" min="0" inputMode="numeric" value={duration}
            onChange={(e) => { setDuration(e.target.value); setDurationTouched(true) }}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          {!durationTouched && duration && (
            <p className="text-xs text-gray-400 mt-1">출발·도착 시간에서 자동 계산됨</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">비행 고도 (ft)</label>
          <input
            type="number" min="0" inputMode="numeric" value={altitude}
            onChange={(e) => setAltitude(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        {mode === 'training' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">교관</label>
              <input
                type="text" value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">훈련 목적</label>
              <input
                type="text" value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">전문교육기관</label>
              <TrainingInstitutionSelect value={institution} onChange={setInstitution} />
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">비고</label>
          <textarea
            rows={2} value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button" onClick={() => save(false)} disabled={saving}
          className="px-4 py-2 text-sm bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? '저장 중...' : editing ? '수정 저장' : '저장'}
        </button>
        <button
          type="button" onClick={() => save(true)} disabled={saving}
          className="px-4 py-2 text-sm border border-amber-400 text-amber-800 bg-amber-50 rounded hover:bg-amber-100 disabled:opacity-50"
          title="비행시간 없이도 저장됩니다. 통계에서는 빠집니다."
        >
          임시저장
        </button>
        <button
          type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          취소
        </button>
      </div>
    </div>
  )
}

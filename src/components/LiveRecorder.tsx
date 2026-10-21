import { useState, useEffect, useCallback, useRef } from 'react'
import {
  startRecording, getSession, getPoints, clearSession,
  type RecorderHandle, type LiveSession,
} from '../lib/live-track'
import { decimate, type TrackPoint } from '../lib/track-parser'
import { nearestAirfield, distanceKm, type AirfieldOption } from '../lib/user-airfields'
import { createFlightLog } from '../lib/supabase-flight-log'
import type { Aircraft, FlightLog } from '../types/flight-log'

interface Props {
  options: AirfieldOption[]
  aircraft: Aircraft[]
  onSaved: () => void
}

function isoDate(iso: string): string { return iso.slice(0, 10) }
function isoTime(iso: string): string { return iso.slice(11, 16) }

/**
 * 비행 중 궤적 기록.
 *
 * 비행 중에 들여다볼 이유를 만들면 그 순간 안전 문제가 된다. 그래서
 * 기록 중 화면은 "기록되고 있다"는 최소한만 보여주고, 경로와 지도는
 * 착륙 후에 보여준다.
 */
export default function LiveRecorder({ options, aircraft, onSaved }: Props) {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [recording, setRecording] = useState(false)
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)
  const handleRef = useRef<RecorderHandle | null>(null)

  const refresh = useCallback(async function refresh() {
    const s = await getSession()
    setSession(s)
    setCount((await getPoints()).length)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // 탭이 닫혀도 좌표는 IndexedDB 에 남아 있다. 정리만 해 둔다.
  useEffect(() => () => { handleRef.current?.stop() }, [])

  async function handleStart() {
    setError('')
    try {
      handleRef.current = await startRecording({
        onPoint: (n) => setCount(n),
        onError: (m) => setError(m),
      })
      setRecording(true)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '기록을 시작하지 못했습니다')
    }
  }

  async function handleStop() {
    await handleRef.current?.stop()
    handleRef.current = null
    setRecording(false)
    refresh()
  }

  async function handleDiscard() {
    if (!confirm('기록한 궤적을 버리시겠습니까? 되돌릴 수 없습니다.')) return
    await handleRef.current?.stop()
    handleRef.current = null
    setRecording(false)
    await clearSession()
    refresh()
  }

  /** 궤적을 임시저장 초안으로 만든다. 확정은 사람이 한다. */
  async function handleFinish() {
    const points: TrackPoint[] = await getPoints()
    if (points.length < 2) { setError('좌표가 너무 적습니다'); return }

    setFinishing(true)
    setError('')
    try {
      const first = points[0]
      const last = points[points.length - 1]
      const from = nearestAirfield(first.lat, first.lng, options)
      const to = nearestAirfield(last.lat, last.lng, options)

      let path = 0
      for (let i = 1; i < points.length; i++) {
        path += distanceKm(points[i - 1], points[i]) ?? 0
      }
      const straight = distanceKm(first, last) ?? 0

      const startIso = first.time ?? new Date().toISOString()
      const endIso = last.time ?? startIso
      const durationMin = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000))
      const departure = from?.name ?? ''
      const arrival = to?.name ?? departure
      const crossCountry = !!departure && !!arrival && departure !== arrival

      const log: FlightLog = {
        flight_date: isoDate(startIso),
        departure_time: isoTime(startIso),
        arrival_time: isoTime(endIso),
        flight_duration_min: durationMin,
        departure_airfield: departure || '확인 필요',
        arrival_airfield: arrival || '확인 필요',
        instructor_name: null,
        training_purpose: null,
        training_institution: null,
        landing_count: 0,
        flight_altitude_ft: null,
        remarks: `비행 중 기록 · 궤적 ${Math.round(path * 10) / 10}km · 좌표 ${points.length}점`
          + (from ? '' : ' · 출발 이착륙장 확인 필요')
          + (to ? '' : ' · 도착 이착륙장 확인 필요'),
        is_draft: true,
        aircraft_id: aircraft.length === 1 ? aircraft[0].id : null,
        pilot_role: 'dual',
        is_cross_country: crossCountry,
        leg_distance_km: crossCountry ? Math.round(straight * 10) / 10 : null,
        track_points: decimate(points),
      }

      await createFlightLog(log)
      await clearSession()
      refresh()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setFinishing(false)
    }
  }

  const hasData = count > 0

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="font-semibold mb-1">비행 중 기록</h2>
      <p className="text-xs text-gray-500 mb-3">
        거치대에 올리고 <strong>화면을 켜둔 채</strong>만 동작합니다. 다른 앱으로
        넘어가거나 화면이 잠기면 그 사이 좌표가 끊깁니다 — 브라우저에는
        백그라운드 위치추적이 없습니다.
      </p>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {recording ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-900">기록 중</p>
              <p className="text-xs text-red-700 tabular-nums">좌표 {count}점</p>
            </div>
          </div>
          <button
            onClick={handleStop}
            className="px-3 py-1.5 text-xs bg-red-700 text-white rounded hover:bg-red-600 shrink-0"
          >
            기록 멈춤
          </button>
        </div>
      ) : hasData ? (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-2">
          <p className="text-sm text-amber-900">
            기록해 둔 궤적이 있습니다 — 좌표 <strong className="tabular-nums">{count}</strong>점
            {session?.startedAt && <> · {isoDate(session.startedAt)} {isoTime(session.startedAt)} 시작</>}
          </p>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <strong>임시저장 초안으로 올라갑니다.</strong> 착륙 횟수와 고도는 채우지
            않습니다 — 궤적만으로는 터치앤고를 셀 수 없고, GPS 고도는 기압고도와
            다릅니다. 열어서 확인한 뒤 확정하세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleFinish} disabled={finishing}
              className="px-3 py-1.5 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {finishing ? '저장 중...' : '초안으로 저장'}
            </button>
            <button
              onClick={handleStart}
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
            >
              이어서 기록
            </button>
            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 text-xs text-red-600 hover:text-red-800"
            >
              버리기
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleStart}
          className="px-4 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-600"
        >
          기록 시작
        </button>
      )}
    </div>
  )
}

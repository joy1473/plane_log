import { useState, useRef } from 'react'
import { parseTrack, TrackParseError, type ParsedTrack } from '../lib/track-parser'
import { nearestAirfield, type AirfieldOption } from '../lib/user-airfields'
import { createFlightLog } from '../lib/supabase-flight-log'
import type { Aircraft, FlightLog } from '../types/flight-log'

interface Props {
  options: AirfieldOption[]
  aircraft: Aircraft[]
  onImported: () => void
}

interface Preview {
  track: ParsedTrack
  filename: string
  date: string
  departure: string
  arrival: string
  departureMatched: boolean
  arrivalMatched: boolean
}

function isoDate(iso: string | null): string {
  if (!iso) {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return iso.slice(0, 10)
}

function isoTime(iso: string | null): string | null {
  return iso ? iso.slice(11, 16) : null
}

/**
 * GPS 트랙 파일을 비행기록 초안으로 바꾼다.
 *
 * 확정 저장이 아니라 임시저장으로 올리는 이유: 비행기록은 제출용 법정
 * 기록이고, 기계가 추정한 값이 사람 확인 없이 들어가면 안 된다.
 * 이착륙 횟수처럼 궤적만으로 판단하기 어려운 값은 아예 채우지 않는다.
 */
export default function TrackImport({ options, aircraft, onImported }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [aircraftId, setAircraftId] = useState<string>('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    try {
      const text = await file.text()
      const track = parseTrack(text, file.name)

      const first = track.points[0]
      const last = track.points[track.points.length - 1]
      const from = nearestAirfield(first.lat, first.lng, options)
      const to = nearestAirfield(last.lat, last.lng, options)

      setPreview({
        track,
        filename: file.name,
        date: isoDate(track.startTime),
        departure: from?.name ?? '',
        arrival: to?.name ?? '',
        departureMatched: !!from,
        arrivalMatched: !!to,
      })
      if (aircraft.length === 1) setAircraftId(aircraft[0].id)
    } catch (err) {
      setPreview(null)
      setError(err instanceof TrackParseError ? err.message : '파일을 읽지 못했습니다')
    }
  }

  async function handleSave() {
    if (!preview) return
    if (!preview.departure.trim()) { setError('출발 이착륙장을 입력하세요'); return }

    setSaving(true)
    try {
      const { track } = preview
      const isCrossCountry =
        !!preview.arrival && preview.arrival !== preview.departure

      const log: FlightLog = {
        flight_date: preview.date,
        departure_time: isoTime(track.startTime),
        arrival_time: isoTime(track.endTime),
        flight_duration_min: track.durationMin ?? 0,
        departure_airfield: preview.departure.trim(),
        arrival_airfield: preview.arrival.trim() || preview.departure.trim(),
        instructor_name: null,
        training_purpose: null,
        training_institution: null,
        // 궤적만으로는 터치앤고를 몇 번으로 셀지 판단할 수 없다. 비워 둔다.
        landing_count: 0,
        // GPS 고도는 기하고도라 기압고도와 다르다. 공식 기록란에 넣지 않는다.
        flight_altitude_ft: null,
        remarks: `${preview.filename} 에서 가져옴 · 궤적 ${track.distanceKm}km`
          + (track.maxAltitudeFt ? ` · GPS 최고고도 약 ${track.maxAltitudeFt}ft` : ''),
        is_draft: true,
        aircraft_id: aircraftId || null,
        pilot_role: 'dual',
        is_cross_country: isCrossCountry,
        leg_distance_km: isCrossCountry ? track.straightKm : null,
        track_points: track.points,
      }

      await createFlightLog(log)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="font-semibold mb-1">GPS 트랙 가져오기</h2>
      <p className="text-xs text-gray-500 mb-3">
        휴대용 GPS · EFB 태블릿 · 비행컴퓨터가 남긴 GPX · KML · IGC 파일을
        올리면 비행기록 초안을 만듭니다.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".gpx,.kml,.igc,.GPX,.KML,.IGC"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-700 file:text-white hover:file:bg-blue-600"
      />

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {preview && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded space-y-2">
          <p className="text-xs text-blue-900">
            <strong>{preview.filename}</strong> · {preview.track.format.toUpperCase()} ·
            점 {preview.track.points.length}개 · 궤적 {preview.track.distanceKm}km ·
            직선 {preview.track.straightKm}km
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">날짜</label>
              <input
                type="date" value={preview.date}
                onChange={(e) => setPreview({ ...preview, date: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                비행시간 (분)
                {preview.track.durationMin === null && (
                  <span className="text-amber-700 ml-1">파일에 시각이 없습니다</span>
                )}
              </label>
              <input
                type="number" min="0" value={preview.track.durationMin ?? ''}
                onChange={(e) => setPreview({
                  ...preview,
                  track: { ...preview.track, durationMin: Number(e.target.value) || 0 },
                })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                출발 {!preview.departureMatched && (
                  <span className="text-amber-700">가까운 이착륙장을 못 찾았습니다</span>
                )}
              </label>
              <input
                type="text" value={preview.departure}
                onChange={(e) => setPreview({ ...preview, departure: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                도착 {!preview.arrivalMatched && (
                  <span className="text-amber-700">가까운 이착륙장을 못 찾았습니다</span>
                )}
              </label>
              <input
                type="text" value={preview.arrival}
                onChange={(e) => setPreview({ ...preview, arrival: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            {aircraft.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">기체</label>
                <select
                  value={aircraftId} onChange={(e) => setAircraftId(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">선택 안 함</option>
                  {aircraft.map((a) => (
                    <option key={a.id} value={a.id}>{a.registration} · {a.category}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="text-[11px] text-blue-900 leading-relaxed">
            <strong>임시저장으로 올라갑니다.</strong> 착륙 횟수와 고도는 채우지 않았습니다 —
            궤적만으로 터치앤고를 몇 번으로 셀지 판단할 수 없고, GPS 고도는 기압고도와
            다르기 때문입니다. 기록을 열어 확인한 뒤 확정하세요.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleSave} disabled={saving}
              className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '초안으로 저장'}
            </button>
            <button
              onClick={() => { setPreview(null); setError(''); if (fileRef.current) fileRef.current.value = '' }}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

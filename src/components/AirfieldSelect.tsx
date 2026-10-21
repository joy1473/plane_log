import { useState, useId } from 'react'
import { createUserAirfield, type AirfieldOption } from '../lib/user-airfields'

interface Props {
  label: string
  value: string
  onChange: (name: string) => void
  options: AirfieldOption[]
  /** 새로 등록되면 목록을 다시 불러오도록 알린다 */
  onAirfieldAdded: () => void
  required?: boolean
}

/**
 * 이착륙장 입력. 내장 목록과 사설 이착륙장을 함께 제안하고,
 * 목록에 없는 이름을 적으면 그 자리에서 좌표까지 받아 등록한다.
 * 좌표 없이 이름만 저장해도 기록은 되지만 지도와 거리 계산에서 빠진다.
 */
export default function AirfieldSelect({
  label, value, onChange, options, onAirfieldAdded, required,
}: Props) {
  const listId = useId()
  const [adding, setAdding] = useState(false)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trimmed = value.trim()
  const known = options.some((o) => o.name === trimmed)
  const isNew = trimmed.length > 0 && !known

  async function handleRegister() {
    setSaving(true)
    setError('')
    try {
      await createUserAirfield({
        name: trimmed,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
      })
      setAdding(false)
      setLat('')
      setLng('')
      onAirfieldAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <input
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이착륙장 이름"
        required={required}
        className="w-full border rounded px-3 py-2 text-sm"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.source + o.name} value={o.name}>
            {o.source === 'user' ? '내 이착륙장' : o.type ?? ''}
          </option>
        ))}
      </datalist>

      {isNew && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 text-xs text-blue-700 hover:text-blue-900 underline"
        >
          목록에 없는 곳입니다 — &ldquo;{trimmed}&rdquo; 등록하기
        </button>
      )}

      {isNew && adding && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded space-y-2">
          <p className="text-xs text-blue-900">
            <strong>{trimmed}</strong> 등록. 좌표를 넣으면 지도에 표시되고
            야외비행 거리 계산에 쓰입니다.
          </p>
          <div className="flex gap-2">
            <input
              type="number" step="any" inputMode="decimal"
              value={lat} onChange={(e) => setLat(e.target.value)}
              placeholder="위도 (예: 36.7564)"
              className="flex-1 border rounded px-2 py-1.5 text-sm"
            />
            <input
              type="number" step="any" inputMode="decimal"
              value={lng} onChange={(e) => setLng(e.target.value)}
              placeholder="경도 (예: 129.3492)"
              className="flex-1 border rounded px-2 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button" onClick={handleRegister} disabled={saving}
              className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '등록 중...' : '등록'}
            </button>
            <button
              type="button" onClick={() => { setAdding(false); setError('') }}
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

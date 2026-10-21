import { useState } from 'react'
import { createAircraft } from '../lib/aircraft'
import { AIRCRAFT_CATEGORIES, type Aircraft, type AircraftCategory } from '../types/flight-log'

interface Props {
  value: string | null
  onChange: (aircraftId: string | null) => void
  aircraft: Aircraft[]
  onAircraftAdded: () => void
}

/**
 * 기체 선택. 등록된 기체가 없으면 그 자리에서 등록할 수 있다.
 * 기종을 받는 이유는 자격 요건이 기종별로 다르기 때문이다.
 */
export default function AircraftSelect({ value, onChange, aircraft, onAircraftAdded }: Props) {
  const [adding, setAdding] = useState(false)
  const [registration, setRegistration] = useState('')
  const [category, setCategory] = useState<AircraftCategory>('타면조종형비행기')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!registration.trim()) { setError('등록기호를 입력하세요'); return }
    setSaving(true)
    setError('')
    try {
      const created = await createAircraft({ registration, category, model })
      onAircraftAdded()
      onChange(created.id)
      setAdding(false)
      setRegistration('')
      setModel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">기체</label>

      <div className="flex gap-2">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        >
          <option value="">선택 안 함</option>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>
              {a.registration} · {a.category}{a.model ? ` · ${a.model}` : ''}
            </option>
          ))}
        </select>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-3 py-2 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-50 whitespace-nowrap"
          >
            + 기체 등록
          </button>
        )}
      </div>

      {!value && aircraft.length > 0 && (
        <p className="text-xs text-amber-700 mt-1">
          기체를 지정하지 않으면 자격 진행률 집계에서 빠집니다.
        </p>
      )}

      {adding && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text" value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              placeholder="등록기호 (예: HL1234)"
              className="border rounded px-2 py-1.5 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AircraftCategory)}
              className="border rounded px-2 py-1.5 text-sm"
            >
              {AIRCRAFT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text" value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="기종명 (선택)"
              className="border rounded px-2 py-1.5 text-sm sm:col-span-2"
            />
          </div>
          <p className="text-xs text-blue-900">
            기종에 따라 자격 요건이 다릅니다. 동력패러슈트는 야외비행 요건이 없습니다.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button" onClick={handleCreate} disabled={saving}
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

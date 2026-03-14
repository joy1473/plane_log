import { useState } from 'react'
import institutionsData from '../data/training-institutions.json'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
}

type CategoryKey = '조종사양성교육기관' | '항공정비사양성교육기관' | '항공교통관제사양성교육기관' | '경량항공기조종사과정' | '항공훈련기관'

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: '경량항공기조종사과정', label: '경량항공기 조종사 과정' },
  { key: '조종사양성교육기관', label: '조종사 양성 교육기관' },
  { key: '항공정비사양성교육기관', label: '항공정비사 양성 교육기관' },
  { key: '항공교통관제사양성교육기관', label: '항공교통관제사 양성 교육기관' },
  { key: '항공훈련기관', label: '항공훈련기관' },
]

const OTHER_VALUE = '__other__'

export default function TrainingInstitutionSelect({ value, onChange, className = '' }: Props) {
  const [category, setCategory] = useState<CategoryKey>('경량항공기조종사과정')
  const [isOther, setIsOther] = useState(false)

  const institutions = (institutionsData as Record<string, any>)[category] as { name: string; location?: string; operating_airports?: string }[] ?? []

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCategory(e.target.value as CategoryKey)
    setIsOther(false)
    onChange('')
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value
    if (selected === OTHER_VALUE) {
      setIsOther(true)
      onChange('')
    } else {
      setIsOther(false)
      onChange(selected)
    }
  }

  function handleOtherInput(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
  }

  function getLocationLabel(inst: { location?: string; operating_airports?: string }): string {
    return inst.location ?? inst.operating_airports ?? ''
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <select
        value={category}
        onChange={handleCategoryChange}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {CATEGORIES.map((cat) => (
          <option key={cat.key} value={cat.key}>{cat.label}</option>
        ))}
      </select>

      <select
        value={isOther ? OTHER_VALUE : value}
        onChange={handleSelectChange}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">교육기관 선택</option>
        {institutions
          .filter((inst) => inst.name !== '기타 (직접 입력)')
          .map((inst, i) => {
            const loc = getLocationLabel(inst)
            return (
              <option key={i} value={inst.name}>
                {inst.name}{loc ? ` (${loc})` : ''}
              </option>
            )
          })}
        <option value={OTHER_VALUE}>기타 (직접 입력)</option>
      </select>

      {isOther && (
        <input
          type="text"
          value={value}
          onChange={handleOtherInput}
          placeholder="교육기관명을 직접 입력하세요"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  )
}

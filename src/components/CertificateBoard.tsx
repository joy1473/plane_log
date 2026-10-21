import { useState, useEffect, useCallback } from 'react'
import {
  fetchCertificates, createCertificate, deleteCertificate,
  fetchProfile, saveProfile,
} from '../lib/certificates'
import { medicalExpiry, daysUntil, expiryStatus, medicalValidityMonths, ageOn } from '../lib/medical'
import {
  CERTIFICATE_KINDS, CERTIFICATE_LABELS,
  type Aircraft, type Certificate, type CertificateKind, type UserProfile,
} from '../types/flight-log'

interface Props {
  aircraft: Aircraft[]
}

const STATUS_STYLE = {
  expired: 'bg-red-50 border-red-300 text-red-800',
  urgent: 'bg-orange-50 border-orange-300 text-orange-800',
  soon: 'bg-amber-50 border-amber-300 text-amber-800',
  ok: 'bg-white border-gray-200 text-gray-700',
} as const

/**
 * 증명서류 만료 관제. 면허가 있어도 이 중 하나가 만료되면
 * 그날 비행은 불법이 된다. 조종사가 달력에 적어 관리하던 일이다.
 */
export default function CertificateBoard({ aircraft }: Props) {
  const [certs, setCerts] = useState<Certificate[]>([])
  const [profile, setProfile] = useState<UserProfile>({ name: '', birth_date: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  // 입력 상태
  const [kind, setKind] = useState<CertificateKind>('medical')
  const [label, setLabel] = useState('')
  const [aircraftId, setAircraftId] = useState('')
  const [issuedOn, setIssuedOn] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async function load() {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([fetchCertificates(), fetchProfile()])
      setCerts(c)
      if (p) setProfile({ name: p.name ?? '', birth_date: p.birth_date ?? '' })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 신체검사는 생년월일과 검사일만 있으면 만료일을 계산할 수 있다
  const autoExpiry =
    kind === 'medical' && profile.birth_date && issuedOn
      ? medicalExpiry(profile.birth_date, issuedOn)
      : null

  useEffect(() => {
    if (autoExpiry) setExpiresOn(autoExpiry)
  }, [autoExpiry])

  async function handleSaveProfile() {
    try {
      await saveProfile(profile)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    }
  }

  async function handleAdd() {
    if (!expiresOn) { setError('만료일을 입력하세요'); return }
    setSaving(true)
    try {
      await createCertificate({
        kind, label,
        aircraft_id: aircraftId || null,
        issued_on: issuedOn || null,
        expires_on: expiresOn,
      })
      setAdding(false)
      setLabel(''); setIssuedOn(''); setExpiresOn(''); setAircraftId('')
      setError('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 서류를 삭제하시겠습니까?')) return
    try {
      await deleteCertificate(id)
      setCerts((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-400">서류 불러오는 중...</div>
  }

  const needsBirthDate = !profile.birth_date

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold">증명서류 만료일</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-50"
          >
            + 서류 등록
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {/* 조종사 정보 — 신체검사 만료일 자동 계산에 필요 */}
      <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">이름</label>
            <input
              type="text" value={profile.name ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">생년월일</label>
            <input
              type="date" value={profile.birth_date ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, birth_date: e.target.value }))}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            조종사 정보 저장
          </button>
        </div>
        {needsBirthDate && (
          <p className="text-xs text-amber-700 mt-2">
            생년월일을 넣으면 항공신체검사 만료일을 자동으로 계산합니다.
            제2종은 나이 구간에 따라 유효기간이 60 / 24 / 12개월로 갈립니다.
          </p>
        )}
      </div>

      {adding && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={kind} onChange={(e) => setKind(e.target.value as CertificateKind)}
              className="border rounded px-2 py-1.5 text-sm"
            >
              {CERTIFICATE_KINDS.map((k) => (
                <option key={k} value={k}>{CERTIFICATE_LABELS[k]}</option>
              ))}
            </select>

            {(kind === 'insurance' || kind === 'airworthiness') && (
              <select
                value={aircraftId} onChange={(e) => setAircraftId(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm"
              >
                <option value="">기체 선택 안 함</option>
                {aircraft.map((a) => (
                  <option key={a.id} value={a.id}>{a.registration}</option>
                ))}
              </select>
            )}

            <div>
              <label className="block text-xs text-gray-600 mb-1">
                {kind === 'medical' ? '검사일' : '발급일'}
              </label>
              <input
                type="date" value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">만료일</label>
              <input
                type="date" value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>

            <input
              type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="메모 (선택)"
              className="border rounded px-2 py-1.5 text-sm sm:col-span-2"
            />
          </div>

          {autoExpiry && profile.birth_date && issuedOn && (
            <p className="text-xs text-blue-900">
              검사일 기준 만 {ageOn(profile.birth_date, issuedOn)}세 →
              유효기간 {medicalValidityMonths(ageOn(profile.birth_date, issuedOn))}개월 →
              만료일 <strong>{autoExpiry}</strong> 으로 계산했습니다. 직접 고칠 수 있습니다.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAdd} disabled={saving}
              className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '등록 중...' : '등록'}
            </button>
            <button
              onClick={() => { setAdding(false); setError('') }}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {certs.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          등록된 서류가 없습니다. 신체검사 · 보험 · 안전성인증 만료일을 넣어두면
          남은 일수를 계속 보여줍니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {certs.map((c) => {
            const days = daysUntil(c.expires_on)
            const status = expiryStatus(days)
            const ac = aircraft.find((a) => a.id === c.aircraft_id)
            return (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-3 border rounded px-3 py-2 ${STATUS_STYLE[status]}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {CERTIFICATE_LABELS[c.kind]}
                    {ac && <span className="font-normal"> · {ac.registration}</span>}
                    {c.label && <span className="font-normal text-xs"> · {c.label}</span>}
                  </p>
                  <p className="text-xs opacity-80">
                    만료 {c.expires_on}
                    {' · '}
                    {days < 0 ? `${-days}일 지남` : days === 0 ? '오늘 만료' : `${days}일 남음`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-xs opacity-50 hover:opacity-100 shrink-0"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        신체검사 유효기간(60 / 24 / 12개월)은 검진기관 안내 기준이며 법령 원문을
        확인하지 않았습니다. 나이를 검사일 기준으로 보는지 등 세부 규칙도
        확정하지 못했으니 갱신 전 반드시 확인하세요.
      </p>
    </div>
  )
}

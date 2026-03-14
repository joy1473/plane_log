import { useState, useRef } from 'react'
import { parseCsvFile } from '../lib/csv-parser-light'
import { insertFlightLogs } from '../lib/supabase-flight-log'
import { savePendingUpload } from '../lib/offline-store'
import TrainingInstitutionSelect from './TrainingInstitutionSelect'
import type { FlightLog } from '../types/flight-log'

interface UploadProps {
  onUploadComplete: () => void
}

export default function LightAircraftLogUpload({ onUploadComplete }: UploadProps) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<FlightLog[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [trainingInstitution, setTrainingInstitution] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('parsing')
    setMessage('')
    setParseErrors([])

    const result = await parseCsvFile(file)

    if (result.data.length === 0) {
      setStatus('error')
      setMessage('파싱된 데이터가 없습니다')
      setParseErrors(result.errors)
      return
    }

    setPreview(result.data)
    setParseErrors(result.errors)
    setStatus('idle')
    setMessage(`${result.data.length}건 파싱 완료 (건너뜀: ${result.skipped}건)`)
  }

  async function handleUpload() {
    if (preview.length === 0) return

    setStatus('uploading')

    // 선택된 교육기관을 모든 로그에 적용
    const logsWithInstitution = trainingInstitution
      ? preview.map((log) => ({ ...log, training_institution: trainingInstitution }))
      : preview

    if (!navigator.onLine) {
      await savePendingUpload(logsWithInstitution)
      setStatus('done')
      setMessage(`오프라인 상태: ${preview.length}건 로컬 저장 완료 (온라인 복귀 시 자동 업로드)`)
      setPreview([])
      onUploadComplete()
      return
    }

    try {
      const result = await insertFlightLogs(logsWithInstitution)

      if (result.errors.length > 0) {
        setStatus('error')
        setMessage(result.errors.join(', '))
        return
      }

      setStatus('done')
      setMessage(`${result.inserted}건 저장 완료 (중복 건너뜀: ${result.duplicates}건)`)
      setPreview([])
      if (fileRef.current) fileRef.current.value = ''
      onUploadComplete()
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다')
    }
  }

  function handleReset() {
    setStatus('idle')
    setMessage('')
    setPreview([])
    setParseErrors([])
    setTrainingInstitution('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">CSV 비행 기록 업로드</h2>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.CSV"
        onChange={handleFileChange}
        disabled={status === 'parsing' || status === 'uploading'}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      {message && (
        <p className={`mt-3 text-sm ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      {parseErrors.length > 0 && (
        <div className="mt-2 text-xs text-orange-600 space-y-1">
          {parseErrors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">미리보기 (최대 5건)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 border">날짜</th>
                  <th className="px-2 py-1 border">출발</th>
                  <th className="px-2 py-1 border">도착</th>
                  <th className="px-2 py-1 border">시간(분)</th>
                  <th className="px-2 py-1 border">이착륙장</th>
                  <th className="px-2 py-1 border">교관</th>
                  <th className="px-2 py-1 border">목적</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((log, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 border">{log.flight_date}</td>
                    <td className="px-2 py-1 border">{log.departure_time ?? '-'}</td>
                    <td className="px-2 py-1 border">{log.arrival_time ?? '-'}</td>
                    <td className="px-2 py-1 border">{log.flight_duration_min}</td>
                    <td className="px-2 py-1 border">{log.airfield}</td>
                    <td className="px-2 py-1 border">{log.instructor_name ?? '-'}</td>
                    <td className="px-2 py-1 border">{log.training_purpose ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              교육기관 선택 <span className="text-gray-400 font-normal">(선택 사항)</span>
            </label>
            <TrainingInstitutionSelect
              value={trainingInstitution}
              onChange={setTrainingInstitution}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleUpload}
              disabled={status === 'uploading'}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'uploading' ? '업로드 중...' : `${preview.length}건 업로드`}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

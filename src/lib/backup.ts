import { supabase, isSupabaseConfigured } from './supabase'

/**
 * 전체 백업 내보내기.
 *
 * 수년치 법정 기록이 계정 하나에만 있는 상태는 불안하다. 이 프로젝트는
 * 무료 플랜이라 미사용 시 자동 정지되고, 조직당 활성 프로젝트 수 제한도
 * 걸려 있다 — 내 손에 사본을 두는 쪽이 맞다.
 *
 * 내보낸 JSON 은 사람이 읽을 수 있고 그대로 되돌릴 수 있는 형태로 둔다.
 */

const TABLES = [
  'flight_logs',
  'aircraft',
  'user_airfields',
  'certificates',
  'maintenance_items',
  'user_profile',
] as const

export interface BackupFile {
  exportedAt: string
  schemaVersion: string
  tables: Record<string, unknown[]>
}

export async function buildBackup(): Promise<BackupFile> {
  if (!isSupabaseConfigured) throw new Error('Supabase가 연결되지 않았습니다')

  const tables: Record<string, unknown[]> = {}

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`${table} 내보내기 오류: ${error.message}`)
    tables[table] = data ?? []
  }

  return {
    exportedAt: new Date().toISOString(),
    // 마이그레이션 파일 번호와 맞춰 둔다. 복원할 때 어느 스키마인지 알아야 한다.
    schemaVersion: '20261021000005',
    tables,
  }
}

export async function downloadBackup(): Promise<number> {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `plane-log-backup-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)

  return Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0)
}

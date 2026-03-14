import { openDB, type IDBPDatabase } from 'idb'
import type { FlightLog } from '../types/flight-log'
import { insertFlightLogs } from './supabase-flight-log'

const DB_NAME = 'plane_log_offline'
const DB_VERSION = 1
const STORE_FLIGHT_LOGS = 'flight_logs'
const STORE_PENDING_UPLOADS = 'pending_uploads'

interface PlaneLogDB {
  [STORE_FLIGHT_LOGS]: {
    key: string
    value: FlightLog & { id: string }
    indexes: { 'by-date': string }
  }
  [STORE_PENDING_UPLOADS]: {
    key: number
    value: { logs: FlightLog[]; createdAt: string }
  }
}

let dbPromise: Promise<IDBPDatabase<PlaneLogDB>> | null = null

function getDb(): Promise<IDBPDatabase<PlaneLogDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PlaneLogDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_FLIGHT_LOGS)) {
          const store = db.createObjectStore(STORE_FLIGHT_LOGS, { keyPath: 'id' })
          store.createIndex('by-date', 'flight_date')
        }
        if (!db.objectStoreNames.contains(STORE_PENDING_UPLOADS)) {
          db.createObjectStore(STORE_PENDING_UPLOADS, { autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

export async function cacheFlightLogs(logs: (FlightLog & { id: string })[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(STORE_FLIGHT_LOGS, 'readwrite')
  await Promise.all([
    ...logs.map((log) => tx.store.put(log)),
    tx.done,
  ])
}

export async function getCachedFlightLogs(): Promise<(FlightLog & { id: string })[]> {
  const db = await getDb()
  return db.getAllFromIndex(STORE_FLIGHT_LOGS, 'by-date')
}

export async function savePendingUpload(logs: FlightLog[]): Promise<void> {
  const db = await getDb()
  await db.add(STORE_PENDING_UPLOADS, { logs, createdAt: new Date().toISOString() })
}

export async function getPendingUploads(): Promise<{ key: number; logs: FlightLog[] }[]> {
  const db = await getDb()
  const tx = db.transaction(STORE_PENDING_UPLOADS, 'readonly')
  const keys = await tx.store.getAllKeys()
  const values = await tx.store.getAll()
  await tx.done
  return keys.map((key, i) => ({ key: key as number, logs: values[i].logs }))
}

export async function removePendingUpload(key: number): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_PENDING_UPLOADS, key)
}

/**
 * 대기 중인 업로드를 Supabase에 동기화.
 * 각 항목을 순서대로 처리하고 성공하면 로컬에서 삭제.
 */
export async function syncPendingUploads(): Promise<void> {
  const pending = await getPendingUploads()
  if (pending.length === 0) return

  for (const { key, logs } of pending) {
    try {
      const result = await insertFlightLogs(logs)
      // 오류가 없거나 전부 중복이면 성공으로 간주
      if (result.errors.length === 0 || result.inserted + result.duplicates === logs.length) {
        await removePendingUpload(key)
      }
    } catch {
      // 네트워크 오류 등 일시적 실패는 다음 재연결 시 재시도
    }
  }
}

/**
 * 네트워크 재연결 시 대기 중인 업로드를 자동으로 동기화하는 리스너를 등록.
 * 앱 초기화 시 한 번만 호출.
 */
export function registerReconnectSync(): void {
  window.addEventListener('online', () => {
    syncPendingUploads().catch((err) => {
      console.error('재연결 자동 동기화 실패:', err)
    })
  })
}

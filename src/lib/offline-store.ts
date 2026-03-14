import { openDB, type IDBPDatabase } from 'idb'
import type { FlightLog } from '../types/flight-log'

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

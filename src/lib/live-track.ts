import { openDB, type IDBPDatabase } from 'idb'
import type { TrackPoint } from './track-parser'

/**
 * 비행 중 실시간 궤적 기록.
 *
 * 전제를 분명히 — 브라우저에는 백그라운드 위치추적이 없다. 화면이 꺼지거나
 * 앱이 뒤로 가면 수신이 멈춘다 (iOS · 안드로이드 공통, W3C Geofencing 제안도
 * 폐기됨). 그래서 "거치대에 올리고 화면을 켜둔 채"만 동작한다. 주머니에
 * 넣어두는 사용법은 네이티브 앱이 아니면 불가능하다.
 *
 * 좌표는 들어오는 대로 IndexedDB 에 적는다. 메모리에만 쌓으면 탭이 죽거나
 * 실수로 새로고침했을 때 비행 하나가 통째로 날아간다.
 *
 * offline-store 와 DB 를 나눈 이유: 그쪽 버전을 올리면 기존 사용자의 DB
 * 마이그레이션이 걸린다. 별도 DB 가 안전하다.
 */

const DB_NAME = 'plane_log_live'
const DB_VERSION = 1
const STORE_POINTS = 'points'
const STORE_SESSION = 'session'

export interface LiveSession {
  id: 'current'
  startedAt: string
  /** 마지막으로 좌표가 들어온 시각. 끊긴 구간을 찾는 데 쓴다 */
  lastPointAt: string | null
}

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE_POINTS)) {
          d.createObjectStore(STORE_POINTS, { autoIncrement: true })
        }
        if (!d.objectStoreNames.contains(STORE_SESSION)) {
          d.createObjectStore(STORE_SESSION, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function getSession(): Promise<LiveSession | null> {
  return (await (await db()).get(STORE_SESSION, 'current')) ?? null
}

export async function getPoints(): Promise<TrackPoint[]> {
  return (await (await db()).getAll(STORE_POINTS)) as TrackPoint[]
}

export async function clearSession(): Promise<void> {
  const d = await db()
  await d.clear(STORE_POINTS)
  await d.delete(STORE_SESSION, 'current')
}

async function appendPoint(p: TrackPoint): Promise<void> {
  const d = await db()
  await d.add(STORE_POINTS, p)
  await d.put(STORE_SESSION, {
    id: 'current',
    startedAt: (await d.get(STORE_SESSION, 'current'))?.startedAt ?? p.time ?? new Date().toISOString(),
    lastPointAt: p.time,
  } satisfies LiveSession)
}

export interface RecorderHandle {
  stop: () => Promise<void>
}

export interface RecorderCallbacks {
  onPoint: (count: number, latest: TrackPoint) => void
  onError: (message: string) => void
  /** 화면이 가려져 기록이 끊겼다가 돌아왔을 때 */
  onGap?: () => void
}

/**
 * 기록을 시작한다. 화면 잠금을 막고(Wake Lock), 위치를 계속 받는다.
 * Wake Lock 은 문서가 가려지면 자동 해제되므로 돌아왔을 때 다시 잡는다.
 */
export async function startRecording(cb: RecorderCallbacks): Promise<RecorderHandle> {
  if (!('geolocation' in navigator)) {
    throw new Error('이 기기에서는 위치를 받을 수 없습니다')
  }

  let count = (await getPoints()).length
  let wakeLock: WakeLockSentinel | null = null

  async function acquireWakeLock() {
    try {
      // Safari 는 홈 화면 앱 기준 18.4 부터 정상 동작한다
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen')
      }
    } catch {
      // 화면이 꺼질 수 있을 뿐 기록 자체는 계속된다
    }
  }

  async function onVisibility() {
    if (document.visibilityState === 'visible') {
      await acquireWakeLock()
      cb.onGap?.()
    }
  }

  await acquireWakeLock()
  document.addEventListener('visibilitychange', onVisibility)

  const watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const point: TrackPoint = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ele: pos.coords.altitude,
        time: new Date(pos.timestamp).toISOString(),
      }
      await appendPoint(point)
      count++
      cb.onPoint(count, point)
    },
    (err) => {
      cb.onError(
        err.code === err.PERMISSION_DENIED
          ? '위치 권한이 거부되었습니다'
          : `위치를 받지 못했습니다: ${err.message}`
      )
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
  )

  return {
    async stop() {
      navigator.geolocation.clearWatch(watchId)
      document.removeEventListener('visibilitychange', onVisibility)
      try { await wakeLock?.release() } catch { /* 이미 해제됨 */ }
      wakeLock = null
    },
  }
}

import type { LogMode } from '../types/flight-log'

/**
 * 훈련 모드와 일지 모드.
 *
 * 스키마의 교관·훈련목적·교육기관은 훈련생에게만 해당한다. 면허를 따고
 * 자기 비행기로 혼자 나는 조종사에게는 셋 다 쓸 일이 없는데, 입력 화면이
 * 계속 물으면 매번 빈칸을 지나쳐야 한다. 훈련은 길어야 몇 달이고 그 뒤는
 * 수십 년이므로 훈련 쪽을 기본값이 아니라 선택지로 둔다.
 *
 * 기기별 표시 설정이라 서버가 아니라 localStorage 에 둔다. 기록 자체는
 * 어느 모드에서 적었든 동일한 테이블에 남는다.
 */
const KEY = 'plane_log_mode'

export function getLogMode(): LogMode {
  try {
    return localStorage.getItem(KEY) === 'logbook' ? 'logbook' : 'training'
  } catch {
    return 'training'
  }
}

export function setLogMode(mode: LogMode): void {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // 사생활 모드 등에서 저장이 막혀도 동작 자체는 막지 않는다
  }
}

/** 직전 비행의 이착륙장을 다음 입력의 기본값으로 쓴다 */
const LAST_KEY = 'plane_log_last_entry'

export interface LastEntry {
  departure_airfield?: string
  arrival_airfield?: string
  instructor_name?: string
  training_institution?: string
}

export function getLastEntry(): LastEntry {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function setLastEntry(entry: LastEntry): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(entry))
  } catch {
    // 무시
  }
}

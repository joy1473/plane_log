export interface Airfield {
  name: string
  lat: number
  lng: number
  type: '비행장' | '이착륙장' | '공항'
}

// 한국 주요 경량항공기 이착륙장/비행장 좌표
export const AIRFIELDS: Airfield[] = [
  // 공항
  { name: '김포공항', lat: 37.5583, lng: 126.7906, type: '공항' },
  { name: '인천공항', lat: 37.4602, lng: 126.4407, type: '공항' },
  { name: '김해공항', lat: 35.1795, lng: 128.9382, type: '공항' },
  { name: '제주공항', lat: 33.5104, lng: 126.4914, type: '공항' },
  { name: '대구공항', lat: 35.8941, lng: 128.6589, type: '공항' },
  { name: '청주공항', lat: 36.7166, lng: 127.4987, type: '공항' },
  { name: '광주공항', lat: 35.1264, lng: 126.8089, type: '공항' },
  { name: '양양공항', lat: 38.0613, lng: 128.6692, type: '공항' },
  { name: '여수공항', lat: 34.8422, lng: 127.6162, type: '공항' },
  { name: '울산공항', lat: 35.5935, lng: 129.3518, type: '공항' },
  { name: '포항공항', lat: 35.9878, lng: 129.4204, type: '공항' },
  { name: '사천공항', lat: 35.0886, lng: 128.0704, type: '공항' },
  { name: '군산공항', lat: 35.9038, lng: 126.6158, type: '공항' },
  { name: '원주공항', lat: 37.4381, lng: 127.9603, type: '공항' },
  { name: '무안공항', lat: 34.9914, lng: 126.3828, type: '공항' },

  // 경량항공기 전용 비행장/이착륙장
  { name: '울진비행장', lat: 36.7564, lng: 129.3492, type: '비행장' },
  { name: '양양비행장', lat: 38.0613, lng: 128.6692, type: '비행장' },
  { name: '단양비행장', lat: 36.9845, lng: 128.3654, type: '이착륙장' },
  { name: '충주비행장', lat: 36.9701, lng: 127.8720, type: '비행장' },
  { name: '예천비행장', lat: 36.6317, lng: 128.3508, type: '비행장' },
  { name: '정석비행장', lat: 33.3896, lng: 126.7122, type: '비행장' },
  { name: '서귀포비행장', lat: 33.2461, lng: 126.5653, type: '이착륙장' },
  { name: '태백이착륙장', lat: 37.1640, lng: 128.9860, type: '이착륙장' },
  { name: '영월이착륙장', lat: 37.1838, lng: 128.4618, type: '이착륙장' },
  { name: '고성이착륙장', lat: 38.3800, lng: 128.4670, type: '이착륙장' },
  { name: '함양이착륙장', lat: 35.5200, lng: 127.7250, type: '이착륙장' },
  { name: '밀양이착륙장', lat: 35.5037, lng: 128.7485, type: '이착륙장' },
  { name: '고흥이착륙장', lat: 34.6116, lng: 127.2072, type: '이착륙장' },
  { name: '무주이착륙장', lat: 35.9220, lng: 127.6609, type: '이착륙장' },
  { name: '횡성이착륙장', lat: 37.4882, lng: 127.9847, type: '이착륙장' },
  { name: '화천이착륙장', lat: 38.1062, lng: 127.7080, type: '이착륙장' },
  { name: '보은이착륙장', lat: 36.4890, lng: 127.7290, type: '이착륙장' },
  { name: '서산이착륙장', lat: 36.7800, lng: 126.4860, type: '이착륙장' },
]

/**
 * 비행기록의 이착륙장 이름으로 좌표를 찾기 (부분 매칭)
 */
export function findAirfield(name: string): Airfield | null {
  const trimmed = name.trim()
  // 정확한 매칭 우선
  const exact = AIRFIELDS.find((a) => a.name === trimmed)
  if (exact) return exact
  // 부분 매칭 (입력에 비행장/이착륙장 이름이 포함되거나 그 반대)
  return AIRFIELDS.find((a) =>
    a.name.includes(trimmed) || trimmed.includes(a.name.replace(/비행장|이착륙장|공항/g, ''))
  ) ?? null
}

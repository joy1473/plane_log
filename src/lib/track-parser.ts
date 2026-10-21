/**
 * GPS 트랙 파일 파서.
 *
 * 브라우저는 백그라운드 위치추적을 못 한다 — 화면이 꺼지거나 앱이 뒤로
 * 가면 수신이 멈춘다. 그래서 추적은 그 일을 잘하는 기기(휴대용 GPS,
 * EFB 태블릿, 비행컴퓨터)에 맡기고 결과만 받는다. 실시간 기록보다
 * 구현이 쉽고 제약도 없으면서 자동화 효과는 거의 같다.
 */

export interface TrackPoint {
  lat: number
  lng: number
  /** 미터. GPS 고도는 기하고도라 기압고도와 다르다 — 참고값으로만 쓴다 */
  ele: number | null
  /** ISO 문자열. 없는 포맷도 있다 */
  time: string | null
}

export interface ParsedTrack {
  points: TrackPoint[]
  format: 'gpx' | 'kml' | 'igc'
  startTime: string | null
  endTime: string | null
  /** 분. 시각이 없으면 null */
  durationMin: number | null
  /** km. 점 사이 거리의 합 */
  distanceKm: number
  /** 직선 거리(km). 야외비행 구간 판정에 쓰는 값은 이쪽이다 */
  straightKm: number
  maxAltitudeFt: number | null
}

export class TrackParseError extends Error {}

function haversineKm(a: TrackPoint, b: TrackPoint): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new TrackParseError('XML을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다')
  }
  return doc
}

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parseGpx(text: string): TrackPoint[] {
  const doc = parseXml(text)
  // trkpt 가 본체지만, 경로를 route 로 담은 파일도 있다
  const nodes = doc.getElementsByTagName('trkpt').length
    ? doc.getElementsByTagName('trkpt')
    : doc.getElementsByTagName('rtept')

  const points: TrackPoint[] = []
  for (const node of Array.from(nodes)) {
    const lat = num(node.getAttribute('lat'))
    const lng = num(node.getAttribute('lon'))
    if (lat === null || lng === null) continue
    points.push({
      lat,
      lng,
      ele: num(node.getElementsByTagName('ele')[0]?.textContent),
      time: node.getElementsByTagName('time')[0]?.textContent?.trim() || null,
    })
  }
  return points
}

export function parseKml(text: string): TrackPoint[] {
  const doc = parseXml(text)
  const points: TrackPoint[] = []

  // gx:Track 은 시각을 따로 들고 있어 먼저 본다
  const whens = Array.from(doc.getElementsByTagName('when'))
  const coords = Array.from(doc.getElementsByTagName('gx:coord'))
  if (coords.length > 0) {
    coords.forEach((c, i) => {
      const parts = (c.textContent ?? '').trim().split(/\s+/)
      const lng = num(parts[0])
      const lat = num(parts[1])
      if (lat === null || lng === null) return
      points.push({ lat, lng, ele: num(parts[2]), time: whens[i]?.textContent?.trim() || null })
    })
    return points
  }

  // 일반 LineString: "lon,lat,ele lon,lat,ele ..."
  for (const node of Array.from(doc.getElementsByTagName('coordinates'))) {
    for (const chunk of (node.textContent ?? '').trim().split(/\s+/)) {
      const [lngS, latS, eleS] = chunk.split(',')
      const lng = num(lngS)
      const lat = num(latS)
      if (lat === null || lng === null) continue
      points.push({ lat, lng, ele: num(eleS), time: null })
    }
  }
  return points
}

/** IGC B 레코드: B HHMMSS DDMMmmm[NS] DDDMMmmm[EW] A PPPPP GGGGG */
const IGC_B = /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])([AV])(\d{5})(\d{5})/

export function parseIgc(text: string): TrackPoint[] {
  const points: TrackPoint[] = []
  let date: string | null = null

  for (const line of text.split(/\r?\n/)) {
    // HFDTE 또는 HFDTEDATE: DDMMYY
    const dateMatch = /^HFDTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/.exec(line)
    if (dateMatch) {
      const [, dd, mm, yy] = dateMatch
      date = `20${yy}-${mm}-${dd}`
      continue
    }

    const m = IGC_B.exec(line)
    if (!m) continue

    const [, hh, mi, ss, latDeg, latMin, ns, lngDeg, lngMin, ew, , pAlt, gAlt] = m
    const lat = (Number(latDeg) + Number(latMin) / 60000) * (ns === 'S' ? -1 : 1)
    const lng = (Number(lngDeg) + Number(lngMin) / 60000) * (ew === 'W' ? -1 : 1)
    // GPS 고도가 0이면 기압고도로 떨어진다
    const ele = Number(gAlt) || Number(pAlt) || null

    points.push({
      lat, lng, ele,
      time: date ? `${date}T${hh}:${mi}:${ss}Z` : null,
    })
  }
  return points
}

/** 점이 너무 많으면 지도 썸네일에 쓰기 무겁다. 처음과 끝은 반드시 남긴다 */
export function decimate(points: TrackPoint[], max = 300): TrackPoint[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  const out: TrackPoint[] = []
  for (let i = 0; i < max - 1; i++) out.push(points[Math.round(i * step)])
  out.push(points[points.length - 1])
  return out
}

export function detectFormat(filename: string): ParsedTrack['format'] {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'gpx') return 'gpx'
  if (ext === 'kml') return 'kml'
  if (ext === 'igc') return 'igc'
  throw new TrackParseError('GPX · KML · IGC 파일만 읽을 수 있습니다')
}

export function parseTrack(text: string, filename: string): ParsedTrack {
  const format = detectFormat(filename)
  const points =
    format === 'gpx' ? parseGpx(text) :
    format === 'kml' ? parseKml(text) :
    parseIgc(text)

  if (points.length < 2) {
    throw new TrackParseError('트랙에서 좌표를 찾지 못했습니다')
  }

  let distanceKm = 0
  for (let i = 1; i < points.length; i++) distanceKm += haversineKm(points[i - 1], points[i])

  const timed = points.filter((p) => p.time)
  const startTime = timed[0]?.time ?? null
  const endTime = timed[timed.length - 1]?.time ?? null
  const durationMin =
    startTime && endTime
      ? Math.max(0, Math.round((Date.parse(endTime) - Date.parse(startTime)) / 60000))
      : null

  const elevations = points.map((p) => p.ele).filter((e): e is number => e !== null)
  const maxAltitudeFt = elevations.length
    ? Math.round(Math.max(...elevations) * 3.28084)
    : null

  return {
    points: decimate(points),
    format,
    startTime,
    endTime,
    durationMin,
    distanceKm: Math.round(distanceKm * 10) / 10,
    straightKm: Math.round(haversineKm(points[0], points[points.length - 1]) * 10) / 10,
    maxAltitudeFt,
  }
}

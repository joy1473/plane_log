import { describe, it, expect } from 'vitest'
import {
  parseGpx, parseKml, parseIgc, parseTrack, decimate, detectFormat, TrackParseError,
} from '../track-parser'

const GPX = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><trkseg>
    <trkpt lat="36.7564" lon="129.3492"><ele>100</ele><time>2026-10-21T01:00:00Z</time></trkpt>
    <trkpt lat="37.0000" lon="129.5000"><ele>500</ele><time>2026-10-21T01:30:00Z</time></trkpt>
    <trkpt lat="38.0613" lon="128.6692"><ele>200</ele><time>2026-10-21T02:00:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`

const KML_LINESTRING = `<?xml version="1.0"?>
<kml><Document><Placemark><LineString><coordinates>
129.3492,36.7564,100 129.5000,37.0000,500 128.6692,38.0613,200
</coordinates></LineString></Placemark></Document></kml>`

// IGC: 36도 45.384분 N = 36.7564, 129도 20.952분 E = 129.3492
const IGC = `AXXX
HFDTE211026
B0100003645384N12920952EA0010000100
B0130003700000N12930000EA0050000500
B0200003803678N12840152EA0020000200
`

describe('detectFormat', () => {
  it('확장자로 포맷을 고른다', () => {
    expect(detectFormat('flight.GPX')).toBe('gpx')
    expect(detectFormat('a/b/flight.kml')).toBe('kml')
    expect(detectFormat('flight.igc')).toBe('igc')
  })

  it('모르는 확장자는 거부한다', () => {
    expect(() => detectFormat('flight.csv')).toThrow(TrackParseError)
  })
})

describe('parseGpx', () => {
  it('trkpt 의 좌표 · 고도 · 시각을 읽는다', () => {
    const p = parseGpx(GPX)
    expect(p).toHaveLength(3)
    expect(p[0].lat).toBeCloseTo(36.7564, 4)
    expect(p[0].lng).toBeCloseTo(129.3492, 4)
    expect(p[0].ele).toBe(100)
    expect(p[0].time).toBe('2026-10-21T01:00:00Z')
  })

  it('trkpt 가 없으면 rtept 를 본다', () => {
    const rte = GPX.replace(/trkpt/g, 'rtept').replace(/trkseg/g, 'rte').replace(/<trk>|<\/trk>/g, '')
    expect(parseGpx(rte)).toHaveLength(3)
  })

  it('깨진 XML 은 TrackParseError', () => {
    expect(() => parseGpx('<gpx><trk>')).toThrow(TrackParseError)
  })
})

describe('parseKml', () => {
  it('LineString 좌표는 경도,위도 순서다', () => {
    const p = parseKml(KML_LINESTRING)
    expect(p).toHaveLength(3)
    expect(p[0].lat).toBeCloseTo(36.7564, 4)
    expect(p[0].lng).toBeCloseTo(129.3492, 4)
  })
})

describe('parseIgc', () => {
  it('B 레코드의 도분 좌표를 십진수로 바꾼다', () => {
    const p = parseIgc(IGC)
    expect(p).toHaveLength(3)
    expect(p[0].lat).toBeCloseTo(36.7564, 3)
    expect(p[0].lng).toBeCloseTo(129.3492, 3)
  })

  it('HFDTE 의 날짜를 시각에 붙인다', () => {
    expect(parseIgc(IGC)[0].time).toBe('2026-10-21T01:00:00Z')
  })

  it('남반구와 서경 부호를 처리한다', () => {
    const south = parseIgc('HFDTE211026\nB0100003645384S12920952WA0010000100')
    expect(south[0].lat).toBeLessThan(0)
    expect(south[0].lng).toBeLessThan(0)
  })
})

describe('decimate', () => {
  const many = Array.from({ length: 1000 }, (_, i) => ({
    lat: 36 + i / 1000, lng: 129, ele: null, time: null,
  }))

  it('상한 이하면 그대로 둔다', () => {
    expect(decimate(many.slice(0, 10), 300)).toHaveLength(10)
  })

  it('줄이더라도 처음과 끝은 남긴다', () => {
    const d = decimate(many, 300)
    expect(d).toHaveLength(300)
    expect(d[0]).toEqual(many[0])
    expect(d[d.length - 1]).toEqual(many[many.length - 1])
  })
})

describe('parseTrack', () => {
  it('GPX 에서 비행시간 · 거리 · 최고고도를 뽑는다', () => {
    const t = parseTrack(GPX, 'flight.gpx')
    expect(t.format).toBe('gpx')
    expect(t.durationMin).toBe(60)
    // 500m -> ft
    expect(t.maxAltitudeFt).toBe(1640)
    expect(t.distanceKm).toBeGreaterThan(t.straightKm)
  })

  it('직선 거리는 첫 점과 끝 점 사이다 — 야외비행 판정은 이 값을 쓴다', () => {
    const t = parseTrack(GPX, 'flight.gpx')
    // 울진 36.75 -> 양양 38.06, 대략 150km 안팎
    expect(t.straightKm).toBeGreaterThan(100)
    expect(t.straightKm).toBeLessThan(200)
  })

  it('세 포맷이 같은 궤적에서 비슷한 거리를 낸다', () => {
    const g = parseTrack(GPX, 'a.gpx')
    const k = parseTrack(KML_LINESTRING, 'a.kml')
    const i = parseTrack(IGC, 'a.igc')
    expect(Math.abs(g.distanceKm - k.distanceKm)).toBeLessThan(0.5)
    expect(Math.abs(g.distanceKm - i.distanceKm)).toBeLessThan(2)
  })

  it('좌표가 모자라면 거부한다', () => {
    expect(() => parseTrack('<gpx></gpx>', 'a.gpx')).toThrow(TrackParseError)
  })

  it('시각이 없으면 비행시간은 null 로 둔다 — 추측하지 않는다', () => {
    const t = parseTrack(KML_LINESTRING, 'a.kml')
    expect(t.durationMin).toBeNull()
  })
})

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { findAirfield, type Airfield } from '../data/airfields'
import type { FlightLog } from '../types/flight-log'

// Leaflet 기본 아이콘 문제 해결
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

interface FlightMapProps {
  logs: FlightLog[]
}

interface AirfieldSummary {
  airfield: Airfield
  flights: number
  totalMinutes: number
  landings: number
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useMemo(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]))
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 })
    }
  }, [positions, map])
  return null
}

export default function FlightMap({ logs }: FlightMapProps) {
  const airfieldSummaries = useMemo(() => {
    const map = new Map<string, AirfieldSummary>()

    for (const log of logs) {
      if (!log.airfield) continue
      const found = findAirfield(log.airfield)
      if (!found) continue

      const key = found.name
      const existing = map.get(key)
      if (existing) {
        existing.flights++
        existing.totalMinutes += log.flight_duration_min
        existing.landings += log.landing_count ?? 1
      } else {
        map.set(key, {
          airfield: found,
          flights: 1,
          totalMinutes: log.flight_duration_min,
          landings: log.landing_count ?? 1,
        })
      }
    }

    return Array.from(map.values())
  }, [logs])

  if (airfieldSummaries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400 text-sm">
        지도에 표시할 이착륙장 데이터가 없습니다
      </div>
    )
  }

  const positions: [number, number][] = airfieldSummaries.map((s) => [s.airfield.lat, s.airfield.lng])
  const center: [number, number] = positions.length === 1
    ? positions[0]
    : [36.5, 127.8] // 한국 중심

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-800 px-4 pt-4 pb-2">비행 이착륙장 지도</h2>
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: '400px', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />
        {airfieldSummaries.map((summary) => {
          const hours = Math.floor(summary.totalMinutes / 60)
          const mins = summary.totalMinutes % 60
          return (
            <Marker
              key={summary.airfield.name}
              position={[summary.airfield.lat, summary.airfield.lng]}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-base">{summary.airfield.name}</p>
                  <p className="text-gray-500">{summary.airfield.type}</p>
                  <hr className="my-1" />
                  <p>비행 횟수: <strong>{summary.flights}회</strong></p>
                  <p>총 비행시간: <strong>{hours}시간 {mins}분</strong></p>
                  <p>총 착륙: <strong>{summary.landings}회</strong></p>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export interface FlightLog {
  id?: string
  user_id?: string
  flight_date: string
  departure_time: string | null
  arrival_time: string | null
  flight_duration_min: number
  airfield: string
  instructor_name: string | null
  training_purpose: string | null
  landing_count: number
  flight_altitude_ft: number | null
  training_institution: string | null
  remarks: string | null
  created_at?: string
}

export interface CsvParseResult {
  data: FlightLog[]
  errors: string[]
  skipped: number
}

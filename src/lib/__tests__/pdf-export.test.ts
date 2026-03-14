import { describe, it, expect, vi, beforeEach } from 'vitest'

// escapeHtml is not exported, so we test it indirectly via exportFlightLogsPdf.
// We mock window.open to capture the HTML written to the fake document.

function setupWindowOpen() {
  const writes: string[] = []
  const fakePrintWindow = {
    document: {
      write: (html: string) => writes.push(html),
      close: vi.fn(),
    },
    onload: null as (() => void) | null,
    print: vi.fn(),
  }
  vi.stubGlobal('window', {
    open: vi.fn(() => fakePrintWindow),
  })
  return { fakePrintWindow, writes }
}

import type { FlightLog } from '../../types/flight-log'
import { exportFlightLogsPdf } from '../pdf-export'

function makeLog(overrides: Partial<FlightLog> = {}): FlightLog {
  return {
    flight_date: '2024-03-01',
    departure_time: null,
    arrival_time: null,
    flight_duration_min: 60,
    airfield: '광주공항',
    instructor_name: null,
    training_purpose: null,
    landing_count: 1,
    flight_altitude_ft: null,
    training_institution: null,
    remarks: null,
    ...overrides,
  }
}

describe('exportFlightLogsPdf - escapeHtml behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('escapes ampersands in field values', () => {
    const { writes } = setupWindowOpen()
    exportFlightLogsPdf([makeLog({ airfield: 'A&B공항' })], '전체')
    const html = writes.join('')
    expect(html).toContain('A&amp;B공항')
    expect(html).not.toContain('A&B공항')
  })

  it('escapes less-than and greater-than characters', () => {
    const { writes } = setupWindowOpen()
    exportFlightLogsPdf([makeLog({ training_purpose: '<script>alert(1)</script>' })], '전체')
    const html = writes.join('')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('escapes double quotes', () => {
    const { writes } = setupWindowOpen()
    exportFlightLogsPdf([makeLog({ instructor_name: 'Kim "Jay"' })], '전체')
    const html = writes.join('')
    expect(html).toContain('Kim &quot;Jay&quot;')
  })

  it('escapes single quotes in rendered fields', () => {
    const { writes } = setupWindowOpen()
    // instructor_name is rendered in the PDF table
    exportFlightLogsPdf([makeLog({ instructor_name: "O'Brien" })], '전체')
    const html = writes.join('')
    expect(html).toContain('O&#39;Brien')
  })

  it('renders null fields as a dash', () => {
    const { writes } = setupWindowOpen()
    exportFlightLogsPdf([makeLog({ instructor_name: null, remarks: null })], '전체')
    const html = writes.join('')
    // null values become '-'
    expect(html).toContain('>-<')
  })

  it('includes summary stats in the output', () => {
    const { writes } = setupWindowOpen()
    exportFlightLogsPdf(
      [
        makeLog({ flight_duration_min: 60, landing_count: 2 }),
        makeLog({ flight_duration_min: 120, landing_count: 3 }),
      ],
      '2024년'
    )
    const html = writes.join('')
    expect(html).toContain('2회')   // totalFlights
    expect(html).toContain('3시간 0분') // totalHours
    expect(html).toContain('5회')   // totalLandings
  })

  it('does nothing when window.open returns null', () => {
    vi.stubGlobal('window', { open: vi.fn(() => null) })
    // Should not throw
    expect(() => exportFlightLogsPdf([makeLog()], '전체')).not.toThrow()
  })
})

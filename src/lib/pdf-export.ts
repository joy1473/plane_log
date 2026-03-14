import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FlightLog } from '../types/flight-log'
import { calculateTotalHours } from './supabase-flight-log'

// 한글 지원을 위해 기본 폰트 사용 (helvetica) + Unicode escape
// jsPDF 기본 폰트는 한글 미지원이므로 영문+숫자 위주로 출력하고 한글은 가능한 범위에서 처리

export function exportFlightLogsPdf(
  logs: FlightLog[],
  dateLabel: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // 제목
  doc.setFontSize(16)
  doc.text('Flight Log Report', 14, 15)

  doc.setFontSize(10)
  doc.text(`Period: ${dateLabel}`, 14, 22)
  doc.text(`Generated: ${new Date().toLocaleDateString('ko-KR')}`, 14, 27)

  // 통계 요약
  const stats = calculateTotalHours(logs)
  doc.text(
    `Total: ${stats.totalFlights} flights | ${stats.totalHours} | ${stats.totalLandings} landings`,
    14, 34
  )

  // 테이블
  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Airfield', 'Duration(min)', 'Instructor', 'Purpose', 'Landings', 'Altitude(ft)']],
    body: logs.map((log) => [
      log.flight_date,
      log.airfield,
      String(log.flight_duration_min),
      log.instructor_name ?? '-',
      log.training_purpose ?? '-',
      String(log.landing_count ?? 1),
      log.flight_altitude_ft ? String(log.flight_altitude_ft) : '-',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175] },
  })

  const fileName = `flight-log-${dateLabel}.pdf`
  doc.save(fileName)
}

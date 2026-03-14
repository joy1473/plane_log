import type { FlightLog } from '../types/flight-log'
import { calculateTotalHours } from './supabase-flight-log'

export function exportFlightLogsPdf(
  logs: FlightLog[],
  dateLabel: string
): void {
  const stats = calculateTotalHours(logs)

  const rows = logs.map((log) => `
    <tr>
      <td>${log.flight_date}</td>
      <td>${log.airfield}</td>
      <td style="text-align:right">${log.flight_duration_min}</td>
      <td>${log.instructor_name ?? '-'}</td>
      <td>${log.training_purpose ?? '-'}</td>
      <td style="text-align:right">${log.landing_count ?? 1}</td>
      <td style="text-align:right">${log.flight_altitude_ft ?? '-'}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>비행기록 - ${dateLabel}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11px; color: #333; }
    h1 { font-size: 18px; color: #1e40af; margin-bottom: 4px; }
    .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
    .stats { display: flex; gap: 20px; margin-bottom: 16px; font-size: 12px; }
    .stats span { background: #f1f5f9; padding: 4px 10px; border-radius: 4px; }
    .stats strong { color: #1e40af; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #1e40af; color: white; padding: 6px 8px; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>비행 기록 보고서</h1>
  <div class="meta">기간: ${dateLabel} | 출력일: ${new Date().toLocaleDateString('ko-KR')}</div>
  <div class="stats">
    <span>비행 횟수: <strong>${stats.totalFlights}회</strong></span>
    <span>총 비행시간: <strong>${stats.totalHours}</strong></span>
    <span>총 착륙: <strong>${stats.totalLandings}회</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>날짜</th>
        <th>이착륙장</th>
        <th style="text-align:right">시간(분)</th>
        <th>교관</th>
        <th>훈련 목적</th>
        <th style="text-align:right">착륙</th>
        <th style="text-align:right">고도(ft)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.print()
  }
}

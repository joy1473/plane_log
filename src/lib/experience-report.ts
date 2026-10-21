import type { Aircraft, AircraftCategory, FlightLog, UserProfile } from '../types/flight-log'
import { REQUIREMENTS, formatMinutes } from './qualification'

/**
 * 비행경력 집계표.
 *
 * ⚠️ 이것은 공식 서식이 아닙니다. 비행경력증명서는 항공안전법 시행규칙
 * 별지 제36호서식이고, 그 레이아웃을 확인하지 못해 흉내 내지 않았습니다.
 * 공식 서식에 옮겨 적거나 증빙으로 첨부하는 용도로 쓰세요.
 *
 * 대신 서식이 요구하는 수치 — 기종별 총 비행시간, 단독, 야외비행,
 * 구간거리 요건 충족 횟수 — 를 그대로 뽑아냅니다.
 */

function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface CategorySummary {
  category: AircraftCategory
  totalMinutes: number
  soloMinutes: number
  dualMinutes: number
  crossCountryMinutes: number
  landings: number
  longLegs: number
  flights: number
}

export function summarizeByCategory(
  logs: FlightLog[],
  aircraft: Aircraft[]
): CategorySummary[] {
  const byId = new Map(aircraft.map((a) => [a.id, a.category]))
  const out = new Map<AircraftCategory, CategorySummary>()

  for (const log of logs) {
    if (log.is_draft || !log.aircraft_id) continue
    const category = byId.get(log.aircraft_id)
    if (!category) continue

    let s = out.get(category)
    if (!s) {
      s = {
        category, totalMinutes: 0, soloMinutes: 0, dualMinutes: 0,
        crossCountryMinutes: 0, landings: 0, longLegs: 0, flights: 0,
      }
      out.set(category, s)
    }

    const min = log.flight_duration_min
    s.totalMinutes += min
    s.flights++
    s.landings += log.landing_count ?? 0
    if (log.pilot_role === 'solo') s.soloMinutes += min
    else s.dualMinutes += min
    if (log.is_cross_country) {
      s.crossCountryMinutes += min
      const req = REQUIREMENTS[category].legDistanceKm
      if (
        req !== null &&
        log.leg_distance_km != null &&
        log.leg_distance_km >= req &&
        log.departure_airfield !== log.arrival_airfield
      ) {
        s.longLegs++
      }
    }
  }

  return Array.from(out.values())
}

export function exportExperienceReport(
  logs: FlightLog[],
  aircraft: Aircraft[],
  profile: UserProfile | null,
  dateLabel: string
): void {
  const confirmed = logs.filter((l) => !l.is_draft)
  const summaries = summarizeByCategory(confirmed, aircraft)
  const signedOff = confirmed.filter((l) => l.instructor_confirmed_at).length
  const regById = new Map(aircraft.map((a) => [a.id, a.registration]))

  const summaryRows = summaries.map((s) => {
    const req = REQUIREMENTS[s.category]
    return `
    <tr>
      <td>${escapeHtml(s.category)}</td>
      <td style="text-align:right">${escapeHtml(s.flights)}</td>
      <td style="text-align:right">${escapeHtml(formatMinutes(s.totalMinutes))}</td>
      <td style="text-align:right">${escapeHtml(formatMinutes(s.soloMinutes))}</td>
      <td style="text-align:right">${escapeHtml(formatMinutes(s.dualMinutes))}</td>
      <td style="text-align:right">${escapeHtml(formatMinutes(s.crossCountryMinutes))}</td>
      <td style="text-align:right">${escapeHtml(s.landings)}</td>
      <td style="text-align:right">${req.legDistanceKm === null ? '해당없음' : `${s.longLegs}회`}</td>
    </tr>`
  }).join('')

  const detailRows = confirmed.map((log) => `
    <tr>
      <td>${escapeHtml(log.flight_date)}</td>
      <td>${escapeHtml(log.aircraft_id ? regById.get(log.aircraft_id) : null)}</td>
      <td>${escapeHtml(log.departure_airfield)}</td>
      <td>${escapeHtml(log.arrival_airfield)}</td>
      <td style="text-align:right">${escapeHtml(log.flight_duration_min)}</td>
      <td style="text-align:center">${log.pilot_role === 'solo' ? '단독' : '동승'}</td>
      <td style="text-align:center">${log.is_cross_country ? '야외' : '-'}</td>
      <td style="text-align:right">${log.leg_distance_km != null ? escapeHtml(log.leg_distance_km) : '-'}</td>
      <td style="text-align:right">${escapeHtml(log.landing_count ?? 0)}</td>
      <td>${escapeHtml(log.instructor_name)}</td>
      <td style="text-align:center">${log.instructor_confirmed_at ? '확인' : '-'}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>비행경력 집계표 - ${escapeHtml(dateLabel)}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11px; color: #222; }
    h1 { font-size: 17px; margin: 0 0 2px; }
    h2 { font-size: 13px; margin: 18px 0 6px; }
    .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
    .notice { border: 1px solid #c88; background: #fdf4f4; color: #833;
              padding: 7px 9px; font-size: 10px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #eceff3; padding: 5px 7px; text-align: left; border: 1px solid #cbd3da; white-space: nowrap; }
    td { padding: 4px 7px; border: 1px solid #dde3e8; }
    tbody tr:nth-child(even) { background: #fafbfc; }
    .sign { margin-top: 22px; font-size: 11px; }
    .sign td { border: none; padding: 6px 0; }
    .line { display: inline-block; width: 180px; border-bottom: 1px solid #888; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>비행경력 집계표</h1>
  <div class="meta">
    조종사: ${escapeHtml(profile?.name || '-')}
    ${profile?.birth_date ? ` (생년월일 ${escapeHtml(profile.birth_date)})` : ''}
    &nbsp;|&nbsp; 기간: ${escapeHtml(dateLabel)}
    &nbsp;|&nbsp; 출력일: ${escapeHtml(new Date().toLocaleDateString('ko-KR'))}
    &nbsp;|&nbsp; 교관 확인 ${escapeHtml(signedOff)} / ${escapeHtml(confirmed.length)}건
  </div>

  <div class="notice">
    이 문서는 공식 서식이 아닙니다. 비행경력증명서는 항공안전법 시행규칙
    별지 제36호서식이며, 이 표는 그 서식에 옮겨 적거나 증빙으로 첨부하기 위한
    집계입니다. 임시저장 기록과 기체를 지정하지 않은 기록은 집계에서 제외됩니다.
  </div>

  <h2>기종별 집계</h2>
  <table>
    <thead>
      <tr>
        <th>기종</th><th style="text-align:right">비행횟수</th>
        <th style="text-align:right">총 비행시간</th><th style="text-align:right">단독</th>
        <th style="text-align:right">동승</th><th style="text-align:right">야외비행</th>
        <th style="text-align:right">착륙</th><th style="text-align:right">장거리 구간</th>
      </tr>
    </thead>
    <tbody>${summaryRows || '<tr><td colspan="8">기체가 지정된 기록이 없습니다.</td></tr>'}</tbody>
  </table>

  <h2>비행 내역</h2>
  <table>
    <thead>
      <tr>
        <th>날짜</th><th>등록기호</th><th>출발</th><th>도착</th>
        <th style="text-align:right">시간(분)</th><th style="text-align:center">구분</th>
        <th style="text-align:center">야외</th><th style="text-align:right">거리(km)</th>
        <th style="text-align:right">착륙</th><th>교관</th><th style="text-align:center">확인</th>
      </tr>
    </thead>
    <tbody>${detailRows || '<tr><td colspan="11">기록이 없습니다.</td></tr>'}</tbody>
  </table>

  <table class="sign">
    <tr>
      <td>위와 같이 비행하였음을 확인합니다.</td>
    </tr>
    <tr>
      <td>
        확인자 성명 <span class="line"></span>
        &nbsp;&nbsp;&nbsp; 서명 <span class="line"></span>
        &nbsp;&nbsp;&nbsp; 일자 <span class="line"></span>
      </td>
    </tr>
  </table>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => win.print()
}

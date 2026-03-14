# plane_log (KoreanLightAircraftEFB) - Comprehensive Gap Analysis Report v2.0

> **Summary**: Full-scope analysis covering code quality, security, performance, PWA, accessibility, error handling, data integrity, and UX completeness
>
> **Author**: gap-detector
> **Created**: 2026-03-14
> **Last Modified**: 2026-03-15
> **Status**: Approved

---

## Executive Summary

| Perspective | Description |
|-------------|-------------|
| **Problem** | Phase 1 MVP is functionally complete but has security vulnerabilities (XSS in PDF, CSV injection, scalability-breaking user lookup), zero test coverage, and critical accessibility gaps that block production readiness. |
| **Solution** | 25 gap items identified across 8 categories with prioritized fix plan. 6 items require immediate action before deploy; 6 more in next sprint. |
| **Function & UX Effect** | All 12 planned+added features work correctly. Date filters, sorting, PDF/CSV export all functional. UX gaps are polish-level (loading skeletons, custom modals, offline indicator). |
| **Core Value** | Raising overall score from 74% to 90%+ requires ~8 hours of targeted fixes across security (2hr), accessibility (2hr), tests (2hr), and PWA assets (1hr). |

---

## Analysis Overview

- **Analysis Target**: KoreanLightAircraftEFB Phase 1 MVP (full codebase)
- **Implementation Path**: `src/`, `supabase/functions/`
- **Analysis Date**: 2026-03-15
- **Previous Analysis**: 2026-03-14 (v1.0 - 76% match rate, 6 issues auto-fixed)
- **Total Source Files**: 17 client + 2 Edge Functions + 2 data files
- **Total Lines of Code**: ~1,450 (excluding node_modules, JSON data)

### Changes Since v1.0 Analysis

Features added since last analysis:
- Date range filters (year/month/custom)
- Column sorting (asc/desc)
- PDF export (rewritten from jsPDF to HTML print for Korean support)
- CSV export (BOM-UTF8)
- Training institution integrated into upload flow
- Reconnect auto-sync for offline uploads

Previously identified issues fixed:
- Kakao CSRF state parameter added
- CORS restricted to allowlist
- TrainingInstitutionSelect integrated into upload flow
- Pending upload auto-sync on reconnect implemented
- Test file previously existed (`tests/csv-parser-light.test.ts`) but has been removed

---

## Overall Scores

| Category | Score | Status | v1.0 Score |
|----------|:-----:|:------:|:----------:|
| Code Quality | 82% | Warning | 78% |
| Security | 75% | Warning | 72% |
| Performance | 83% | Warning | - |
| PWA Compliance | 65% | Critical | - |
| Accessibility | 40% | Critical | - |
| Error Handling | 75% | Warning | - |
| Data Integrity | 88% | OK | - |
| UX Completeness | 82% | Warning | - |
| Architecture | 90% | OK | 85% |
| Convention | 97% | OK | 95% |
| **Overall** | **74%** | **Warning** | **76%** |

> Note: Overall decreased slightly from v1.0 because this analysis includes categories not previously measured (PWA, Accessibility, Performance) which have lower scores. Functional feature coverage remains at 100%.

---

## Gap Items

### Critical (4 items - Must Fix Before Deploy)

#### C-01: No PWA icons exist
- **Category**: PWA Compliance
- **File**: `vite.config.ts:22-23`
- **Issue**: Manifest references `pwa-192x192.png` and `pwa-512x512.png` but neither file exists in `public/`. Chrome Lighthouse will fail the installability check.
- **Fix**: Generate and place PWA icons in `public/`.
- **Effort**: 15 min

#### C-02: Zero test files
- **Category**: Code Quality
- **File**: `package.json:12-13`
- **Issue**: `vitest`, `@testing-library/react`, and `jsdom` are all in devDependencies with test scripts configured, but **zero test files** exist anywhere in the project. The test file from v1.0 (`tests/csv-parser-light.test.ts`) has been removed. CSV parsing and flight log calculations are critical business logic that must be tested.
- **Fix**: Create tests for `csv-parser-light.ts` (parsing edge cases), `supabase-flight-log.ts` (`calculateTotalHours`), and component rendering.
- **Effort**: 2 hr

#### C-03: No ARIA labels or keyboard navigation
- **Category**: Accessibility
- **File**: Multiple
- **Issues**:
  - `Login.tsx:40-61`: OAuth buttons lack `aria-label` attributes
  - `FlightLogList.tsx:346-353`: Delete button uses visual "X" with `title="삭제"` but no `aria-label`
  - `FlightLogList.tsx:389-400`: Sortable `<th>` elements use `onClick` but no `role="button"`, `tabIndex`, `onKeyDown`, or `aria-sort`
  - `FlightMap.tsx:86-89`: `<MapContainer>` has no `aria-label` or accessible description
  - `LightAircraftLogUpload.tsx:90-97`: File input has no visible `<label>` element
  - `App.tsx`: No skip-to-content link
- **Fix**: Add ARIA attributes, keyboard handlers, and semantic HTML improvements.
- **Effort**: 2 hr

#### C-04: Edge Function user lookup is O(n) with 1000-user hard limit
- **Category**: Security / Scalability
- **File**: `supabase/functions/kakao-auth/index.ts:87`, `supabase/functions/naver-auth/index.ts:88`
- **Issue**: Both Edge Functions call `listUsers({ page: 1, perPage: 1000 })` then linear-scan for email. Breaks silently at >1000 users. Also a performance concern (fetches all user records per login).
- **Fix**: Replace with `supabase.auth.admin.listUsers({ filter: { email: kakaoEmail } })` or use RPC.
- **Effort**: 30 min
- **Carried from**: v1.0 item #1

---

### Major (10 items - Should Fix)

#### M-01: PDF export has XSS vulnerability
- **Category**: Security
- **File**: `src/lib/pdf-export.ts:10-20`
- **Issue**: Flight log fields are interpolated directly into HTML template literals without escaping. A CSV containing `<img src=x onerror=alert(1)>` in any text field will execute in the print window.
- **Fix**: Create `escapeHtml()` utility and apply to all interpolated values.
- **Effort**: 30 min

#### M-02: CSV export has formula injection vulnerability
- **Category**: Security
- **File**: `src/pages/FlightLogList.tsx:143-158`
- **Issue**: Values starting with `=`, `+`, `-`, `@`, `\t`, `\r` can trigger formula execution in Excel/Google Sheets. Current quoting is insufficient.
- **Fix**: Prefix dangerous-character values with a tab or single-quote character.
- **Effort**: 15 min

#### M-03: `handleUpload` missing try/catch on online path
- **Category**: Error Handling
- **File**: `src/components/LightAircraftLogUpload.tsx:43-75`
- **Issue**: `insertFlightLogs()` (line 62) can throw on network errors but the online code path has no try/catch wrapper. An unhandled promise rejection crashes the upload flow silently.
- **Fix**: Wrap lines 62-68 in try/catch, set error state.
- **Effort**: 10 min

#### M-04: No root-level Error Boundary
- **Category**: Error Handling
- **File**: `src/App.tsx`, `src/main.tsx`
- **Issue**: `MapErrorBoundary` protects the map, but an error in `LightAircraftLogUpload`, `Login`, or `FlightLogList` (outside the map) shows a blank white screen.
- **Fix**: Add a root `<ErrorBoundary>` in `App.tsx` or `main.tsx`.
- **Effort**: 20 min

#### M-05: Array mutation with `.reverse()`
- **Category**: Code Quality
- **File**: `src/pages/FlightLogList.tsx:40, 46`
- **Issue**: `cached.reverse()` mutates the array returned by IndexedDB. Called in two places with same pattern. Violates immutability expectations.
- **Fix**: Use `[...cached].reverse()` or explicit sort.
- **Effort**: 5 min

#### M-06: `useEffect` missing dependency
- **Category**: Code Quality
- **File**: `src/pages/FlightLogList.tsx:54-56`
- **Issue**: `loadLogs` referenced in `useEffect` but not in dependency array.
- **Fix**: Add eslint-disable comment or wrap in `useCallback`.
- **Effort**: 5 min

#### M-07: `window.confirm()` for delete confirmation
- **Category**: UX
- **File**: `src/pages/FlightLogList.tsx:124`
- **Issue**: Blocking synchronous dialog that cannot be styled, may be suppressed by browsers, and shows English OK/Cancel on Korean-language app.
- **Fix**: Replace with custom modal component.
- **Effort**: 1 hr

#### M-08: Supabase client created with potentially undefined env vars
- **Category**: Code Quality / Reliability
- **File**: `src/lib/supabase.ts:3-4`
- **Issue**: `import.meta.env.VITE_SUPABASE_URL` cast to `string` without null check. If env var is missing, `createClient` receives `undefined` and produces cryptic runtime errors.
- **Fix**: Add fallback or startup validation.
- **Effort**: 15 min

#### M-09: No rate limiting on Edge Functions
- **Category**: Security
- **File**: `supabase/functions/kakao-auth/index.ts`, `supabase/functions/naver-auth/index.ts`
- **Issue**: No request rate limiting, body size validation, or abuse prevention. Attacker can exhaust Kakao/Naver API quotas.
- **Fix**: Use Supabase API Gateway rate limits or add in-function throttling.
- **Effort**: 30 min

#### M-10: N+1 insert pattern for flight logs
- **Category**: Performance
- **File**: `src/lib/supabase-flight-log.ts:27-41`
- **Issue**: Each log inserted individually via `for` loop. 100 CSV rows = 100 sequential HTTP requests. Supabase supports batch insert.
- **Fix**: Use `.insert(logsArray)` with duplicate handling via `.onConflict()` or post-processing.
- **Effort**: 1 hr

---

### Minor (11 items - Nice to Have)

| # | Category | File | Issue | Fix |
|---|----------|------|-------|-----|
| m-01 | Code Quality | Edge Functions :79/:80 | Unused `user` variable declared but never read | Remove or use for logging |
| m-02 | Code Quality | TrainingInstitutionSelect.tsx:26 | `as Record<string, any>` cast | Define proper TypeScript type |
| m-03 | Performance | FlightLogList.tsx:390 | Dynamic Tailwind class `text-${align}` may be stripped by JIT | Use mapping object |
| m-04 | PWA | index.html | No `<link rel="apple-touch-icon">` | Add link tag |
| m-05 | Data | airfields.ts | 33 hardcoded airfields; Korea has ~60+ | Load from DB for updates |
| m-06 | Data Integrity | csv-parser-light.ts:86 | No date format validation on `flight_date` | Add YYYY-MM-DD regex |
| m-07 | UX | FlightLogList.tsx:177 | Plain text loading state instead of skeleton | Add table skeleton |
| m-08 | PWA | index.html:5 | Default Vite favicon | Create custom aviation icon |
| m-09 | Code Quality | csv-parser-light.ts:200-245 | `parseCsvString` duplicates `parseCsvFile` logic | Extract shared function |
| m-10 | Accessibility | index.html | No `<noscript>` fallback | Add noscript message |
| m-11 | UX | App.tsx | No persistent offline status indicator | Add banner/icon |

---

## Category Details

### 1. Code Quality (82%)

| Item | Status | Notes |
|------|:------:|-------|
| TypeScript strict mode | OK | `strict: true`, `noUnusedLocals`, `noUnusedParameters` |
| Consistent naming | OK | 100% convention compliance |
| Import organization | OK | External > internal > types pattern |
| Test coverage | FAIL | 0% -- no test files exist |
| DRY compliance | Warning | `parseCsvString` duplicates `parseCsvFile` |
| Unused variables | Warning | `user` in Edge Functions |
| Type safety | Warning | `as any` in TrainingInstitutionSelect |

### 2. Security (75%)

| Item | Status | Notes |
|------|:------:|-------|
| CSRF (OAuth) | OK | Both Kakao and Naver use `state` + `sessionStorage` |
| CORS (Edge Functions) | OK | Allowlist: `plane-log-chi.vercel.app` + `localhost:5173` |
| Env var exposure | OK | Only `VITE_*` (public OAuth IDs) exposed |
| `.gitignore` | OK | `.env`, `.env.local`, `.env.production` ignored |
| RLS policies | OK | Full CRUD restricted to `auth.uid()` |
| XSS in PDF | FAIL | Unsanitized HTML interpolation |
| CSV injection | FAIL | No formula prefix sanitization |
| Rate limiting | FAIL | No Edge Function rate limits |
| User enumeration | FAIL | `listUsers(1000)` pattern |

### 3. Performance (83%)

| Item | Status | Notes |
|------|:------:|-------|
| Code splitting | OK | FlightMap lazy-loaded |
| Memoization | OK | `useMemo` for filter/sort/airfield aggregation |
| Bundle size | OK | Minimal deps for MVP scope |
| N+1 inserts | FAIL | Sequential per-row INSERT |
| Dynamic Tailwind | Warning | May be stripped in production |

### 4. PWA Compliance (65%)

| Item | Status |
|------|:------:|
| Manifest (VitePWA) | OK |
| Service worker (Workbox) | OK |
| Runtime caching (Supabase API) | OK |
| Offline IndexedDB | OK |
| Reconnect sync | OK |
| PWA icons | FAIL |
| apple-touch-icon | FAIL |
| Custom favicon | FAIL |
| `<meta theme-color>` | OK |

### 5. Accessibility (40%)

| Item | Status |
|------|:------:|
| `lang="ko"` | OK |
| Color contrast | OK |
| ARIA labels | FAIL |
| Keyboard navigation | FAIL |
| `aria-sort` | FAIL |
| Screen reader live regions | FAIL |
| `<noscript>` | FAIL |
| Skip-to-content | FAIL |
| Focus management | Warning |

### 6. Error Handling (75%)

| Item | Status |
|------|:------:|
| Auth error display | OK |
| Upload error display | OK |
| Offline fallback | OK |
| Map error boundary | OK |
| Root error boundary | FAIL |
| Upload try/catch | FAIL |
| Edge Function errors | OK |
| Silent catch blocks | Warning (`offline-store.ts:89`) |

### 7. Data Integrity (88%)

| Item | Status |
|------|:------:|
| CSV header mapping (30+ variants) | OK |
| Required field validation (3 fields) | OK |
| Duplicate detection (23505) | OK |
| BOM handling | OK |
| Empty row skipping | OK |
| Training institution data (107 entries) | OK |
| Date format validation | Warning |

### 8. UX Completeness (82%)

| Item | Status |
|------|:------:|
| Login loading state | OK |
| Upload 5-state machine | OK |
| CSV preview (5 rows) | OK |
| Date range filters | OK |
| Column sorting | OK |
| PDF export | OK |
| CSV export (BOM-UTF8) | OK |
| Empty state messages | OK |
| Delete confirmation | Warning (uses `confirm()`) |
| Loading skeleton | Warning (plain text) |
| Offline indicator | Warning (none) |

---

## Architecture Assessment

### Folder Structure (Starter Level - Appropriate for Phase 1)

```
src/
  components/   4 files  (Login, FlightMap, LightAircraftLogUpload, TrainingInstitutionSelect)
  data/         2 files  (airfields.ts, training-institutions.json)
  lib/          7 files  (supabase, auth x3, CSV, offline, PDF)
  pages/        1 file   (FlightLogList)
  types/        1 file   (flight-log)
```

### Dependency Direction: No violations detected

All imports flow correctly: pages -> lib/components/types, components -> lib/data/types, lib -> types/other-lib, types -> nothing.

### Convention Compliance: 97%

Only deviation: `as any` cast in TrainingInstitutionSelect and mixed concerns in `supabase-flight-log.ts` (`calculateTotalHours` pure logic alongside DB operations).

---

## Recommended Actions

### Immediate (Before Production Deploy) -- ~3.5 hours

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | C-01: Add PWA icons | 15 min | PWA installability |
| 2 | M-01: HTML-escape PDF export | 30 min | XSS prevention |
| 3 | M-02: Sanitize CSV export | 15 min | CSV injection prevention |
| 4 | M-03: Add try/catch to upload | 10 min | Error handling |
| 5 | C-04: Fix Edge Function user lookup | 30 min | Scalability + security |
| 6 | M-04: Add root ErrorBoundary | 20 min | Crash resilience |
| 7 | M-05: Fix array mutation | 5 min | Code correctness |
| 8 | M-08: Env var validation | 15 min | Startup reliability |

### Short-Term (Next Sprint) -- ~6 hours

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 9 | C-02: Add unit tests | 2 hr | Test coverage 0% -> 60%+ |
| 10 | C-03: Accessibility fixes | 2 hr | WCAG compliance |
| 11 | M-07: Custom delete modal | 1 hr | UX polish |
| 12 | M-10: Batch INSERT | 1 hr | Upload performance |
| 13 | m-03: Fix dynamic Tailwind | 10 min | Production CSS |
| 14 | m-04: Add apple-touch-icon | 5 min | iOS PWA |

### Medium-Term (Phase 2 Prep)

| # | Item | Effort |
|---|------|--------|
| 15 | m-09: DRY refactor CSV parser | 30 min |
| 16 | m-06: Date format validation | 30 min |
| 17 | m-11: Offline status indicator | 1 hr |
| 18 | m-07: Loading skeletons | 1 hr |
| 19 | Upgrade to Dynamic folder structure | 2 hr |
| 20 | Separate `calculateTotalHours` to pure utility | 15 min |

---

## Comparison with v1.0 Analysis

| v1.0 Issue | Status in v2.0 |
|------------|:--------------:|
| `listUsers(1000)` in Edge Functions | Still open (C-04) |
| Missing Kakao CSRF state | Fixed |
| CORS unrestricted | Fixed (allowlist in place) |
| TrainingInstitutionSelect not integrated | Fixed |
| Pending upload no auto-sync | Fixed (`registerReconnectSync`) |
| Duplicate CSV parser logic | Still open (m-09) |

### New Issues Found in v2.0

| # | New Since v1.0 | Category |
|---|----------------|----------|
| M-01 | XSS in new PDF export feature | Security |
| M-02 | CSV injection in new CSV export feature | Security |
| C-02 | Test file removed since v1.0 | Code Quality |
| C-03 | Accessibility (not measured in v1.0) | Accessibility |
| C-01 | PWA icons (not measured in v1.0) | PWA |
| M-10 | N+1 insert (promoted from v1.0 note to Major) | Performance |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-14 | Initial gap analysis (Plan vs Implementation) | gap-detector |
| 2.0 | 2026-03-15 | Comprehensive 8-category analysis; 25 gap items; added security, a11y, PWA, performance categories | gap-detector |

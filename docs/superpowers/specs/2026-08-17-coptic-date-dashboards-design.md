# Design — Coptic date on the main dashboards

**Date:** 2026-08-17
**Status:** Approved

## Goal

Show the current **Coptic calendar date** (Coptic month, day, and year) alongside the existing **Gregorian** date on the four main dashboards (admin, servant, parent, student) so users always see today's Coptic liturgical date at a glance.

## Scope

- Frontend only. No backend, no schema, no API changes.
- Three hero date lines in `frontend/src/app/dashboard/dashboard-client.tsx` (admin+student share one, plus servant, plus parent).
- One new helper module with unit tests.
- Not in scope: the `/portal` Parent Portal, the take-flow pages, or any other page.

## Surfaces

| Dashboard | Category | Location (dashboard-client.tsx) | Current display |
|-----------|----------|-------------------------------|-----------------|
| Admin + Student | `management` | `HeroSection` badges (line 274) | Gregorian |
| Servant / Ministry | `ministry` | `MinistryDashboard` badges (line 1961) | Gregorian |
| Parent | `parent` | `ParentDashboard` badges (line 2586) | Gregorian |

All three currently render the identical expression:
```
{lang === 'ar' ? getDayNameAr() : getDayName()}
```

## Behavior / output format

The existing Gregorian line is replaced by a combined line:

- English: `Tuesday, 17 August 2026 · 11 Mesori 1742 AM`
- Arabic: `الثلاثاء، ١٧ أغسطس ٢٠٢٦ · ١١ مسرى ١٧٤٢ للشهداء`

Separator is ` · ` (U+00B7). The Coptic portion appends the Gregorian line; there is no other UI change.

## Core: Coptic calendar helper

Add two exported functions to `frontend/src/lib/datetime.ts`:

### `getCopticDate(d = new Date()): { day: number; month: number; year: number }`

Gregorian → Coptic conversion using the Julian Day Number method:

1. Compute the Julian Day Number of the Gregorian date `(y, m 1–12, d 1–31)`:
   ```
   a = floor((14 − m) / 12)
   y2 = y + 4800 − a
   m2 = m + 12·a − 3
   jdn = d + floor((153·m2 + 2) / 5) + 365·y2 + floor(y2/4) − floor(y2/100) + floor(y2/400) − 32045
   ```
2. Coptic epoch (Thout 1, AM 1) Julian Day Number: **1,825,030**.
   ```
   n = jdn − 1_825_030            // days since Coptic epoch, n ≥ 0
   yearIndex = floor((4·n + 3) / 1461)   // 0-based
   yday = n − floor((1461·yearIndex) / 4)  // 0-based day of the Coptic year
   month = floor(yday / 30) + 1      // 1–13
   day = (yday % 30) + 1             // 1–30 (months 1–12), 1–5/6 (month 13)
   return { year: yearIndex + 1, month, day }
   ```

### `getFullDay(lang: 'en' | 'ar', d = new Date()): string`

Returns the combined Gregorian + Coptic string. Bilingual:

- Builds the Gregorian part with the existing `getDayName()` / `getDayNameAr()`.
- Builds the Coptic part as `{day} {monthName} {year}{eraSuffix}`:
  - English: `11 Mesori 1742 AM` (era suffix ` AM`)
  - Arabic: `١١ مسرى ١٧٤٢ للشهداء` (era suffix ` للشهداء`, Arabic-Indic digits, Arabic month name)

Month name arrays (index = month − 1):

| # | English (Bohairic transliteration) | Arabic |
|---|-----------------------------------|--------|
| 1 | Thout | توت |
| 2 | Paopi | بابه |
| 3 | Hathor | هاتور |
| 4 | Koiak | كيهك |
| 5 | Tobi | طوبة |
| 6 | Meshir | أمشير |
| 7 | Paremhat | برمهات |
| 8 | Paremoude | برمودة |
| 9 | Pashons | بشنس |
| 10 | Paoni | بؤونة |
| 11 | Epip | أبيب |
| 12 | Mesori | مسرى |
| 13 | Pi Kogi Enavot | نسيء |

Arabic numerals use Arabic-Indic digits (`toLocaleString('ar-EG')`); the Coptic day and year are formatted the same way.

## Validation / tests

Add `frontend/src/lib/datetime.test.ts` (or extend the existing datetime test file if present) asserting `getCopticDate` against authoritative reference dates, all verified against published Coptic calendar data and Wikipedia:

| Gregorian date | Expected Coptic | Notes |
|----------------|-----------------|-------|
| 2026-08-17 | 11 Mesori 1742 | today; JDN 2461270 |
| 2026-09-11 | 1 Thout 1743 | Nayrouz (Coptic New Year) |
| 2026-06-06 | 29 Pashons 1742 | Wikipedia anchor; JDN 2461198 |
| 2026-09-06 | 1 Pi Kogi Enavot 1742 | start of the 13th (epagomenal) month |

Also assert:
- `getFullDay('en')`/`getFullDay('ar')` contain the expected Coptic fragment for a fixed date.
- The `getFullDay` Gregorian portion still matches `getDayName`/`getDayNameAr`.
- Month 13 handling (epagomenal day 6 in a Coptic leap year) — a reference value for a leap-year end date is covered if a stable anchor is available; otherwise the structure test (month ≤ 13) is sufficient. (No hard requirement; the four anchors above are the required tests.)

## Component changes

In `dashboard-client.tsx`, replace each of the three identical date expressions (`lang === 'ar' ? getDayNameAr() : getDayName()`) with `getFullDay(lang)`:

- Import `getFullDay` alongside the existing datetime imports (line ~26).
- Apply at lines 274 (admin/student), 1961 (servant), 2586 (parent).

No other component, styling, or layout changes.

## Error handling

- `getCopticDate` is deterministic and pure for any valid JS `Date`. No I/O, no exceptions for in-range dates. No fallback UI required.
- `getFullDay` delegates the Gregorian formatting to the existing, already-tested helpers.

## Testing strategy

- **Unit:** `datetime.test.ts` covers the conversion algorithm and the combined formatting (above).
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run` green (from `frontend/`). No backend tests.

## Out of scope

- The `/portal` Parent Portal date line (unchanged).
- Localization beyond English/Arabic already used by the app.
- Adding Coptic dates to any non-dashboard pages, reports, or exports.
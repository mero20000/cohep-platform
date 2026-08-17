# Coptic Date on Main Dashboards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the current Coptic calendar date (month, day, year) alongside the existing Gregorian date on the admin, servant, and parent dashboards.

**Architecture:** Add a pure Gregorian→Coptic conversion helper plus a bilingual combined-date formatter to `src/lib/datetime.ts`, then replace the three identical hero date lines in `dashboard-client.tsx` with the new helper. Frontend only; no backend changes.

**Tech Stack:** TypeScript, React (Next.js), Vitest. No new dependencies.

## Global Constraints

- Frontend only. Run `npx tsc --noEmit` (must be clean) and `npx vitest run` (must be green) from `frontend/`. Do NOT run backend tests.
- Coptic epoch Julian Day Number = **1,825,030** (Thout 1, AM 1).
- Coptic year = 12 months × 30 days + 13th epagomenal month (5–6 days). Month numbering is 1–13.
- English month names: `Thout, Paopi, Hathor, Koiak, Tobi, Meshir, Paremhat, Paremoude, Pashons, Paoni, Epip, Mesori, Pi Kogi Enavot`.
- Arabic month names: `توت, بابه, هاتور, كيهك, طوبة, أمشير, برمهات, برمودة, بشنس, بؤونة, أبيب, مسرى, نسيء`.
- Combined format: Gregorian line + ` · ` + Coptic. English Coptic fragment: `11 Mesori 1742 AM`. Arabic Coptic fragment: `١١ مسرى ١٧٤٢ للشهداء` (Arabic-Indic digits).
- Work directly on `main`. Before pushing: `git pull --rebase --autostash`. Commit after each task; push after review.

---

### Task 1: Coptic calendar helpers + tests

**Files:**
- Modify: `frontend/src/lib/datetime.ts`
- Test: `frontend/src/lib/datetime.test.ts`

**Interfaces:**
- Produces:
  - `getCopticDate(d?: Date): { day: number; month: number; year: number }`
  - `getFullDay(lang: 'en' | 'ar', d?: Date): string`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/lib/datetime.test.ts`:

```ts
import { getGreeting, getGreetingAr, getDayName, getDayNameAr, getCopticDate, getFullDay } from './datetime'
```
Replace the existing import line with the line above.

Append inside the `describe('datetime helpers', ...)` block (after the last `it`):

```ts
  describe('Coptic calendar', () => {
    const cases: Array<[string, number, number, number]> = [
      ['2026-08-17', 12, 11, 1742], // 11 Mesori 1742
      ['2026-09-11', 1, 1, 1743],   // 1 Thout 1743 (Nayrouz)
      ['2026-06-06', 9, 29, 1742],  // 29 Pashons 1742
      ['2026-09-06', 13, 1, 1742],  // 1 Pi Kogi Enavot 1742 (epagomenal month)
    ]
    it.each(cases)('converts %s to Coptic month %i day %i year %i', (iso, month, day, year) => {
      const [yy, mm, dd] = iso.split('-').map(Number)
      const res = getCopticDate(new Date(yy, mm - 1, dd, 12, 0, 0))
      expect(res).toEqual({ day, month, year })
    })

    it('formats the combined bilingual day with the Coptic fragment', () => {
      const d = new Date(2026, 7, 17, 12, 0, 0)
      const en = getFullDay('en', d)
      expect(en).toContain('17 August 2026')
      expect(en).toContain('11 Mesori 1742 AM')
      const ar = getFullDay('ar', d)
      expect(ar).toContain('مسرى')
      expect(ar).toContain('للشهداء')
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/datetime.test.ts`
Expected: FAIL — `getCopticDate is not defined` / `getFullDay is not defined`.

- [ ] **Step 3: Write the implementation**

Append to `frontend/src/lib/datetime.ts`:

```ts
const COPTIC_MONTHS_EN = [
  'Thout', 'Paopi', 'Hathor', 'Koiak', 'Tobi', 'Meshir',
  'Paremhat', 'Paremoude', 'Pashons', 'Paoni', 'Epip', 'Mesori', 'Pi Kogi Enavot',
]
const COPTIC_MONTHS_AR = [
  'توت', 'بابه', 'هاتور', 'كيهك', 'طوبة', 'أمشير',
  'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'نسيء',
]
const COPTIC_EPOCH_JDN = 1_825_030

export function getCopticDate(d = new Date()): { day: number; month: number; year: number } {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const dd = d.getDate()

  const a = Math.floor((14 - m) / 12)
  const y2 = y + 4800 - a
  const m2 = m + 12 * a - 3
  const jdn =
    dd + Math.floor((153 * m2 + 2) / 5) + 365 * y2 +
    Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045

  const n = jdn - COPTIC_EPOCH_JDN
  const yearIndex = Math.floor((4 * n + 3) / 1461)
  const yday = n - Math.floor((1461 * yearIndex) / 4)
  const month = Math.floor(yday / 30) + 1
  const day = (yday % 30) + 1

  return { day, month, year: yearIndex + 1 }
}

export function getFullDay(lang: 'en' | 'ar', d = new Date()): string {
  const gregorian = lang === 'ar' ? getDayNameAr('ar-EG', d) : getDayName('en-GB', d)
  const c = getCopticDate(d)
  const monthName = lang === 'ar' ? COPTIC_MONTHS_AR[c.month - 1] : COPTIC_MONTHS_EN[c.month - 1]
  const num = (v: number) => (lang === 'ar' ? v.toLocaleString('ar-EG') : String(v))
  const era = lang === 'ar' ? ' للشهداء' : ' AM'
  return `${gregorian} · ${num(c.day)} ${monthName} ${num(c.year)}${era}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/datetime.test.ts`
Expected: PASS. Then run `npx tsc --noEmit` (must be clean).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/datetime.ts frontend/src/lib/datetime.test.ts
git commit -m "feat(datetime): add Coptic calendar helpers and bilingual day formatting"
```

---

### Task 2: Wire Coptic date into the three dashboards

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx`
  - import line ~26
  - line ~274 (admin/student `HeroSection` badges)
  - line ~1961 (servant `MinistryDashboard` badges)
  - line ~2586 (parent `ParentDashboard` badges)

**Interfaces:**
- Consumes: `getFullDay(lang: 'en' | 'ar', d?: Date): string` from Task 1.
- Produces: no new exports.

- [ ] **Step 1: Update the import**

Find:
```ts
import { getGreeting, getGreetingAr, getDayName, getDayNameAr } from '@/lib/datetime'
```
Replace with:
```ts
import { getGreeting, getGreetingAr, getFullDay } from '@/lib/datetime'
```
(`getDayName`/`getDayNameAr` become unused after the three call sites below are replaced; removing them keeps `noUnusedLocals` clean.)

- [ ] **Step 2: Replace the three date expressions**

Each of the following identical expressions becomes `{getFullDay(lang)}`:

1. `HeroSection` badges (admin/student), ~line 274:
   ```tsx
   <p className="text-gray-400 text-sm">{lang === 'ar' ? getDayNameAr() : getDayName()}</p>
   ```
   → ` <p className="text-gray-400 text-sm">{getFullDay(lang)}</p>`

2. `MinistryDashboard` badges (servant), ~line 1961:
   ```tsx
   <p className="text-white/60 text-sm">{lang === 'ar' ? getDayNameAr() : getDayName()}</p>
   ```
   → ` <p className="text-white/60 text-sm">{getFullDay(lang)}</p>`

3. `ParentDashboard` badges (parent), ~line 2586:
   ```tsx
   const parentBadges = <p className="text-white/60 text-sm">{lang === 'ar' ? getDayNameAr() : getDayName()}</p>
   ```
   → ` const parentBadges = <p className="text-white/60 text-sm">{getFullDay(lang)}</p>`

  In each, `lang` is already in scope (a `useLanguage()` call exists in the enclosing component).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (must be clean).
Run: `npx vitest run` (must be green).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx
git commit -m "feat(dashboard): show Coptic date alongside Gregorian date in heroes"
```

---

## Verification (post-plan)

Run from `frontend/`:
```bash
npx tsc --noEmit
npx vitest run
```
Expected: tsc clean; all Vitest tests pass (the new Coptic tests included). Then push the two commits to `origin/main` with `git pull --rebase --autostash` first.
# Unified Dashboard Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a single shared `<DashboardHero>` component and rebuild all three role heroes (admin, ministry, parent) on it, so they share one structural shell and scroll parallax, differing only by background color + role content.

**Architecture:** A new presentational client component `frontend/src/app/dashboard/hero.tsx` owns the hero shell (rounded wrapper, color token, parallax orbs/curve via `motion/react`, dot-grid overlay, header row with greeting/title/badges + logos slot, children slot). Each dashboard renders it with a `bg` prop and its own role content. Small greeting/day helpers move to a shared `frontend/src/lib/datetime.ts` so the shell component can default the greeting without importing from the page.

**Tech Stack:** React 19 client component, Next.js, `motion/react` (useScroll/useSpring/useTransform/useReducedMotion), Tailwind CSS vars (`--hymn-navy/green/indigo`), lucide-react, shared UI components, Vitest + Testing Library.

## Global Constraints

- Test framework: Vitest (jsdom, globals: true, setup `src/test/setup.ts`, includes `**/*.test.{ts,tsx}`). Run with `npm test` (`vitest run`).
- Type check: `npm run type-check` (`tsc --noEmit`). Must pass.
- Lint: `npm run lint` (`eslint src`). Must pass.
- Frontend working dir for all commands: `frontend/`.
- Do NOT change data flow or API calls. `hero.tsx` is presentational only.
- Preserve existing look and behavior exactly; only the shell is refactored.
- Existing color tokens (light/dark in `globals.css`) are reused verbatim: `--hymn-navy` (admin), `--hymn-green` (ministry), `--hymn-indigo` (parent).
- No new dependencies.

---

### Task 1: Extract shared day/greeting helpers to `lib/datetime.ts`

**Files:**
- Create: `frontend/src/lib/datetime.ts`
- Test: `frontend/src/lib/datetime.test.ts`
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx:98-101` (remove local defs, import from lib)

**Interfaces:**
- Produces: exports `getGreeting(): string`, `getGreetingAr(): string`, `getDayName(): string`, `getDayNameAr(): string` — same behavior as the current locals.

- [ ] **Step 1: Write the failing test**

`frontend/src/lib/datetime.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getGreeting, getGreetingAr, getDayName, getDayNameAr } from './datetime'

describe('datetime helpers', () => {
  it('returns a known greeting for every hour', () => {
    ;[0, 6, 11, 12, 16, 17, 23].forEach((h) => {
      const g = getGreeting(h)
      expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(g)
    })
  })

  it('returns Arabic greetings', () => {
    expect(['صباح الخير', 'مساء الخير']).toContain(getGreetingAr(9))
    expect(['مساء الخير']).toContain(getGreetingAr(20))
  })

  it('formats a full date string', () => {
    const d = new Date(2026, 7, 7, 12, 0, 0)
    expect(getDayName('en-GB', d)).toMatch(/\d{4}/)
    expect(getDayNameAr('ar-EG', d)).toContain('2026')
  })
})
```

> The helpers below take an optional hour / Date for testability, defaulting to `now`. TypeScript signature must stay source-compatible with the existing call sites.

- [ ] **Step 2: Run the test to verify it fails**

Run in `frontend/`: `npx vitest run src/lib/datetime.test.ts`
Expected: FAIL with "Failed to resolve import './datetime'".

- [ ] **Step 3: Implement the minimal module**

`frontend/src/lib/datetime.ts`:

```ts
export function getGreeting(h = new Date().getHours()) {
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getGreetingAr(h = new Date().getHours()) {
  if (h < 12) return 'صباح الخير'
  return 'مساء الخير'
}

export function getDayName(locale = 'en-GB', d = new Date()) {
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function getDayNameAr(locale = 'ar-EG', d = new Date()) {
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
```

> NOTE: The original `getGreetingAr(20)` also returned 'مساء الخير' — the test above asserts that; keep the same strings the app already used.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/datetime.test.ts`
Expected: PASS.

- [ ] **Step 5: Point the page at the shared helpers**

In `frontend/src/app/dashboard/dashboard-client.tsx`:
1. Add import (after the `@/lib/school` import on line 25): `import { getGreeting, getGreetingAr, getDayName, getDayNameAr } from '@/lib/datetime'`
2. Delete the four local function definitions (lines 98-101: `getGreeting`, `getGreetingAr`, `getDayName`, `getDayNameAr`) — the import satisfies all existing call sites.

- [ ] **Step 6: Verify typing and existing tests**

Run: `npm run type-check`
Run: `npm test`
Expected: type-check passes; existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/datetime.ts frontend/src/lib/datetime.test.ts frontend/src/app/dashboard/dashboard-client.tsx
git commit -m "refactor(dashboard): extract datetime helpers to shared lib"
```

---

### Task 2: Create the shared `DashboardHero` component

**Files:**
- Create: `frontend/src/app/dashboard/hero.tsx`
- Test: `frontend/src/app/dashboard/hero.test.tsx`

**Interfaces:**
- Consumes: `useLanguage()` from `@/lib/use-language` (`'en' | 'ar'`), `getGreeting()`/`getGreetingAr()` from `@/lib/datetime`, `motion/react` hooks, `Sun` from `lucide-react`.
- Produces: default export `DashboardHero({ bg, greeting?, title, badges?, logos?, children? }: DashboardHeroProps)`. `bg` is the CSS variable string, `title` is required, everything else optional. Renders the full hero shell.

- [ ] **Step 1: Write the failing test**

`frontend/src/app/dashboard/hero.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import DashboardHero from './hero'

vi.mock('motion/react', () => {
  const React = require('react')
  const DomDiv = ({ children, style }: any) => React.createElement('div', { 'data-motion': '', style }, children)
  return {
    motion: { div: DomDiv },
    useScroll: () => ({ scrollY: { get: () => 0 } }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: (v: any) => v,
    useReducedMotion: () => true,
  }
})

vi.mock('lucide-react', () => ({
  Sun: (p: any) => <span data-testid="icon-sun" {...p} />,
}))

vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))

vi.mock('@/lib/datetime', () => ({
  getGreeting: () => 'Good morning',
  getGreetingAr: () => 'صباح الخير',
}))

describe('DashboardHero', () => {
  it('renders title, logos, badges and children', () => {
    render(
      <DashboardHero
        bg="var(--hymn-green)"
        title="My School"
        greeting={<span>Hi there</span>}
        badges={<span data-testid="badge">Badge</span>}
        logos={<span data-testid="logo">Logo</span>}
      >
        <div data-testid="stats">stat grid</div>
      </DashboardHero>,
    )
    expect(screen.getByRole('heading', { name: 'My School' })).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByTestId('logo')).toBeInTheDocument()
    expect(screen.getByTestId('stats')).toBeInTheDocument()
  })

  it('renders a default greeting with the Sun icon when no greeting prop is given', () => {
    render(<DashboardHero bg="var(--hymn-navy)" title="Platform" />)
    expect(screen.getByText('Good morning')).toBeInTheDocument()
    expect(screen.getByTestId('icon-sun')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run in `frontend/`: `npx vitest run src/app/dashboard/hero.test.tsx`
Expected: FAIL — "Failed to resolve import './hero'".

- [ ] **Step 3: Implement the component**

`frontend/src/app/dashboard/hero.tsx`:

```tsx
'use client'

import { ReactNode } from 'react'
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react'
import { useLanguage } from '@/lib/use-language'
import { getGreeting, getGreetingAr } from '@/lib/datetime'
import { Sun } from 'lucide-react'

export interface DashboardHeroProps {
  bg: string
  title: ReactNode
  greeting?: ReactNode
  badges?: ReactNode
  logos?: ReactNode
  children?: ReactNode
}

export default function DashboardHero({
  bg,
  title,
  greeting,
  badges,
  logos,
  children,
}: DashboardHeroProps) {
  const lang = useLanguage()
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const springConfig = { stiffness: 80, damping: 20, mass: 0.5 }
  const orb1Y = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : -15]), springConfig)
  const orb2Y = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : 20]), springConfig)
  const curveY = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : -6]), springConfig)

  return (
    <div className="relative overflow-hidden rounded-b-[2rem] p-6 sm:p-8" style={{ backgroundColor: bg }}>
      <motion.div className="absolute -top-6 left-1/2 -translate-x-1/2 w-[120%] h-12 rounded-[50%] bg-blue-500/5" style={{ y: curveY }} />
      <motion.div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" style={{ y: orb1Y }} />
      <motion.div className="absolute bottom-0 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" style={{ y: orb2Y }} />
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:20px_20px]" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-gold-400 text-sm font-medium mb-2">
            {greeting ?? (
              <>
                <Sun className="h-4 w-4" />
                <span>{lang === 'ar' ? getGreetingAr() : getGreeting()}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
          {badges && <div className="flex items-center gap-2 mt-1.5">{badges}</div>}
        </div>
        {logos && <div className="flex items-center gap-4 shrink-0">{logos}</div>}
      </div>

      {children && <div className="relative mt-6">{children}</div>}
    </div>
  )
}
```

> The scroll `useTransform` gadget stays inside the motion-wrapped `<div>`s to keep jsdom rendering simple; `useReducedMotion` gates it so reduced-motion users get static orbs, matching current behavior.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/dashboard/hero.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/hero.tsx frontend/src/app/dashboard/hero.test.tsx
git commit -m "feat(dashboard): add shared DashboardHero component with parallax shell"
```

---

### Task 3: Refactor the admin hero to use `DashboardHero`

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx` (function `HeroSection`, currently lines 256-329)

**Interfaces:**
- Consumes: `DashboardHero` from `./hero`; existing `HeroFallback`, `AnimatedCounter`, `useLanguage`, `getSchoolId`, icons.

- [ ] **Step 1: Import the component and trim motion hooks**

Add after line 26 (`import ... from '@/lib/use-active-role'`):

```tsx
import DashboardHero from './hero'
```

Change line 8 (`import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react'`) to import only `motion` — the four scroll/spring/reduced-motion hooks move into `hero.tsx` and are no longer used in this file:

```tsx
import { motion } from 'motion/react'
```

- [ ] **Step 2: Rewrite `HeroSection`**

Replace the whole `HeroSection` body (return at lines ~266-327) so the shell delegates to `DashboardHero` and only the role content remains:

```tsx
function HeroSection({ stats, churchLogo, churchName, loading }) {
  const lang = useLanguage()
  if (loading && !stats) return <HeroFallback />
  const s = stats ?? EMPTY_STATS
  const greetingText = lang === 'ar' ? getGreetingAr() : getGreeting()
  const title =
    s.school?.name || (lang === 'ar' ? 'منصة تعليم التراتيل الكنسية' : 'Coptic Orthodox Hymn Education Platform')

  const badges = (
    <>
      {churchName && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
          {churchName}
        </span>
      )}
      <p className="text-gray-400 text-sm">{lang === 'ar' ? getDayNameAr() : getDayName()}</p>
    </>
  )

  const logos = (
    <>
      {churchLogo && (
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
          <Image src={churchLogo} alt="Church Logo" width={100} height={100}
            className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
        </div>
      )}
      {s.school?.logoUrl && (
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
          <Image src={(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '') + s.school.logoUrl}
            alt="School Logo" width={100} height={100}
            className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
        </div>
      )}
    </>
  )

  const stats = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {([
        { label: 'Active Students', labelAr: 'الطلاب النشطون', value: s.activeStudents ?? 0, icon: Users },
        { label: 'Attendance', labelAr: 'الحضور', value: s.attendanceRate ?? 0, suffix: '%', icon: UserCheck },
        { label: 'Levels', labelAr: 'المستويات', value: s.totalLevels ?? 0, icon: Layers },
        { label: 'Assessments', labelAr: 'التقييمات', value: s.publishedAssessments ?? 0, icon: ClipboardCheck },
        { label: 'Pass Rate', labelAr: 'نسبة النجاح', value: s.assessmentStats?.passRate ?? 0, suffix: '%', icon: TrendingUp },
      ] as const).map((item) => (
        <div key={item.label} className="group rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
          <div className="flex items-center gap-2 mb-1">
            <item.icon className="h-3.5 w-3.5 text-gold-400 group-hover:scale-110 group-active:scale-110 transition-transform duration-300" />
            <span className="text-[11px] text-gray-400">{lang === 'ar' ? (item as any).labelAr : item.label}</span>
          </div>
          <div className="text-xl font-bold text-white tracking-wider group-hover:text-gold-300 transition-colors">
            <AnimatedCounter value={item.value} suffix={'suffix' in item ? (item as any).suffix || '' : ''} />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <DashboardHero
      bg="var(--hymn-navy)"
      title={title}
      greeting={
        <>
          <Sun className="h-4 w-4" />
          <span>{greetingText}</span>
        </>
      }
      badges={badges}
      logos={logos}
    >
      {stats}
    </DashboardHero>
  )
}
```

> The original top curve and parallax orbs are now owned by `DashboardHero`, so they are intentionally absent here.

- [ ] **Step 3: Run existing tests + type-check + lint**

Run: `npm test`
Run: `npm run type-check`
Run: `npm run lint`
Expected: all pass; `users`, `Sun`, `AnimatedCounter`, `Image`, `getDayName*` still imported/used (no unused-import lint errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx
git commit -m "refactor(dashboard): rebuild admin hero on shared DashboardHero"
```

---

### Task 4: Refactor the ministry hero to use `DashboardHero`

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx` (`MinistryDashboard` hero, currently lines ~1143-1201)

**Interfaces:**
- Consumes: `DashboardHero`, `RoleBadge`/`StartClassCard` (unchanged), icons.

- [ ] **Step 1: Rewrite the ministry hero block**

Replace the inline `<div className="relative overflow-hidden rounded-b-[2rem] bg-[var(--hymn-green)] ...">...` block (lines ~1143-1201) with:

```tsx
const ministryBadges = (
  <>
    {churchName && (
      <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
        {churchName}
      </span>
    )}
    <p className="text-white/60 text-sm">{lang === 'ar' ? getDayNameAr() : getDayName()}</p>
    <RoleBadge role={d.role || 'servant'} lang={lang} />
  </>
)

const ministryLogos = (
  <>
    {churchLogo && (
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
        <Image src={churchLogo} alt="Church Logo" width={100} height={100}
          className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
      </div>
    )}
    {schoolLogo && (
      <div className="relative shrink-0">
        <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
        <Image src={schoolLogo} alt="School Logo" width={100} height={100}
          className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
      </div>
    )}
  </>
)

const ministryStats = (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {([
      { label: 'My Students', labelAr: 'طلابي', value: d.studentsCount ?? 0, icon: Users },
      { label: 'My Groups', labelAr: 'مجموعاتي', value: groups.length, icon: UserCog },
      { label: 'Attendance', labelAr: 'الحضور', value: d.attendanceRate ?? 0, suffix: '%', icon: UserCheck },
      { label: 'Sessions to Run', labelAr: 'جلسات للتشغيل', value: sessions.length, icon: CalendarClock },
    ] as const).map((item) => (
      <div key={item.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <item.icon className="h-3.5 w-3.5 text-gold-400" />
          <span className="text-[11px] text-white/60">{lang === 'ar' ? (item as any).labelAr : item.label}</span>
        </div>
        <div className="text-xl font-bold text-white tracking-wider">
          <AnimatedCounter value={item.value} suffix={'suffix' in item ? (item as any).suffix || '' : ''} />
        </div>
      </div>
    ))}
  </div>
)
```

Then render the hero via:

```tsx
<DashboardHero
  bg="var(--hymn-green)"
  title={
    school?.name || (lang === 'ar' ? 'منصة تعليم التراتيل الكنسية' : 'Coptic Orthodox Hymn Education Platform')
  }
  badges={ministryBadges}
  logos={ministryLogos}
>
  {ministryStats}
</DashboardHero>
```

> Keep the `StartClassCard` block and the "not assigned" amber banner where they already live (below the hero). Do not touch them.

- [ ] **Step 2: Run tests + type-check + lint**

```
cd frontend && npm test && npm run type-check && npm run lint
```
Expected: passes; `StartClassCard` and the "not assigned" amber banner remain in the page (below the hero) unchanged.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx
git commit -m "refactor(dashboard): rebuild ministry hero on shared DashboardHero"
```

---

### Task 5: Refactor the parent hero to use `DashboardHero`

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx` (`ParentDashboard` hero, currently lines 1718-1733)

**Interfaces:**
- Consumes: `DashboardHero`, `Baby` icon, `lang`.

- [ ] **Step 1: Rewrite the parent hero**

Replace the inline `<div className="relative overflow-hidden rounded-b-[2rem] bg-[var(--hymn-indigo)] ...">` block (lines ~1718-1733) with:

```tsx
const parentGreeting = (
  <>
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
      <Baby className="h-5 w-5 text-gold-300" />
    </div>
    <span>{lang === 'ar' ? getGreetingAr() : getGreeting()}</span>
  </>
)

const parentBadges = <p className="text-white/60 text-sm">{lang === 'ar' ? getDayNameAr() : getDayName()}</p>
```

Then render:

```tsx
<DashboardHero
  bg="var(--hymn-indigo)"
  title={lang === 'ar' ? 'أولادي' : 'My Children'}
  greeting={parentGreeting}
  badges={parentBadges}
/>
```

> No `children` is passed for parent (it has no in-hero stat grid today) and no `logos` (parent payload has none).

- [ ] **Step 2: Run tests + type-check + lint**

```
cd frontend && npm test && npm run type-check && npm run lint
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx
git commit -m "refactor(dashboard): rebuild parent hero on shared DashboardHero"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full check**

```
cd frontend && npm test && npm run type-check && npm run lint
```
Expected: all pass.

- [ ] **Step 2: Confirm no stray hero duplication**

Grep for the old inline patterns; expect no matches:
```
grep -rn "hymn-navy\|hymn-green\|hymn-indigo" frontend/src/app/dashboard/dashboard-client.tsx
```
Only the three `<DashboardHero bg="..."` lines + fallbacks remain.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(dashboard): verify unified hero shell"
```

## Self-Review

**Spec coverage:**
- Structural shell extraction → Task 2 (`hero.tsx`) + Tasks 3-5 (rebuild each hero).
- Parallax added to ministry & parent → Task 2 component owns parallax; all three heroes pass through it.
- Per-role content preserved → each task passes role badges/logos/stats as props; parent gets no stat grid (spec).
- Keep 3 color tokens → each task passes `var(--hymn-*)`.
- Fallbacks/loading unchanged → Task 3 keeps `HeroFallback`, Tasks 4-5 keep `StartClassCard` & `ChildCard`; no fallback edits planned.
- Datetime helpers shared → Task 1.

**Placeholder scan:** no TBD/TODO; every code step has a full code block. Removed vague "similar to Task N" language.

**Type consistency:** `DashboardHeroProps` (bg:string, title:ReactNode, greeting/badges/logos/children?: ReactNode) defined in Task 2 and used identically in Tasks 3-5. `getGreeting(h)`/`getGreetingAr(h)`/`getDayName(locale,d)` signatures from Task 1 match Task 3-4 call sites (`getGreeting()`, `getDayNameAr()` with no args still valid via defaults).
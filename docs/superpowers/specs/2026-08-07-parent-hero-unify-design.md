# Design Spec: Unify Parent Hero & Parent Portal onto DashboardHero

- Date: 2026-08-07
- Status: Approved
- Depends on: shared `DashboardHero` from `2026-08-07-dashboard-hero-unify-design.md`
- Frontend repo: `frontend/` under `niangelos-platform`

## 1. Problem

The shared `DashboardHero` now unifies the three role dashboards (admin, ministry, parent) in `/dashboard`. But the **parent surfaces outside `/dashboard` still use hand-rolled headers** that don't match:

- **Parent Portal home** (`/portal`) — `frontend/src/app/portal/page.tsx` (~140-163): inline `bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900` hero with church/school identity chips.
- **Dashboard parents page** (`/dashboard/parents`) — `frontend/src/app/dashboard/parents/page.tsx` (~129-163): near-identical inline hero.
- **Child detail overview** (`/portal/children/[id]`) — a **white card** header, not a hero.
- **Practice guide** (`/portal/children/[id]/practice-guide`) — a plain text header.

A parent sees three different header treatments across these pages. This spec extends `DashboardHero` and converts all of these surfaces onto it.

## 2. Design decisions (agreed)

1. **Extend `DashboardHero`**, do not create a separate parent component. Add two optional presentational props: `avatar` and `description`.
2. **The immersive child view (`/portal/children/[id]/home`) stays distinct.** It is a deliberate full-screen dark Gamified "child's view" (streaks, challenges). Not touched.
3. **The child `[id]` overview and practice-guide become dark unified heroes** (matching portal home), using the child photo/initials as the avatar.
4. **Out of scope:** `/portal/login`, `/portal/settings`, non-hero dashboard sub-pages. The existing `/dashboard` parent route is already wired.

## 3. DashboardHero API extension

File: `frontend/src/app/dashboard/hero.tsx`

Add two **optional** props to `DashboardHeroProps`:

- `avatar?: ReactNode` — rendered to the LEFT of the title column, as a rounded framed tile (`shrink-0`). The consumer supplies the fixed-size inner content (e.g. `h-14 w-14` image or initials).
- `description?: ReactNode` — a muted text line rendered directly below the badges row.

### Layout

Inside the existing `flex items-start justify-between gap-4`, wrap the left column:

```
<div className="flex items-start gap-4">
  {avatar && (
    <div className="shrink-0 rounded-2xl border-2 border-white/20 overflow-hidden">{avatar}</div>
  )}
  <div className="min-w-0">
    {greeting row}
    <h1>{title}</h1>
    {badges && <div className="flex items-center gap-2 mt-1.5">{badges}</div>}
    {description && <p className="text-sm mt-3 opacity-80">{description}</p>}
  </div>
</div>
```

- The shared component owns the rounded border/frame wrapper; the consumer supplies the inner content and size.
- `logos` (top-right) and the parallax/orbs/curve are unchanged.
- Both props are optional, so admin/ministry/existing parent dashboards render identically (no `avatar`, no `description`).

## 4. Surface conversions

All use the parent accent: `bg="var(--hymn-indigo)"` and `orbTint="bg-indigo-500/10"`.

### 4.1 Parent Portal home — `frontend/src/app/portal/page.tsx`

Replace the inline hero div (~lines 140-163) with:

```
<DashboardHero
  bg="var(--hymn-indigo)"
  orbTint="bg-indigo-500/10"
  avatar={churchLogoUrl ? <Image … h-14 w-14 /> : <Baby icon />}
  title={t('My Children', 'أبنائي')}
  badges={identity chips: church name «·» school name}
  description={t('Your children appear automatically when their record uses your login email …')}
/>
```

Keep the `schoolIdentity` fetch (`/users/schools/me`) and its chip logic; move chip rendering into `badges`. Trim imports made unused.

### 4.2 Dashboard parents page — `frontend/src/app/dashboard/parents/page.tsx`

Same replacement with its own local copies of chips and copy. `bg="var(--hymn-indigo)"`, `orbTint="bg-indigo-500/10"`.

### 4.3 Child detail overview — `frontend/src/app/portal/children/[id]/page.tsx`

Convert the white card header (~lines 386-408) into the dark hero:

```
<DashboardHero
  bg="var(--hymn-indigo)"
  orbTint="bg-indigo-500/10"
  avatar={photo ? <img h-16 w-16/> : initials tile}
  title={bilingual name}
  badges={Level n — group — code chips}
  description={optional}
/>
```

Keep the "Back to Children" link **above** the hero (unchanged position). Remove the replaced white-card markup.

### 4.4 Practice guide — `frontend/src/app/portal/children/[id]/practice-guide/page.tsx`

Wrap the title into `DashboardHero` (title = lesson title). Light touch.

## 5. Styling

- All parent surfaces use `var(--hymn-indigo)` with `orbTint="bg-indigo-500/10"`, matching the existing parent role hero.
- Parallax/orbs kept (already in `DashboardHero`).
- No leftover hand-rolled hero markup in the four converted surfaces.

## 6. Out of scope

- Child `[id]/home` immersive view — unchanged.
- `/portal/login`, `/portal/settings` — not hero surfaces.
- Existing `/dashboard` role heroes — untouched.

## 7. Testing

- Extend `frontend/src/app/dashboard/hero.test.tsx` to assert `avatar` and `description` render when passed and are absent when not.
- Existing hero tests must keep passing.
- `tsc --noEmit` clean; `npm test` green; `npm run lint` 0 new errors.

## 8. Definition of done

- `DashboardHero` accepts optional `avatar` + `description`, with tests.
- `/portal`, `/dashboard/parents`, child `[id]` overview, and practice-guide all render via `DashboardHero`.
- Child `[id]`/home unchanged.
- Full suite green; type-check clean; lint 0 new errors.
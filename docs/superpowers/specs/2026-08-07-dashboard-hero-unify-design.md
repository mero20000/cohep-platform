# Unify Dashboard Hero — Design

**Date:** 2026-08-07
**Status:** Approved (pending spec review)

## Goal

Unify the dashboard hero section across all roles. The super-admin hero is the benchmark: every other role's hero should match its look and feel (layout shell, parallax motion, color-token-driven background), differing only by a per-role background color.

## Scope decision

**Structural shell only.** Unify the hero layout, scroll parallax, color token, and header line across roles. Each role keeps its own existing header content and stat cards. This is not a full-content match: the parent hero does not gain an in-hero stat grid.

## Current state (three duplicated heroes)

Located in `frontend/src/app/dashboard/dashboard-client.tsx`:

- **`HeroSection`** (line ~256) — admin. `--hymn-navy` background; scroll-parallax spring orbs + curve (gated by `useReducedMotion`); greeting + school title + church badge + day; church + school logos; 5 in-hero stat cards with `AnimatedCounter`.
- **`MinistryDashboard`** (line ~1143) — ministry roles. `--hymn-green` bg; **no parallax** (static orbs); greeting + school title + church badge + day + `RoleBadge`; church + school logos; 4 in-hero stat cards. `StartClassCard` lives below the hero (outside it).
- **`ParentDashboard`** (line ~1718) — parent. `--hymn-indigo` bg; **no parallax** (static orbs); `Baby` icon + "My Children" title + day; **no logos** (payload has none); **no in-hero stat grid** (aggregates rendered in separate cards below).

Color tokens (`frontend/src/app/globals.css`): `--hymn-navy` (admin), `--hymn-green` (ministry), `--hymn-indigo` (parent). These are already theme-aware (light/dark).

## Decision

Approach A — extract a single shared presentational component, own all shell duplication, all parallax, background token as a prop, per-role content passed in.

## Architecture

New client component file `frontend/src/app/dashboard/hero.tsx`, default export `<DashboardHero>`. It owns the entire hero shell currently duplicated in the three components:

- `rounded-b-[2rem]` overflow-hidden wrapper
- Background token via `bg` prop (one of `var(--hymn-navy) | var(--hymn-green) | var(--hymn-indigo)`)
- Scroll parallax: `useScroll` + `useSpring`/`useTransform` orbs + top curve (the exact setup from `HeroSection` lines 258-263: `stiffness: 80, damping: 20, mass: 0.5`), always gated by `useReducedMotion`
- Dot-grid pattern overlay + role-tinted blur orbs
- Flex header row: `greeting` + `title` + `badges` slot on the left; `logos` slot on the right
- `children` slot for the per-role in-hero stat grid

### Props

```ts
interface DashboardHeroProps {
  bg: string          // 'var(--hymn-navy)' | 'var(--hymn-green)' | 'var(--hymn-indigo)'
  title: ReactNode
  greeting?: ReactNode // role icon + greeting text (default: <Sun> + getGreeting())
  badges?: ReactNode    // church badge, RoleBadge, day, etc.
  logos?: ReactNode     // church + school image stack
  children?: ReactNode  // in-hero stat grid
}
```

## Per-role mapping

| Role | bg | Title | Header content (keep role-specific) | Logos | In-hero stats |
|------|----|-------|--------------------------------------|------|--------------------|
| admin | `--hymn-navy` | school name (fallback platform name) | greeting + church badge + day | church + school | 5 cards (existing) |
| ministry | `--hymn-green` | school name | greeting + church badge + day + `RoleBadge` | church + school | 4 cards (existing) |
| parent | `--hymn-indigo` | "My Children" | `Baby` icon + greeting + day | none | none |

Each dashboard renders `<DashboardHero ...>` and passes its already-fetched data and its own stat-grid JSX via `children`. The `StartClassCard` remains outside the hero in Ministry.

## Behavior & detail

- **Parallax:** ministry and parent gain the scroll-parallax orbs/curve. Admin behavior unchanged. Role orbs keep their current tint (`emerald-500/10` ministry, `indigo-500/10` parent); admin uses `blue-500/10`.
- **Loading/fallbacks:** `HeroFallback` (admin) and `MineFallback` (ministry/parent) stay as-is. Only the loaded hero uses the shared component. Loading mode is deliberately out of scope.
- **Data flow:** no API changes. `hero.tsx` is presentational.
- **Error handling:** unchanged — `ErrorBoundary` around heroes in management dashboard; `RetryCard` for ministry/parent.
- **Accessibility:** parallax uses `useReducedMotion`, consistent with existing behavior.

## Files

- **New:** `frontend/src/app/dashboard/hero.tsx` — `DashboardHero` component.
- **Edit:** `frontend/src/app/dashboard/dashboard-client.tsx` — replace the three hero blocks with `<DashboardHero>` calls; move ministry/parent stat grids into `children`.
- **No change:** `page.tsx`, `use-active-role.ts`, `globals.css`, any API/backend files, fallbacks.

## Out of scope

- Full content match for parent (in-hero stat grid).
- Distinguishing background color per individual role — existing three category tokens retained.
- Any backend / data-fetching changes.
- Loading skeleton unification.
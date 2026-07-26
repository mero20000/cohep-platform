# 003 — Design taste audit & improvement plan

- **Status**: TODO
- **Severity**: MEDIUM
- **Category**: Design cohesion, visual polish, interactive states
- **Scope**: Dashboard-wide

## Design Read

Reading this as: an internal curriculum management dashboard for church school administrators and teachers, bilingual (English/Arabic), with a functional data-dense personality leaning toward Tailwind utilities + Lucide icons + restrained CSS motion. This is a tool, not a marketing site — the bar is clarity, consistency, and speed, not visual flair.

## Current State Assessment

### What works
- **Comprehensive functionality** — the curriculum tab covers teaching view, calendar with drag-and-drop, level management, and allocation grid. Feature depth is strong.
- **Bilingual support** — Arabic/English throughout with `useLanguage()` hook.
- **Existing motion groundwork** — `animate-fade-in-up`, `animate-scale-in`, `animate-drawer-in/out` classes exist in globals.css, and AnimatePresence was recently added to `<Modal>`.
- **Loading states** — `animate-pulse` skeletons and `animate-spin` spinners are used consistently.

### What needs improvement

#### 1. Visual hierarchy & spacing
- The dashboard shell has a resizable sidebar, notification panel, banner announcements, and breadcrumbs — a lot of chrome around the content. The per-page content area feels compressed.
- Cards in teaching view and calendar view use consistent rounded borders but spacing between elements is uneven (mixed `p-3`, `p-4`, `p-5` patterns).
- No consistent `max-w-` constraint on content areas — pages stretch edge-to-edge on widescreen, reducing scanability.

#### 2. Color system inconsistency
- **Accent color drift**: Some elements use `gold-500`/`gold-100` (the brand accent), others use `blue-50`/`blue-600` for level badges, `green-500` for status, `red-600` for danger, `amber-600` for warnings. The gold accent is the brand identifier but it competes with blue for primary actions.
- **Background layering**: The sidebar is `bg-white`, the main content area is `bg-gray-50`, cards inside are `bg-white`. This works, but some nested cards (e.g. in teaching view) are `bg-gray-50` on `bg-gray-50`, creating flat, unbounded areas.

#### 3. Interactive state gaps
- Many raw `<button>` elements lack `transition-colors` (documented in plan 001's findings — 20+ instances across attendance, curriculum, settings modals). Hover states snap.
- The status select dropdown in teaching view has no focus ring or active state.
- Draggable items in calendar view have `cursor-grab` but no visual feedback on drag start beyond opacity change.

#### 4. Typography
- Uses the default Tailwind font stack (system fonts). No Coptic font integration for the Coptic hymn names (the app serves a Coptic Orthodox church school).
- `coptic-text` class exists in teaching-view but may not load a proper Coptic typeface.
- Headline hierarchy is flattened — section titles, card titles, and labels all use similar `text-sm`/`text-xs` sizes with `font-semibold`.

#### 5. Empty & edge states
- Calendar sidebar shows "All items are allocated" when none remain — functional but visually bare.
- Teaching view summary widgets show `0` counts with no contextual empty state illustration.
- No loading skeleton for the allocation grid — it shows a spinner.

#### 6. Sidebar complexity
- The resizable sidebar has auto-hide, hover-reveal, drag-to-resize — a lot of mechanism for an internal tool. The resize handle is custom and may have accessibility gaps.
- Multiple state variables (`sidebarWide`, `autoHide`, `sidebarHover`, `sidebarWidth`, `isResizing`) suggest complexity that could be simplified.

## Recommendations (ordered by leverage)

### A. Consolidate accent color (HIGH)
**Problem**: Gold (`#D4AF37`) is the brand accent but blue is used for interactive elements (level badges, some buttons, links). Two accent colors dilute the brand.

**Fix**: Pick gold as THE accent. Replace blue level badges (`bg-blue-50 text-blue-600`) with gold-toned equivalents (`bg-amber-50 text-amber-700` or `bg-gold-50 text-gold-700`). Keep blue only for semantic link text. Keep green/red/amber for status indicators.

**Files**: Teaching view badges (`teaching-view.tsx`), calendar level pills (`calendar-view.tsx`), allocation grid badges, settings pages.

### B. Unify card spacing (MEDIUM)
**Problem**: Inconsistent padding across card-type containers.

**Fix**: Audit all card/padding usage and standardize:
- Section containers: `p-6` (or `px-6 py-5`)
- Card items: `p-4`
- Compact items (sidebar list): `px-3 py-2`

**Files**: Teaching view items, calendar sidebar items, allocation grid cells.

### C. Add Coptic typeface support (MEDIUM)
**Problem**: Church school curriculum displays Coptic hymn names but may not have a proper Coptic font.

**Fix**:
- Add a Coptic-capable font via `next/font` (e.g. `Noto Sans Coptic` from Google Fonts, or a self-hosted font like `New Athena Unicode`).
- Apply to elements with the `coptic-text` class.

**Files**: `globals.css` or `layout.tsx` for the font import, `teaching-view.tsx` for the class.

### D. Hover/active state audit (MEDIUM)
**Problem**: 20+ raw buttons snap hover states.

**Fix**: Add `transition-colors duration-150` to every `<button>` with `hover:` color/bg changes. This is a mechanical find-and-fix across attendance, curriculum, settings, and students pages.

### E. Loading skeletons for allocation grid (LOW)
**Problem**: Allocation grid shows a spinner while loading. A skeleton matching the grid shape would feel more polished.

**Fix**: Create a grid-shaped skeleton with the same column/row structure, using `animate-pulse` divs.

### F. Sidebar simplification (LOW)
**Problem**: Resizable, auto-hiding sidebar with drag-to-resize adds ~10 state variables for marginal UX gain.

**Fix**: Consider replacing with a fixed-width sidebar with a simple collapse toggle. Or keep the current implementation but add `prefers-reduced-motion` gating to the resize animation.

## Current design dial reading

| Dial | Value | Notes |
| --- | --- | --- |
| `VARIANCE` | 3 | Symmetrical grid layouts, consistent card sizes, predictable structure — appropriate for a dashboard |
| `MOTION` | 3 | CSS transitions only, no decorative motion — correct for a data-dense tool |
| `DENSITY` | 6 | Moderate density, mixed spacing — could be tightened slightly (recommend 5) |

## Verdict

This is a functional internal tool that already avoids the common AI-slop patterns (no gratuitous animation, no purple gradients, no fake data). The highest-leverage improvement is **consolidating the accent color** (A) — it's a small change that makes the entire app feel more deliberate and branded. Adding Coptic font support (C) is the feature-area improvement that directly serves the user's domain.

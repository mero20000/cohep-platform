# Motion Design: Animated Charts & Calendar Overhaul

**Date:** 2026-09-06
**Status:** Approved
**Scope:** Dashboard chart animations + curriculum calendar motion overhaul

---

## 1. Dashboard Chart Motion

### 1.1 Chart Card Entry Animation
- **Component:** All chart card wrappers in `dashboard-client.tsx` and `reports/page.tsx`
- **Pattern:** `motion.div` with `initial={{ opacity: 0, y: 16 }}` → `animate={{ opacity: 1, y: 0 }}`
- **Timing:** Spring `stiffness: 300, damping: 24`
- **Stagger:** 0, 0.08s, 0.16s across cards in a row

### 1.2 Bar Chart Animations
- **Files:** `dashboard-client.tsx` (AttendanceChartSection, AnalyticsSection)
- **Props:** `isAnimationActive={true}` on `<Bar>`, `animationDuration={800}`, `animationEasing="ease-out"`
- **Hover:** Individual bar brightens via `onMouseEnter`/`onMouseLeave` state (`opacity: 0.85`)
- **Tooltip:** Custom `AnimatedTooltip` component with `AnimatePresence` — `scale: 0.95 → 1`, fade in
- **Data transitions:** `key={JSON.stringify(data)}` forces re-mount, triggering Recharts entry animation

### 1.3 Donut Chart Animation
- **File:** `dashboard-client.tsx` (AnalyticsSection — Grade Distribution)
- **Props:** `<Pie isAnimationActive animationBegin={200} animationDuration={800}>`
- **Hover:** Custom `activeShape` with `motion.path` — segment scales outward 4px
- **Center text:** Existing `AnimatedNumber` counter for total count
- **Legend:** `motion.li` items stagger in with 0.04s delay per item

### 1.4 SVG Progress Ring
- **File:** `dashboard-client.tsx` (AssessmentSection)
- **Existing:** `motion.circle` with `strokeDashoffset` animation
- **Enhancement:** Hover — `strokeWidth: 8 → 10` with spring transition

### 1.5 Reports Page — New Recharts
- **File:** `reports/page.tsx`
- Convert `MiniBar` usage to Recharts horizontal `BarChart`
- Convert mastery distribution to Recharts `BarChart` with color-coded `<Cell>` segments
- Same entry animation pattern (staggered `motion.div` wrappers)

### 1.6 Remove Unused Nivo Packages
- Uninstall `@nivo/bar`, `@nivo/core`, `@nivo/heatmap`, `@nivo/line` from `package.json`

---

## 2. Curriculum Calendar Motion

### 2.1 Sidebar — Stagger Entry
- **File:** `curriculum/calendar-view.tsx`
- Items wrapped in `motion.div` with `layout` prop for smooth reflow
- Entry: `initial={{ opacity: 0, x: -12 }}` → `animate={{ opacity: 1, x: 0 }}` (0.03s delay per item)
- Allocated items exit: `AnimatePresence` with `exit={{ opacity: 0, scale: 0.9, x: -20 }}`

### 2.2 Sidebar — Filter Transitions
- When filter changes, remaining items animate to new positions via `layout` spring
- Count badge updates with flip animation

### 2.3 Drag Ghost
- Custom drag preview: `motion.div` with `scale: 1.05`, shadow `0 8px 32px rgba(0,0,0,0.15)`
- Original item dims to `opacity: 0.4` during drag
- `useReducedMotion()` check — skip ghost customization for reduced motion users

### 2.4 Drop Zone Feedback
- Valid target on drag-over: border transitions dashed gray → solid gold
- Invalid target (inactive week): subtle red tint flash
- Successful drop: ripple effect — `motion.div` expanding `scale` + `opacity: 0 → 1 → 0`

### 2.5 Term/Week Transitions
- Switching terms: grid rows crossfade
  - Outgoing: `exit={{ opacity: 0, y: -8 }}`
  - Incoming: `initial={{ opacity: 0, y: 8 }}` → `animate={{ opacity: 1, y: 0 }}`
- `AnimatePresence mode="wait"` on grid body

### 2.6 Empty Cell Breathing
- Dashed border on empty cells: subtle `opacity` pulse (0.3 → 0.6 → 0.3) on 3s loop
- On hover during drag: border solid, background tints subject color at 5% opacity

### 2.7 Allocation Cards
- Existing spring drop-in (already implemented)
- Enhancement: `whileHover={{ y: -2 }}` lift effect
- Delete confirmation: shake animation (`x: [-2, 2, -2, 0]`) before removal

---

## 3. Technical Details

### Motion Library
- Primary: `motion` v12 (Framer Motion successor) — already installed
- Chart library: Recharts v3.10.1 — already installed, add `isAnimationActive` props
- Cleanup: Remove 4 unused Nivo packages

### Reduced Motion Support
- All new animations wrapped in `useReducedMotion()` checks or `MotionConfig reducedMotion="user"`
- `dashboard-shell.tsx` already has `MotionConfig` wrapping all dashboard content
- Skeleton shimmer and breathing effects use CSS `@media (prefers-reduced-motion: reduce)` overrides

### Performance
- `layout` animations use `transform` only (no layout thrash)
- Chart re-mounts via `key` prop — only when data actually changes
- Stagger delays are small (0.03-0.16s) to avoid perceived lag
- All animations respect `prefers-reduced-motion`

### Files to Modify
| File | Changes |
|------|---------|
| `app/dashboard/dashboard-client.tsx` | Chart entry animations, hover effects, animated tooltip, legend stagger |
| `reports/page.tsx` | Convert MiniBar/mastery bars to Recharts with animations |
| `components/curriculum/calendar-view.tsx` | Sidebar stagger, drag ghost, drop feedback, term transitions, breathing cells, card hover |
| `components/ui/stat-card.tsx` | Already animated — no changes |
| `components/ui/skeleton.tsx` | Already shimmer — no changes |
| `package.json` | Remove Nivo packages |

### Estimated Effort
- Dashboard charts: ~2-3 hours (entry + hover + tooltip + data transitions)
- Reports page: ~1-2 hours (convert to Recharts)
- Calendar overhaul: ~3-4 hours (sidebar + drag + transitions + breathing)
- Total: ~6-9 hours of implementation

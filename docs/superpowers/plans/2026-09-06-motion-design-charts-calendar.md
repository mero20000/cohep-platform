# Motion Design: Animated Charts & Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full interactive motion to dashboard charts (entry, hover, data transitions) and overhaul curriculum calendar with staggered sidebar, polished drag-drop, and term transitions.

**Architecture:** Extend existing Recharts charts with `isAnimationActive` props and motion wrappers. Add `motion.div` layout animations to calendar sidebar and drag system. Remove unused Nivo packages.

**Tech Stack:** `motion` v12 (Framer Motion successor), Recharts v3.10.1, Next.js 16, Tailwind CSS

## Global Constraints

- All animations must respect `useReducedMotion()` or CSS `@media (prefers-reduced-motion: reduce)`
- `dashboard-shell.tsx` already has `MotionConfig reducedMotion="user"` wrapping dashboard content
- Use spring physics where possible (no linear easing)
- Stagger delays: 0.03–0.16s max (avoid perceived lag)
- No new dependencies — use only `motion` and `recharts` (both already installed)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `app/dashboard/dashboard-client.tsx` | Chart entry animations, hover effects, animated tooltip, legend stagger, data transition keys |
| `reports/page.tsx` | Convert MiniBar/mastery bars to Recharts with animations |
| `components/curriculum/calendar-view.tsx` | Sidebar stagger, drag ghost, drop feedback, term transitions, breathing cells, card hover |
| `package.json` | Remove 4 unused Nivo packages |

---

### Task 1: Dashboard — Chart Card Entry Animations

**Files:**
- Modify: `app/dashboard/dashboard-client.tsx` (StatsSection, AnalyticsSection)

**Interfaces:**
- Consumes: existing Recharts `<BarChart>`, `<PieChart>` components
- Produces: animated chart card wrappers (no new exports)

- [ ] **Step 1: Wrap chart cards in motion.div**

Find the `StatsSection` component. Each stat card grid wrapper and each chart card (`<div className="rounded-xl ...">`) gets wrapped in:

```tsx
import { motion } from 'motion/react'

// Wrap each chart card:
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0 }}
  className="rounded-xl border border-gray-200 bg-white p-4"
>
  {/* existing chart content */}
</motion.div>
```

Apply to all 3 chart sections in `dashboard-client.tsx`:
1. `AttendanceChartSection` — delay 0
2. `AnalyticsSection` students-per-level — delay 0.08
3. `AnalyticsSection` grade-distribution donut — delay 0.16

- [ ] **Step 2: Add stagger to stat cards row**

The stat cards in `StatsSection` already have `delay` props from the `StatCard` component. Verify the stagger values are 0, 0.05, 0.1, 0.15 across the 4 cards.

- [ ] **Step 3: Verify in browser**

Run `npm run dev` and check:
- Charts fade-in and slide-up on page load
- Staggered timing across the 3 chart cards
- No layout shift during animation

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/dashboard-client.tsx
git commit -m "feat(dashboard): add chart card entry animations with spring physics"
```

---

### Task 2: Dashboard — Bar Chart Hover + Tooltip

**Files:**
- Modify: `app/dashboard/dashboard-client.tsx` (AttendanceChartSection, AnalyticsSection)

**Interfaces:**
- Consumes: existing `<BarChart>` data format
- Produces: animated tooltip component

- [ ] **Step 1: Create AnimatedTooltip component**

Add at the top of `dashboard-client.tsx` (or in a new file `components/ui/animated-tooltip.tsx`):

```tsx
'use client'
import { motion, AnimatePresence } from 'motion/react'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
  formatter?: (value: number) => string
}

export function AnimatedChartTooltip({ active, payload, label, formatter }: TooltipProps) {
  return (
    <AnimatePresence>
      {active && payload && payload.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
        >
          {label && <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>}
          {payload.map((entry, i) => (
            <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
              {formatter ? formatter(entry.value) : entry.value.toLocaleString('en-GB')}
            </p>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Add hover state to bar charts**

In `AttendanceChartSection`, add state for hover:

```tsx
const [hoveredBar, setHoveredBar] = useState<number | null>(null)
```

On each `<Bar>` or `<Cell>`, add:
```tsx
onMouseEnter={() => setHoveredBar(index)}
onMouseLeave={() => setHoveredBar(null)}
```

Apply conditional opacity:
```tsx
<Cell
  fill={color}
  opacity={hoveredBar === null || hoveredBar === index ? 1 : 0.5}
/>
```

- [ ] **Step 3: Replace default Tooltip with AnimatedChartTooltip**

In both bar charts, replace:
```tsx
<Tooltip content={<AnimatedChartTooltip />} />
```

- [ ] **Step 4: Verify in browser**

Run `npm run dev` and check:
- Bars brighten on hover, others dim
- Tooltip fades in with scale animation
- Tooltip fades out smoothly on mouse leave

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/dashboard-client.tsx
git commit -m "feat(dashboard): add bar chart hover effects and animated tooltip"
```

---

### Task 3: Dashboard — Donut Chart Animation

**Files:**
- Modify: `app/dashboard/dashboard-client.tsx` (AnalyticsSection — Grade Distribution)

**Interfaces:**
- Consumes: existing PieChart data
- Produces: animated legend items

- [ ] **Step 1: Enable Pie animation**

On the `<Pie>` component in the grade distribution chart, ensure these props:

```tsx
<Pie
  isAnimationActive={true}
  animationBegin={200}
  animationDuration={800}
  animationEasing="ease-out"
  // ... existing props
/>
```

- [ ] **Step 2: Add hover scale to pie segments**

Create a state for hovered segment:

```tsx
const [hoveredPie, setHoveredPie] = useState<number | null>(null)
```

Add `onMouseEnter`/`onMouseLeave` to the `<Pie>`:

```tsx
<Pie
  onMouseEnter={(_, index) => setHoveredPie(index)}
  onMouseLeave={() => setHoveredPie(null)}
  // ... existing props
/>
```

Create custom active shape that scales:

```tsx
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value, index } = props
  const isActive = hoveredPie === index
  const radius = isActive ? outerRadius + 4 : outerRadius
  return (
    <g>
      <motion.circle
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={radius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        animate={{ outerRadius: radius }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="text-lg font-bold fill-gray-900">
        {value}
      </text>
    </g>
  )
}
```

Apply: `<Pie activeIndex={hoveredPie} activeShape={renderActiveShape} />`

- [ ] **Step 3: Stagger legend items**

Replace the legend `<div>` with:

```tsx
import { motion } from 'motion/react'

<div className="flex flex-wrap gap-2 mt-3">
  {data.map((entry, i) => (
    <motion.div
      key={entry.name}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
      className="flex items-center gap-1.5 text-xs"
    >
      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
      <span className="text-gray-600">{entry.name}</span>
    </motion.div>
  ))}
</div>
```

- [ ] **Step 4: Verify in browser**

Check:
- Donut fills with animation on load (0.2s delay after bars)
- Segment scales outward on hover
- Legend items stagger in from bottom

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/dashboard-client.tsx
git commit -m "feat(dashboard): add donut chart hover scale and staggered legend"
```

---

### Task 4: Dashboard — Data Transition Animations

**Files:**
- Modify: `app/dashboard/dashboard-client.tsx`

**Interfaces:**
- Consumes: chart data arrays (attendance, levels, grades)
- Produces: charts that animate when data changes

- [ ] **Step 1: Add key prop for re-mount on data change**

On each `<BarChart>` and `<PieChart>`, add a `key` prop that changes when data changes:

```tsx
<BarChart key={`attendance-${JSON.stringify(attendanceData)}`} data={attendanceData}>
```

This forces Recharts to re-mount and play its entry animation when data changes (e.g., date range filter).

- [ ] **Step 2: Add AnimatePresence wrapper for chart sections**

Wrap each chart section in `AnimatePresence` to handle conditional rendering:

```tsx
<AnimatePresence mode="wait">
  {data && (
    <motion.div
      key="chart"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* chart */}
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Verify in browser**

Check:
- Charts re-animate entry when data source changes
- No flash of unstyled content during transition
- Smooth fade between loading and loaded states

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/dashboard-client.tsx
git commit -m "feat(dashboard): add chart data transition animations"
```

---

### Task 5: Reports Page — Convert to Recharts

**Files:**
- Modify: `reports/page.tsx`

**Interfaces:**
- Consumes: existing report data (liturgical engagement, servant activity, level mastery)
- Produces: Recharts-based animated bar charts

- [ ] **Step 1: Add Recharts imports**

```tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { AnimatedChartTooltip } from '@/components/ui/animated-tooltip'
```

- [ ] **Step 2: Convert liturgical engagement MiniBar section**

Replace the hand-built `MiniBar` rows with:

```tsx
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={liturgicalData} layout="vertical" margin={{ left: 80 }}>
    <XAxis type="number" hide />
    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
    <Tooltip content={<AnimatedChartTooltip />} />
    <Bar
      dataKey="count"
      isAnimationActive={true}
      animationDuration={800}
      animationEasing="ease-out"
      radius={[0, 4, 4, 0]}
    >
      {liturgicalData.map((_, i) => (
        <Cell key={i} fill={i % 2 === 0 ? '#d4a853' : '#3b82f6'} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

- [ ] **Step 3: Convert mastery distribution to Recharts**

Replace the 4 hand-built horizontal bars with:

```tsx
<ResponsiveContainer width="100%" height={160}>
  <BarChart data={masteryData} margin={{ left: 80 }}>
    <XAxis type="category" dataKey="label" tick={{ fontSize: 11 }} />
    <YAxis type="number" hide />
    <Tooltip content={<AnimatedChartTooltip />} />
    <Bar
      dataKey="percentage"
      isAnimationActive={true}
      animationDuration={800}
      radius={[4, 4, 0, 0]}
    >
      {masteryData.map((entry, i) => (
        <Cell key={i} fill={entry.color} />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

- [ ] **Step 4: Wrap report sections in motion.div entry**

```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
  className="rounded-xl border border-gray-200 bg-white p-4"
>
  {/* chart content */}
</motion.div>
```

- [ ] **Step 5: Verify in browser**

Check:
- Reports page shows Recharts instead of hand-built bars
- Charts animate on entry
- Tooltips work on hover

- [ ] **Step 6: Commit**

```bash
git add reports/page.tsx
git commit -m "feat(reports): convert hand-built bars to animated Recharts"
```

---

### Task 6: Remove Unused Nivo Packages

**Files:**
- Modify: `package.json`

**Interfaces:**
- None (cleanup only)

- [ ] **Step 1: Uninstall Nivo packages**

```bash
cd frontend && npm uninstall @nivo/bar @nivo/core @nivo/heatmap @nivo/line
```

- [ ] **Step 2: Verify no broken imports**

```bash
grep -r "@nivo" src/
```

Expected: no results.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused @nivo packages"
```

---

### Task 7: Calendar — Sidebar Stagger Entry

**Files:**
- Modify: `components/curriculum/calendar-view.tsx`

**Interfaces:**
- Consumes: existing `teachingItems` array, `draggedLesson`/`draggedSubjectItem` state
- Produces: animated sidebar item list

- [ ] **Step 1: Add motion import**

```tsx
import { motion, AnimatePresence } from 'motion/react'
```

- [ ] **Step 2: Wrap sidebar items in motion.div**

Find the sidebar items loop (the `unallocItems.map(...)` section). Wrap each item:

```tsx
<motion.div
  key={item.id || item.name}
  layout
  initial={{ opacity: 0, x: -12 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, scale: 0.9, x: -20 }}
  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
  draggable
  onDragStart={() => { /* existing handler */ }}
  onDragEnd={() => setDraggedLesson(null)}
  className="..."
>
  {/* existing item content */}
</motion.div>
```

- [ ] **Step 3: Add AnimatePresence wrapper**

Wrap the entire sidebar items list:

```tsx
<AnimatePresence mode="popLayout">
  {unallocItems.map(item => (
    <motion.div key={item.id || item.name} layout exit={{ opacity: 0, scale: 0.9, x: -20 }}>
      {/* item */}
    </motion.div>
  ))}
</AnimatePresence>
```

- [ ] **Step 4: Verify in browser**

Check:
- Sidebar items stagger in on page load
- When an item is allocated (removed from sidebar), it fades and shrinks left
- Layout reflows smoothly when items are removed

- [ ] **Step 5: Commit**

```bash
git add components/curriculum/calendar-view.tsx
git commit -m "feat(calendar): add sidebar item stagger entry and exit animations"
```

---

### Task 8: Calendar — Sidebar Filter Transitions

**Files:**
- Modify: `components/curriculum/calendar-view.tsx`

**Interfaces:**
- Consumes: `selectedLevelId`, `selectedGroup`, sidebar filter state
- Produces: smooth layout transitions when filters change

- [ ] **Step 1: Add layout prop to sidebar items**

Ensure every sidebar item `<motion.div>` has `layout` prop (already added in Task 7). This enables spring-based layout animation when items are added/removed from the filtered list.

- [ ] **Step 2: Animate count badge**

Find the unallocated items count at the bottom of the sidebar. Wrap in `motion.div` with `layout`:

```tsx
<motion.div layout className="text-xs text-gray-500 text-center pt-2">
  {unallocItems.length} {lang === 'ar' ? 'عناصر' : 'items'}
</motion.div>
```

- [ ] **Step 3: Verify in browser**

Check:
- Changing level/group filter causes items to smoothly animate to new positions
- Items that appear fade in, items that disappear fade out
- Count badge stays in sync

- [ ] **Step 4: Commit**

```bash
git add components/curriculum/calendar-view.tsx
git commit -m "feat(calendar): add sidebar filter transition animations"
```

---

### Task 9: Calendar — Drag Ghost

**Files:**
- Modify: `components/curriculum/calendar-view.tsx`

**Interfaces:**
- Consumes: `draggedLesson`, `draggedSubjectItem`, `draggedAllocation`, `draggedReview`, `draggedAssessment` state
- Produces: custom drag preview visual

- [ ] **Step 1: Add drag preview state**

```tsx
const [dragPreview, setDragPreview] = useState<{ x: number; y: number; label: string } | null>(null)
```

- [ ] **Step 2: Dim original item during drag**

On each draggable sidebar item, add conditional opacity:

```tsx
<motion.div
  animate={{
    opacity: draggedLesson?.id === item.id ? 0.4 : 1,
    scale: draggedLesson?.id === item.id ? 0.98 : 1,
  }}
  // ... existing props
>
```

- [ ] **Step 3: Add drag-over visual feedback to cells**

On each table cell's `onDragOver`, add a state to track which cell is being hovered:

```tsx
const [dragOverCell, setDragOverCell] = useState<string | null>(null)
```

On each cell:
```tsx
onDragOver={e => {
  e.preventDefault()
  setDragOverCell(`${week.weekNumber}-${subj.name}`)
}}
onDragLeave={() => setDragOverCell(null)}
onDrop={e => {
  e.preventDefault()
  setDragOverCell(null)
  handleCalendarDrop(week.weekNumber, subj.name)
}}
```

Apply visual feedback:
```tsx
className={`... ${
  dragOverCell === `${week.weekNumber}-${subj.name}`
    ? 'ring-2 ring-gold-400 bg-gold-50/30'
    : ''
}`}
```

- [ ] **Step 4: Check reduced motion**

```tsx
import { useReducedMotion } from 'motion/react'
const shouldReduceMotion = useReducedMotion()
```

Skip ghost dimming and drag-over effects if `shouldReduceMotion`.

- [ ] **Step 5: Verify in browser**

Check:
- Sidebar item dims when being dragged
- Drop target highlights with gold ring on drag-over
- Highlight clears when drag leaves the cell
- Reduced motion mode skips visual effects

- [ ] **Step 6: Commit**

```bash
git add components/curriculum/calendar-view.tsx
git commit -m "feat(calendar): add drag ghost dimming and drop zone highlight"
```

---

### Task 10: Calendar — Drop Success Ripple

**Files:**
- Modify: `components/curriculum/calendar-view.tsx`

**Interfaces:**
- Consumes: `handleCalendarDrop` callback
- Produces: ripple animation on successful drop

- [ ] **Step 1: Add ripple state**

```tsx
const [dropRipple, setDropRipple] = useState<{ week: number; subject: string } | null>(null)
```

- [ ] **Step 2: Trigger ripple on drop**

In `handleCalendarDrop`, after the allocation is created:

```tsx
setDropRipple({ week: weekNumber, subject: subjectName })
setTimeout(() => setDropRipple(null), 600)
```

- [ ] **Step 3: Render ripple animation**

In each cell, conditionally render a ripple:

```tsx
{dropRipple?.week === week.weekNumber && dropRipple?.subject === subj.name && (
  <motion.div
    initial={{ scale: 0, opacity: 0.6 }}
    animate={{ scale: 2.5, opacity: 0 }}
    transition={{ duration: 0.6, ease: 'easeOut' }}
    className="absolute inset-0 rounded-lg bg-gold-400 pointer-events-none"
  />
)}
```

Ensure the cell has `position: relative` and `overflow: hidden`.

- [ ] **Step 4: Verify in browser**

Check:
- Dropping an allocation triggers a gold ripple expanding from the drop point
- Ripple fades out after 0.6s
- No layout shift during ripple

- [ ] **Step 5: Commit**

```bash
git add components/curriculum/calendar-view.tsx
git commit -m "feat(calendar): add drop success ripple animation"
```

---

### Task 11: Calendar — Term/Week Transitions

**Files:**
- Modify: `components/curriculum/calendar-view.tsx`

**Interfaces:**
- Consumes: `selectedTerm` state
- Produces: crossfade when switching terms

- [ ] **Step 1: Add AnimatePresence to grid body**

Find the grid/table rendering. Wrap the grid body (the `<tbody>` or the rows container) in:

```tsx
<AnimatePresence mode="wait">
  <motion.tbody
    key={`term-${selectedTerm}`}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2 }}
  >
    {/* grid rows */}
  </motion.tbody>
</AnimatePresence>
```

- [ ] **Step 2: Verify in browser**

Check:
- Switching T1/T2/T3 causes grid to crossfade
- Outgoing rows slide up slightly, incoming rows slide up from below
- No flash or layout jump

- [ ] **Step 3: Commit**

```bash
git add components/curriculum/calendar-view.tsx
git commit -m "feat(calendar): add term switch crossfade animation"
```

---

### Task 12: Calendar — Empty Cell Breathing

**Files:**
- Modify: `components/curriculum/calendar-view.tsx`

**Interfaces:**
- Consumes: empty cell rendering
- Produces: subtle pulse animation on empty drop zones

- [ ] **Step 1: Add breathing animation class**

In `globals.css`, add:

```css
@keyframes breathing {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.animate-breathing {
  animation: breathing 3s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-breathing {
    animation: none;
    opacity: 0.4;
  }
}
```

- [ ] **Step 2: Apply to empty cells**

On the empty cell drop zone (the dashed-border div), add:

```tsx
<div className={`min-h-[32px] rounded border-2 border-dashed transition-colors animate-breathing ${
  isInactive ? 'border-gray-100' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
}`}
```

- [ ] **Step 3: Enhance hover during drag**

When a drag is active and the cell is hovered, make the border solid and tint:

```tsx
className={`min-h-[32px] rounded border-2 transition-all animate-breathing ${
  dragOverCell === `${week.weekNumber}-${subj.name}`
    ? 'border-solid border-gold-400 bg-gold-50/30 animate-none'
    : isInactive
      ? 'border-gray-100'
      : 'border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
}`}
```

- [ ] **Step 4: Verify in browser**

Check:
- Empty cells have subtle breathing opacity animation
- On drag-over, border becomes solid gold with background tint
- Reduced motion: no animation, static opacity

- [ ] **Step 5: Commit**

```bash
git add components/curriculum/calendar-view.tsx src/app/globals.css
git commit -m "feat(calendar): add empty cell breathing and drag-over tint"
```

---

### Task 13: Calendar — Allocation Card Hover + Delete Shake

**Files:**
- Modify: `components/curriculum/calendar-view.tsx`

**Interfaces:**
- Consumes: existing allocation card rendering
- Produces: hover lift and delete shake effects

- [ ] **Step 1: Add hover lift to allocation cards**

On each allocation card `<motion.div>`, add:

```tsx
<motion.div
  whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
  // ... existing props
>
```

- [ ] **Step 2: Add delete shake animation**

Add a state for cards pending deletion:

```tsx
const [shakingAlloc, setShakingAlloc] = useState<string | null>(null)
```

In `handleDeleteAlloc`, before the actual delete:

```tsx
setShakingAlloc(alloc.id)
setTimeout(() => {
  setShakingAlloc(null)
  // proceed with delete
}, 400)
```

On the card:
```tsx
animate={shakingAlloc === a.id ? { x: [-2, 2, -2, 0] } : {}}
transition={{ duration: 0.3 }}
```

- [ ] **Step 3: Verify in browser**

Check:
- Cards lift slightly on hover with shadow
- Delete button triggers shake before removal
- No layout shift during hover or shake

- [ ] **Step 4: Commit**

```bash
git add components/curriculum/calendar-view.tsx
git commit -m "feat(calendar): add allocation card hover lift and delete shake"
```

---

### Task 14: Final Verification + Cleanup

**Files:**
- All modified files

**Interfaces:**
- None (verification only)

- [ ] **Step 1: Run build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual QA checklist**

Verify all animations in browser:
- [ ] Dashboard charts stagger entry on load
- [ ] Bar chart hover highlights individual bars
- [ ] Tooltip animates in/out
- [ ] Donut segment scales on hover
- [ ] Legend items stagger in
- [ ] Charts re-animate when data changes
- [ ] Reports page shows Recharts with animations
- [ ] Calendar sidebar items stagger in
- [ ] Sidebar items fade/shrink when allocated
- [ ] Filter transitions animate layout
- [ ] Drag dims original item
- [ ] Drop zones highlight on drag-over
- [ ] Drop triggers gold ripple
- [ ] Term switch crossfades grid
- [ ] Empty cells breathe
- [ ] Allocation cards lift on hover
- [ ] Delete triggers shake
- [ ] Reduced motion mode works correctly

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: animation polish and reduced motion fixes"
```

- [ ] **Step 4: Push**

```bash
git push
```

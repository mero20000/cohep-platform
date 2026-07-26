# Task 3 Report — Features → Why COHEP Exists + Who We Serve + Approach Refinement

## Sections changed/added/removed

- **Removed:** `{/* Features */}` section (old lines 876-900) — replaced entirely
- **Added:** `{/* Why COHEP Exists */}` `<section id="why">` — challenge/response two-column layout with `CrossPatternBg`
- **Added:** `{/* Who We Serve */}` `<section>` — 4-column card grid with icon, title, desc, and feature list per persona (Servants, Parents, Students, Church Leaders), placed between Why and Platform Preview
- **Renamed:** `{/* Curriculum Deep Dive (replaces stand-alone Three Pillars) */}` → `{/* The COHEP Approach */}` (line ~955)
- **Nav data:** removed `features` key, added `why` key to both `en.nav` and `ar.nav`

## New imports

None — all needed Lucide icons (`Users`, `Heart`, `Star`, `Church`, `CheckCircle2`) were already imported.

## Internal additions

- `DefaultIcon` component (simple rounded placeholder div) added in Home component
- `iconMap: Record<string, React.ElementType>` mapping icon strings (`'Users'`, `'Heart'`, `'Star'`, `'Church'`) to Lucide components; fallback to `Users`

## Nav updates

| Location | Change |
|---|---|
| Desktop nav (line ~693) | `#features` → `#why`, added `#open-source` after curriculum, `t.nav.features` → `t.nav.why` |
| Mobile nav (line ~737) | Same as desktop |
| IntersectionObserver (line ~647) | `['features', 'curriculum', 'testimonials']` → `['why', 'curriculum', 'open-source', 'testimonials']` |
| Nav `content` key | `features` removed, `why` added with en="Why COHEP" / ar="لماذا كوهيب" |

## Typecheck result

`npx tsc --noEmit` — **passed with zero errors.**

## Concerns

1. **No `t.approach.badge` key exists** in the content object, so the Three Pillars badge keeps its hardcoded "Curriculum Deep Dive" English / "المنهج التفصيلي" Arabic text. If `approach` content is added later, the badge can be updated to `{t.approach.badge}`.
2. **No `#open-source` section exists in the page yet** — the nav link points to it and the IntersectionObserver watches for it, but it will only become active once Task 4 adds the `<section id="open-source">` element.
3. **Footer link** (`<a href="#features">`) on line ~1147 still references `#features` — may need updating depending on whether footer should point to `#why` instead. Not addressed in this task.
4. **`DefaultIcon`** is a minimal fallback (`div h-6 w-6 bg-gold-200 rounded`). The `typeof Icon === 'string'` check in the render is defensive — it should never trigger since `iconMap` resolves all strings, but it's kept for safety.

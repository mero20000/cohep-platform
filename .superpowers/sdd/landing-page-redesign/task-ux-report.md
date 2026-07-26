# UX Improvements — Landing Page

## Changes Applied

### Change 1: `aria-labelledby` on all section elements
Added `aria-labelledby` to 13 section elements with corresponding `id` on their `<h2>`:

| Section | Section `aria-labelledby` | `<h2>` `id` |
|---|---|---|
| A Sacred Calling | `aria-labelledby="sacred-calling"` | `id="sacred-calling"` |
| The Challenge | `aria-labelledby="why-heading"` | `id="why-heading"` |
| The Response | `aria-labelledby="response-heading"` | `id="response-heading"` |
| Four Callings | `aria-labelledby="who-we-serve-heading"` | `id="who-we-serve-heading"` |
| Platform Preview | `aria-labelledby="platform-preview-heading"` | `id="platform-preview-heading"` |
| Curriculum | `aria-labelledby="curriculum-heading"` | `id="curriculum-heading"` |
| Approach/Pillars | `aria-labelledby="approach-heading"` | `id="approach-heading"` |
| From First Hymn | `aria-labelledby="from-first-hymn-heading"` | `id="from-first-hymn-heading"` |
| How It Works | `aria-labelledby="how-it-works-heading"` | `id="how-it-works-heading"` |
| Open Source | `aria-labelledby="open-source-heading"` | `id="open-source-heading"` |
| Testimonials | `aria-labelledby="testimonials-heading"` | `id="testimonials-heading"` |
| FAQ | `aria-labelledby="faq-heading"` | `id="faq-heading"` |
| CTA | `aria-labelledby="cta-heading"` | `id="cta-heading"` |

### Change 2: `useReducedMotion` support
- Added `useReducedMotion` to the framer-motion import
- Added `const reduce = useReducedMotion()` in the Home component
- Wrapped all hero `initial`/`animate` props with conditional empty objects when reduced motion is preferred
- `transition` props left unchanged

### Change 3: SectionBadge typography
- Changed badge from `text-sm font-medium` to `text-xs font-semibold uppercase tracking-wider`

## Verification
- TypeScript typecheck: **PASS** (`npx tsc --noEmit` — no errors)

# 006 — Animate How-It-Works connector line

- **Status**: DONE
- **Commit**: unknown
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~5 lines changed

## Problem

`src/app/page.tsx:871-873` — The "How It Works" section has three step cards with a connector line between them (a static gradient line between step 1→2 and 2→3):

```tsx
{i < 2 && (
  <div className={`hidden lg:block absolute top-14 h-0.5 bg-gradient-to-r from-gold-300 to-transparent ${isAr ? 'right-[calc(50%+2.5rem)] left-0' : 'left-[calc(50%+2.5rem)] right-0'}`} />
)}
```

The line is present immediately on scroll — it doesn't draw in as the user reaches each step. An animated line that scales from 0 to full width as the step comes into view would make the progression feel connected.

## Target

Animate the connector line's `scaleX` from 0 to 1 as the step pair enters the viewport, with a stagger. Step 1→2 line animates when step 2 enters view; step 2→3 line animates when step 3 enters view. Use framer-motion's `whileInView`.

## Repo conventions to follow

- `FadeInUp` pattern in `page.tsx:206-218` — `whileInView` with `viewport: { once: true }`
- Easing: `cubic-bezier(0.23, 1, 0.32, 1)` (project strong ease-out)

## Steps

1. Convert the static div (line 873) to a `motion.div`:

   ```tsx
   {i < 2 && (
     <motion.div
       initial={{ scaleX: 0 }}
       whileInView={{ scaleX: 1 }}
       viewport={{ once: true, margin: '-40px' }}
       transition={{ duration: 0.5, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
       className={`hidden lg:block absolute top-14 h-0.5 bg-gradient-to-r from-gold-300 to-transparent origin-left ${isAr ? 'right-[calc(50%+2.5rem)] left-0 origin-right' : 'left-[calc(50%+2.5rem)] right-0 origin-left'}`}
     />
   )}
   ```

2. Add `origin-left` (or `origin-right` for RTL) to ensure the scale expands from the starting edge rather than from center.

## Boundaries

- Do NOT change the step card layout, content, or styling
- Do NOT change the "How It Works" section wrapper
- Keep the `hidden lg:block` breakpoint

## Verification

- **Mechanical**: `npx tsc --noEmit` passes
- **Feel check**: scroll to the "How It Works" section. The connector line between step 1 and step 2 should draw in from left to right (or right to left in Arabic) as the steps enter view.
- Confirm the line stays visible after animating (no `exit` — once drawn, it stays).

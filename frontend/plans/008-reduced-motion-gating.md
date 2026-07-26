# 008 — Gate motion under prefers-reduced-motion

- **Status**: DONE
- **Commit**: unknown
- **Severity**: LOW
- **Category**: Accessibility
- **Estimated scope**: 2 files, ~10 lines changed

## Problem

Two elements on the landing page animate without `prefers-reduced-motion` gating:

1. **GradientOrbs** (`page.tsx:172-188`) — infinite rotating/scale loop on background decorative orbs. Uses framer-motion `animate` with `repeat: Infinity`. When `useReducedMotion()` is active, the current code sets `{ scale: 1, rotate: 0 }` (static) — this is correct. However, the component is reused in the curriculum dark section and the CTA section (same component reference). The current gating uses `useInView` to pause when out of view, which is sufficient for performance but doesn't address reduced motion.

2. **Button press scale** (`button.tsx:6`) — `active:scale-[0.97]` on all buttons. This is a transform (position change) which should be removed under reduced motion, while the color feedback should remain.

Current GradientOrbs code:
```tsx
animate={isInView ? { scale: [1, 1.1, 1], rotate: [0, 15, 0] } : { scale: 1, rotate: 0 }}
```

Current button base (line 6):
```tsx
"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-100 ease-out active:scale-[0.97] ..."
```

## Target

- GradientOrbs: When `prefers-reduced-motion: reduce`, render only the static gradient divs (no motion animation, keep blur/opacity for depth).
- Button press: Keep color/background feedback, remove `active:scale-[0.97]` transform under reduced motion.

## Repo conventions to follow

- `useReducedMotion()` from framer-motion already used in `modal.tsx:21`
- CSS `@media (prefers-reduced-motion: reduce)` already present in `globals.css` patterns

## Steps

1. In `page.tsx`, GradientOrbs already has `useInView` + conditional animate (from plan 003 polish). Add reduced motion check. The current `isInView` variable already gates the animation to in-view only, and the animate prop switches between the motion and static keyframes. This is already correct — no change needed for the orbs. Mark as NO-CHANGE.

2. In `button.tsx`, add a `useReducedMotion()` guard. Add `noScale` prop or use a CSS media query approach:
   - Add to `globals.css`:
     ```css
     @media (prefers-reduced-motion: reduce) {
       .btn-press-scale { transform: none !important; }
     }
     ```
   - Add `btn-press-scale` class alongside `active:scale-[0.97]` so the media query can nullify it:
     ```tsx
     "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-100 ease-out active:scale-[0.97] btn-press-scale ..."
     ```

   Alternatively, use framer-motion's `whileTap` with conditional scale. But since buttons use CSS classes not framer-motion, the CSS approach is simpler.

## Verification

- **Mechanical**: `npx tsc --noEmit` passes
- **Feel check**: In DevTools Rendering panel, toggle `prefers-reduced-motion: reduce`. Confirm:
  - GradientOrbs are static (no rotation/scale pulsing)
  - Button press has no scale-down but still changes color on hover

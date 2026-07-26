# 009 — Reduce decorative blur radius

- **Status**: DONE
- **Commit**: unknown
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: 1 file, ~6 lines changed

## Problem

`src/app/page.tsx` uses `blur-3xl` (64px blur radius) on decorative elements that don't need such an aggressive blur:

- Line 173-174, 178-179, 183-184: `GradientOrbs` — three `blur-3xl` circles
- Line 484 (PreviewCarousel): `.rounded-[14px] bg-gray-800 p-2 sm:p-3 shadow-2xl` — the phone frame (no blur here, this is fine)

The `blur-3xl` on the orbs is `filter: blur(64px)`. The AUDIT.md recommends keeping blur under 20px for animations (transition-time blur). While these are static blurs (not animated), 64px is paint-heavy especially on Safari where heavy `filter: blur()` is significantly more expensive than Chrome.

Current:
```tsx
<motion.div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl" ...
<motion.div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl" ...
<motion.div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-3xl ...
```

## Target

Reduce `blur-3xl` (64px) → `blur-2xl` (40px) on decorative orbs only. The visual difference between 40px and 64px blur on 10% opacity background circles is imperceptible, but the rendering cost drops significantly.

Tailwind blur scale: `blur-2xl = 40px`, `blur-3xl = 64px`.

## Repo conventions to follow

- Tailwind blur utility classes used consistently across the codebase

## Steps

1. Replace all three `blur-3xl` class names with `blur-2xl` in `page.tsx`:
   - Line 173: `blur-3xl` → `blur-2xl`
   - Line 178: `blur-3xl` → `blur-2xl`
   - Line 183: `blur-3xl` → `blur-2xl`

## Boundaries

- Do NOT change any other blur instances on the page
- Do NOT change the orb sizes, colors, or positions
- Do NOT touch `blur-3xl` in the dashboard or other files — only the landing page decorative orbs

## Verification

- **Mechanical**: `npx tsc --noEmit` passes
- **Feel check**: open the landing page hero section. The background orbs should look visually identical — the 40px vs 64px difference on low-opacity, large circles is imperceptible.
- DevTools Performance tab: confirm GPU/Composite layer count is unchanged or reduced.

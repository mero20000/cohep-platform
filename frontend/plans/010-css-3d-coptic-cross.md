# 010 — CSS/SVG 3D Coptic cross

- **Status**: DONE
- **Commit**: unknown
- **Severity**: LOW (additive)
- **Category**: Missed opportunity (CSS/SVG 3D approximation)
- **Estimated scope**: 2 files, ~120 lines added

## Problem

`src/app/page.tsx` hero section (lines 633-745) has decorative background elements (GradientOrbs, CrossPatternBg) but no 3D presence. A subtle 3D element in the hero — a Coptic cross that slowly rotates in perspective — would dramatically raise the perceived craft of the landing page. Since we have no 3D model asset, we build it with CSS 3D transforms and SVG.

## Target

A new `HeroCross3D` component: an SVG-based Coptic cross rendered in 3D perspective using CSS `transform-style: preserve-3d` and `rotateX`/`rotateY` with a subtle idle animation (slow orbit, spring-based). The cross should:
- Be positioned behind the hero text (lower z-index than content)
- Have ~10% opacity with a subtle gold gradient fill
- Slowly rotate in 3D space (one full Y rotation over ~30s, spring-driven)
- Respond to scroll with subtle parallax (slower than content)
- Fade out gracefully under `prefers-reduced-motion: reduce` (static with no rotation)

## Repo conventions to follow

- framer-motion `useScroll`/`useTransform`/`useSpring` pattern from dashboard hero (dashboard-client.tsx:253-258)
- SVG pattern usage via `CrossPatternBg` component in page.tsx:191-204
- Easing: `cubic-bezier(0.23, 1, 0.32, 1)` for the subtle float
- Spring: `{ stiffness: 60, damping: 15 }` for smooth, no-bounce idle motion

## Steps

1. Create a new component file `src/components/hero-cross-3d.tsx`:

```tsx
'use client'

import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion'

export function HeroCross3D() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const parallaxY = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : -25]), { stiffness: 80, damping: 20 })
  const parallaxRotate = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : 5]), { stiffness: 80, damping: 20 })

  if (reduce) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ perspective: '800px' }}>
        <CrossSVG className="opacity-[0.06] w-[500px] h-[500px]" />
      </div>
    )
  }

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      style={{ perspective: '800px', y: parallaxY }}
    >
      <motion.div
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        style={{ rotateX: 15, rotateZ: 0 }}
      >
        <CrossSVG className="opacity-[0.06] w-[500px] h-[500px]" />
      </motion.div>
    </motion.div>
  )
}

function CrossSVG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      {/* Vertical beam */}
      <rect x="85" y="20" width="30" height="160" rx="4" fill="url(#crossGrad)" />
      {/* Horizontal beam */}
      <rect x="35" y="75" width="130" height="30" rx="4" fill="url(#crossGrad)" />
      {/* Top crossbar (INRI) */}
      <rect x="60" y="45" width="80" height="16" rx="3" fill="url(#crossGrad)" />
      {/* Bottom slanted beam (footrest) */}
      <rect x="55" y="135" width="90" height="14" rx="3" fill="url(#crossGrad)" transform="rotate(-5 100 142)" />
      {/* Center circle (glory halo) */}
      <circle cx="100" cy="90" r="22" fill="none" stroke="url(#crossGrad)" strokeWidth="2" opacity="0.5" />
      <circle cx="100" cy="90" r="16" fill="none" stroke="url(#crossGrad)" strokeWidth="1" opacity="0.3" />
    </svg>
  )
}
```

2. Import and render `<HeroCross3D />` in `page.tsx` inside the hero section (line 633), above the `<CrossPatternBg />` line (639) so it sits between the gradient background and the pattern:

```tsx
<HeroCross3D />
<CrossPatternBg className="text-gold-500" />
```

3. Ensure the component file is properly imported:
```tsx
import { HeroCross3D } from '@/components/hero-cross-3d'
```

## Boundaries

- The cross is purely decorative — do NOT make it interactive
- Do NOT add any click/tap handlers
- Do NOT change the hero section layout or content
- The cross must not overlap or obscure hero text (its z-index is behind content via DOM order + opacity)
- The cross rotation is a full 360° Y-axis rotation over 30s — slow enough to be subliminal

## Verification

- **Mechanical**: `npx tsc --noEmit` passes
- **Feel check**: open the landing page hero. A faint gold Coptic cross should be visible in the background, very slowly rotating. It should not distract from the hero text.
- Scroll down — the cross should move slightly slower than the content (parallax), creating subtle depth.
- Toggle `prefers-reduced-motion: reduce` in DevTools Rendering panel — the cross should be static (no rotation, no parallax).
- The cross should be invisible at mobile sizes (behind text) or very faint — test at 375px width.

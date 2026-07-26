# 004 — Animate PreviewCarousel tab transitions

- **Status**: TODO
- **Commit**: unknown
- **Severity**: HIGH
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~20 lines changed

## Problem

`src/app/page.tsx:245-518` — `PreviewCarousel` renders 4 platform mockup SVGs (Dashboard, Students, Attendance, Gamification). Switching tabs via `setActiveTab` instantly swaps `previews[activeTab].content` with no transition — the entire mockup phone screen blinks to the next view. On a marketing landing page this is the single most prominent visual element, and the snap reads as unfinished.

Current at line 495-498:
```tsx
<div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-white">
  <div className="h-full w-full overflow-hidden">
    {previews[activeTab].content}
  </div>
</div>
```

## Target

Wrap the mockup content area in `AnimatePresence` with a direction-aware slide + fade transition. The content slides left when advancing to the next tab (right-to-left direction for Arabic), and right when going back. This gives spatial continuity — each screen feels connected to the previous one.

Exit animation: slide out in the opposite direction + fade out (200ms, ease-out).
Enter animation: slide in from the new direction + fade in (250ms, ease-out).

## Repo conventions to follow

- `AnimatePresence` usage in `src/components/ui/modal.tsx:54-88` — pattern for wrapping conditional content with enter/exit animations
- framer-motion `motion.div` with `initial`/`animate`/`exit` props
- Easing: `cubic-bezier(0.23, 1, 0.32, 1)` (the project's strong ease-out, same as modal.tsx:63,70)

## Steps

1. In `src/app/page.tsx`, add `AnimatePresence` to the framer-motion import (line 5):
   ```tsx
   import { motion, useInView, AnimatePresence } from 'framer-motion'
   ```

2. Track the previous tab index to determine slide direction. Add after `const [activeTab, setActiveTab] = useState(0)` (line 246):
   ```tsx
   const [prevTab, setPrevTab] = useState(0)
   ```
   And update `setActiveTab` calls to also store the previous value. Replace line 505:
   ```tsx
   <button key={p.label} onClick={() => { setPrevTab(activeTab); setActiveTab(i) }}
   ```

3. Compute slide direction:
   ```tsx
   const direction = activeTab > prevTab ? 1 : -1
   ```

4. Replace the static content div (lines 495-498) with AnimatePresence:
   ```tsx
   <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-white">
     <AnimatePresence mode="wait" custom={direction}>
       <motion.div
         key={activeTab}
         custom={direction}
         initial={{ opacity: 0, x: direction * 60 }}
         animate={{ opacity: 1, x: 0 }}
         exit={{ opacity: 0, x: direction * -60 }}
         transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
         className="h-full w-full"
       >
         {previews[activeTab].content}
       </motion.div>
     </AnimatePresence>
   </div>
   ```

## Boundaries

- Do NOT change the mockup SVG content inside each preview
- Do NOT change the phone frame (`.rounded-[14px] bg-gray-800 p-2 sm:p-3 shadow-2xl`)
- Do NOT change the tab button styling or behavior
- Direction must flip for RTL (`isAr ? -direction : direction`)

## Verification

- **Mechanical**: `npx tsc --noEmit` passes
- **Feel check**: open the page, click between Dashboard / Students / Attendance / Gamification tabs. Content should slide left when advancing, right when going back, with no snap or blink.
- In DevTools Animations panel, set playback to 10% and confirm the slide path is smooth
- Toggle Arabic (`عربي` button) and confirm direction reverses

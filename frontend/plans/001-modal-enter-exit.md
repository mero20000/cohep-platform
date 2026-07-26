# 001 — Animate modal enter/exit with AnimatePresence

- **Status**: TODO
- **Commit**: N/A (no git repo)
- **Severity**: HIGH
- **Category**: Missed opportunities / preventing jarring change
- **Estimated scope**: 1 file (`src/components/ui/modal.tsx`)

## Problem

The `<Modal>` component at `src/components/ui/modal.tsx:52` renders with `if (!open) return null` — the overlay and content panel appear and disappear instantly with zero animation. This is the most noticeable seam in the daily dashboard experience because every modal (settings, students, attendance, assessments, curriculum) goes through this single component.

Current code:

```tsx
// src/components/ui/modal.tsx:52-61
if (!open) return null

return (
    <div ref={overlayRef} role="dialog" aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}>
      <div ref={contentRef} tabIndex={-1}
        className="w-full {sizeMap[size]} rounded-2xl bg-white shadow-xl max-h-[95vh] flex flex-col outline-none"
        onClick={e => e.stopPropagation()}>
```

The overlay's `bg-black/40` appears instantly, and the content panel teleports in. On close, both vanish instantly. This fails the "preventing a jarring change" purpose for an Occasional-frequency element — modals are the right tier for standard animation (200–500ms).

## Target

Use framer-motion's `AnimatePresence` + `motion.div` (already installed, v12.42.2) for enter/exit transitions:

- **Overlay**: fade opacity 0→1 on enter, 1→0 on exit — `200ms ease-out`
- **Content panel**: scale from `scale(0.95)` + `opacity: 0` → `scale(1)` + `opacity: 1` on enter, reverse on exit — `250ms ease-out`
- **Easing**: `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out per AUDIT.md)
- The exit animation on close must complete before unmount (AnimatePresence handles this)

Target code:

```tsx
import { AnimatePresence, motion } from 'framer-motion'

// In the return:
<AnimatePresence>
  {open && (
    <motion.div
      key="modal-overlay"
      ref={overlayRef} role="dialog" aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <motion.div
        key="modal-content"
        ref={contentRef} tabIndex={-1}
        className="w-full {sizeMap[size]} rounded-2xl bg-white shadow-xl max-h-[95vh] flex flex-col outline-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* existing content unchanged */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

## Repo conventions to follow

- framer-motion is already installed (`package.json:21` — `"framer-motion": "^12.42.2"`) and used in `src/app/page.tsx` with identical `motion.div` + `initial`/`animate` patterns (e.g. `page.tsx:172-176`)
- The existing `.animate-scale-in` CSS class (`globals.css:192`) uses the same pattern: `opacity 0→1, scale(0.95→1)` — the framer-motion version mirrors it
- No other dashboard component uses framer-motion currently, but the library is available. Using it in Modal is the highest-leverage first use since it touches every modal in the app

## Steps

1. **Add imports** at the top of `src/components/ui/modal.tsx`:
   - Add `AnimatePresence, motion` to the framer-motion import (or add `import { AnimatePresence, motion } from 'framer-motion'` if none exists)

2. **Replace the conditional return block** — remove the `if (!open) return null` guard and wrap the JSX in `<AnimatePresence>`:
   - Before: `if (!open) return null` on line 52
   - After: Move the `{open && (...)}` condition inside the `<AnimatePresence>` block

3. **Convert the overlay `<div>` to `<motion.div>`** with `initial`, `animate`, `exit`, and `transition` props as specified in the Target above. Keep all existing classes, refs, event handlers, and ARIA attributes.

4. **Convert the content `<div>` to `<motion.div>`** with `initial`, `animate`, `exit`, `transition` props. Keep all existing classes, refs, and event handlers.

5. **Remove the `if (!open) return null` line** (line 52) — it is no longer needed since AnimatePresence handles the conditional rendering.

## Boundaries

- Do NOT change the Modal component's props, event handlers, focus management, or keyboard behavior
- Do NOT change the content structure, classes, or styling of the modal
- Do NOT touch any consumer of Modal (confirm-dialog, settings pages, etc.) — the change flows through automatically
- Do NOT remove the `overflow: hidden` body scroll lock or the escape key handler — they must remain

## Verification

- **Mechanical**: `npm run lint && npx tsc --noEmit` — must pass with no errors
- **Feel check**: open any modal in the app (e.g. settings → Add School) and confirm:
  - On open: overlay fades in, content scales up from 0.95→1 over ~250ms
  - On close (click overlay, press Escape, click close button): content scales down to 0.95 + fades out, THEN overlay fades out, THEN component unmounts
  - In DevTools (Animations panel at 10% speed): confirm the easing curve starts fast (ease-out), not slow
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel) and confirm animations are disabled but the modal still opens/closes
- **Done when**: all modals in the app animate on enter and exit, and no type/lint errors

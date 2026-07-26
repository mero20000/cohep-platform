# 002 — Animate DetailDrawer exit with drawer-out animation

- **Status**: TODO
- **Commit**: N/A (no git repo)
- **Severity**: MEDIUM
- **Category**: Spatial consistency / missing exit animation
- **Estimated scope**: 1 file (`src/components/ui/detail-drawer.tsx`)

## Problem

The `<DetailDrawer>` component at `src/components/ui/detail-drawer.tsx:35` has an enter animation (`animate-drawer-in` on line 46) but NO exit animation — when the drawer closes, the panel slides back instantly, breaking spatial consistency.

Current code:

```tsx
// src/components/ui/detail-drawer.tsx:35-46
if (!open) return null

return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-xl flex flex-col outline-none animate-drawer-in"
      >
```

The CSS class `.animate-drawer-in` is defined at `globals.css:152-154`:
```css
@keyframes drawer-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
.animate-drawer-in {
  animation: drawer-in 0.3s ease-out both;
}
```

A sibling class `.animate-drawer-out` already exists at `globals.css:166-168`:
```css
@keyframes drawer-out {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}
.animate-drawer-out {
  animation: drawer-out 0.2s ease-in both;
}
```

...but it's never used.

## Target

Add a `closing` state that applies `.animate-drawer-out` before unmounting, and fades the backdrop. After the exit animation completes (200ms), unmount the component.

## Repo conventions to follow

- The `closing` state pattern matches how CSS exit animations work without AnimatePresence: set a flag, render with exit class, setTimeout to unmount (e.g. `src/components/ui/toast.tsx:72` uses a similar pattern for its slideIn animation)
- `.animate-drawer-out` is already defined in `globals.css:166-168` — no new CSS needed
- The backdrop has no animation currently; add a `transition: opacity 200ms ease-out` to it

## Steps

1. **Add `closing` state** at the top of the component (after the `panelRef`):
   ```tsx
   const [closing, setClosing] = useState(false)
   ```
   Import `useState` from React (add to the existing `useEffect, useRef` import on line 3).

2. **Add a close handler** that triggers the exit animation before unmounting. Replace the direct `onClose` calls with this wrapper:
   ```tsx
   const handleClose = () => {
     if (closing) return
     setClosing(true)
     setTimeout(() => {
       setClosing(false)
       onClose()
     }, 200)
   }
   ```

3. **Guard the early return** — change line 35 from:
   ```tsx
   if (!open) return null
   ```
   to:
   ```tsx
   if (!open && !closing) return null
   ```

4. **Replace direct `onClose` calls** with `handleClose`:
   - Backdrop `onClick={onClose}` → `onClick={handleClose}`
   - Escape key handler `onClose()` → `handleClose()` (line 21)
   - Close button `onClick={onClose}` → `onClick={handleClose}` (line 55)

5. **Add exit animation classes to the panel** — replace the single `animate-drawer-in` class with conditional classes:
   ```tsx
   className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-xl flex flex-col outline-none ${
     closing ? 'animate-drawer-out' : 'animate-drawer-in'
   }`}
   ```

6. **Add backdrop transition** — add `transition-opacity duration-200` to the backdrop div:
   ```tsx
   <div className="fixed inset-0 bg-black/40 transition-opacity duration-200" onClick={handleClose} />
   ```

## Boundaries

- Do NOT change the enter animation (`animate-drawer-in`) — it works correctly
- Do NOT change the drawer's structure, content, or styling
- Do NOT modify `globals.css` — `.animate-drawer-out` already exists
- Do NOT add framer-motion or any new dependencies

## Verification

- **Mechanical**: `npm run lint && npx tsc --noEmit` — must pass with no errors
- **Feel check**: open any detail drawer (e.g. student detail) and close it:
  - On open: drawer slides in from the right over 300ms (unchanged)
  - On close: drawer slides back to the right over 200ms, THEN backdrop fades, THEN component unmounts
  - Spamming the close button while animating should not re-trigger (the `if (closing) return` guard prevents this)
  - In DevTools (Animations panel at 10% speed): confirm both directions are smooth
- **Done when**: the drawer exits with a visible slide-out animation matching the enter direction and speed, with no type/lint errors

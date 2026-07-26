# 005 — Animate FAQ collapse/expand

- **Status**: TODO
- **Commit**: unknown
- **Severity**: HIGH
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~15 lines changed

## Problem

`src/app/page.tsx:947-953` — FAQ items use native `<details>`/`<summary>` elements. The chevron rotates smoothly (CSS `transition-transform duration-200 group-open:rotate-90`) but the answer panel snaps open/closed with no height animation. On a landing page this is the most frequently interacted-with element, and the snap is jarring.

Current code:
```tsx
<details className="group rounded-xl border border-gray-200 bg-white p-5 open:border-gold-200 open:shadow-sm transition-all">
  <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-gray-900 list-none">
    {item.q}
    <ChevronRight className="h-4 w-4 text-gray-400 transition-transform duration-200 group-open:rotate-90 rtl-flip" />
  </summary>
  <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.a}</p>
</details>
```

## Target

Replace native `<details>`/`<summary>` with a custom accordion using framer-motion `AnimatePresence` and `motion.div` with height animation. The content panel animates open with a `max-height` / `scaleY` reveal (200ms, ease-out). The chevron rotation is preserved.

## Repo conventions to follow

- `AnimatePresence` pattern in `modal.tsx:54-88`
- framer-motion `motion.div` with `initial`/`animate`/`exit`

## Steps

1. Replace `<details>` with a clickable `<div>` that tracks `open` state per item. Convert `t.faq.map` to use local state:

   ```tsx
   const [openFaq, setOpenFaq] = useState<number | null>(null)
   ```

2. Replace the `<details>` block (lines 947-953):
   ```tsx
   <div className="rounded-xl border border-gray-200 bg-white p-5 transition-all">
     <button
       onClick={() => setOpenFaq(openFaq === i ? null : i)}
       className="flex w-full cursor-pointer items-center justify-between text-sm font-semibold text-gray-900 list-none"
     >
       {item.q}
       <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform duration-200 rtl-flip ${openFaq === i ? 'rotate-90' : ''}`} />
     </button>
     <AnimatePresence initial={false}>
       {openFaq === i && (
         <motion.div
           key="answer"
           initial={{ height: 0, opacity: 0 }}
           animate={{ height: 'auto', opacity: 1 }}
           exit={{ height: 0, opacity: 0 }}
           transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
           className="overflow-hidden"
         >
           <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.a}</p>
         </motion.div>
       )}
     </AnimatePresence>
   </div>
   ```

3. When `height: 'auto'` in framer-motion, use `overflow: hidden` on the motion.div to prevent content spill during animation. Add `overflow-hidden` to the className.

## Boundaries

- Do NOT change FAQ content, styling, or layout structure beyond the animation
- Do NOT remove the chevron rotation
- The `open:border-gold-200 open:shadow-sm` classes on `<details>` should be replaced with conditional classes: `openFaq === i ? 'border-gold-200 shadow-sm' : ''`

## Verification

- **Mechanical**: `npx tsc --noEmit` passes
- **Feel check**: click a FAQ question. The answer panel should slide open smoothly (not snap). Click again — it should close with the same smooth animation.
- Click a second FAQ while the first is open — the first should close smoothly while the second opens.
- Confirm no layout shift during the animation (content below FAQ should not jump).

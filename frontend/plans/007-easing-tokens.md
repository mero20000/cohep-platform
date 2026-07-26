# 007 — Consolidate easing tokens

- **Status**: DONE
- **Commit**: unknown
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 3 files, ~10 lines added/changed

## Problem

The codebase has multiple hand-typed easing values with no shared tokens:

| Location | Easing |
|---|---|
| `page.tsx:63,70` (modal) | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `page.tsx:213` (FadeInUp) | `'easeOut'` (CSS default ease-out) |
| `page.tsx:237` (SectionBadge) | `'easeOut'` (CSS default) |
| `globals.css:137-168` (keyframes) | `ease-out` (CSS default) |
| `button.tsx:6` (Button) | `ease-out` (CSS default) |
| `detail-drawer.tsx:57` | CSS keyframe with `ease-out` |

CSS default `ease-out` (`cubic-bezier(0, 0, 0.58, 1)`) starts slower and decelerates less aggressively than the strong custom curve `(0.23, 1, 0.32, 1)` used in the modal. This inconsistency means some UI feels snappier than others for no deliberate reason.

## Target

Define two shared easing CSS custom properties in `globals.css` and reference them via Tailwind's `theme.extend.transitionTimingFunction`. Replace all hand-typed easings with these tokens.

- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` — strong ease-out for UI entrances
- `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` — strong ease-in-out for on-screen movement

## Repo conventions to follow

- Tailwind config extends theme (check `tailwind.config.ts` for existing `transitionTimingFunction` or `extend` patterns)
- CSS custom properties already exist in `globals.css` (gold palette: `--gold-50` through `--gold-900`)

## Steps

1. Add easing tokens to `src/app/globals.css` in the `:root` block (after line 26 or near the gold variables):
   ```css
   --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
   --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
   ```

2. In `tailwind.config.ts`, extend `transitionTimingFunction`:
   ```ts
   theme: {
     extend: {
       transitionTimingFunction: {
         'out-strong': 'var(--ease-out)',
         'in-out-strong': 'var(--ease-in-out)',
       },
     },
   },
   ```

3. Replace hand-typed `ease-out` in CSS keyframes in `globals.css` lines 137-168 with `var(--ease-out)`.

4. In `src/components/ui/button.tsx:6`, change `duration-100 ease-out` → `duration-100 ease-out-strong`.

5. In `src/app/page.tsx`:
   - Line 63,70 (modal transitions): already uses `cubic-bezier(0.23, 1, 0.32, 1)` — replace with `ease-out-strong` (but these are framer-motion `ease` props, which take CSS easing strings directly)
   - Line 213 (FadeInUp): `ease: 'easeOut'` → `ease: 'easeOut'` (framer-motion `easeOut` maps to CSS `ease-out`; if using the custom curve, change to `[0.23, 1, 0.32, 1]`)

6. In `src/app/page.tsx:237` (SectionBadge), same as above.

## Boundaries

- Do NOT change duration values — only easing curves
- Do NOT touch framer-motion `spring` or `tween` configs that aren't using CSS ease strings
- Do NOT change the modal's cubic-bezier since it already uses the target curve

## Verification

- **Mechanical**: `npx tsc --noEmit` passes
- **Feel check**: open the page, trigger modal, hover buttons — all should feel equally responsive with the same deceleration curve
- Confirm no regression: modals, drawers, and hover effects should feel snappier or identical to before

# Accessibility Audit — COHEP Frontend

**Date:** 2026-08-31
**Scope:** `frontend/src` — 208 `.tsx` files
**Standard:** WCAG 2.1 Level AA
**Method:** static analysis of the component tree and shared primitives, plus behavioural tests written against the shared controls. Not a substitute for a screen-reader pass or an automated axe run in a real browser — see [Not covered](#not-covered).

---

## Summary

The app has a better a11y baseline than most codebases of this size. Skip links exist on both shells, 263 `aria-label`s are in place, `useReducedMotion` is respected in the modal, and the design system already defines a single correct focus treatment (`ds.focusRing`).

The gap was concentrated in **one place: form controls**. Across 208 files there was exactly **1** `aria-invalid` and **4** `aria-describedby`. Every validation error in the app was visible but not programmatically associated with its field — a sighted user saw red text, a screen-reader user heard nothing. Because nearly all forms route through two shared primitives, this was fixable centrally rather than file by file.

| Severity | Finding | Status |
|---|---|---|
| **Critical** | Date picker was entirely keyboard-inaccessible | ✅ Fixed |
| **Critical** | Form errors not associated with their controls (1 `aria-invalid` app-wide) | ✅ Fixed in primitive |
| **Serious** | Modal did not trap focus — Tab walked into the page behind | ✅ Fixed |
| **Serious** | `required` conveyed only by a red asterisk | ✅ Fixed in primitive |
| **Serious** | Duplicate `id`s in `FormField` and `Modal` broke label association | ✅ Fixed |
| **Serious** | `role="dialog"` on the backdrop, not the focused panel | ✅ Fixed |
| **Moderate** | Invalid ARIA grid in the calendar (cells with no rows) | ✅ Fixed |
| **Moderate** | Validation messages hard-coded English in a bilingual app | ✅ Fixed |
| **Moderate** | ~398 uses of `text-gray-400` (2.54:1 — fails AA) | ⚠️ Partly; systemic |
| **Moderate** | `ds.focusRing` used in only 5 files | ⚠️ Partly; systemic |
| **Low** | 2 focusable inputs with no visible focus indicator | ⚠️ Open |
| **Low** | Sparse `aria-live` coverage for async results (11 files) | ⚠️ Open |

---

## Critical

### 1. The date picker could not be used without a mouse

`DatePicker` rendered a `readOnly` text input whose only affordance was `onClick`, opening a grid of 31 buttons. A keyboard user could focus the field, but no key opened it; nothing in the markup indicated a calendar existed. This fails **2.1.1 Keyboard (A)** outright — for a field appearing in registration, attendance, assessments and student records.

Fixed by implementing the ARIA combobox + grid pattern:

- `role="combobox"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`
- Opens on `Enter`, `Space`, `ArrowDown`
- Roving-tabindex grid: arrows move by day, `ArrowUp`/`Down` by week, `Home`/`End` to month ends, `PageUp`/`PageDown` by month, `Shift` for a year
- `Enter`/`Space` commits; `Escape` closes without committing; focus returns to the field either way
- Each day carries its full date as an accessible name; today gets `aria-current="date"`, the selection `aria-selected`
- Out-of-range days use `aria-disabled` rather than `disabled`, so arrow navigation never dead-ends on a blocked cell

Browsing the calendar deliberately does **not** change the value — only an explicit commit does. 16 tests cover this in `date-picker.test.tsx`.

### 2. Validation errors were invisible to assistive technology

`FormField` rendered errors as `<p role="alert">` but never linked them to the input. There was no `aria-invalid` and no `aria-describedby`. A screen-reader user tabbing to a failed field heard its label and nothing else — no indication it was invalid, and no way to reach the reason. Fails **3.3.1 Error Identification (A)** and **1.3.1 Info and Relationships (A)**.

Fixed in the primitive, so all 15 consuming files benefit without change:

- `aria-invalid` when an error is present
- `aria-describedby` linking the error **and** the hint (the hint usually states the format the error is complaining about, so suppressing it exactly when the user got it wrong was the wrong trade — the old code hid the hint whenever an error showed)
- `role="alert"` retained for announcement

---

## Serious

### 3. The modal did not trap focus

`Modal` handled `Escape` and restored focus on close, but Tab walked straight out of the dialog into the page behind it — which remained fully reachable and operable while visually obscured. Fails **2.4.3 Focus Order (A)**.

Fixed with a wrapping trap on the panel. Worth noting: the first implementation filtered candidates by `el.offsetParent !== null` as a visibility check. A test caught that this silently drops every `position: fixed` element (its `offsetParent` is `null` by spec, not only in jsdom). The check is now based on `hidden`/`aria-hidden`.

### 4. `required` was decoration only

`FormField` rendered a red `*` but passed nothing to the control. Assistive tech had no way to know a field was mandatory. Now sets both `required` and `aria-required`, and the asterisk is `aria-hidden` so it is not read as punctuation.

### 5. Duplicate `id`s broke label association

Two independent bugs of the same shape:

- `FormField` derived its `id` from the label text (`label.toLowerCase().replace(/\s+/g, '-')`). Any two fields sharing a label — "Name" appears in many forms, and two were adjacent in the pending-registrations editor — produced the same `id`, so the second `<label for>` pointed at the *first* input. Clicking the second label focused the wrong field.
- `Modal` hard-coded `id="modal-title"` and `id="modal-desc"`. With two modals mounted, `aria-labelledby` resolved to whichever came first in the document, so a dialog could announce another dialog's title.

Both now use `useId()`.

### 6. Dialog semantics sat on the backdrop

`role="dialog"`, `aria-modal` and `aria-labelledby` were on the full-screen overlay, while `tabIndex={-1}` and actual focus were on the inner panel. The named element and the focused element disagreed. Moved onto the panel.

---

## Moderate

### 7. Invalid ARIA grid

The calendar applied `role="grid"` with `role="gridcell"` children and **no `role="row"` between them**. An `owns`-less grid without rows is invalid, and screen readers stop reporting row/column position. Rebuilt as a proper header-row + week-row nest.

### 8. Validation messages were English-only

Every message in the app's most-validated form (`auth/register`) was a hard-coded English string — `'Email is required'`, `'Passwords do not match'` — in an app that otherwise threads `t(en, ar)` through every label. Arabic users got Arabic labels and English errors. Fails **3.3.1** in spirit and is a plain i18n defect.

The new `lib/validation.ts` makes bilingual messages structural: a rule returns `{ en, ar }` and the language is resolved at render.

### 9. Contrast: `text-gray-400` (2.54:1)

398 occurrences across 86 files. On white, Tailwind's `gray-400` (`#9ca3af`) is **2.54:1** — it fails **1.4.3 Contrast (AA)**'s 4.5:1 for body text and even the 3:1 large-text floor. `gray-500` is 4.83:1 and passes.

A worked example, because it shows `gray-500` is not always a sufficient fix — the register form's step indicator (`auth/register/page.tsx:360`) renders future steps as `bg-gray-100 text-gray-400`:

| Foreground on `gray-100` | Ratio | AA (4.5:1) |
|---|---|---|
| `text-gray-400` (current) | 2.31:1 | ✗ |
| `text-gray-500` | 4.39:1 | ✗ (just short) |
| `text-gray-600` | 6.87:1 | ✓ |

So the sweep cannot be a blind `gray-400` → `gray-500` replace: on any tinted surface it needs `gray-600`. Worth deciding once, centrally.

Changed in the primitives I touched (`FormField` hints, calendar weekday headers). **The remaining ~390 are a systemic sweep I have not done** — it is a one-line-per-site change but it is a visible, app-wide restyle that should be a deliberate decision, not a side effect of this track.

Related: I verified `gold-500` is **not** safe as a background for white text. It is a themeable accent (five themes remap it) and at default `rgb(201,160,48)` white-on-gold is 2.45:1. The calendar's selected day therefore uses `gold-700`, which measures 4.98:1 and clears AA in all five themes (the other four resolve to 5.02–8.08:1).

### 10. Focus ring is defined but barely used

`ds.focusRing` in `ds/tokens.ts` is documented as "one consistent, visible treatment everywhere". It is referenced in **5** files. Everything else hand-rolls a ring, and the treatments disagree — `date-picker` combined `focus:border-gold-500` with `focus:ring-blue-500` on the same element, mixing two accents by accident.

Adopted in the components I touched. The broader migration is open.

---

## Low / open

### 11. Two inputs with no visible focus indicator

`focus:outline-none` with no replacement ring:

- `dashboard/gamification/page.tsx:976`
- `dashboard/gamification/page.tsx:1302` (the destructive "type RESET to confirm" input)

Fails **2.4.7 Focus Visible (AA)**. The second is on a confirmation for an irreversible bulk delete, which is a poor place to lose the caret. Two other matches are benign: a `tabIndex={-1}` alert target and a `readOnly` field.

### 12. Async results are not announced

`aria-live` appears in 11 of 208 files. Save/delete/filter results generally update silently, so a screen-reader user gets no confirmation that an action succeeded. Not a violation on its own, but the reason the app feels unresponsive under assistive tech. A single shared live region wired into the existing toast system would cover most of it.

---

## Not covered

State this plainly rather than implying the audit is complete:

- **No automated axe/Lighthouse run** — needs the app running against a real browser and seeded data.
- **No screen-reader pass** (VoiceOver/NVDA). Static analysis finds missing attributes; only listening finds bad announcement order and wrong reading of composite widgets.
- **RTL visual verification.** I fixed a popup that anchored to the wrong edge and mirrored the calendar's horizontal arrow keys, and the arrow mirroring is covered by a test — but Arabic layout was not reviewed visually across the app.
- **Charts.** `@nivo` and `recharts` render inline SVG with no text alternative. Data visualisations are usually the largest remaining a11y gap in a dashboard app and were not examined.
- **Colour-blind safety** of status colours (green/amber/red badges) — these encode meaning by hue with a text label alongside, which is probably fine, but was not verified against **1.4.1 Use of Colour**.
- **Zoom/reflow at 400%** (1.4.10) and **tap-target sizes** (2.5.5). `ds.tapTarget` exists; adoption was not measured.

## Recommended order

1. Wire the new `useFormValidation` + `FormField` a11y through the remaining forms (see track 1 notes) — the primitives are ready, the forms are not yet using them.
2. Fix the two `focus:outline-none` inputs. Trivial, and one guards a destructive action.
3. Run axe against the running app. Cheap, and will surface things static analysis structurally cannot.
4. Decide on the `text-gray-400` → `gray-500` sweep as one deliberate visual change.
5. Migrate hand-rolled focus rings to `ds.focusRing`, mechanically.
6. Give charts text alternatives / data tables.

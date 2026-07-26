# Post-MVP Audit — Landing Page Redesign

## 1. Concerns Mentioned in Task Reports

### Task 1 — Content Object
- **Footer description hardcoded in JSX** (`page.tsx` ~line 1048): Inline `{isAr ? '...' : '...'}` instead of `t.footer.desc`. The `t.footer.desc` values exist but are unused.
- **Footer links hardcoded in JSX** (`page.tsx` ~lines 1052-1054): Inline ternaries instead of `t.footer.links`, `t.footer.features`, `t.footer.curriculum`, etc. Values exist but unused.
- **Testimonials count reduced from 3 to 1**: JSX renders 1 card centered. Intentional per spec but looks sparse — should update JSX to handle dynamic counts gracefully.

### Task 3 — Core Sections
- **No `t.approach.badge` key exists**: The "Three Pillars" section badge is hardcoded as "Curriculum Deep Dive" / "المنهج التفصيلي" (`page.tsx:1029`). The section was renamed to "The COHEP Approach" in the section comment but the badge and data keys (`t.pillarsTitle`, `t.pillarsSubtitle`) were never renamed. Content object still uses `pillars` keys, not `approach.*`.

### Task 4 — Open Source + FAQ
- **GitHub link is a placeholder**: `page.tsx:1129` — `href="https://github.com"` points to github.com root, not the actual COHEP repository. Needs the real repo URL.

### Task 6 — Visual Refinements
- **"N" logo remnant in dashboard/gamification** (`dashboard/gamification/page.tsx:389`): `>N<` in badge icon preview. Flagged as out of scope for this landing page task but still exists in the app.

### Task 9 (Non-Code) — Testimonial Outreach
- **Entire task deferred**: No real testimonials collected. The testimonial section uses a single placeholder: `{ name: '—', role: '—', quote: 'Testimonials from our church partners are coming soon...', rating: 0 }` (`page.tsx:112`). Requires human outreach to churches.

---

## 2. Code Issues Found by Grep

### `bg-blue-5*` in page.tsx — Remaining Blue Backgrounds

Most remaining blues are intentional (PreviewCarousel mockups representing the real app UI, nav active states, GradientOrbs decorative elements). However:

| Line | Issue | Category |
|------|-------|----------|
| `page.tsx:72-73` | Feature data `features` entries use `bg: 'bg-blue-50'` for card icon backgrounds | **Should review** — these are in the data object for old feature cards that are no longer rendered (the old Features section was removed in Task 3). The data still exists in the content object but is dead code. |
| `page.tsx:192-193` | Same as above, Arabic versions | Dead code in content object |
| `page.tsx:278,283` | `GradientOrbs` component uses `bg-blue-500/10` | **Intentional** — decorative element, kept blue per Task 6 |
| `page.tsx:369-370` | PreviewCarousel: student progress bars with `bg-blue-50` / `bg-blue-500` | **Intentional** — mock app UI |
| `page.tsx:378,380` | PreviewCarousel stats: `color: 'bg-blue-500'` | **Intentional** — mock app UI |
| `page.tsx:439` | PreviewCarousel: `bg-blue-500` dummy chart bar | **Intentional** — mock app UI |
| `page.tsx:478` | PreviewCarousel: date grid highlight `bg-blue-500` | **Intentional** — mock app UI |
| `page.tsx:524-525` | PreviewCarousel: status badge `bg-blue-50` / `bg-blue-500` | **Intentional** — mock app UI |
| `page.tsx:558` | PreviewCarousel: leaderboard XP bar `color: 'bg-blue-500'` | **Intentional** — mock app UI |
| `page.tsx:621` | PreviewCarousel tab active state: `bg-blue-500 text-white shadow-lg shadow-blue-200` | **Should review** — this is the tab button active style, still blue |
| `page.tsx:705` | "Why COHEP" section icon: `bg-blue-50 text-blue-700` | **Should review** — this is in the actual landing page content, not mock UI |
| `page.tsx:728-731` | Nav active states: `bg-blue-50 text-blue-700` | **Intentional** — kept blue for nav interactivity per Task 6 |

### `#features` Anchor Links
- **None found** — all previously identified `#features` links were changed to `#why` (Task 3 nav, Task 5 footer). ✓ Clean.

### Fabricated Student Names ("Peter Adly" etc.)
- **None found in page.tsx** — Task 6 replaced all: Peter Adly → Mina Bishoy, Peter A. → Mina B., Mariam Sameh → Mariam Talaat, George K. → Bishoy H. ✓ Clean.

### "N" Placeholder Logo Remnants
- **None found in page.tsx** ✓ Clean.

### `shadow-blue` in page.tsx
- **`page.tsx:621`**: `shadow-lg shadow-blue-200` — PreviewCarousel tab active state. Task 6 report says "Changed all" shadow-blues to shadow-gold, but this one on the tab button still uses blue. Partial miss.

---

## 3. Items from the Plan Explicitly Skipped or Deferred

### From the Plan
- **Task 9 (Non-Code): Real Testimonial Outreach** — Entirely deferred. Requires human action.
- **"View the Curriculum" CTA links to `/auth/register`** (plan note, line 417): No standalone `/curriculum` page exists yet. The secondary CTA button and nav both point to `/auth/register` as a placeholder.
- **The COHEP Approach section was never properly renamed**: The plan (line 88) says to rename "pillars" → "approach". The section comment was updated to `{/* The COHEP Approach */}` (`page.tsx:1025`) but the content object still uses `pillarsTitle`/`pillarsSubtitle`/`pillars` keys, and the badge still reads "Curriculum Deep Dive" / "المنهج التفصيلي" (`page.tsx:1029`). No `t.approach.*` keys exist.

### From Task Reports
- **Old `features` data still in content object**: The 14-card feature grid (`content.en.features`, `content.ar.features`) is no longer rendered (the JSX section was removed in Task 3), but the data objects remain in the content object. Dead code — should be pruned.
- **Old `nav.features` key removed** but `content.en.nav.features` might still exist (need to verify).

---

## 4. Items That Should Be Fixed Before Calling This Done

### P0 — Must Fix
1. **GitHub placeholder URL** — `page.tsx:1129`: Replace `href="https://github.com"` with the actual COHEP repo URL.
2. **Approach section badge still says "Curriculum Deep Dive"** — `page.tsx:1029`: Should say "The COHEP Approach" / "منهج كوهيب" (or similar). Either add `t.approach.badge` to the content object, or update the hardcoded string.
3. **`shadow-blue-200` on tab active state** — `page.tsx:621`: Should be `shadow-gold-200` for consistency with the gold palette. The tab button `bg-blue-500` may also want review (it's the only blue active state in the UI chrome).

### P1 — Should Fix
4. **Why COHEP section icon uses blue** — `page.tsx:705`: `bg-blue-50 text-blue-700` should be `bg-gold-50 text-gold-700` to match the gold brand palette.
5. **Footer hardcoded text** — `page.tsx:~1048-1054`: Footer description and links use inline ternaries instead of `t.footer.*` keys. The values exist in the content object but are unused.
6. **Old `features` data is dead code** — `page.tsx:54-87` (EN) and `page.tsx:174-207` (AR): The `features` array in the content object is no longer rendered by any JSX. Should be removed to avoid confusion.

### P2 — Nice to Have
7. **App-wide "N" logo in gamification dashboard** — `dashboard/gamification/page.tsx:389`: `>N<` in badge icon preview. Not on the landing page but still in the app.
8. **Testimonials placeholder** — `page.tsx:112`: Single placeholder testimonial with dashes for name/role. Looks incomplete on the page. Consider a more polished placeholder card or a "contribute your story" CTA.
9. **"Curriculum" footer link points to `#approach`** — `page.tsx:1265`: The footer link labeled "Curriculum" (EN) / "المنهج" (AR) points to `#approach`. Either rename the link text or the target anchor ID for consistency.
10. **Content object still uses `pillarsTitle/pillarsSubtitle/pillars`** — If the intent was to rename to `approach.*`, the content object keys need updating (and all JSX references).

---

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Known concerns from reports | 6 | Mixed (1 P0, 3 P1, 2 P2) |
| Code issues from grep | 2 remaining (shadow-blue, blue icon in Why section) | P1 |
| Deferred/skipped from plan | 2 (testimonials outreach, curriculum page) | External |
| Dead code | 1 (features array) | P1 |

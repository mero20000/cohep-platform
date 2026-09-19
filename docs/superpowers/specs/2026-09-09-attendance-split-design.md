# Attendance Split Design — Mark / Manage / Insights

Date: 2026-09-09
Status: Proposed — awaiting user review
Scope: `frontend/src/app/dashboard/attendance/*`, sidebar Attendance entry
Non-goals: backend API changes, Prisma changes, mobile app, offline queue

## 1. Problem

`attendance-client.tsx` (1561 lines) does 4 jobs in 1 route: sessions CRUD + marking + stats + by-student lookup. Evidence:

- 85× `console.error` repo-wide, 9 still in attendance-client (lines 199,216,230,291,328,449,479,495,562,600) alongside toasts — no `ErrorState + Retry`, `tempMarks` preserved by accident.
- Color-only status (`STATUS_COLORS` green/amber/red/gray, `STATUS_ICONS`), `title` only for sighted users.
- Targets half-fixed: status `p-3` + dots `h-9 w-9` done (lines 996,1036,1054 with `aria-label`/`aria-pressed`/`focus-visible:ring-gold-500`), but filters `min-h-[40px]`, checkboxes `h-5 w-5`, `text-[10px]`, liturgy box still small.
- No undo, list/panel mutually exclusive (`lg:hidden`), stats always visible, `max-h-[500px]`, "Completed" ambiguous, create-form generic toast only, `localStorage.getItem('user')` inline (lines 305,437), P/L/A/E + 1-5 + arrows exist (lines 143-184) but undiscoverable.
- 14 interactive elements per student row; 350 targets for 25 kids — unusable for servant phone Sunday rush.

Decisions locked by user: servant phone Sunday is primary; split into 3 views; Save + Save & Finalize (no autosave).

## 2. Architecture

Split `/dashboard/attendance` into 3 routes sharing lib hooks:

- `.../attendance/mark` (default landing for Attendance nav): today-first. Auto-resolves today's session via `POST /attendance/start-class` or `?sessionId=` deep-link (arrival tap + QR preserved). Phone-first cards.
- `.../attendance/sessions` (Manage): session list + create/edit/generate/recurring/batch-delete/QR scanner. Desktop table, existing filters collapsed with "N active + Clear All".
- `.../attendance/insights` (Insights): stats + level-stats + group-stats + by-student `student-search` + heatmap link. Existing `fetchStats` moved here, lazy-loaded on tab.

Shared: `lib/attendance/` hooks — `useSessions`, `useSessionDetail`, `useMarkingState` (tempMarks/behavior/participation/liturgy/notes with dirty flag + preserved on save failure), `useStartClass`. Existing backend routes reused unchanged. `/dashboard/attendance` redirects to `/mark` for deep-link compat (`?sessionId` forwarded).

Components: `MarkStudentCard`, `MarkSummaryBar` (sticky), `StatusSegment` (Present/Late/Absent/Excused 44px+ with icon + text), `DetailExpander` (behavior/participation/notes/liturgy), `SessionFormModal` (extracted from duplicated create/edit modals), `ErrorState`, `FilterBadge`.

## 3. Data flow

Mark: resolve session → `GET /attendance/sessions/:id` → init temp state from `attendanceRecords` → edit locally → `POST /sessions/:id/mark {records, recordedBy}` → optional `PUT /sessions/:id {status:completed}` on Finalize → refetch detail + list → success toast + analytics `attendance.marked`. On save failure: keep temp state, error toast with Retry, dirty indicator stays.

Manage: `GET /attendance/sessions?schoolId&levelId&groupId&status&from&to&limit=500` + levels/groups for filters. Mutations: create/update/delete/batch-delete/generate/recurring/QR-checkin/start-class — each with confirm modal, success/error toast, list refetch.

Insights: `GET /attendance/stats|level-stats|group-stats` + `GET /attendance/student-search` (debounced 300ms). No mutations.

## 4. Interaction — Mark view (primary)

Hierarchy: sticky summary (Present/Late/Absent/Excused counts + X/Y marked + dirty dot) → student cards → bottom thumb-zone bar (Save + Save & Finalize + Mark-all).

Student card: name + code + current status chip → 2×2 status grid (min 44×44, icon + EN/AR text, `aria-pressed`, `focus-visible:ring-gold-500`) → tap name expands behavior (5 dots, click N = N, separate Clear), participation (same), liturgy toggle, note field. Completed sessions render read-only + Re-open.

Mark-all: existing confirm pattern kept (`showMarkAllConfirm`), scope text "all N students in this session". Save preserves draft; Save & Finalize confirms lock ("No further edits — you can Re-open") then `PUT completed`. Keyboard: P/L/A/E, 1-5 behavior, Shift+1-5 participation, Up/Down move, Ctrl+S save; hint bar documents them. Filters: collapsed by default on Mark (session picker instead). `max-h-[60vh]` scroll areas. Modals trap focus + Esc.

Bilingual + RTL: all strings via `t(en,ar)`, `dir` aware, dates consistent (fix `en-GB` vs native picker to single format per BRAND).

## 5. Error handling

- Load failure (sessions/detail/stats): `ErrorState message + Retry` replaces silent console-only; `console.error` removed from user paths (keep server log via existing logger only).
- Save failure: error toast with server message, temp state preserved, dirty flag stays, Retry button in summary bar.
- Create/edit: inline field errors (red border + helper text + `aria-invalid/describedby` via `FormField`) instead of generic toast only.
- Delete/batch/generate: confirm modals with counts, success/error toasts, list refetch on success only.
- QR/start-class failures: error toast, no navigation loss.

## 6. Accessibility + responsive

WCAG AA: 44×44 targets on Mark (status grid, dots hit-area 44 via padding), status never color-only (icon + text + `aria-label`), `focus-visible:ring-2 ring-gold-500` on all interactives, modals trap + Esc, `aria-live` summary updates, touch targets verified at 375px. Desktop Manage keeps dense table but 40px+ inputs with visible focus. No `text-[10px]` interactives; no fixed 500px heights.

## 7. Testing

- Unit: `useMarkingState` (init from records, mark-all, save payload mapping, preserve-on-failure, finalize flag), status/dot toggle semantics, filter badge count.
- Integration: Mark flow (resolve → mark → save → finalize → refetch), Manage CRUD + batch + generate, Insights fetch + debounced search.
- A11y: keyboard-only mark flow, focus trap, contrast spot-check, 400% zoom / 375px layout.
- Existing `__tests__/attendance-client.test.tsx` updated to new routes; keep deep-link `?sessionId&prefill=present&subjectItemId` compat test.

## 8. Boundaries

Untouched: backend modules, Prisma schema, auth/permissions, curriculum subject-item status machine (link-out only), parent/student portals, mobile app. No autosave, no offline queue, no swipe gestures, no new status values, no analytics schema change (reuse `attendance.marked`).

## 9. Open decision for builder

Route compat: keep `/dashboard/attendance` as redirect to `/mark` (recommended, preserves `?sessionId` links from arrival/QR) vs keep list at root and put Mark at `/mark`. Do not invent new API params; reuse `schoolId` auto-injection via `http-client`.

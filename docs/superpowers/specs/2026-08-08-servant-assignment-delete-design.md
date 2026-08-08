# Servant Module — Grade/Group Assignment + Bulk Delete — Design

**Date:** 2026-08-08
**Status:** Draft — pending user review of this spec
**Author:** brainstorming session (Amir)

## Problem

The servants page (`frontend/src/app/dashboard/servants/page.tsx`) has three gaps:

1. The create/edit form only supports **Level → Group**, forcing a level selection
   before a group can be chosen. There is no optional **Grade** field, even though the
   `ServantUser.metadata` type already declares `grade?: string` (unused).
2. A servant who is "responsible for a group" should be able to be assigned that
   **group alone** (knowing it spans all of that group's grades and levels) without
   needing to also pick a grade. Today the group select is disabled until a level is
   chosen, so group-only assignment in the form is impossible.
3. Deleting is single-record only. Users want **multi-record selection and deletion**.

## Requirements (confirmed with user)

1. **Grade selection (new, optional)** in the servant form. Once a grade is selected,
   the group is auto-selected/matched accordingly.
2. **Group-alone assignment**: picking a group by itself is enough — the servant is
   responsible for that group (and effectively its multiple grades). No grade is
   required.
3. **Multi-record delete**: checkboxes in both table and card views + a "Delete
   selected" toolbar/confirmation; batch request to the backend.

## Approach

**A — Reuse the existing config grades + per-servant metadata (no schema change, and
no backend grade-model dependency):**

- Grade options come from the existing `gradeGroups` config (`fetchGradeGroups()`,
  `frontend/src/lib/school.ts:61`) — the same combos the student form uses.
  Selecting a grade maps to the combo's `groupId`, auto-filling the group select.
- Servant assignment persists as today: `metadata.levelId`, `metadata.groupId`, plus a
  new `metadata.grade` (grade name string from the combo).
- Group-alone works by making the group select independent (not gated behind level):
  if the user picks a group without a level, `levelId` is left `undefined` and the
  group is still saved. The list/filter logic already tolerates a `groupId` without a
  `levelId`.

Rejected: waiting for the in-flight Levels/Grades/Groups restructure (would block this
feature indefinitely — the two coexist cleanly), and adding a new backend grade entity
(duplicates the parallel task's work).

## Frontend changes

### `frontend/src/app/dashboard/servants/page.tsx` (form + list)

**Form state / `ServantUser.metadata`** — add `grade` to the form:

```ts
form: { ..., grade: string }   // grade name ('' = none)
metadata: { teachingSubjects, levelId, groupId, grade }
```

| Control | Behavior |
|---------|----------|
| **Grade** (new, optional select) | Options from the `gradeGroups` combos via `fetchGradeGroups()`. On select: find the matching active combo; if it has a `groupId`, set `form.groupId = combo.groupId`. The user may then override the group. |
| **Group** (changed) | Now always enabled, independent of the level select. Picking a group without a level is a valid group-only assignment. The level select stays as-is (optional grouping context). |

The existing `ServantUser` type already has `metadata.grade?: string` — surface it in
the form. When editing, prefill `grade` from `editing.metadata.grade`.

### Cards + Table (display)

- Both table and card views currently render `Level / Group`. When `grade` is present,
  show `Grade (group)` instead so the responsible grade is visible.
- Add a **grade filter** (optional) that filters servants by `metadata.grade`,
  matching the existing `filterLevel`/`filterGroup` pattern.

Note: `filterGroup` currently depends on `filterLevel` (disabled until a level is
picked). That stays as-is — group-alone is about *assignment* in the form, not filters.

### Bulk delete

- Add checkboxes to table rows and to card rows (one select box per card), plus a
  "select all" checkbox in the table header.
- Selection state: `selectedIds: string[]` at page level. A "Delete selected (N)"
  button appears when at least one is selected (and `canDelete`). Clicking opens a
  bulk variant of the existing `ConfirmDialog` showing the count (and servant names).
- On confirm: call the backend bulk-delete endpoint, re-fetch servants, reset
  selection.

## Backend changes

### New endpoint: bulk delete users (servants)

Nothing exists to bulk-delete `users` rows. Mirror the proven student pattern:

- Students use `POST /students/bulk-delete` (`students.controller.ts:97`) →
  `students.service.ts:524` `bulkDelete(ids, schoolId)` via
  `prisma.student.updateMany({ where: { id: { in: ids }, schoolId, deletedAt: null },
  data: { deletedAt: new Date() } })`.

For servants, add:

```
POST /users/bulk-delete
Body: { ids: string[] }
```

to `backend/src/modules/users/users.controller.ts`. It calls a new
`usersService.bulkDeleteUsers(ids, requestingUser)` that:

- Validates `ids` is a non-empty array.
- Soft-deletes via `prisma.user.updateMany({ where: { id: { in: ids }, schoolId:
  requestingUser.schoolId, deletedAt: null }, data: { deletedAt: new Date() } })`.
- Excludes `super_admin` accounts from deletion (school admins cannot delete super
  admins — matches the existing single-delete guard) and returns the count actually
  deleted.
- Returns `{ deleted: count }`.
- Guarded by `@Roles('super_admin', 'admin')` matching the existing single
  `DELETE :id` (`users.controller.ts:129`).
- Adds the audit-log/analytics hooks if those services are already injected in the
  users module; otherwise keep it a plain soft-delete to match the current
  `users.service.deleteUser` minimalism.

### Backend rules [unchanged]

- Servant save metadata is already persisted by the existing `createUser`/`updateUser`
  (`metadata` JSON, e.g. `users.service.ts:134`). **No backend change needed** beyond
  the bulk-delete endpoint.
- Grade→group auto-fill is a frontend concern; the backend just stores the resolved
  ids.

## Edge cases / decisions

- **No mapped group for a grade**: if a grade combo has no `groupId`, the group stays
  empty and the user picks a group (or configures one in Settings).
- **Grade → group override**: after auto-fill from a grade, the group remains
  editable.
- **Group-only servant**: saves with `groupId` and no `levelId`; list/filters already
  tolerate this.
- **Bulk delete scope**: only servants/users in the requester's school are eligible.

## Verification

- Frontend: `npm run type-check`, `npm run lint`, `npm run test` green. Tests for the
  servants page: grade→group auto-fill, group-alone save, bulk selection + delete
  confirm.
- Backend: `npx tsc --noEmit && npx jest` green (new `users.service` bulkDelete spec).
- Manual (staging/prod): create a servant picking a grade → group auto-fills; create
  another with group-only (no grade); select multiple servants in table and card
  views, delete them, confirm the list updates; filters reflect grade/group.

## Out of scope

- The parallel Levels/Grades/Groups restructure work (Grades as a first-class entity).
- Changing the Student-side `gradeGroups` config flow.
- Any deletion-model change beyond the bulk endpoint above.
- Bulk edit of servants (only multi-delete is requested).
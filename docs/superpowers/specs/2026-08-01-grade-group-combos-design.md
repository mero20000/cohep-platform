# Grade + Group Combos — Design

**Date:** 2026-08-01
**Status:** Draft — pending user review
**Approach:** A (config-based mapping, no DB migration)

## Problem

Today the student form treats Level, Grade, and Group as three independent
fields. The user's mental model is that a Grade is a combination of a school
grade and a group (e.g. "Grade 4 + Group 1"). Picking a Grade for a Level
should automatically determine the group.

Additional pain: Levels 2–5 have students but no visible groups, so group
menus are empty and new enrollments for those levels fail.

## Requirements (from user)

1. Settings → Grades becomes a list of **grade+group combos** per level, e.g.
   "Grade 4 + Group 1", "Grade 5 + Group 1", "Grade 6 + Group 1" ... each with
   Active/Inactive status.
2. Each grade maps to **exactly one group** (1:1).
3. The mapping is **per level** (Level 1 and Level 2 can have different maps).
4. Grades tab gets a **level selector** at the top; combos are managed within
   the selected level.
5. Adding a combo **auto-creates (or reuses) the group** under that level.
6. Student form: after picking Level + Grade, the group is **auto-set and
   locked** (read-only/hidden). Group is derived, not chosen.
7. The Grade dropdown in the student form only shows grades that have a
   mapped group for the selected level.
8. Bulk student import also **auto-derives group** from row level+grade.
9. The flat grade-name list is **replaced** by the combo list (combos only).

## Approach A — Config-based mapping

No schema change. Combos live in a new school config entry and reference real
groups (created via the existing `POST /students/groups` endpoint, which we
already fixed to honor `levelId`).

### Data model

School config `key = "gradeGroups"`, `value`:

```ts
interface GradeGroupCombo {
  id: string          // e.g. `combo-${Date.now()}`
  levelId: string     // owning level (UUID)
  gradeName: string   // e.g. "Grade 4" (the string stored on Student.schoolGrade)
  groupId: string     // real group UUID created under levelId
  groupName: string   // e.g. "Group 1" (display + sync target)
  status: 'active' | 'inactive'
}
```

Rules enforced at write time (frontend):
- Unique `(levelId, gradeName)` — one grade per level maps to one group.
- Unique `(levelId, groupName)` — reuse a group if the same name already
  exists under the level; otherwise create it.

The existing flat `grades` config is **left untouched** (no data migration);
it simply stops being read by the new flow.

### Backend changes

- **None required** — `POST /students/groups` (already levelId-aware),
  `GET /students/groups/all`, `PATCH /students/groups/:id`, and
  `/users/schools/:id/config` already provide everything needed.
- Optionally add a small helper on the backend to *read-only* validate combo
  payloads; frontend validation is sufficient for v1.

### Frontend changes

1. **`settings/_components/grades-tab.tsx` (rewrite)**
   - Load `levels` (`/curriculum/levels`) + `gradeGroups` config.
   - Level selector at top; defaults to first active level.
   - Table rows: Grade (e.g. "Grade 4") | Group (e.g. "Group 1") | Status |
     Actions (edit/delete/activate).
   - Add/Edit modal: Grade name (text) + Group name (text) for the selected
     level. On save:
     - find existing active/inactive group under level with same `name`
       (case-insensitive) → reuse its id; else `POST /students/groups`
       with `{ name, levelId }`.
     - upsert combo into `gradeGroups` config via `POST /users/schools/:id/config`.
   - Delete combo → also delete the referenced group via
     `DELETE /students/groups/:id`.
   - Toggle status → also `PATCH /students/groups/:id { status }` so the real
     group stays in sync.

2. **`lib/school.ts`**
   - Add `fetchGradeGroupCombos(): Promise<GradeGroupCombo[]>` reading config
     `key=gradeGroups`.
   - Keep `fetchActiveGrades()` for backward compatibility (filters/exports),
     but the student form stops depending on it.

3. **`students/_components/student-form-modal.tsx`**
   - Accept `combos: GradeGroupCombo[]` (per-level mapping) instead of relying
     on `allGroups` for the group step.
   - On `levelId` change → Grade options = active combos for that level.
   - On grade select → auto-set `groupId` to combo.groupId.
   - Replace the Group dropdown with a read-only display (auto group name) or
     hidden field; remove group from required-error logic.
   - Edit mode: prefill from student's `levelId`/`schoolGrade`/`groupId`
     (grade matched by name, group by id).

4. **`students/students-client.tsx`**
   - Load combos alongside groups/levels; pass to form, filters, bulk modals.
   - Filters that reference grade use combo grade names for the selected level
     (or keep global `GRADE_OPTIONS` fallback when no combos configured).

5. **`students/_components/student-import-modal.tsx`**
   - For each row, resolve `groupId` from `levelId` + `schoolGrade` via combos;
     drop the `groupId` column requirement. Rows without a matching combo are
     reported as errors in the preview.

6. **`students/_components/student-bulk-modals.tsx`**
   - Bulk "change grade" keeps using grade names (unchanged semantics).
   - Bulk "change level" should also clear/re-derive group (leave for follow-up
     if it complicates v1).

## Edge cases / decisions

- **Empty level, no combos:** student form Grade dropdown shows empty state
  with a hint to configure Grades in Settings.
- **Existing students (Levels 2–5) with soft-deleted groups:** out of scope.
  This feature creates fresh groups for combos; reassignment of existing
  students is a separate data-cleanup task.
- **groupName reuse:** if two combos in the same level claim the same group
  name, the second reuses the first's group (no duplicate group rows).
- **groupName/gradeName uniqueness:** enforced in the Grades tab form.

## Verification

- Frontend: `npm run build` (tsc no errors in changed files); extend the
  `docs/superpowers/tests/frontend-scenarios.mjs` harness with combo
  scenarios (level selector, add combo → group created under level,
  grade→group auto-fill in student form, import auto-map).
- Manual (prod): configure combos for Level 1 + Level 2, create a student with
  (Level 2, Grade 5) → group auto-fills; verify group appears under Level 2 in
  `GET /students/groups/all`.

## Out of scope

- Flat `grades` config data migration (left as-is).
- Reassigning existing students to newly-created groups.
- Backend schema/migration (Approach B).

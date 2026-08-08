# Levels, Grades, Groups — Relationship Restructure — Design

**Date:** 2026-08-07
**Status:** Approved (user reviewed design in conversation)
**Approach:** A — restructure with denormalized `Student.groupId` (auto-maintained from grade)

Supersedes: `2026-08-01-grade-group-combos-design.md` (the JSON `gradeGroups` config approach).

## Problem

Levels, Grades, and Groups are modeled inconsistently today:

- **Level** is a real per-school entity (`Level`, unique `[schoolId, number]`), and
  curriculum attaches to levels (`LevelSubject`, `SubjectItemLevel.levelNumber`,
  `Lesson.levelId`, `CurriculumAllocation.levelId`). This part already matches the
  target model.
- **Grade does not exist as an entity.** There is no school-grade model. Grades are
  represented two loose ways:
  1. free-text `Student.schoolGrade` (a plain string, e.g. `"4"`, `"Grade 4"`), and
  2. a JSON blob in `system_config` under key `gradeGroups` — a list of
     `{ levelId, gradeName, groupId, groupName, status }` combos per level, plus a
     `grades` key for grade filter options.
- **Group belongs to a Level** (`Group.levelId` required). Each level owns its own
  "Group 1..4". The settings UI treats `levelId` as optional and silently falls back
  to the first level; edit mode cannot change it.

This makes per-school configuration of grades/groups impossible, forces grades to be
repeated per level, and ties groups to levels when the user's mental model treats them
as school-wide entities.

## Requirements (confirmed with user)

1. **Level** = the set of *active levels* configured per school (Level 1, Level 2, …).
   Curriculum subjects connect to a specific level. (Unchanged from today.)
2. **Grade** = the set of *active grades* configured per school (Grade 4, Grade 5, …).
   A grade is a **new first-class entity** per school.
3. **Group** = the set of *active groups* configured per school (Group 1 Sherobem,
   Group 2 Archangelos, …). Groups are **school-wide**, no longer nested under levels.
4. **Relationship**: each Grade is assigned **one Group** (chosen via a dropdown in the
   grades section under Settings). **One Group ← many Grades** (Grade 4, 5, and 6 can
   all point to Group 1). The FK lives on the Grade.
5. **Student assignment**: a student picks **Level + Grade**; the **Group is derived
   automatically** from the Grade's group (not chosen independently).
6. **Changing a Grade's Group in Settings auto-moves all students** of that Grade to the
   new group.
7. **Existing data is migrated by a script** (no data loss, works against production).

## Approach

**Approach A — restructure with denormalized `Student.groupId`:**

- `Group` becomes school-scoped (`schoolId`, no `levelId`).
- New `SchoolGrade` entity per school, each pointing at one `Group`.
- `Student` keeps `levelId` and a **denormalized `groupId`**, auto-set on save from
  `SchoolGrade.groupId` and batch-updated when a grade's group changes.
- Attendance, assessments, gamification, and dashboards query `groupId` directly in ~10
  files; keeping `groupId` denormalized means those code paths stay working and the
  group is still always consistent because it is server-maintained from the grade.

Rejected alternatives: removing `Student.groupId` entirely (larger blast radius across
all groupId-based queries — riskier for the same outcome), and keeping groups under
levels (does not match the confirmed model).

## Backend

### Data model

One Prisma migration:

```prisma
model Group {
  id          String    @id @default(uuid())
  schoolId    String    @map("school_id")
  name        String
  nameAr      String?   @map("name_ar")
  description String?
  capacity    Int       @default(30)
  orderIndex  Int       @default(0) @map("order_index")
  status      String    @default("active")
  metadata    Json?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  school       School      @relation(fields: [schoolId], references: [id])
  schoolGrades SchoolGrade[]
  students     Student[]

  @@index([schoolId])
  @@map("groups")
}
// NOTE: levelId + the `level` relation are removed.
// No unique constraint on name — same-named groups are allowed per school.

model SchoolGrade {
  id         String   @id @default(uuid())
  schoolId   String   @map("school_id")
  name       String                 // "Grade 4"
  nameAr     String?  @map("name_ar")
  groupId    String   @map("group_id")
  orderIndex Int      @default(0) @map("order_index")
  status     String   @default("active")
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  deletedAt  DateTime? @map("deleted_at")

  school   School    @relation(fields: [schoolId], references: [id])
  group    Group     @relation(fields: [groupId], references: [id])
  students Student[]

  @@unique([schoolId, name])
  @@index([schoolId])
  @@index([groupId])
  @@map("school_grades")
}
```

- The model is named `SchoolGrade` and the table `school_grades` because `Grade` /
  `grades` already exist for **assessment scoring** (score/maxScore on submissions).
  That model is untouched.
- `Student`: drop `schoolGrade String?`; add `gradeId String? @map("grade_id")`
  (nullable FK → `SchoolGrade`, so legacy students without a mapped grade survive).
  `levelId` and denormalized `groupId` stay. `@@index([levelId, groupId])` stays.
- `School`: add `groups Group[]` and `schoolGrades SchoolGrade[]` relations; `Level`
  loses its `groups` relation.
- **Unchanged by this restructure:** `AttendanceSession`, `Assessment`,
  `PromotionRecord` still reference `Group`/`Level` as today; curriculum ↔ level
  connections (`LevelSubject`, `SubjectItemLevel`, `Lesson.levelId`,
  `CurriculumAllocation`) are untouched.

### Migration mechanics

Prisma migration does the mechanical SQL (safe to run via `prisma migrate deploy`):

1. Create `school_grades` table + indexes + FKs.
2. Add `groups.school_id` (NOT NULL) with SQL backfill from the owning level:
   `UPDATE groups SET school_id = (SELECT school_id FROM levels WHERE levels.id = groups.level_id);`
3. Drop `groups.level_id` (FK, index, column).
4. Add `students.grade_id` (nullable) + FK.

A separate ts-node data script (`scripts/migrate-levels-grades-groups.ts`, manual,
**after** deploy) does the business mapping:

1. **Dedupe groups** per school by normalized name (trim + lowercase): keep the
   lowest-`createdAt` row, **soft-delete** the rest (`deletedAt`), and remap every FK
   that referenced a soft-deleted duplicate: `attendance_sessions.group_id`,
   `assessments.group_id`, `promotion_records.from_group_id`/`to_group_id`,
   `students.group_id` → the kept group id. Soft-deleting (not hard) keeps FK
   constraints valid.
2. **Create `SchoolGrade` rows** from `system_config` key `gradeGroups`: for each
   school, for each combo `{ gradeName, groupId, status }` → one `SchoolGrade`
   (`name: gradeName`, `groupId` remapped via the dedupe map, `status`). If duplicate
   grade names exist across the old per-level combos, keep the first and use its group.
3. **Map students**: normalize `student.school_grade` (`/^grade\s*(\d+)$/i` → "Grade N",
   `/^(\d+)$/` → "Grade N", otherwise case-insensitive exact match) → find a
   `SchoolGrade` by name in the same school; set `grade_id` and `group_id =
   grade.groupId`. Unmatched students keep `grade_id = NULL` and their (remapped)
   existing `group_id`.
4. **Delete** the old `gradeGroups` and `grades` `system_config` keys.
5. Print a summary (groups before/after, grades created, students matched/unmatched).
   Support a `--dry-run` flag that reports without writing.

**Seed:** update `backend/prisma/seed.ts` to the new model (school-wide groups, a few
`SchoolGrade` rows each with a `groupId`, students with `levelId` + `gradeId` +
denormalized `groupId`). Fresh deploys then create new-model data; the data script
above only applies to databases already holding old-model data.

### Endpoints

New **grades module** (mirrors the curriculum-levels pattern, includes audit logs):

| Method | Route | Body | Behavior |
|--------|-------|------|----------|
| GET | `/grades?schoolId=` | – | List grades (active first, by `orderIndex`), each with `groupName`, `studentCount` |
| POST | `/grades` | `{ name, nameAr?, groupId }` | Duplicate-name guard per school (case-insensitive); group must belong to the same school; audit log |
| PATCH | `/grades/:id` | `{ name?, nameAr?, groupId?, status }` | **If `groupId` changes → `student.updateMany({ where: { gradeId }, data: { groupId } })`** (auto-move); audit log |
| DELETE | `/grades/:id` | – | Soft delete; students keep `gradeId`/`groupId` |

**Groups (students module):**

| Method | Route | Change |
|--------|-------|--------|
| GET | `/students/groups/all?schoolId=` | Now returns a **flat** school-scoped list `{ id, name, nameAr, description, status, orderIndex, studentCount }` (was levels-with-nested-groups) |
| POST | `/students/groups` | Body `{ name, nameAr?, description?, capacity? }` — no `levelId`; remove the "fallback to first level" logic; duplicate-name guard per school |
| PATCH | `/students/groups/:id` | name/nameAr/description/status/capacity |
| DELETE | `/students/groups/:id` | Soft delete |
| DELETE | `/students/groups?schoolId=` | Soft delete all |

**Students:**

- `CreateStudentDto`: `levelId` (required) + `gradeId` (optional UUID). **No
  `groupId`, no `schoolGrade`.** Server derives `groupId = grade.groupId` (overrides
  any client value) — group is never chosen independently.
- `UpdateStudentDto`: `status`, `levelId`, `gradeId` (group re-derived).
- `QueryStudentDto`: `gradeId?` filter; remove `schoolGrade`.
- Bulk import: `levelId` + `gradeId`; CSV `grade` column is matched to active grade
  names (normalized as in the migration); unknown → row error (mirrors the existing
  "No group mapped for grade" behavior). Group derived from grade.
- Analytics `gradeDistribution`: group by `gradeId`, include `grade.name`;
  `studentsWithoutGrade` = `gradeId` null.

**Attendance:** remove the `startClass` derivation `levelId = groups[0].levelId`
(attendance.service.ts:408) — groups no longer have a level; session `levelId` comes
from the request/UI.

**Gamification:** `groups/:id/trophy` (gamification.service.ts:715-724) drops the now-
invalid `level` include on group.

**System config:** the new flow no longer reads/writes `gradeGroups` or `grades` keys
(generic `GET/POST /users/schools/:id/config` stays).

## Frontend

- **`settings/_components/grades-tab.tsx` (rewrite):** CRUD grades via `/grades`.
  Add/Edit modal: name, nameAr, **group dropdown** (flat school-wide groups from
  `GET /students/groups/all`), status. Editing the group shows a warning that students
  will move. Row shows grade name, group name, student count, status, actions.
- **`settings/_components/groups-tab.tsx`:** flat group list; create/edit form =
  name, nameAr, description (no level selector/dropdown).
- **`settings/_components/levels-tab.tsx`:** unchanged.
- **Student flows** (`student-form-modal`, `student-types`, `student-table`,
  `student-detail-modal`, `students-client`, `parents/page`, `assessments/page`,
  `dashboard-client`/leaderboard, `student-import-modal`, `student-bulk-modals`):
  grade is a `gradeId` → grade-name lookup (replacing `schoolGrade` text); student form
  = **Level + Grade** dropdowns, group auto-filled and shown read-only; grade filters
  use `gradeId` (grade options = active grades from `/grades`).
- **Remove** `lib/grade-groups.ts` (combos/`resolveGroupId`/`gradeOptionsForLevel`) and
  `lib/school.ts` `fetchGradeGroups`/`saveGradeGroups`; add grade CRUD helpers and a
  flat `fetchGroups`.

## Edge cases / decisions

- **Legacy students with no matching grade** keep `gradeId = NULL` and their current
  (remapped) group; the form allows creating/editing them with a grade later.
- **Duplicate grade names across old levels** collapse into one `SchoolGrade` (kept by
  `[schoolId, name]` unique).
- **Deleting a group that a grade references**: allowed (soft delete); the grade keeps
  pointing at the soft-deleted group and its edit form shows the group as inactive,
  prompting a new selection.
- **Grade with no active group** can't be created (groupId is required).
- **Curriculum stays level-based** — subjects/lessons/allocations are untouched.
- **`SchoolGrade` naming** exists to avoid clashing with the assessment `Grade` model.

## Verification

- Backend: `npx tsc --noEmit && npx jest` green. New/updated specs: grades service
  (duplicate guard, group-belong guard, **batch-move on group change**, soft delete),
  students service (gradeId mapping, group auto-set overrides client, bulk import grade
  resolution, analytics), attendance `startClass` fix.
- Frontend: `npm run type-check`, `npm run lint`, `npm run test` green. Updated specs:
  grades-tab (create with group dropdown, group-change warning), groups-tab (no level),
  student form (level + grade, group auto-filled read-only).
- Migration script: run with `--dry-run` on a copy/staging first; verify summary counts,
  then run against production. Confirm groups deduped, grades created, students mapped.
- Manual (prod): configure a grade with a group; create a student (Level + Grade) →
  group auto-fills; change the grade's group → its students move.

## Out of scope

- Promotion flow (`PromotionRecord` is schema-only, no runtime — untouched).
- Curriculum restructure beyond the existing level connection (subjects stay linked to
  levels).
- Assessment `effectiveGrade` semantics beyond switching the filter from `schoolGrade`
  text to `gradeId`.
- Student portal login (code/QR based — unaffected).
- Any redesign of settings beyond the grades/groups/student-form surfaces above.

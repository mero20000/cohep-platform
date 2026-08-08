# Levels, Grades & Groups Restructure — Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Follow the skill exactly. Do NOT skip steps, do NOT write code before the test step for that task, and update todos as you go. This plan is intentionally bite-sized: complete each task's tests before its implementation, and only mark a task done when its tests pass.

## Goal

Implement the approved design `docs/superpowers/specs/2026-08-07-levels-grades-groups-design.md` (Approach A):

- Introduce a real, per-school **Grade** entity (`school_grades` table), replacing the free-text `Student.schoolGrade` string and the JSON `gradeGroups` combos stored in `system_config`.
- Decouple **Group** from **Level**: a group belongs to a school (not a level). One group may serve many grades.
- Keep `Student.groupId` denormalized; it is derived automatically from the student's grade (`grade.groupId`).
- A student is now identified by **Level + Grade**; group is read-only output.
- Remove all trace of `gradeGroups` JSON config and the old per-level group model across backend and frontend.

## Architecture

- `Student.schoolGrade` (free text) → `Student.gradeId` FK → `school_grades` (per school: `name`, `nameAr`, `groupId`, `orderIndex`, `status`, timestamps). Unique `[schoolId, name]`.
- `Group.levelId` (required FK) → `Group.schoolId` (required FK). All existing FK consumers (`students`, `attendance_sessions`, `assessments`) keep `groupId`; `promotion_records.from_group_id`/`to_group_id` are plain strings (no relation) and only need data remapping.
- Grades CRUD lives in a new `grades` module (`/grades?schoolId=`); groups CRUD stays in the students module but becomes school-scoped.
- Backend derives `student.groupId` from `grade.groupId` on create/update/bulk-create/bulk-update. All reads of `student.schoolGrade` across modules (dashboard, parents, assessments, attendance, gamification) switch to `student.gradeId`/`grade.name` (exposed as `gradeName` where the API used `schoolGrade`).
- A one-time data migration script (`backend/scripts/migrate-levels-grades-groups.ts`) backfills live data: dedupe groups school-wide (soft-delete dups + remap FKs), create `school_grades` from `gradeGroups` config, map students, drop the config keys. It must support `--dry-run`.

## Tech Stack

Unchanged from the repo: NestJS + Prisma + PostgreSQL (backend), Next.js App Router + Tailwind + shadcn-style components (frontend), vitest (frontend), jest (backend). No new libraries.

## Global Constraints

- Follow the existing code conventions in each file; do not reformat unrelated code. No comments unless the surrounding file uses them for the same purpose.
- Run `npx prisma generate` immediately after every schema change before running anything that touches `@prisma/client`.
- Backend tests: `npm test` (jest). Frontend tests: `npm run test` (vitest, patterns `**/*.test.{ts,tsx}` and `**/*.spec.{ts,tsx}`). Backend `npm run lint` is pre-existing broken — use `npx prettier --check` on touched files instead.
- Migrations: dev DB via `npm run migrate` (`prisma migrate dev`); prod applies the same files via `npm run migrate:prod` (`prisma migrate deploy`). New migration names use the existing `YYYYMMDD…` convention.
- Commit after each task. Do not push or deploy unless the user asks.

## File Structure Map

Backend:
- `backend/prisma/schema.prisma` — add `SchoolGrade`, add `Group.schoolId`, add `Student.gradeId`, wire relations.
- `backend/prisma/seed.ts` — school-wide groups + grades; students get `levelId + gradeId + groupId`.
- `backend/scripts/migrate-levels-grades-groups.ts` — NEW one-time data backfill (dedupe groups, build grades, map students, drop config).
- `backend/src/modules/grades/` — NEW `grades.module.ts`, `grades.controller.ts`, `grades.service.ts`, `dto/create-grade.dto.ts`, `dto/update-grade.dto.ts`, `grades.service.spec.ts`.
- `backend/src/app.module.ts` — register `GradesModule`.
- `backend/src/modules/students/students.service.ts` — groups CRUD school-wide; create/update/bulk/import gradeId→groupId; findAll/getStats.
- `backend/src/modules/students/dto/create-student.dto.ts`, `update-student.dto.ts`, `query-student.dto.ts`, `bulk-import-student.dto.ts` — drop `schoolGrade`/`groupId`, add `gradeId`/`grade`.
- `backend/src/modules/students/students.controller.ts` — groups endpoints unchanged routes.
- `backend/src/modules/students/students.service.spec.ts` — update for gradeId.
- `backend/src/modules/attendance/attendance.service.ts` — `startClass` (:380-430) + `getGroupStats` (:590-618) group lookups school-wide.
- `backend/src/modules/gamification/gamification.service.ts` — `getGroupTrophy` (:750-763, :876-877) drop `group.level`.
- `backend/src/modules/dashboard/dashboard.service.ts` — grade distribution (:35-79) + leaderboard (:500-542) switch to grade.
- `backend/src/modules/parents/parents.service.ts` — `findChildren` (:45-98) + `mapStudentParent` (:100-131) → `gradeName`.
- `backend/src/modules/assessments/assessments.service.ts` — `getStudentsForAssessment` (:420-481) + controller (:153-159) switch to `gradeId`.

Frontend:
- `frontend/src/lib/school.ts` — remove `GradeItem`, `fetchGrades`, `fetchActiveGrades`, `fetchGradeGroups`, `saveGradeGroups`, `GRADES_SCHOOL_ID`, and the `./grade-groups` import.
- `frontend/src/lib/grades.ts` — NEW `GradeItem`, `GroupOption`, `fetchGrades`, `fetchActiveGrades`, `fetchGroups`, `createGrade`, `updateGrade`, `deleteGrade`.
- `frontend/src/lib/grade-groups.ts` + `grade-groups.test.ts` — DELETE.
- `frontend/src/app/dashboard/settings/_components/grades-tab.tsx` — rewrite to real grades CRUD.
- `frontend/src/app/dashboard/settings/_components/groups-tab.tsx` — no level selector; flat list.
- `frontend/src/app/dashboard/students/student-types.ts` — `gradeId`/`grade` replace `schoolGrade`.
- `frontend/src/app/dashboard/students/_components/student-form-modal.tsx` — Level + Grade selects, group read-only.
- `frontend/src/app/dashboard/students/_components/student-filters.tsx` — grade filter by id.
- `frontend/src/app/dashboard/students/students-client.tsx` — fetch flat groups; grade filter by id; CSV.
- `frontend/src/app/dashboard/students/_components/student-table.tsx` + `student-detail-modal.tsx` — render `grade.name`.
- `frontend/src/app/dashboard/students/_components/student-bulk-modals.tsx` + `student-import-modal.tsx` — gradeId/grade.
- `frontend/src/app/dashboard/students/__tests__/page.test.tsx` — update mocks.
- `frontend/src/app/dashboard/assessments/page.tsx` — grade filter by id, `gradeName` rows.
- `frontend/src/app/dashboard/dashboard-client.tsx` — `child.gradeName`, leaderboard `gradeName`.
- `frontend/src/app/dashboard/parents/page.tsx` — `s.gradeName`.
- NEW tests: `frontend/src/lib/grades.test.ts`, `frontend/src/app/dashboard/settings/__tests__/grades-tab.test.tsx`.

## Implementation Plan

### Task 1: Prisma schema — SchoolGrade model + decouple Group (migration 1)

**Files:** `backend/prisma/schema.prisma`

**Changes:**
1. Add `SchoolGrade` model (place near `Group`):
```prisma
model SchoolGrade {
  id         String    @id @default(uuid())
  schoolId   String    @map("school_id")
  name       String
  nameAr     String?   @map("name_ar")
  groupId    String    @map("group_id")
  orderIndex Int       @default(0) @map("order_index")
  status     String    @default("active")
  metadata   Json?
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")
  deletedAt  DateTime? @map("deleted_at")

  school   School   @relation(fields: [schoolId], references: [id])
  group    Group    @relation(fields: [groupId], references: [id])
  students Student[]

  @@unique([schoolId, name])
  @@index([schoolId])
  @@index([groupId])
  @@map("school_grades")
}
```
2. `Group`: remove `levelId String @map("level_id")` and the `level Level @relation(...)` line entirely; add `schoolId String @map("school_id")` (required) + relations `school School @relation(fields: [schoolId], references: [id])` and `schoolGrade SchoolGrade[]`. Replace `@@index([levelId])` with `@@index([schoolId])`.
3. `Student`: add `gradeId String? @map("grade_id")` + `grade SchoolGrade? @relation(fields: [gradeId], references: [id])`. **Keep `schoolGrade String?` for now** — it is dropped in Task 3 after the data migration has consumed it. `@@index([levelId, groupId])` stays.
4. `School` model: add back-relations `groups Group[]` and `schoolGrades SchoolGrade[]`. `Level` loses its `groups` relation.

**Migration (one hand-authored migration matching the spec's mechanics):**
- Scaffold with `npx prisma migrate dev --create-only --name levels_grades_groups`, then replace the generated SQL with the spec's exact SQL so existing rows backfill safely:
  - Create `school_grades` + FKs + indexes.
  - `ALTER TABLE "groups" ADD COLUMN "school_id" TEXT NOT NULL` **then** `UPDATE groups SET school_id = (SELECT school_id FROM levels WHERE levels.id = groups.level_id);`
  - Drop `groups.level_id` (FK, index, column).
  - `ALTER TABLE "students" ADD COLUMN "grade_id" TEXT;` + FK to `school_grades`.
- Apply with `npm run migrate` (dev). Production applies the same file later via `npm run migrate:prod`.

**Steps:**
- Edit the schema, `npx prisma generate`, create + hand-edit + apply the migration as above.
- Verify `npm run build` compiles with the new client and `npm test` compiles (students spec failures are expected and fixed in Task 14).
- Commit.

### Task 2: Data migration script

**Files:** `backend/scripts/migrate-levels-grades-groups.ts` (NEW), `backend/package.json` (optional helper script)

**Interfaces:**
- Consumes: `system_config` rows `gradeGroups` (value is `{ combos: [{ levelId, gradeName, groupId, groupName, status }] }` or a bare array — normalize both), `groups`, `levels`, `students`, `attendance_sessions`, `assessments`, `promotion_records`.
- Produces: backfilled `groups.school_id`, deduped groups, `school_grades` rows, `students.grade_id`/`students.group_id` remapped, config keys removed.

**Logic (pseudo, write real code):**
```ts
const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const summary = { schools: 0, groupsBefore: 0, groupsAfter: 0, gradesCreated: 0, studentsMatched: 0, studentsUnmatched: 0 };

for (const school of await prisma.school.findMany({ select: { id: true } })) {
  summary.schools++;
  // 1) Dedupe groups school-wide: canonical = lowest createdAt per trimmed-lowercase name.
  const groups = await prisma.group.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: 'asc' } });
  summary.groupsBefore += groups.length;
  const canonical = new Map<string, typeof groups[number]>();   // nameKey -> kept group
  for (const g of groups) {
    const key = g.name.trim().toLowerCase();
    if (!canonical.has(key)) canonical.set(key, g);
  }
  // 2) For each duplicate group: remap students, attendanceSessions, assessments,
  //    promotion_records (from_group_id/to_group_id) from dup.id -> canonical.id,
  //    then soft-delete the dup. (updateMany per entity.)
  // 3) Load gradeGroups config (value is { combos: [{ levelId, gradeName, groupId, groupName, status }] }
  //    or a bare array — normalize both); for each combo resolve group via the canonical map
  //    (by name, fallback id), upsert SchoolGrade on [schoolId, name] (duplicate grade names
  //    across old levels collapse to the first, using its group).
  // 4) Map students: normalize student.school_grade —
  //      /^grade\s*(\d+)$/i  -> "Grade N"
  //      /^(\d+)$/           -> "Grade N"
  //      otherwise           -> case-insensitive exact match
  //    find a SchoolGrade by name in the same school; set grade_id + group_id = grade.groupId.
  //    Unmatched students keep grade_id = NULL and their (already remapped) group_id.
  // 5) Delete system_config rows with keys 'gradeGroups' and 'grades' for this school.
}
// --dry-run: log every intended write, mutate nothing.
console.log(summary);
```

**Steps:**
- Write the script. Run `npx ts-node scripts/migrate-levels-grades-groups.ts --dry-run` against the dev DB; review the summary. Then run without `--dry-run`.
- Commit. (Backend tests unaffected.)

### Task 3: Prisma Phase C — drop legacy `students.school_grade`

**Files:** `backend/prisma/schema.prisma`

**Changes:**
1. `Student`: remove `schoolGrade String? @map("school_grade")` entirely — the data migration (Task 2) has already consumed it.

**Steps:**
- Edit, `npx prisma generate`, `npm run migrate -- --name drop_students_school_grade` (migration 2: drops `students.school_grade`).
- `npm run build` + `npm test` — expect failures only in `students.service.spec.ts` (still references `schoolGrade`; fixed in Task 14). Fix any compile errors in touched Prisma usages first.
- Commit.

### Task 4: Seed update

**Files:** `backend/prisma/seed.ts`

**Changes (mirror existing structure):**
- Replace per-level group creation with school-wide groups, e.g. `['Group 1', 'Group 2', 'Group 3', 'Group 4']` (no `levelId`).
- Create `SchoolGrade` rows, e.g. `Grade 4..Grade 9`, each mapped to one of the groups.
- Replace `allGroups = prisma.group.findMany({ where: { levelId: { in: levels.map(l => l.id) } } })` with a flat query `{ where: { schoolId } }`; assign students `levelId + gradeId + groupId` (derive `groupId` from the grade), and drop `schoolGrade` from the student create payload.

**Steps:** edit, `npm run seed`, verify rows (`npm run studio` optional). Commit.

### Task 5: Grades module (backend)

**Files:** `backend/src/modules/grades/grades.module.ts`, `grades.controller.ts`, `grades.service.ts`, `dto/create-grade.dto.ts`, `dto/update-grade.dto.ts` (all NEW), `backend/src/app.module.ts`

**Interfaces:**
- `GET /grades?schoolId=` → `GradeItem[]` where `GradeItem = { id, name, nameAr, groupId, groupName, orderIndex, status, studentCount }`.
- `POST /grades?schoolId=` body `CreateGradeDto { name: string; nameAr?: string; groupId: string }` → `GradeItem`.
- `PATCH /grades/:id` body `UpdateGradeDto { name?, nameAr?, groupId?, status? }` → `GradeItem`; when `groupId` changes, also `updateMany` students of that grade to the new group.
- `DELETE /grades/:id` → `{ success: true }` (soft delete).

**grades.module.ts** (mirror `curriculum.module.ts`):
```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [GradesController],
  providers: [GradesService],
})
export class GradesModule {}
```

**grades.controller.ts** (mirror `curriculum.controller.ts` guards/`@ApiTags`/`@Roles(...STAFF_ROLES)`):
```ts
@ApiTags('grades')
@Controller('grades')
@Roles(...STAFF_ROLES)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get()
  getAll(@Query('schoolId') schoolId?: string) {
    return this.gradesService.getGrades(schoolId);
  }

  @Post()
  create(@Query('schoolId') schoolId: string, @Body() dto: CreateGradeDto) {
    return this.gradesService.createGrade(schoolId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.updateGrade(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gradesService.deleteGrade(id);
  }
}
```

**grades.service.ts** (use `ConflictException` for duplicate names like `curriculum.service.ts`; resolve school via `SchoolResolver`; mirror the audit call shape used in `curriculum.service.ts`):
```ts
@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
    private readonly audit: AuditService,
  ) {}

  async getGrades(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const grades = await this.prisma.schoolGrade.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        group: { select: { id: true, name: true, nameAr: true } },
        _count: { select: { students: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });
    return grades.map((g) => ({
      id: g.id, name: g.name, nameAr: g.nameAr,
      groupId: g.groupId, groupName: g.group.name,
      orderIndex: g.orderIndex, status: g.status,
      studentCount: g._count.students,
    }));
  }

  async createGrade(schoolIdentifier: string, dto: CreateGradeDto) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const existing = await this.prisma.schoolGrade.findFirst({
      where: { schoolId, name: dto.name.trim(), deletedAt: null },
    });
    if (existing) throw new ConflictException(`Grade "${dto.name}" already exists`);
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw new BadRequestException('Group not found in this school');
    const maxOrder = await this.prisma.schoolGrade.findFirst({
      where: { schoolId }, orderBy: { orderIndex: 'desc' }, select: { orderIndex: true },
    });
    const grade = await this.prisma.schoolGrade.create({
      data: { schoolId, name: dto.name.trim(), nameAr: dto.nameAr || null, groupId: dto.groupId, orderIndex: maxOrder ? maxOrder.orderIndex + 1 : 1 },
      include: { group: { select: { id: true, name: true, nameAr: true } }, _count: { select: { students: true } } },
    });
    await this.audit.log({ /* mirror curriculum.service.ts audit shape */ });
    return this.toGrade(grade);
  }

  async updateGrade(id: string, dto: UpdateGradeDto) {
    const grade = await this.prisma.schoolGrade.findUnique({ where: { id } });
    if (!grade) throw new NotFoundException('Grade not found');
    if (dto.name !== undefined) {
      const existing = await this.prisma.schoolGrade.findFirst({
        where: { schoolId: grade.schoolId, name: dto.name.trim(), deletedAt: null, id: { not: id } },
      });
      if (existing) throw new ConflictException(`Grade "${dto.name}" already exists`);
    }
    if (dto.groupId !== undefined) {
      const group = await this.prisma.group.findFirst({ where: { id: dto.groupId, schoolId: grade.schoolId, deletedAt: null }, select: { id: true } });
      if (!group) throw new BadRequestException('Group not found in this school');
    }
    const updated = await this.prisma.schoolGrade.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.groupId !== undefined && { groupId: dto.groupId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { group: { select: { id: true, name: true, nameAr: true } }, _count: { select: { students: true } } },
    });
    if (dto.groupId !== undefined && updated.groupId !== grade.groupId) {
      await this.prisma.student.updateMany({ where: { gradeId: id, deletedAt: null }, data: { groupId: updated.groupId } });
    }
    await this.audit.log({ /* mirror curriculum.service.ts audit shape */ });
    return this.toGrade(updated);
  }

  async deleteGrade(id: string) {
    await this.prisma.schoolGrade.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }
}
```
Add `toGrade(g)` private helper returning the mapped `GradeItem`, and `BadRequestException`/`NotFoundException` imports.

**Steps:** write module + DTOs (DTOs with `class-validator`: `name` `@IsString() @IsNotEmpty()`, `groupId` `@IsString()`, optional `nameAr`, `status` in update); register `GradesModule` in `app.module.ts` (imports + `imports` array, near `CurritculumModule`). Write `grades.service.spec.ts` in Task 14 (test file can be created here with failing tests, or together with Task 14 — prefer together with Task 14). `npm run build`. Commit.

### Task 6: Students — groups CRUD school-wide

**Files:** `backend/src/modules/students/students.service.ts` (`getGroups` :560, `createGroup` :580, `updateGroup` :618, `deleteAllGroups` :647)

**Changes:**
- `getGroups`: return flat array — `group.findMany({ where: { schoolId, deletedAt: null }, select: { id, name, nameAr, description, orderIndex, status, _count: { select: { students: true } } }, orderBy: { orderIndex: 'asc' } })`.
- `createGroup(schoolIdentifier, data: { name; nameAr?; description? })`: drop the level lookup/fallback and `levelId`; duplicate check `{ schoolId, name: data.name, deletedAt: null }`; max `orderIndex` per school; create with `schoolId`. Remove the `'No level found...'` guard.
- `updateGroup`: dup check by `schoolId` — look up the group first (`findUnique`), then `findFirst({ where: { schoolId: group.schoolId, name, deletedAt: null, id: { not: id } } })`.
- `deleteAllGroups`: `updateMany({ where: { schoolId, deletedAt: null }, data: { deletedAt: new Date() } })`; drop the levels lookup.
- Controller signatures: `createGroup` no longer takes `levelId` (leave the `POST /students/groups` route; body now `{ name, nameAr?, description? }`).

**Steps:** edit; `npm test` (students spec may need group-shape updates — see Task 14); `npm run build`. Commit.

### Task 7: Students — create/update/bulk/import gradeId→groupId

**Files:** `backend/src/modules/students/students.service.ts`, `dto/create-student.dto.ts`, `dto/update-student.dto.ts`, `dto/bulk-import-student.dto.ts`

**Invariant (schema-verified):** `students.group_id` is `NOT NULL`; `students.grade_id` is nullable. Every student must have a group. When a grade is set, `groupId` is DERIVED from it (server-derived, overrides any supplied `groupId` per spec). When no grade is set, `groupId` must be supplied explicitly (school-scoped validated) — it is never written as `null`.

**Changes:**
1. `create-student.dto.ts`: `schoolGrade` → remove; `groupId` stays but becomes `@IsOptional() @IsUUID()`; add `gradeId?: string` (`@IsOptional() @IsUUID()`). `levelId` stays required.
2. `update-student.dto.ts`: drop `schoolGrade`; keep optional `groupId`; add optional `gradeId`.
3. `bulk-import-student.dto.ts`: `schoolGrade` → remove from the item DTO; keep optional `groupId`; add optional `grade?: string` (grade name, matched case-insensitively).
4. `create`: replace the `schoolGrade`/`group` handling with:
```ts
let groupId: string;
if (gradeId) {
  const grade = await this.prisma.schoolGrade.findFirst({ where: { id: gradeId, schoolId, deletedAt: null }, select: { id: true, groupId: true } });
  if (!grade) throw new BadRequestException('Grade not found');
  groupId = grade.groupId;
} else if (createStudentDto.groupId) {
  const group = await this.prisma.group.findFirst({ where: { id: createStudentDto.groupId, schoolId, deletedAt: null }, select: { id: true } });
  if (!group) throw new BadRequestException('Group not found');
  groupId = createStudentDto.groupId;
} else {
  throw new BadRequestException('Grade or group is required');
}
```
and set `gradeId: createStudentDto.gradeId || null` + `groupId` on create; include `grade: { select: { id: true, name: true } }` in the returned include.
5. `update`: when `gradeId` is provided, look up the grade and set `groupId = grade.groupId` (derived, overrides any supplied groupId). When `gradeId` is not provided but `groupId` is, validate the group belongs to the school and set it. Never write `groupId: null`.
6. `bulkCreate` (:380-400): replace `gradeGroupMap` (keyed `levelId|gradeName`) with a per-school `gradeMap` from `schoolGrade.findMany({ where: { schoolId, deletedAt: null } })` keyed by `name.trim().toLowerCase()`; per row resolve `gradeId` + `groupId` from `item.grade` (matched case-insensitively; unmatched → row error naming the grade). If `item.grade` absent, fall back to `item.groupId` (validated school-scoped); if neither → row error `Grade or group is required`.
7. `bulkUpdate` (:466-496): `allowed = ['status', 'levelId', 'gradeId', 'groupId']`; remove `assertGroupBelongsToLevel` and the H7 `loadGradeGroupMap` re-derivation block; when `gradeId` is a value → derive `groupId = grade.groupId` (override); `gradeId: null` → clear grade only, leave groupId untouched; `groupId` set → write it directly (updateMany, no per-row validation needed).
8. Remove now-unused helpers `assertGroupBelongsToLevel` (:804) and `loadGradeGroupMap` (:781).

**Steps:** edit; `npm run build`; fix `students.service.spec.ts` (Task 14 covers the test updates — if the spec fails to compile here, update the two `schoolGrade` fixtures immediately so `npm test` compiles). Commit.

### Task 8: Students — findAll filter/sort + getStats

**Files:** `backend/src/modules/students/students.service.ts` (`findAll`, `getStats` :754)

**Changes:**
- `findAll` where: `schoolGrade` filter → `gradeId` (id). Add `grade: { select: { id: true, name: true } }` to the include. `sortBy === 'grade'` → `{ grade: { name: 'asc' } }`.
- `getStats`: replace `student.groupBy({ by: ['schoolGrade'] })` with `groupBy({ by: ['gradeId'], where: { schoolId, deletedAt: null, gradeId: { not: null } } })`, join names from `schoolGrade.findMany` for the `gradeDistribution` array (`{ grade, count }`); `studentsWithoutGrade` counts `gradeId: null`.
- `query-student.dto.ts`: `schoolGrade` filter field → `gradeId` (`@IsOptional() @IsUUID()`).

**Steps:** edit; `npm test`/`npm run build`; commit.

### Task 9: Attendance service — school-wide group lookups

**Files:** `backend/src/modules/attendance/attendance.service.ts`

**Changes:**
1. `startClass` (:380-430): the group lookup `where: { level: { schoolId: servant.schoolId }, levelId: ref.levelId }` → `where: { schoolId: servant.schoolId, deletedAt: null, status: { not: 'inactive' } }`. The single-group shortcut should use `ref.levelId` (from `recentSessions[0].levelId` / the ref param) as the level instead of `groups[0].levelId`. The `requiresGroupPick` payload must no longer include `level` from the group — return `groups.map((g) => ({ id: g.id, name: g.name }))`.
2. `getGroupStats` (:590-618): query `where: { schoolId, status: { not: 'inactive' } }`, drop the `include: { level }` and `orderBy: [{ level: ... }]` → `orderBy: { name: 'asc' }`, and remove `levelNumber`/`levelName` from each stat row.
3. Check for any other `group.level` / `levelId: groups[...]` references in the file and fix them the same way (verify with grep `group\.level|groups\[.*\]\.levelId`).
4. `generateSessions` (:667-747): the `levels` query `include: { groups: ... }` (reverse relation — removed) must be rewritten. **Decision:** sessions are generated per (school-wide group × distinct level of that group's active students). Replace the levels loop with:
   - `const groups = await this.prisma.group.findMany({ where: { schoolId, deletedAt: null, status: { not: 'inactive' } }, orderBy: { orderIndex: 'asc' } });`
   - `for (const group of groups)`: resolve `const groupLevels = await this.prisma.student.findMany({ where: { groupId: group.id, schoolId, deletedAt: null, status: 'active' }, select: { levelId: true }, distinct: ['levelId'] });` — if empty, `continue` (no students → no session).
   - `for (const { levelId } of groupLevels)`: the existing session create keeps `levelId` + `groupId`; the student pre-mark query becomes `where: { groupId: group.id, levelId, schoolId, deletedAt: null, status: 'active' }` so each (group, level) session marks exactly its students.
   - `level.id` usages in the session create/pre-mark are replaced by the loop's `levelId`.

**Steps:** edit; grep to confirm no `group.level` / `level.groups` remains; `npm run build`; commit.

### Task 10: Gamification service — drop group.level

**Files:** `backend/src/modules/gamification/gamification.service.ts`

**Changes:**
- `getGroupTrophy` (:750-763): remove `level` from the `group.findUnique` include.
- Response (:876-877): remove `levelNumber`/`levelName` (and their consuming milestone descriptions/renders in that method). Keep `groupId`/`groupName`.

**Steps:** edit; grep `group\.level` in the file returns nothing; `npm run build`; commit.

### Task 11: Dashboard service — grade-based distribution + leaderboard

**Files:** `backend/src/modules/dashboard/dashboard.service.ts`

**Changes:**
1. Grade distribution (:35-50): `student.groupBy({ by: ['schoolGrade'] })` → `by: ['gradeId']` with `gradeId: { not: null }`; load `schoolGrade` names for the school; return `{ grade: name, count }`. `studentsWithoutGrade` (:70-71): `schoolGrade: null` → `gradeId: null`.
2. Leaderboard / student map (:500-542): replace `schoolGrade: true` select with `grade: { select: { name: true } }`; return `gradeName: s?.grade?.name || null` (line ~582); and the parent-dashboard child payload (line ~509) → `gradeName: student.grade?.name || null` (add the `grade` include to that student query).
3. Grep the file for any remaining `schoolGrade` references and switch to grade.

**Steps:** edit; `npm run build`; commit.

### Task 12: Parents service — gradeName passthrough

**Files:** `backend/src/modules/parents/parents.service.ts`

**Changes:**
- `findChildren` (:45-98): add `grade: { select: { name: true } }` to the student include(s).
- `mapStudentParent` (:100-131): `schoolGrade: sp.student.schoolGrade` → `gradeName: sp.student.grade?.name || null`.
- `getChildrenCurrentLesson` (:134-139) is unaffected (selects `schoolId, levelId`).

**Steps:** edit; `npm run build`; commit.

### Task 13: Assessments — gradeId filter

**Files:** `backend/src/modules/assessments/assessments.service.ts` (`getStudentsForAssessment` :420-481), `assessments.controller.ts` (:153-159)

**Changes:**
- Controller: `@Get(':id/students')` query param `schoolGrade` → `gradeId`; pass through.
- Service: signature `(assessmentId, gradeId?)`; remove the `metadata.grade` / `storedGrade` / `effectiveGrade` string fallback; filter `...(gradeId ? { gradeId } : {})`; select `grade: { select: { name: true } }`; return each row's `gradeName` (drop `schoolGrade`).

**Steps:** edit; `npm run build`; commit.

### Task 14: Backend test updates + new grades spec

**Files:** `backend/src/modules/students/students.service.spec.ts`, `backend/src/modules/grades/grades.service.spec.ts` (NEW)

**Changes:**
- `students.service.spec.ts`: mock `student` object `schoolGrade: 'Grade 4'` → `gradeId` (a mock uuid) with `grade: { name: 'Grade 4' }` where the code under test reads it. Extend the prisma mock with `schoolGrade: { findMany, findFirst, create, update, updateMany }`. Update assertions for `createGroup`/`getGroups` school-scoped queries, `create` deriving `groupId` from `grade.groupId` (including that it overrides any client group value), `bulkCreate` grade-name resolution, and `getStats` gradeDistribution by gradeId.
- `grades.service.spec.ts` (mirror the spec style in the repo): mock `prismaMock` with `schoolGrade: { findMany, findFirst, create, update, updateMany }` and `group: { findFirst }`. Cover: `getGrades` maps groupName + studentCount; `createGrade` conflicts on duplicate name, rejects group from another school, sets `orderIndex`; `updateGrade` batch-moves students when groupId changes; `deleteGrade` soft-deletes.

**Steps:** write/update specs; `npm test` (all green, backend only); `npm run build`; commit.

### Task 15: Frontend lib — grades helpers, remove grade-groups

**Files:** `frontend/src/lib/grades.ts` (NEW), `frontend/src/lib/grades.test.ts` (NEW), `frontend/src/lib/school.ts`, delete `frontend/src/lib/grade-groups.ts` + `grade-groups.test.ts`

**Changes:**
- `lib/grades.ts`:
```ts
import { http } from '@/lib/http-client';
import { getSchoolId } from '@/lib/school';

export interface GradeItem {
  id: string;
  name: string;
  nameAr?: string | null;
  status: string;
  groupId?: string;
  groupName?: string;
  studentCount?: number;
}

export interface GroupOption {
  id: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  status: string;
}

export async function fetchGrades(): Promise<GradeItem[]> {
  return http.get<GradeItem[]>('/grades', { schoolId: getSchoolId() });
}

export async function fetchActiveGrades(): Promise<GradeItem[]> {
  const grades = await fetchGrades();
  return grades.filter((g) => g.status === 'active');
}

export async function fetchGroups(): Promise<GroupOption[]> {
  return http.get<GroupOption[]>('/students/groups/all', { schoolId: getSchoolId() });
}

export async function createGrade(input: { name: string; nameAr?: string; groupId: string }) {
  return http.post<GradeItem>('/grades', input, { schoolId: getSchoolId() });
}

export async function updateGrade(id: string, input: { name?: string; nameAr?: string; groupId?: string; status?: string }) {
  return http.patch<GradeItem>(`/grades/${id}`, input);
}

export async function deleteGrade(id: string) {
  return http.delete<void>(`/grades/${id}`);
}
```
- `lib/school.ts`: remove `GradeItem`, `fetchGrades`, `fetchActiveGrades`, `GRADES_SCHOOL_ID` (fully migrated to `grades.ts`; both importers updated). Keep `getSchoolId`/`getBaseSchoolId`. **Do NOT remove `fetchGradeGroups`/`saveGradeGroups`/`GRADE_GROUPS_KEY`/the `grade-groups` import yet** — `student-form-modal.tsx:13` still imports `fetchGradeGroups` from `@/lib/school` and `grades-tab.tsx`/`student-form-modal.tsx` still import from `@/lib/grade-groups` until Tasks 16/18 rewrite them.
- Do NOT delete `lib/grade-groups.ts`/`grade-groups.test.ts` in this task (still imported). They are deleted at the end of Task 18, which also removes the `fetchGradeGroups`/`saveGradeGroups`/`GRADE_GROUPS_KEY` leftovers from `lib/school.ts`.
- Update the two importers of `fetchActiveGrades`/`GradeItem` from `@/lib/school`: `students-client.tsx` (:10) and `assessments/page.tsx` (:22) → `@/lib/grades`.
- `lib/grades.test.ts`: mock `global.fetch`/`http-client` to assert `fetchActiveGrades` filters by status and `fetchGroups` maps the flat array.

**Steps:** write files, update the two importers, trim `lib/school.ts`; `grep -rn "fetchActiveGrades\|GRADES_SCHOOL_ID" frontend/src/app/dashboard/students/students-client.tsx frontend/src/app/dashboard/assessments/page.tsx` returns nothing (i.e. those importers no longer pull grades from `@/lib/school`); `grep -rn "GRADES_SCHOOL_ID" frontend/src` returns nothing; `npm run test` (frontend); commit. (The `grade-groups` + `fetchGradeGroups`/`saveGradeGroups` removal gates are checked after Task 18.)

### Task 16: Settings — grades-tab rewrite

**Files:** `frontend/src/app/dashboard/settings/_components/grades-tab.tsx`

**Interfaces:** uses `fetchGrades`, `fetchGroups`, `createGrade`, `updateGrade`, `deleteGrade` from `@/lib/grades`.

**Behavior:**
- Load grades + active groups on mount (`Promise.all`).
- Create form: name, nameAr (optional), group select (required, from active groups). `emptyForm = { name: '', nameAr: '', groupId: '' }`.
- Table: name, group name, student count, status, edit/delete actions.
- Edit: same fields pre-filled; status toggle.
- Deleting a grade with students → `window.confirm` warning before delete.
- Changing a grade's group → `window.confirm` warning that existing students' groups will follow.
- Remove all `GRADE_GROUPS_KEY`/`combos`/`saveGradeGroups` logic.

**Steps:** rewrite; add `frontend/src/app/dashboard/settings/__tests__/grades-tab.test.tsx` (mock `@/lib/http-client` + `@/lib/use-language` like existing tests; assert renders grades, and creating calls `createGrade` with `groupId`); `npm run test` (frontend); commit.

### Task 17: Settings — groups-tab (no level)

**Files:** `frontend/src/app/dashboard/settings/_components/groups-tab.tsx`

**Changes:**
- Remove `fetchLevels` and the level selector; `emptyForm = { name: '', nameAr: '', description: '' }`.
- Load groups via `fetchGroups()` (flat array — no `.groups` nesting).
- Create/edit/delete use the existing `/students/groups` endpoints (`http.post('/students/groups', body, { schoolId })`, `http.patch`, `http.delete`).
- Update the local `Group` interface: `levelId` optional field removed.

**Steps:** edit; `npm run test` (frontend); commit.

### Task 18: Students — types + form

**Files:** `frontend/src/app/dashboard/students/_components/student-types.ts`, `_components/student-form-modal.tsx`, `students-client.tsx` (minimal caller alignment only)

**Changes:**
- `student-types.ts`: `Student` — remove `schoolGrade?: string`; add `gradeId?: string` and `grade?: { id: string; name: string } | null`. Remove `schoolGrade` from `emptyForm`, add `gradeId: ''`. (Leave `levelId`/`groupId`/`groupName`; `groupName` stays read-only display.)
- `student-form-modal.tsx`:
  - Props: `gradeOptions` becomes `GradeItem[]` (from `@/lib/grades`); drop the `allGroups` prop and `fetchGradeGroups`/`gradeOptionsForLevel`/`grade-groups` usage.
  - Add a Grade select (options `gradeOptions`, value `gradeId`). Group is no longer user-editable: show read-only `form.groupName` (from `gradeOptions.find(g => g.id === gradeId)?.groupName`, or the existing student's group in edit mode). Remove the group select + `groupChange`/`combo` warning.
  - Submit payload: `{ ...form, levelId, gradeId }` — no `schoolGrade`, no `groupId`. The optimistic-add object (`onOptimisticAdd`) must not include a manually-chosen groupId; use the selected grade's `groupId`/`groupName` (from `gradeOptions`) because backend keeps `students.group_id` NOT NULL and derives it from the grade. On the level select change, clear `gradeId` too.
- `students-client.tsx` (MINIMAL caller alignment for this task — full rewrite is Task 19): pass the new props to `StudentFormModal`:
  - `gradeOptions` becomes `GradeItem[]` from `fetchActiveGrades()` (in `@/lib/grades`) instead of `string[]`;
  - stop passing `allGroups`;
  - may still build `allGroups` internally for its own filter state (not passed to the modal).

**Steps:** edit; delete `lib/grade-groups.ts` + `grade-groups.test.ts` and remove the now-unused `fetchGradeGroups`/`saveGradeGroups`/`GRADE_GROUPS_KEY` + `import { GRADE_GROUPS_KEY, type GradeGroupCombo } from './grade-groups'` from `lib/school.ts` (verify `grep -rn "grade-groups" frontend/src` and `grep -rn "fetchGradeGroups\|saveGradeGroups\|GRADE_GROUPS_KEY" frontend/src` both return nothing); `npm run test` (frontend); commit.

### Task 19: Students — client, filters, table, detail

**Files:** `students-client.tsx`, `_components/student-filters.tsx`, `_components/student-table.tsx`, `_components/student-detail-modal.tsx`

**Changes:**
- `students-client.tsx`:
  - `gradeOptions` from `fetchActiveGrades()` → `GradeItem[]`; `filterGrade` = gradeId string.
  - `fetchStudents`: `if (filterGrade) params.gradeId = filterGrade` (was `schoolGrade`).
  - Groups: `fetchGroups()` flat array → `allGroups`; `filterGroups` = all groups (no level filtering). `levelNameMap` built from `levels` only (levels no longer nest groups).
  - Export CSV 'Grade' column → `s.grade?.name`.
  - Import `fetchActiveGrades`/`type GradeItem` from `@/lib/grades`.
- `student-filters.tsx`: props `gradeOptions: GradeItem[]`; grade filter value is the id, label `g.name`; group filter no longer gated on level selection.
- `student-table.tsx`: grade cell `{s.grade?.name || '—'}` (both desktop :153 and mobile :103).
- `student-detail-modal.tsx`: `value: s.grade?.name || '—'` (was `s.schoolGrade`, :33).

**Steps:** edit; update `students/__tests__/page.test.tsx` mocks *minimally* so the suite stays green under this task (the fetch mock must now serve `/curriculum/levels` and the flat `/students/groups/all` and `/grades`; student fixtures switch `schoolGrade` → `gradeId` + `grade: { name }`; the group-filter dropdown loses its "Select level first" disabled state, so update any assertion that expects it; full student-form-modal/groups-tab/grades-tab coverage is Task 22) — `npm run test` (frontend) MUST pass after this task; commit.

### Task 20: Students — bulk + import modals

**Files:** `_components/student-bulk-modals.tsx`, `_components/student-import-modal.tsx`

**Changes:**
- `student-bulk-modals.tsx`: `gradeOptions` become `GradeItem[]`; bulk grade state = gradeId; payload `patch('/students/bulk', { ids, data: { gradeId: bulkGrade } })`. The bulk *level* modal drops the group dropdown (update no longer accepts `groupId`).
- `student-import-modal.tsx`:
  - CSV template header `schoolGrade` → `grade`; sample value `Grade 4`.
  - Map rows to `{ levelId: r.levelid, grade: r.grade || undefined }` (drop `groupId`, `schoolGrade`).
  - Preview grade column uses `r.grade`.
  - Info copy: "Group is auto-derived from grade."

**Steps:** edit; `npm run test` (frontend); commit.

### Task 21: Assessments + dashboard + parents pages

**Files:** `frontend/src/app/dashboard/assessments/page.tsx`, `frontend/src/app/dashboard/dashboard-client.tsx`, `frontend/src/app/dashboard/parents/page.tsx`

**Changes:**
- `assessments/page.tsx`:
  - Import `fetchActiveGrades, type GradeItem` from `@/lib/grades` (:22).
  - Grade filter options → `GradeItem[]` (id + name); filter state is a gradeId.
  - `openStudents` (:315-346): pass `p.gradeId = gradeId` (id) instead of `p.schoolGrade = grade` (name).
  - `StudentRow` (:41-46) and report/CSV (:390-425): `r.schoolGrade` → `r.gradeName`.
- `dashboard-client.tsx`: ChildCard grade pill (:1501-1503) uses `child.gradeName`; leaderboard (:1824) uses `s.gradeName || s.levelName`.
- `parents/page.tsx`: student card (:254) `s.schoolGrade` → `s.gradeName`.

**Steps:** edit; grep `schoolGrade` in `frontend/src/app` returns nothing (except none should remain); `npm run test` (frontend); `npm run build` (frontend, if wired); commit.

### Task 22: Frontend test updates

**Files:** `students/__tests__/page.test.tsx`, `settings/__tests__/grades-tab.test.tsx` (from Task 16), `settings/__tests__/groups-tab.test.tsx` (NEW), `students/_components/__tests__/student-form-modal.test.tsx` (NEW), `lib/grades.test.ts` (from Task 15)

**Changes:**
- `page.test.tsx`: mock student fixtures `schoolGrade: 'Grade 4'` (:69) / `'Grade 6'` (:88) → `gradeId` + `grade: { name: 'Grade 4' }` etc.; update any mocked lib responses for the new `/grades` + flat `/students/groups/all` shapes.
- `grades-tab.test.tsx`: assert grades render (name + group name), creating calls `createGrade` with `groupId`, and the group-change confirm warning fires.
- `groups-tab.test.tsx`: assert the create form has **no level selector** and creating calls the groups endpoint.
- `student-form-modal.test.tsx`: assert the form shows **Level + Grade** selects, a read-only group display (no group dropdown), and submits `{ levelId, gradeId }` without `schoolGrade`/`groupId`.
- Ensure `lib/grades.test.ts` passes.

**Steps:** write/update tests; `npm run test` (frontend, full) green; commit.

### Task 23: Full verification pass

**Files:** none (verification only)

**Steps:**
1. `grep -rn "schoolGrade" backend/src frontend/src` → none expected (only historical docs); `grep -rn "grade-groups\|fetchGradeGroups\|saveGradeGroups\|GRADE_GROUPS_KEY\|gradeGroups" frontend/src` → none.
2. `grep -rn "group\.level\|groups\[.*\]\.levelId\|\.levelId: group" backend/src` → none.
3. Backend: `npx prisma generate && npx tsc --noEmit && npm run build && npm test` (all green). `npx prettier --check` on all touched backend files.
4. Frontend: run the available checks — `npm run type-check` (or `npx tsc --noEmit`), `npm run lint` if wired, `npm run test` (all green). `npx prettier --check` on touched frontend files. `npm run build` (Next) if available.
5. Review `git status`/`git diff` for accidental churn; run the data migration script against a copy/staging DB with `--dry-run` first, verify summary counts, then run against dev once more idempotently (it must be safe to run twice).
6. Confirm the approved spec's checklist (`docs/superpowers/specs/2026-08-07-levels-grades-groups-design.md`): Grade entity, Group school-wide, group auto-derived from grade, student = level + grade, changing a grade's group auto-moves its students, `gradeGroups`/`grades` config removed, verification specs updated.
7. Commit any remaining changes and report the summary to the user. Do NOT push or deploy.

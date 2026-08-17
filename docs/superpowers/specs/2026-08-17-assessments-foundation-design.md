# Assessments Foundation Fixes — Design

**Date:** 2026-08-17
**Scope:** Unit A of the assessments improvement program (see decomposition below).
**Approach:** Backend-authoritative (Approach 1). No Prisma schema/migration changes.

## Context

The assessments feature already supports create/edit (with a questions editor), assign
students, manual + batch marking, and a report view. A review of the deployed code
(`origin/main` @ `f05017e`) surfaced several integrity bugs and gaps. This spec fixes the
foundational ones. The larger features (analytics dashboard, student take flow, bulk
actions + PDF/XLS export) are tracked as separate units and out of scope here.

Verified facts from the deployed schema: `Assessment.type` and `Assessment.status` are
plain `String` columns (not DB enums), so the type enum requires no migration.
`AssessmentQuestion` has `onDelete: Cascade` for grades.

## Decomposition (program-level)

- **Unit A (this spec):** Foundation fixes — real type enum, grade-filter bug, question-ID
  upsert, validation, `closed` status.
- **Unit B:** Results & analytics dashboard.
- **Unit C:** Student-facing take/complete flow.
- **Unit D:** Bulk actions + PDF/XLS export.

## Goals

1. Make assessment `type` a real, editable field (quiz/test/exam/oral/homework) and make
   the existing type filter actually work end to end.
2. Stop `update()` from destroying question IDs (which corrupts historical grades).
3. Fix the students-modal grade filter (sends a grade name where a UUID is expected).
4. Enforce validation server-side with friendly errors, mirrored as soft warnings in the UI.
5. Expose the `closed` status in the UI.

## Non-goals

- No student-facing take flow, analytics, bulk actions, or export (Units B/C/D).
- No pagination/server search for the student list (out of scope).
- No Prisma schema migration; `type`/`status` remain `String` columns.

## Backend changes

### DTO (`backend/src/modules/assessments/dto/assessment.dto.ts`)

- `CreateAssessmentDto` / `UpdateAssessmentDto`:
  - Add `@IsOptional() @IsIn(['quiz','test','exam','oral','homework']) type?: string`.
- `CreateQuestionDto`:
  - Add `@IsOptional() @IsUUID() id?: string` (used by `update()` for upsert).

### Service (`backend/src/modules/assessments/assessments.service.ts`)

- `create()`: persist `type: dto.type || 'quiz'` (replaces hardcoded `'general'`).
- `update()`: persist `dto.type` when provided.
- `update()` question handling (replaces delete-and-recreate):
  - When `dto.questions` is provided, run inside `prisma.$transaction`:
    - For each incoming question: if it has an `id` matching an existing question of this
      assessment → `update`; otherwise → `create`.
    - `deleteMany` questions whose id is **not** in the incoming set **and** have zero
      `grades` rows (`where: { assessmentId, id: { notIn: keptIds }, grades: { none: {} } }`),
      so grades on removed questions are preserved rather than cascaded away.
- `findAll()`: accept a `type` query param and add it to the `where` filter.
- Validation (throw `BadRequestException` with a clear message):
  - Points: `sum(q.points) <= totalPoints` (checked on create and update).
  - MC correctness: `correctAnswer` must be one of the `options`; reject empty option strings.
  - Mark caps: in `markStudent()`, require `score <= maxScore` and `maxScore` not exceeding
    the assessment total.
  - Duplicate submit: in `submit()`, reject if a submission already exists for this
    assessment + student (unless reopened via `reassess`).

### Controller (`backend/src/modules/assessments/assessments.controller.ts`)

- `findAll()`: add the `type` query param (optional) and forward to the service.

## Frontend changes (`frontend/src/app/dashboard/assessments/page.tsx`)

- Carry question IDs through the editor:
  - Add optional `id` to the `QuestionDraft` type; populate from `detail.questions[].id`
    when editing; include `id` in the PUT body (omit on create).
- Assessment type UI:
  - Add a required **Type** select (quiz/test/exam/oral/homework) to the create/edit form.
  - Set from `detail.type` when editing; default `'quiz'` on create.
  - Include `type` in the POST/PUT body.
- Make the type filter real: wire the selected filter value into the server query
  (`type` param) instead of the current no-op. (Search stays client-side.)
- Grade-filter bug: in the students modal, send the grade `id` (UUID) instead of the
  grade name.
- `closed` status: add `closed` to the form status dropdown and the create-form status select.
- Soft validation mirrors (inline warnings): warn when question points exceed
  `totalPoints`; flag MC questions whose `correctAnswer` is not in `options`.

## Error handling

- Backend validation failures → `BadRequestException` with human-readable messages.
- Frontend already surfaces API errors via its existing toast/error handling; no new error
  UI introduced. Messages should be clear in English (and Arabic where the UI localizes).

## Testing

- Backend (`assessments.service.spec.ts`): add cases for
  - upsert preserves question IDs;
  - type whitelist rejection;
  - points-sum validation;
  - MC correctAnswer validation;
  - mark-score cap;
  - duplicate-submit rejection.
- Frontend: add a test that the type field is required/persisted and that the students
  modal sends a grade UUID (following the existing `assessment-reference.test.tsx` pattern).
- Verify with `npx tsc --noEmit` + `npx vitest run` (frontend) and the backend assessments
  spec. The 17 pre-existing unrelated backend Jest failures remain untouched.

## Files touched

- `backend/src/modules/assessments/dto/assessment.dto.ts`
- `backend/src/modules/assessments/assessments.service.ts`
- `backend/src/modules/assessments/assessments.controller.ts`
- `backend/src/modules/assessments/assessments.service.spec.ts`
- `frontend/src/app/dashboard/assessments/page.tsx`
- `frontend/src/app/dashboard/assessments/__tests__/assessment-reference.test.tsx` (or a new test file)

No Prisma schema or migration changes.

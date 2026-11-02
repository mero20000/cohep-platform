# Assessment Module Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add copy-assessment, a per-assessment "Require review" flag, retry-on-fail with a configurable attempt cap and visible attempt count, and a "Require recording" flag.

**Architecture:** Three boolean columns on `assessments` (plus the existing `max_attempts`) drive everything. Backend rules live in `AssessmentsService` and one new pure helper module (`assessment-attempts.ts`) that computes score, pass and attempt state at read time, so nothing is backfilled. The frontend adds form controls, a prefill-the-form Copy action, and attempt/recording UI on the take, result and portal pages.

**Tech Stack:** NestJS + Prisma (Postgres) + Jest (backend); Next.js App Router + React + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-11-02-assessment-module-enhancements-design.md`

## Global Constraints

- New columns on `assessments`: `require_review` boolean not null default `true`; `require_recording` boolean not null default `false`; `allow_retry` boolean not null default `false`. Reuse existing `max_attempts` as the **total** attempts including the first.
- `maxAttempts` range 2–10, default 3 when `allowRetry` is true; when `allowRetry` is false, store `null` (effective attempts = 1).
- On create, `requireReview` omitted → `false` for type `quiz`, `true` for every other type.
- Essay questions: reject (400) `requireReview = false` or `allowRetry = true` when any question is `essay`; checked on every create and update against the merged (stored + incoming) state.
- XP when `allowRetry` is on: only on a pass, at `round(score / maxScore × 100)`; failed attempts earn none; re-marking a passing submission below the pass mark removes its XP. When `allowRetry` is off, XP is unchanged (any mark credits).
- Pass means `score >= passingScore`. Score = the overall grade row (`questionId = null`) if present, else the sum of per-question grades.
- Recording requirement is enforced on the student-portal submit only; the staff proxy submit is never blocked by it.
- Answer key and per-question detail stay hidden while a further attempt is possible (spec "Answer-key protection").
- Copy sets title `Copy of <title>` (AR: `نسخة من <title>`), clears the due date, status `draft`, drops question ids.
- All new UI text is bilingual AR/EN, in the style of the surrounding code (`lang === 'ar' ? '…' : '…'`).
- No changes under `mobile/`. Do not push. Commit steps are local commits on the current branch and run only after the user confirms commits are wanted; each commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Commands: backend `cd backend && npx jest <path>`; frontend `cd frontend && npx vitest run <path>`; typecheck `npx tsc --noEmit` in each package.

## Review Focus

1. A student double-clicks "Try again" (or reloads after it): no second open attempt, and the attempt count is unchanged. Test in Task 4.
2. A student who failed attempt 1 and started attempt 2 opens attempt 1's review URL directly: no answer key and no per-question marks. Test in Task 4.
3. A failed student with attempts left after the due date (late not allowed): "Try again" is refused, and the key is then open. Test in Task 2 and Task 4.
4. The timer hits 0:00 on a recording-required assessment with no recording: the page stays open and explains why, instead of looping on a rejected auto-submit. Test in Task 7.
5. A servant re-marks a passing retry-enabled submission below the pass mark: its XP is removed, and no duplicate XP row appears on re-marks. Test in Task 3.

---

### Task 1: Data model, DTOs, create/update rules

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Assessment`, ~line 868)
- Create: `backend/prisma/migrations/20261102000000_assessment_review_retry_recording_flags/migration.sql`
- Modify: `backend/src/modules/assessments/dto/assessment.dto.ts`
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`create`, `update`)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Produces: `Assessment.requireReview: boolean`, `.requireRecording: boolean`, `.allowRetry: boolean` (Prisma fields mapped to the snake_case columns above); DTO fields `requireReview?: boolean`, `requireRecording?: boolean`, `allowRetry?: boolean`, `maxAttempts?: number` on both `CreateAssessmentDto` and `UpdateAssessmentDto`; private `assertReviewRetryCompatible(questions: Array<{ type: string }>, flags: { requireReview: boolean; allowRetry: boolean }): void` on the service (throws `BadRequestException`).

- [ ] **Step 1: Write failing tests** in `assessments.service.spec.ts`:
  - `create` describe: `defaults requireReview to false for quiz` (dto without type → `prisma.assessment.create` called with `data.requireReview === false`); `defaults requireReview to true for exam` (type `exam`); `stores maxAttempts 3 when allowRetry is true and maxAttempts omitted`; `stores maxAttempts null when allowRetry is false even if maxAttempts is sent`; `rejects an essay question with requireReview false`; `rejects an essay question with allowRetry true` (both `rejects.toThrow(BadRequestException)`).
  - `update` describe: `rejects adding an essay question to a retry-enabled assessment` (existing mock row `allowRetry: true`, dto with an essay question); `rejects turning allowRetry on when stored questions include an essay` (existing row, `assessmentQuestion.findMany` resolves `[{ type: 'essay' }]`); `clears maxAttempts when allowRetry is switched off`.
  - `DTO validation` describe: `rejects maxAttempts of 1 and 11`, `accepts maxAttempts 2..10`.
- [ ] **Step 2: Run** `cd backend && npx jest src/modules/assessments/assessments.service.spec.ts` — expect the new tests FAIL.
- [ ] **Step 3: Implement.** Add the three columns to `schema.prisma` (`requireReview Boolean @default(true) @map("require_review")`, etc.) and the migration as three `ALTER TABLE "assessments" ADD COLUMN … NOT NULL DEFAULT …` statements. Add the DTO fields (`@IsOptional() @IsBoolean()`; `maxAttempts` with `@IsInt() @Min(2) @Max(10)`) to both DTO classes. In `create()` compute `requireReview = dto.requireReview ?? (type !== 'quiz')`, `allowRetry = dto.allowRetry ?? false`, `maxAttempts = allowRetry ? (dto.maxAttempts ?? 3) : null`, call `assertReviewRetryCompatible(dto.questions ?? [], …)` and persist all four. In `update()` merge incoming flags over stored ones, take questions as `dto.questions ?? await prisma.assessmentQuestion.findMany({ where: { assessmentId: id }, select: { type: true } })`, call the assertion, and persist the changed flags (`allowRetry` false → `maxAttempts: null`; `allowRetry` true with no stored/incoming cap → 3). Run `cd backend && npx prisma generate`.
- [ ] **Step 4: Run** the spec again — expect PASS, and `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(assessments): add review/retry/recording flags and validation`.

### Task 2: Attempt, score and pass helpers

**Files:**
- Create: `backend/src/modules/assessments/assessment-attempts.ts`
- Test: `backend/src/modules/assessments/assessment-attempts.spec.ts`

**Interfaces:**
- Produces (all exported):
  - `const DEFAULT_MAX_ATTEMPTS = 3`
  - `interface RetryPolicy { allowRetry: boolean; maxAttempts: number | null; passingScore: number; dueDate: Date | null; allowLateSubmission: boolean }`
  - `interface LiveAttempt { status: string; attemptNumber: number; earned: number | null }`
  - `effectiveMaxAttempts(p: Pick<RetryPolicy, 'allowRetry' | 'maxAttempts'>): number` — 1 when retry off, else `maxAttempts ?? 3`.
  - `submissionScore(grades: Array<{ questionId: string | null; score: unknown; maxScore: unknown }>, totalPoints: number): { earned: number; max: number }` — overall grade authoritative, else sum of per-question grades with `max = totalPoints`.
  - `attemptState(policy: RetryPolicy, live: LiveAttempt, now?: Date): { attemptNumber: number; max: number; remaining: number; passed: boolean | null; moreAttemptsPossible: boolean; canRetry: boolean; answerKeyOpen: boolean }`
    - `passed` = `earned >= passingScore` when `live.status === 'completed'` and `earned !== null`, else `null`.
    - `moreAttemptsPossible` = `allowRetry && passed !== true && attemptNumber < max && dueOpen`, where `dueOpen` is false only when `dueDate` is past and `allowLateSubmission` is false.
    - `canRetry` = `moreAttemptsPossible && passed === false`.
    - `answerKeyOpen` = `!allowRetry || passed === true || !moreAttemptsPossible`.
    - `remaining` = `max(0, max - attemptNumber)`.

- [ ] **Step 1: Write failing tests** (`attemptState` unless noted): retry off → `max 1, canRetry false, answerKeyOpen true`; failed completed 1 of 3 → `canRetry true, answerKeyOpen false, remaining 2`; passed → `canRetry false, answerKeyOpen true`; failed on attempt 3 of 3 → `canRetry false, answerKeyOpen true, remaining 0`; failed, due date past, late not allowed → `canRetry false, answerKeyOpen true`; same with late allowed → `canRetry true`; live status `submitted` (awaiting marking), attempts left → `canRetry false, passed null, answerKeyOpen false`; `effectiveMaxAttempts({ allowRetry: true, maxAttempts: null })` → 3; `submissionScore` uses the overall row when present (earned 7 of 10 with extra per-question rows ignored) and sums per-question rows with `max = totalPoints` otherwise.
- [ ] **Step 2: Run** `cd backend && npx jest src/modules/assessments/assessment-attempts.spec.ts` — FAIL (module missing).
- [ ] **Step 3: Implement** the module to the signatures above (pure functions, no Prisma).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(assessments): pure attempt/score/pass helpers`.

### Task 3: `submit()` auto-complete, recording rule, XP rule

**Files:**
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`submit`, `markStudent`, new private methods)
- Modify: `backend/src/modules/assessments/assessments.controller.ts` (staff `submit` passes `source: 'staff'`)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 columns; Task 2 `submissionScore`, `attemptState`, `effectiveMaxAttempts`.
- Produces:
  - `submit(assessmentId: string, studentId: string, dto: SubmitAssessmentDto, actor?: { id?: string; schoolId?: string; source?: 'staff' | 'portal' })` now returns the existing submission include **plus** `result: SubmitResult`, where `SubmitResult = { gradingComplete: boolean; earned: number | null; max: number; passed: boolean | null; attemptNumber: number; maxAttempts: number; attemptsRemaining: number; canRetry: boolean; revealDetail: boolean }`. `maxAttempts` is the effective cap; `revealDetail = !allowRetry || (status === 'completed' && answerKeyOpen)`.
  - private `creditXp(args: { studentId: string; submissionId: string; lessonId: string | null; score: number; maxScore: number; passRequired: boolean; passingScore: number }): Promise<void>` — extracted from `markStudent`; when `passRequired && score < passingScore` it deletes any existing XP row for the submission and returns; otherwise upserts exactly as `markStudent` does today.
  - private `notifyGraded(args: { studentId: string; submissionId: string; title: string; titleAr: string | null; score: number; maxScore: number }): Promise<void>` — the existing `assessment_graded` `notifyOrRefresh` call.

- [ ] **Step 1: Write failing tests**:
  - `submit`: `rejects a portal submit without fileUrl when requireRecording is on` (actor `{ source: 'portal' }` and actor `undefined`); `allows a staff submit without fileUrl when requireRecording is on` (actor `{ source: 'staff' }`); `auto-completes when requireReview is false and all questions are gradable` (`assessmentSubmission.update` called with `status: 'completed'`, `notifyOrRefresh` called once, result `gradingComplete: true`); `leaves status submitted when requireReview is true`; `leaves status submitted when an essay question exists even if requireReview is false`; `reports attempt 1 of 3 and canRetry true for a failed no-review quiz with retry on`; `credits no XP for a failing attempt when retry is on`; `credits one XP row for the passing attempt when retry is on`; `still credits XP for a failing mark when retry is off`.
  - `markStudent`: `removes XP when a passing retry-enabled submission is re-marked below the pass mark` (`xPTransaction.delete`/`deleteMany` called, no `create`); `updates rather than duplicates XP on a second passing re-mark`.
  - Extend `prismaMock` with `xPTransaction: { findFirst, aggregate, create, update, deleteMany }` (the `markStudent` code already uses them) if absent.
- [ ] **Step 2: Run** the spec — new tests FAIL.
- [ ] **Step 3: Implement.** In `submit()`: select the assessment's new flags, enforce the recording rule (`actor?.source !== 'staff' && requireRecording && !dto.fileUrl` → `BadRequestException('A voice recording is required for this assessment')`), and inside the existing transaction, after the per-question grades, finalise when `!requireReview && no essay question`: set `status: 'completed'`, compute `submissionScore`, call `creditXp` with `passRequired: allowRetry`, then `notifyGraded` after the transaction. Build `result` from `attemptState` (build `RetryPolicy` from the assessment). Refactor `markStudent` to call `creditXp` (`passRequired: assessment.allowRetry`) and `notifyGraded` without changing its other behaviour. Staff controller: pass `source: 'staff'` alongside `id`/`schoolId`; the portal controller passes `{ source: 'portal' }` as the fourth argument (`student-portal.controller.ts:85`).
- [ ] **Step 4: Run** the full assessments spec — PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(assessments): auto-complete no-review submissions, recording rule, pass-only XP`.

### Task 4: Retake rules, review gate, take payload, portal data

**Files:**
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`prepareRetake`, `getSubmissionReview`, `getTakeQuestions`)
- Modify: `backend/src/modules/students/students.service.ts` (assessments block in portal data, ~line 840–990)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts` (and the portal-data test file for `StudentsService`, extending it if one covers this block)

**Interfaces:**
- Consumes: Task 2 helpers.
- Produces:
  - `getSubmissionReview` response gains `attempt: { number: number; max: number; remaining: number; canRetry: boolean; answerKeyOpen: boolean }`. `correctAnswer`, per-question `isCorrect` and `score` are `null` unless the viewed submission is `completed` **and** `answerKeyOpen`.
  - `getTakeQuestions` assessment header gains `requireRecording: boolean`, `attemptNumber: number`, `maxAttempts: number` (effective).
  - Portal data per assessment gains `attempt: { number: number; max: number; canRetry: boolean }`; `earnedScore` now uses `submissionScore` (replacing the plain sum, which double-counted a servant's overall mark alongside auto-grades).

- [ ] **Step 1: Write failing tests**: `prepareRetake` — `refuses when allowRetry is off`, `refuses when the student already passed`, `refuses when attempts are exhausted` (update the existing maxAttempts test to set `allowRetry: true`), `refuses after the due date when late submission is not allowed`, `allows after the due date when late submission is allowed`, `reuses the open attempt on a second call` (live status `assigned` → no `create`, same `newSubmissionId`; Review Focus 1). `getSubmissionReview` — `withholds correctAnswer and per-question marks for a failed student with attempts left`; `releases them once the student passed`; `releases them when attempts are exhausted`; `withholds them for a superseded attempt opened by id while a new attempt is open` (Review Focus 2); `releases them after the due date passes` (Review Focus 3); `reports attempt { number, max, remaining, canRetry }`. `getTakeQuestions` returns `requireRecording`, `attemptNumber`, `maxAttempts`. Portal data: `returns attempt 2 of 3 and canRetry for a failed completed retry-enabled assessment`.
- [ ] **Step 2: Run** the specs — FAIL.
- [ ] **Step 3: Implement.** `prepareRetake`: keep the existing essay/grading-in-progress/open-attempt/archive-and-create code, and add before the archive step the rules from the spec using `attemptState(...).canRetry` (specific 400 messages: retry not enabled; already passed; no attempts remaining; due date passed). Replace the `attemptsUsed >= maxAttempts` check with the helper's `max`. `getSubmissionReview`: build the policy from the assessment (add the needed fields to its `select`), call `attemptState` using the live submission (`liveSubmission(...)`), and gate the answer-key fields on `gradingComplete && attempt.answerKeyOpen`. Portal data: add `allowRetry, maxAttempts, allowLateSubmission` to the assessment `select` and `questionId` to the grades select; map `attempt`.
- [ ] **Step 4: Run** the specs — PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(assessments): retry rules, answer-key gate, attempt data`.

### Task 5: Frontend form settings

**Files:**
- Create: `frontend/src/app/dashboard/assessments/assessment-form.ts` (moves `QuestionDraft`, `emptyForm` out of `page.tsx`; exports `AssessmentForm`)
- Create: `frontend/src/app/dashboard/assessments/review-settings.ts`
- Modify: `frontend/src/app/dashboard/assessments/page.tsx` (form JSX ~line 985–1045, `handleSave` body ~line 570, type select `onChange`, `Assessment` interface)
- Test: `frontend/src/app/dashboard/assessments/review-settings.test.ts`, and a case in `__tests__/assessment-reference.test.tsx`

**Interfaces:**
- Produces: `AssessmentForm` gains `requireReview: boolean`, `requireRecording: boolean`, `allowRetry: boolean`, `maxAttempts: string` (default `'3'`), `reviewTouched: boolean` (UI-only, never sent), `durationMinutes: string` (hidden; carried so copy/edit keep the timer).
  - `review-settings.ts`: `defaultRequireReview(type: string): boolean`; `hasEssay(questions: Array<{ type: string }>): boolean`; `reviewPayload(form: Pick<AssessmentForm, 'requireReview' | 'requireRecording' | 'allowRetry' | 'maxAttempts' | 'questions'>): { requireReview: boolean; requireRecording: boolean; allowRetry: boolean; maxAttempts?: number }` (essay forces `requireReview: true`, `allowRetry: false`; `maxAttempts` only when retry is on); `needsShortAnswerWarning(form): boolean` (review off and any `short_answer` question).

- [ ] **Step 1: Write failing tests** (`review-settings.test.ts`): `defaultRequireReview('quiz')` false and `'exam'` true; `reviewPayload` with an essay question returns `requireReview: true, allowRetry: false` and no `maxAttempts`; with retry on and `maxAttempts: '4'` returns `maxAttempts: 4`; `needsShortAnswerWarning` true only for review off + short answer. In `assessment-reference.test.tsx`: `submits the four settings in the create body` (toggle Allow retry, set Max attempts 4, Require recording on; assert the POST body contains `requireReview: false` for the default quiz, `allowRetry: true`, `maxAttempts: 4`, `requireRecording: true`); `disables Require review and Allow retry when an essay question exists`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/app/dashboard/assessments` — FAIL.
- [ ] **Step 3: Implement.** Create the two modules; import `emptyForm`/`QuestionDraft` in `page.tsx` from `assessment-form.ts` (extend `emptyForm` with the new fields: `requireReview: false`, `requireRecording: false`, `allowRetry: false`, `maxAttempts: '3'`, `reviewTouched: false`, `durationMinutes: ''`). Add a "Review & attempts" group after the points/due-date grid with the four controls (labels and hints per the spec; Max attempts is a number input `min=2 max=10`, shown only when Allow retry is on; both toggles `disabled` with a hint when `hasEssay(form.questions)`; soft warning from `needsShortAnswerWarning`). The Type select's `onChange` also sets `requireReview: defaultRequireReview(type)` unless `reviewTouched`; toggling Require review sets `reviewTouched: true`. `handleSave` spreads `reviewPayload(form)` into `body` and sends `durationMinutes` when set. `openEdit` loads the four settings and `metadata.durationMinutes` (add the four optional fields and `durationMinutes` to the `Assessment` interface / `metadata` type) with `reviewTouched: true`.
- [ ] **Step 4: Run** `npx vitest run src/app/dashboard/assessments` and `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(assessments): review/retry/recording controls in the assessment form`.

### Task 6: Copy assessment

**Files:**
- Modify: `frontend/src/app/dashboard/assessments/assessment-form.ts`
- Modify: `frontend/src/app/dashboard/assessments/page.tsx` (`openEdit` refactor, new `openCopy`, actions column ~line 730–750)
- Test: `frontend/src/app/dashboard/assessments/assessment-form.test.ts`, `__tests__/assessment-reference.test.tsx`

**Interfaces:**
- Consumes: Task 5 `AssessmentForm`.
- Produces: in `assessment-form.ts`, `assessmentToForm(detail: AssessmentDetail): AssessmentForm` (the mapping currently inline in `openEdit`, plus the new settings and `durationMinutes`) and `toCopyForm(form: AssessmentForm, lang: 'en' | 'ar'): AssessmentForm`. `AssessmentDetail` is a structural type covering the fields `openEdit` reads today plus the new ones; the page's `Assessment` interface must satisfy it.

- [ ] **Step 1: Write failing tests**: `toCopyForm` — title `Copy of Midterm` (en) and `نسخة من Midterm` (ar), `dueDate: ''`, `status: 'draft'`, every question has `id` `undefined`, and all other fields (level, subject, points, passing, the four settings, reference recording, `durationMinutes`) are carried. Page test: `Copy opens the create form prefilled and posts without ids` — click the Copy button on a row (aria-label `Copy <title>`), assert the title input shows `Copy of <title>`, submit, assert `http.post('/assessments', body, …)` where `body.questions[0].id` is `undefined`, `body.dueDate` is `undefined`, `body.status === 'draft'`, and `http.put` is not called.
- [ ] **Step 2: Run** `npx vitest run src/app/dashboard/assessments` — FAIL.
- [ ] **Step 3: Implement.** Move the form mapping from `openEdit` into `assessmentToForm` and call it from `openEdit`. Add `openCopy(a: Assessment)`: always fetch `GET /assessments/:id` for the questions, `setForm(toCopyForm(assessmentToForm(detail), lang))`, `setFormDirty(true)`, `setSelectedAssessment(null)`, `setFormError('')`, `setShowForm(true)`, with the same error toast as `openEdit` on failure. Add a `Copy` icon button (lucide `Copy`) to the actions column between Students and Edit, styled like its siblings, `aria-label` `Copy ${a.title}` / `نسخ ${a.title}`.
- [ ] **Step 4: Run** `npx vitest run src/app/dashboard/assessments` and `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(assessments): copy an assessment into a prefilled create form`.

### Task 7: Take page, result page, portal cards

**Files:**
- Modify: `frontend/src/app/dashboard/assessments/take-helpers.ts`, `take-helpers.test.ts`
- Modify: `frontend/src/components/assessments/take-assessment.tsx`
- Create: `frontend/src/components/assessments/__tests__/take-assessment.test.tsx`
- Modify: `frontend/src/app/student-portal/[code]/assessment/[assessmentId]/submission/[submissionId]/page.tsx`
- Modify: `frontend/src/app/student-portal/[code]/page.tsx` (assessment type + the pending and done cards, ~lines 1129–1290)

**Interfaces:**
- Consumes: Tasks 3–4 response shapes (`result`, `attempt`, take header fields, portal `attempt`).
- Produces in `take-helpers.ts`: `attemptLabel(n: number, max: number, lang: 'en' | 'ar'): string | null` (`Attempt 2 of 3` / `المحاولة 2 من 3`; `null` when `max <= 1`); `recordingBlocksSubmit(mode: 'portal' | 'dashboard', requireRecording: boolean, hasRecording: boolean): boolean` (true only for portal mode with a required, missing recording).

- [ ] **Step 1: Write failing tests**: helpers — `attemptLabel(2, 3, 'en')` equals `Attempt 2 of 3`, `(2, 3, 'ar')` equals `المحاولة 2 من 3`, `(1, 1, 'en')` is `null`; `recordingBlocksSubmit('portal', true, false)` true, `('dashboard', true, false)` false, `('portal', true, true)` false. Component test (mock `next/navigation`, `@/lib/http-client`, `@/lib/use-language`): `disables Submit and labels the recording required when requireRecording is on in portal mode`; `shows Attempt 2 of 3 in the header`; `keeps the page open and explains when the timer hits 0:00 without a required recording` (fake timers, `durationMinutes: 1`; assert `http.post` for submit was never called and a message is shown; Review Focus 4); `hides per-question marks and shows Try again when the result has revealDetail false and canRetry true`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/components/assessments src/app/dashboard/assessments/take-helpers.test.ts` — FAIL.
- [ ] **Step 3: Implement.** `take-assessment.tsx`: extend `TakePayload` and the submit response types; header shows `attemptLabel`; when `recordingBlocksSubmit(...)`, relabel the recording block "Voice recording (required)" (AR: `تسجيل صوتي (مطلوب)`), disable Submit, and make an upload failure abort with an error instead of the "Submit without it?" confirm; the timer expiry path checks a ref mirroring `recordedBlob` and, when blocked, sets a visible notice and does not call `submit()`. Result view: when `!result.revealDetail` omit the per-question "Your answers" list; when `result.gradingComplete` show earned/max, pass or fail and the attempt label, plus (portal mode, `result.canRetry`) a "Try again" button that POSTs `/student-portal/:code/assessments/:id/retake` then routes to the take page; when not complete and `result` says retry is on, show "awaiting marking" instead of a partial score. Result page (`submission/[submissionId]/page.tsx`): add `attempt` to `SubmissionData`; show the Retake button only when `attempt.canRetry`, labelled "Try again — attempt N of M"; show "No attempts left" when failed, `attempt.max > 1` and `attempt.remaining === 0`; when `grade.gradingComplete && !attempt.answerKeyOpen`, replace the Question Review list with a note that details unlock after passing or using the last attempt. Portal page: add `attempt` to the assessment type and render an `attemptLabel` chip on pending and completed cards when `max > 1`.
- [ ] **Step 4: Run** the vitest paths above and `npx tsc --noEmit` — PASS.
- [ ] **Step 5: Commit** `feat(assessments): attempt count, required recording and retry UI for students`.

### Task 8: Whole-branch verification

**Files:** none (verification only).

- [ ] **Step 1:** `cd backend && npx tsc --noEmit && npx jest` — expect the full backend suite to pass (it passed 711 tests on `main` on 2026-10-30; report any new failure).
- [ ] **Step 2:** `cd frontend && npx tsc --noEmit && npx vitest run` — expect PASS.
- [ ] **Step 3:** Apply the migration to a local database (`cd backend && npx prisma migrate deploy`) and confirm the three columns exist with the specified defaults; skip and say so if no local database is available.
- [ ] **Step 4:** Run the app (`run` skill) and walk one quiz end to end: create a quiz with retry on and max attempts 3, copy it, assign a student, fail it once and see "Try again — attempt 2 of 3", pass it and see XP awarded once. Report what was and was not checked in a browser.

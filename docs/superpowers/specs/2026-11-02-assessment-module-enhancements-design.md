# Assessment Module Enhancements — Design

**Date:** 2026-11-02
**Branch:** `claude/assessment-module-enhancements-2b3d33`
**Status:** Draft, awaiting approval

## Intent

Servants want to (1) copy an existing assessment instead of rebuilding it, (2) let quizzes
finish without a servant marking them, (3) let a student who fails try again a limited number
of times and see how many tries they have used, and (4) make voice recording required only on
the assessments that need it.

Today every submission stops at `submitted` and the student sees no score until a servant
marks it, even when every question is auto-graded. Retakes exist (`prepareRetake`, the
`maxAttempts` column, the "Retake" button) but nothing sets `maxAttempts`, the button shows
even to students who passed, and the student never sees an attempt count. The student's voice
recording is always shown as optional.

## Goals

1. **Copy** an assessment, with its questions and settings, into a new draft the servant can edit before saving.
2. **Require review** flag. Off means a fully auto-gradable submission is graded and completed on submit, and the student sees the score, pass/fail and XP at once.
3. **Retry on fail** toggle with a configurable total number of attempts. A failed student can try again until they pass or run out of attempts, and sees "Attempt N of M".
4. **Require recording** flag. On means a submission without a voice recording is rejected.

## Non-goals

- No change to how questions are auto-graded (exact, case-insensitive match).
- No change to essay handling: essay questions always need servant marking and are never retakeable.
- No new server-side timer enforcement, draft saving or resume.
- No mobile app changes (`mobile/`); the API additions are additive.
- No bulk copy, and no cross-school copy.

## Anti-goals

- A student must never be able to read the answer key off a failed attempt and then retry.
- Existing published assessments must keep today's marking behaviour after the migration.

## Approaches considered

**Where the settings live.**
- A. Real columns on `assessments` (`require_review`, `require_recording`, `allow_retry`), next to the existing `max_attempts`. Typed and queryable; precedent is the `subject_items` flags migration (2026-09-12). One small additive migration; production runs `prisma migrate deploy` on start (`render.yaml`, `Dockerfile`).
- B. The `metadata` JSON, as `durationMinutes` does. No migration, but untyped, not filterable, and splits settings between a column (`maxAttempts`) and JSON.
- **Chosen: A**, by the user.

**How copy works.**
- A. "Copy" opens the existing create form prefilled; the servant edits and saves. No new endpoint; reuses create validation.
- B. A one-click server endpoint that creates a draft immediately. Faster, but leaves stray "Copy of …" drafts and needs its own tests.
- **Chosen: A**, by the user.

## Design

### Data model (one migration)

Add to `Assessment` (additive, `prisma/migrations/<ts>_assessment_review_retry_recording_flags`):

| Column | Type | Default |
|---|---|---|
| `require_review` | boolean not null | `true` |
| `require_recording` | boolean not null | `false` |
| `allow_retry` | boolean not null | `false` |

The existing `max_attempts` (nullable int) is reused as the **total** number of attempts
(first try included). Defaults preserve today's marking behaviour for existing rows. They also
turn retakes off for existing assessments, since retry is now opt-in per assessment. This
is deliberate.

### Backend (`backend/src/modules/assessments/`)

**DTOs.** `CreateAssessmentDto` / `UpdateAssessmentDto` gain optional `requireReview`,
`requireRecording`, `allowRetry` (booleans) and `maxAttempts` (int, 2–10).

**Create/update rules.**
- On create, if `requireReview` is omitted it defaults from the type: `quiz` → `false`, every other type → `true`. (The form also does this, but the backend is authoritative.)
- If `allowRetry` is true and `maxAttempts` is omitted, store 3. If `allowRetry` is false, `maxAttempts` is ignored (effective attempts = 1).
- Reject with a clear 400 when the assessment has any `essay` question and `requireReview` is false, or `allowRetry` is true. Essays cannot be auto-graded or retaken.

**Effective attempt limit.** `effectiveMax = allowRetry ? (maxAttempts ?? 3) : 1`.

**Score and pass.** One shared helper computes a submission's score: the overall grade row
(`questionId = null`) if one exists, otherwise the sum of per-question grades. This is the rule
`getSubmissionReview` and the portal data already use. Passed means `score >= passingScore`.

**`submit()`.**
- If `requireRecording` and no `fileUrl` is supplied, throw 400. This applies to the student-portal submit only. The staff proxy submit (`POST /assessments/:id/submit?studentId=`, used to enter answers for a student, e.g. a paper quiz) is never blocked by it. Pass the actor/source into `submit()` to tell them apart. Auto-complete, XP and notification apply to both paths.
- After writing the per-question auto-grades, if `requireReview` is false and the assessment has no essay question, finalise in the same transaction: set status `completed` and credit XP using the same formula as `markStudent` (`round(score/total × 100)`, one `XPTransaction` per submission, updated rather than duplicated on re-grade). Send the `assessment_graded` notification.
- **XP rule when `allowRetry` is on: XP is awarded only on a pass.** A failed attempt earns nothing; the attempt that passes earns its percentage. Because a pass ends retries, there is at most one award per student per assessment. This applies to both paths (auto-complete in `submit()` and servant marking in `markStudent`), so a servant marking a failed attempt does not credit XP either. If a servant later re-marks a passing attempt below the pass mark, the XP for that submission is removed; re-marking it up to a pass credits it.
- When `allowRetry` is off, XP behaves as it does today (credited for any mark, passing or not).
- The XP/notification code now lives inline in `markStudent`; extract it into a private method used by both paths. It takes a "pass required" condition derived from `allowRetry`.
- Return the submission plus a `result` block: `{ gradingComplete, earned, max, passed, attemptNumber, maxAttempts (effective), attemptsRemaining, canRetry }`. `passed` is null while grading is incomplete.

**`prepareRetake()`.** Allowed only when all hold: published; `allowRetry`; no essay question; live submission is `completed` (so, for review-required assessments, after the servant marks it); the score is below `passingScore`; attempts used < `effectiveMax`; and, unless `allowLateSubmission`, the due date has not passed. Otherwise a 400 with a specific message. The existing archive-and-create-next-attempt transaction is unchanged. The `attemptsRemaining` arithmetic stays as is.

**`getSubmissionReview()`.**
- Add `attempt: { number, max, remaining, canRetry }` to the response so the result page can show the count and gate the button.
- **Answer-key protection:** per-question detail (`correctAnswer`, per-question `isCorrect` and `score`) is withheld while a further attempt is still possible. Only the overall score, pass/fail and attempt count are shown. (Per-question correct/incorrect alone would leak the answer on true/false questions.) This extends the guard already in this method.
  - The gate is decided **per student across all their attempts**, not per submission viewed. Detail is withheld unless one of these holds: the student has passed on any attempt; they have used all `effectiveMax` attempts; or no retry is possible any more (retry is off, or the due date has passed and late submission is not allowed).
  - This applies equally to `superseded` attempts, so opening an old failed attempt while a new one is open stays gated. Otherwise the review endpoint, which accepts any submission id, would leak the key.
  - `canRetry` (the button) is stricter than the gate: it also requires the live attempt to be `completed` and below the pass mark.

**Portal data** (`students.service.ts`, the assessments block near `submissionStatus` / `earnedScore`): add `attemptNumber`, `maxAttempts` (effective), `canRetry` per assessment so cards can show "Attempt 2 of 3". `earnedScore` already works once a submission is `completed`.

**Take payload** (`getTakeQuestions`): add `requireRecording`, `attemptNumber` and `maxAttempts` (effective) so the take page can show "Attempt N of M" and enforce the recording.

### Frontend

**Assessment form** (`dashboard/assessments/page.tsx`): add a "Review & attempts" group with four controls, bilingual AR/EN:
- **Require review** toggle. Defaults from the type on create (quiz off, others on); changing the type re-defaults it only until the servant touches it. Disabled and forced on when an essay question exists, with a hint.
- **Allow retry if failed** toggle. Disabled with a hint when an essay question exists.
- **Max attempts** number input (2–10, default 3), shown only when retry is on. Label makes clear it counts the first try.
- **Require recording** toggle.
The soft-warning style from Unit A is used for hints. Send all four in the POST/PUT body.

**Copy.** A Copy icon button in the list row actions (beside Edit/Delete), with an aria-label like the others. It fetches the full assessment (as `openEdit` does when questions are missing), then opens the **create** form prefilled:
- title "Copy of <title>" (AR: "نسخة من <title>");
- all fields, including the four new settings and the reference recording;
- questions copied **without ids**, so they are created fresh;
- due date cleared, status `draft`;
- the form is marked dirty so closing it warns.
No students, submissions or grades are copied. Extract one shared `assessmentToForm(detail)` mapper used by both edit and copy, so they cannot drift. Confirm it carries `durationMinutes`; the current edit mapping does not visibly do so.

**Take page** (`components/assessments/take-assessment.tsx`): show "Attempt N of M" in the sticky header when M > 1. If `requireRecording`, label the recording section "Voice recording (required)", disable Submit until a recording is attached, and remove the "Submit without it?" fallback when the upload fails. Otherwise the section stays "optional" as today. After submit, if `result.gradingComplete`, show the score and pass/fail immediately (extend the result view); otherwise keep "awaiting grading".

**Result page** (`student-portal/.../submission/[submissionId]/page.tsx`): the Retake button shows only when `attempt.canRetry`; its label reads "Try again — attempt N of M". When the student failed with no attempts left, show "No attempts left". While `canRetry`, show score, pass/fail and attempt count only (per the answer-key rule).

**Portal cards** (`student-portal/[code]/page.tsx`): show an "Attempt N of M" chip on cards of assessments with M > 1.

### Error handling

Backend errors are 400 `BadRequestException` with human-readable messages (existing style); the frontend surfaces them through the existing toast/`formError` paths. Retake errors reuse the existing toast on the result page.

### Testing

- Backend (`assessments.service.spec.ts`): create defaults `requireReview` from type; essay + `requireReview=false` or `allowRetry=true` rejected; `submit()` rejects a missing recording when required; `submit()` auto-completes with notification when review is off and all questions are gradable, and stays `submitted` when review is on; with retry on, a failing attempt credits no XP and the passing attempt credits exactly one award, with retry off a failing mark still credits XP as today (same checks for `markStudent`); `prepareRetake()` rejects when retry is off, when passed, when attempts are exhausted, when the live attempt is `submitted`, and when past due; `getSubmissionReview()` withholds per-question detail while `canRetry`, and reveals it after pass or exhaustion.
- Frontend (vitest): copy mapper output (title, no question ids, no due date, draft, flags carried); the form defaults and disabled states; Retake button visibility from `attempt.canRetry`.
- `npx tsc --noEmit` in both packages, plus the existing suites.

## Decisions the user made

- Three flags as columns; copy by prefilling the create form.
- Retry is a per-assessment toggle (any type), and the number of attempts is configured in the form. The user's first sketch was "3 attempts max"; that is the default.
- A student retries only if they failed.
- XP on retry-enabled assessments is awarded only on a pass, at that attempt's percentage.

## My calls (please check these)

- `maxAttempts` counts total attempts including the first; allowed range 2–10; default 3.
- Retry off means one attempt. Existing assessments get retry off, so retakes stop being available on them until a servant opts in.
- Existing assessments keep `requireReview = true`.
- Per-question detail and the answer key are hidden while a retry is possible (anti-goal above).
- Recording stays visible-but-optional when not required (not hidden).
- Essay questions force review on and retry off.
- Copy clears the due date and sets status `draft`.
- Retake after the due date is blocked unless late submission is allowed.
- Editing after publish is **not locked**; every new rule is derived at read time, so nothing is backfilled or re-graded:
  - Turning `requireReview` off does not complete submissions already at `submitted`; a servant still marks those.
  - Lowering `maxAttempts` below attempts already used just means that student cannot retry.
  - Turning `allowRetry` off mid-way makes `canRetry` false for everyone.
  - The essay rule is checked on every update. Adding an essay question to a no-review or retry-enabled assessment is rejected; the author must first turn those settings off. Submissions already completed are left alone.
  - Staff `reassessStudent` stays a servant override: it reopens the same attempt number and does not consume an attempt. Unchanged.
- The staff proxy submit skips the recording requirement (see `submit()` above).
- The pass-only XP rule is scoped to assessments with retry on. The user's answer was about retries, and applying it everywhere would silently stop XP for failing marks on existing assessments. If you want it everywhere, it is a one-line change to the condition.
- Auto-grading uses the existing exact-match rule, so a `short_answer` typo can fail a student on a no-review quiz. The form shows a soft warning when review is off and a short-answer question exists.

## Left to the builder

- Exact component structure and the transaction boundaries in `submit()`.
- Wording of AR/EN labels and hints.
- What the timer does at 0:00 when a required recording is missing. The server must never accept a missing required recording; the client should keep the page open and say why rather than loop on a rejected auto-submit.
- Whether the portal card chip and result-page label share one helper.

# Unit C — Assessment Student Take Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student actually take a published, assigned assessment — answer all questions on one page, submit, and see an instant result (auto-graded correct/incorrect; essays "awaiting grading") — from both the student-portal (self-service) and the dashboard (servant on a student's behalf), with an opt-in countdown timer.

**Architecture:** Add backend question-fetch + hardened submit, split across two surfaces: the public `student-portal` controller (resolves the student from the `portalAccessKey`) and the staff-gated `assessments` controller (servant chooses a `studentId`). Build one reusable React `TakeAssessment` component surfaced in both places. Store the opt-in `durationMinutes` in the assessment's existing `metadata` JSON (no migration).

**Tech Stack:** NestJS + Prisma (backend), Next.js App Router + React + Tailwind (frontend), Jest (backend), Vitest (frontend), `http()` client at `@/lib/http-client`.

## Global Constraints

- Backend tests run from `backend/` with `npx jest src/modules/assessments/assessments.service.spec.ts` (mocked Prisma; no live DB). There are **17 pre-existing unrelated Jest failures** — do NOT touch/fix them; only run the assessments spec.
- Frontend: `npx tsc --noEmit` must be clean and `npx vitest run` must stay green.
- The portal surface is `@Public()` (auth by `portalAccessKey`); the dashboard surface is `@Roles(...STAFF_ROLES)` + global `JwtAuthGuard`. Never send `correctAnswer` to clients.
- `Assessment.metadata` is a JSON column already holding `academicYearId`/`term`/`grade` — store `durationMinutes` there. No Prisma migration.
- Bilingual AR/EN labels for all user-facing frontend strings, matching existing portal/dashboard style (a `lang` value of `'en'`/`'ar'`).
- Work directly on `main` (no worktree) and push to `origin/main` after each task's review passes. `git pull --rebase --autostash` before pushing.

---

### Task 1: Backend — `durationMinutes` field (DTO + persistence)

**Files:**
- Modify: `backend/src/modules/assessments/dto/assessment.dto.ts` (CreateAssessmentDto after `term` ~line 90; UpdateAssessmentDto after `term` ~line 168)
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`create()` metadata ~line 96; `update()` metadata block ~line 149)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Consumes: existing `CreateAssessmentDto`, `UpdateAssessmentDto`, `metadata` handling.
- Produces: `CreateAssessmentDto.durationMinutes?: number`, `UpdateAssessmentDto.durationMinutes?: number`; `create()`/`update()` persist `metadata.durationMinutes`.

- [ ] **Step 1: Add failing DTO-validation test**

Add to the `describe('DTO validation', ...)` block (after the existing `type` tests, around line 303) in `assessments.service.spec.ts`:

```ts
it('accepts durationMinutes', async () => {
  const dto = new CreateAssessmentDto();
  (dto as any).title = 'Quiz';
  (dto as any).levelId = 'level-1';
  (dto as any).subjectId = 'subject-1';
  (dto as any).totalPoints = 10;
  (dto as any).passingPoints = 5;
  (dto as any).durationMinutes = 30;
  const errors = await validate(dto as any);
  expect(errors).toEqual([]);
});

it('rejects a negative durationMinutes', async () => {
  const dto = new CreateAssessmentDto();
  (dto as any).title = 'Quiz';
  (dto as any).levelId = 'level-1';
  (dto as any).subjectId = 'subject-1';
  (dto as any).totalPoints = 10;
  (dto as any).passingPoints = 5;
  (dto as any).durationMinutes = -5;
  const errors = await validate(dto as any);
  expect(errors.length).toBeGreaterThan(0);
});
```

Note: `validate` and `CreateAssessmentDto` are already imported in the spec. `class-validator` is a dependency.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts -t "durationMinutes"`
Expected: FAIL — `durationMinutes` is not a property of `CreateAssessmentDto`, so the accepted case errors (unknown-property / property-not-declared).

- [ ] **Step 3: Add the DTO field**

In `backend/src/modules/assessments/dto/assessment.dto.ts`, add to **both** `CreateAssessmentDto` and `UpdateAssessmentDto` (right after the `term` property):

```ts
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
```

(`IsInt` and `Min` are already imported.)

- [ ] **Step 4: Add failing service tests for persistence**

Add inside `describe('create', ...)` (after the `defaults type` test ~line 122):

```ts
it('persists durationMinutes into metadata on create', async () => {
  prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
  prisma.assessment.create.mockResolvedValue({ id: 'a1' });
  await service.create({ ...baseDto, durationMinutes: 45 }, 'school-1');
  const data = prisma.assessment.create.mock.calls[0][0].data;
  expect(data.metadata.durationMinutes).toBe(45);
});
```

Add inside `describe('update', ...)` (after the `persists the provided type` test ~line 166):

```ts
it('persists durationMinutes into metadata on update', async () => {
  prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, totalPoints: 100 });
  prisma.assessment.update.mockResolvedValue({ id: 'a1' });
  await service.update('a1', { durationMinutes: 30 });
  const data = prisma.assessment.update.mock.calls[0][0].data;
  expect(data.metadata.durationMinutes).toBe(30);
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts -t "durationMinutes"`
Expected: FAIL — `data.metadata.durationMinutes` is undefined in both.

- [ ] **Step 6: Implement persistence**

In `backend/src/modules/assessments/assessments.service.ts`, in `create()` change the `metadata` object (currently lines 96-100) to:

```ts
      metadata: {
        academicYearId: dto.academicYearId,
        term: dto.term,
        grade: dto.grade || null,
        durationMinutes: dto.durationMinutes ?? null,
      },
```

In `update()`, inside the existing `if (dto.academicYearId !== undefined || dto.term !== undefined || dto.grade !== undefined)` block (currently line 149), add after the `grade` line:

```ts
      if (dto.durationMinutes !== undefined) metadata.durationMinutes = dto.durationMinutes;
```

Also widen that guard so a duration-only update still writes metadata — change the condition to:

```ts
    if (dto.academicYearId !== undefined || dto.term !== undefined || dto.grade !== undefined || dto.durationMinutes !== undefined) {
```

- [ ] **Step 7: Run full spec to verify all pass**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts`
Expected: all tests pass (including the new durationMinutes ones).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/assessments/dto/assessment.dto.ts backend/src/modules/assessments/assessments.service.ts backend/src/modules/assessments/assessments.service.spec.ts
git commit -m "feat(assessments): add optional durationMinutes stored in metadata"
```

---

### Task 2: Backend — `getTakeQuestions` service method

**Files:**
- Modify: `backend/src/modules/assessments/assessments.service.ts`
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`assessment.findUnique`, `assessmentSubmission.findFirst`).
- Produces: `getTakeQuestions(assessmentId: string, studentId: string)` returning `{ assessment: { id, title, titleAr?, type, subject, totalPoints, passingScore, dueDate?, durationMinutes }, questions: Array<{ id, text, type, options, points, orderIndex }> }` with `correctAnswer` omitted.

- [ ] **Step 1: Add failing tests**

Add a new `describe('getTakeQuestions', ...)` block after the `markStudent validation` block (~line 281). The mock's `assessment.findUnique` and `assessmentSubmission.findFirst` are reused.

```ts
describe('getTakeQuestions', () => {
  const pubAssess = (over: any = {}) => ({
    id: 'a1', title: 'Quiz', titleAr: null, type: 'quiz', status: 'published',
    totalPoints: 10, passingScore: 5, dueDate: null,
    metadata: { durationMinutes: 30 },
    subject: { id: 'sub1', name: 'Hymns', nameAr: null },
    questions: [
      { id: 'q1', questionText: 'What?', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 5, orderIndex: 0 },
      { id: 'q2', questionText: 'Explain', type: 'essay', options: null, correctAnswer: null, points: 5, orderIndex: 1 },
    ],
    ...over,
  });

  it('returns questions without correctAnswer and the assessment header', async () => {
    prisma.assessment.findUnique.mockResolvedValue(pubAssess());
    prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned' });

    const res = await service.getTakeQuestions('a1', 'stu-1');

    expect(res.assessment.durationMinutes).toBe(30);
    expect(res.questions).toHaveLength(2);
    expect(res.questions[0]).toEqual({
      id: 'q1', text: 'What?', type: 'multiple_choice', options: ['A', 'B'], points: 5, orderIndex: 0,
    });
    expect(JSON.stringify(res.questions)).not.toContain('correctAnswer');
  });

  it('throws BadRequestException when not published', async () => {
    prisma.assessment.findUnique.mockResolvedValue(pubAssess({ status: 'draft' }));
    await expect(service.getTakeQuestions('a1', 'stu-1')).rejects.toThrow('not open');
  });

  it('throws BadRequestException when the student is not assigned', async () => {
    prisma.assessment.findUnique.mockResolvedValue(pubAssess());
    prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
    await expect(service.getTakeQuestions('a1', 'stu-1')).rejects.toThrow('not assigned');
  });

  it('throws BadRequestException when already completed', async () => {
    prisma.assessment.findUnique.mockResolvedValue(pubAssess());
    prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'completed' });
    await expect(service.getTakeQuestions('a1', 'stu-1')).rejects.toThrow('already submitted');
  });
});
```

`BadRequestException` is already imported in the spec. The test asserts on message substrings ('not open', 'not assigned', 'already submitted'), so the implementation's messages must contain those words.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts -t "getTakeQuestions"`
Expected: FAIL — `service.getTakeQuestions is not a function`.

- [ ] **Step 3: Implement `getTakeQuestions`**

In `backend/src/modules/assessments/assessments.service.ts`, add this method after `getSubmissions` (after line ~297):

```ts
  async getTakeQuestions(assessmentId: string, studentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
        subject: { select: { id: true, name: true, nameAr: true } },
      },
    });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.status !== 'published') {
      throw new BadRequestException('Assessment is not open for submission');
    }

    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { assessmentId, studentId },
    });
    if (!submission) {
      throw new BadRequestException('This student is not assigned to this assessment');
    }
    if (['submitted', 'completed'].includes(submission.status)) {
      throw new BadRequestException('This student has already submitted this assessment');
    }

    const metadata = (assessment.metadata as any) || {};
    return {
      assessment: {
        id: assessment.id,
        title: assessment.title,
        titleAr: assessment.titleAr,
        type: assessment.type,
        subject: assessment.subject,
        totalPoints: Number(assessment.totalPoints),
        passingScore: Number(assessment.passingScore),
        dueDate: assessment.dueDate,
        durationMinutes: metadata.durationMinutes ?? null,
      },
      questions: assessment.questions.map((q: any) => ({
        id: q.id,
        text: q.questionText,
        type: q.type,
        options: q.options || null,
        points: Number(q.points),
        orderIndex: q.orderIndex,
      })),
    };
  }
```

`NotFoundException` and `BadRequestException` are already imported (used elsewhere in the service).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts -t "getTakeQuestions"`
Expected: PASS (4 tests).

- [ ] **Step 5: Run full spec**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/assessments/assessments.service.ts backend/src/modules/assessments/assessments.service.spec.ts
git commit -m "feat(assessments): add getTakeQuestions (no answer exposure)"
```

---

### Task 3: Backend — harden `submit()` (require assignment; don't auto-grade essays)

**Files:**
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`submit()` ~line 219)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Consumes: existing `submit(assessmentId, studentId, dto: SubmitAssessmentDto)`.
- Produces: `submit()` rejects unassigned students, still blocks double-submit, and skips essay questions when creating auto-grade rows.

- [ ] **Step 1: Add failing tests**

Add a new `describe('submit assignment', ...)` block after the existing `submit validation` block (~line 267):

```ts
describe('submit assignment', () => {
  it('rejects when the student is not assigned', async () => {
    prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', status: 'published', deletedAt: null, questions: [] });
    prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
    await expect(service.submit('a1', 'stu-1', { answers: [] })).rejects.toThrow('not assigned');
  });

  it('does not create a grade row for essay questions', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1', status: 'published', deletedAt: null,
      questions: [
        { id: 'q1', type: 'essay', correctAnswer: null, points: 10 },
      ],
    });
    prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'assigned' });
    prisma.assessmentSubmission.create.mockResolvedValue({ id: 'sub1' });
    prisma.grade.createMany = jest.fn().mockResolvedValue({ count: 0 });

    await service.submit('a1', 'stu-1', { answers: [{ questionId: 'q1', answer: 'My essay' }] });

    expect(prisma.grade.createMany).not.toHaveBeenCalled();
  });
});
```

The existing `submit validation` "rejects a duplicate submission" test (line 256) mocks `findFirst` returning `{ id: 's1', status: 'submitted' }` and expects `.rejects.toThrow('already submitted')`. Your implementation must keep that passing.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts -t "submit"`
Expected: FAIL — unassigned students are not rejected (no assignment check); essay grade rows are still created.

- [ ] **Step 3: Implement the hardened `submit()`**

In `backend/src/modules/assessments/assessments.service.ts`, replace the existing assignment/double-submit block (currently lines 231-236):

```ts
    const assignment = await this.prisma.assessmentSubmission.findFirst({
      where: { assessmentId, studentId },
    });
    if (!assignment) {
      throw new BadRequestException('This student is not assigned to this assessment');
    }
    if (['submitted', 'completed'].includes(assignment.status)) {
      throw new BadRequestException('This student has already submitted this assessment');
    }
```

Then, inside the `gradeData` mapping (currently line 249), skip essay questions so they remain "awaiting grading" — change the map body to add, right after the `if (!question) return null;` line:

```ts
          if (question.type === 'essay') return null; // not auto-graded; graded manually
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts -t "submit"`
Expected: PASS — the two new tests plus the existing duplicate-submission test.

- [ ] **Step 5: Run full spec**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/assessments/assessments.service.ts backend/src/modules/assessments/assessments.service.spec.ts
git commit -m "feat(assessments): require assignment on submit and defer essay grading"
```

---

### Task 4: Backend — controller/route wiring (dashboard + portal)

**Files:**
- Modify: `backend/src/modules/assessments/assessments.controller.ts`
- Modify: `backend/src/modules/students/student-portal.controller.ts`
- Modify: `backend/src/modules/students/students.module.ts`
- Test: `backend/src/modules/assessments/assessments.service.spec.ts` (only to ensure the existing spec still runs)

**Interfaces:**
- Consumes: `assessmentsService.getTakeQuestions(assessmentId, studentId)` (Task 2), `assessmentsService.submit(...)` (existing), `AssessmentsModule` (exports `AssessmentsService`).
- Produces: `GET /api/assessments/:id/questions?studentId=`, `GET /api/student-portal/:code/assessments/:id`, `POST /api/student-portal/:code/assessments/:id/submit`.

- [ ] **Step 1: Add the dashboard route to the staff-gated controller**

In `backend/src/modules/assessments/assessments.controller.ts`, add this method (before the closing `}` of the class, after `getStudentsForAssessment` ~line 162). `Get`, `Param`, `Query`, `ParseUUIDPipe` are already imported:

```ts
  @Get(':id/questions')
  @ApiOperation({ summary: 'Get assessment questions for a student to take (answers not exposed)' })
  async getTakeQuestions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.assessmentsService.getTakeQuestions(id, studentId);
  }
```

- [ ] **Step 2: Add the portal routes to the public controller**

In `backend/src/modules/students/student-portal.controller.ts`:

Add imports at the top (next to the existing imports):

```ts
import { AssessmentsService } from '../assessments/assessments.service';
import { SubmitAssessmentDto } from '../assessments/dto/assessment.dto';
```

Add `private readonly assessmentsService: AssessmentsService` to the constructor (line 18-22) so it reads:

```ts
  constructor(
    private readonly studentsService: StudentsService,
    private readonly hymnLearning: HymnLearningService,
    private readonly assessmentsService: AssessmentsService,
  ) {}
```

Add these two routes inside the class (e.g. after the `getPortal` method ~line 34). `Get`, `Post`, `Param`, `Body`, `HttpCode`, `ApiOperation` are already imported:

```ts
  @Get(':code/assessments/:id')
  @ApiOperation({ summary: 'Get an assigned assessment questions for the student to take (answers not exposed)' })
  async takeAssessment(@Param('code') code: string, @Param('id') id: string) {
    const student = await this.resolveStudent(code);
    return this.assessmentsService.getTakeQuestions(id, student.id);
  }

  @Post(':code/assessments/:id/submit')
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit answers for an assessment as this student' })
  async submitAssessment(
    @Param('code') code: string,
    @Param('id') id: string,
    @Body() body: SubmitAssessmentDto,
  ) {
    const student = await this.resolveStudent(code);
    return this.assessmentsService.submit(id, student.id, body);
  }
```

- [ ] **Step 3: Wire the module**

In `backend/src/modules/students/students.module.ts`, add the import and add `AssessmentsModule` to `imports`:

```ts
import { AssessmentsModule } from '../assessments/assessments.module';
```

```ts
  imports: [AuditModule, AnalyticsModule, CurriculumModule, AssessmentsModule],
```

- [ ] **Step 4: Build to verify no type errors**

Run: `npm run build` (from `backend/`)
Expected: build succeeds (no type errors). If Nest complains about the `@Get(':code/assessments/:id')` vs the existing `@Get(':code/hymn-map')` etc., note that all are distinct static/param paths; Nest resolves longest-match first, so no conflict.

- [ ] **Step 5: Run the assessments spec to confirm nothing regressed**

Run: `npx jest src/modules/assessments/assessments.service.spec.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/assessments/assessments.controller.ts backend/src/modules/students/student-portal.controller.ts backend/src/modules/students/students.module.ts
git commit -m "feat(assessments): expose take endpoints for dashboard and student portal"
```

---

### Task 5: Frontend — pure helpers (result computation + countdown) with tests

**Files:**
- Create: `frontend/src/app/dashboard/assessments/take-helpers.ts`
- Test: `frontend/src/app/dashboard/assessments/take-helpers.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces:
  - `type TakeQuestion = { id: string; text: string; type: string; options: string[] | null; points: number; orderIndex: number }`
  - `type TakeGrade = { questionId: string; score: number; maxScore: number }`
  - `computeResult(grades: TakeGrade[], questions: TakeQuestion[]): { earned: number; items: Array<{ questionId: string; status: 'correct' | 'incorrect' | 'pending'; score: number; maxScore: number }> }`
  - `formatCountdown(totalSeconds: number): string`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/dashboard/assessments/take-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeResult, formatCountdown } from './take-helpers'

describe('computeResult', () => {
  const qs = [
    { id: 'q1', text: 'A?', type: 'multiple_choice', options: ['x', 'y'], points: 5, orderIndex: 0 },
    { id: 'q2', text: 'Essay', type: 'essay', options: null, points: 10, orderIndex: 1 },
  ]

  it('marks auto-graded correct, essays pending, and sums earned', () => {
    const grades = [
      { questionId: 'q1', score: 5, maxScore: 5 },
    ]
    const res = computeResult(grades, qs)
    expect(res.earned).toBe(5)
    expect(res.items[0].status).toBe('correct')
    expect(res.items[1].status).toBe('pending')
  })

  it('marks a zero-score graded question as incorrect', () => {
    const grades = [{ questionId: 'q1', score: 0, maxScore: 5 }]
    const res = computeResult(grades, qs)
    expect(res.items[0].status).toBe('incorrect')
  })
})

describe('formatCountdown', () => {
  it('formats as m:ss', () => {
    expect(formatCountdown(90)).toBe('1:30')
    expect(formatCountdown(5)).toBe('0:05')
    expect(formatCountdown(0)).toBe('0:00')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/dashboard/assessments/take-helpers.test.ts`
Expected: FAIL — module/file not found.

- [ ] **Step 3: Implement the helpers**

Create `frontend/src/app/dashboard/assessments/take-helpers.ts`:

```ts
export type TakeQuestion = {
  id: string
  text: string
  type: string
  options: string[] | null
  points: number
  orderIndex: number
}

export type TakeGrade = {
  questionId: string
  score: number
  maxScore: number
}

export type QuestionResult = {
  questionId: string
  status: 'correct' | 'incorrect' | 'pending'
  score: number
  maxScore: number
}

export function computeResult(grades: TakeGrade[], questions: TakeQuestion[]) {
  let earned = 0
  const items: QuestionResult[] = questions.map((q) => {
    const g = grades.find((gr) => gr.questionId === q.id)
    if (!g) {
      return { questionId: q.id, status: 'pending', score: 0, maxScore: q.points }
    }
    earned += g.score
    return { questionId: q.id, status: g.score > 0 ? 'correct' : 'incorrect', score: g.score, maxScore: g.maxScore }
  })
  return { earned, items }
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/app/dashboard/assessments/take-helpers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/assessments/take-helpers.ts frontend/src/app/dashboard/assessments/take-helpers.test.ts
git commit -m "feat(assessments): add take-flow result + countdown helpers"
```

---

### Task 6: Frontend — `TakeAssessment` component

**Files:**
- Create: `frontend/src/components/assessments/take-assessment.tsx`

**Interfaces:**
- Consumes: `http()` from `@/lib/http-client`; `computeResult`, `formatCountdown`, `TakeQuestion` from `../app/dashboard/assessments/take-helpers`.
- Produces: `<TakeAssessment assessmentId mode accessKey? studentId? />` — fetches questions, renders the answering UI, submits, and shows the result view.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/assessments/take-assessment.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { http } from '@/lib/http-client'
import { computeResult, formatCountdown, type TakeQuestion } from '../app/dashboard/assessments/take-helpers'
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, ClipboardCheck } from 'lucide-react'

interface TakePayload {
  assessment: {
    id: string
    title: string
    titleAr?: string
    type: string
    totalPoints: number
    passingScore: number
    durationMinutes: number | null
  }
  questions: TakeQuestion[]
}

interface TakeProps {
  assessmentId: string
  mode: 'portal' | 'dashboard'
  accessKey?: string
  studentId?: string
  lang?: 'en' | 'ar'
}

type AnswerMap = Record<string, string>

export default function TakeAssessment({ assessmentId, mode, accessKey, studentId, lang = 'en' }: TakeProps) {
  const [payload, setPayload] = useState<TakePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<any>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const submittedRef = useRef(false)

  const qp = mode === 'portal'
    ? { accessKey }
    : { studentId }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await http.get<TakePayload>(`/assessments/${assessmentId}/questions`, qp as any)
        if (cancelled) return
        setPayload(data)
        if (data.assessment.durationMinutes) setSecondsLeft(data.assessment.durationMinutes * 60)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load assessment')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [assessmentId, mode, qp.accessKey, qp.studentId])

  const durationSec = payload?.assessment.durationMinutes
    ? payload.assessment.durationMinutes * 60
    : null

  useEffect(() => {
    if (durationSec == null || submittedRef.current) return
    setSecondsLeft(durationSec)
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev == null) return prev
        if (prev <= 1) {
          clearInterval(id)
          if (!submittedRef.current) submit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [durationSec])

  const answeredCount = useMemo(
    () => payload?.questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length ?? 0,
    [payload, answers],
  )

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const answerList = payload!.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' }))
      const url = mode === 'portal'
        ? `/student-portal/${accessKey}/assessments/${assessmentId}/submit`
        : `/assessments/${assessmentId}/submit`
      const body = mode === 'portal' ? { answers: answerList } : { ...qp, answers: answerList }
      const res = await http.post(url, body)
      setSubmission(res)
    } catch (e: any) {
      setError(e?.message || 'Submit failed')
      submittedRef.current = false
    } finally {
      setSubmitting(false)
    }
  }

  const confirmSubmit = () => {
    const unanswered = payload?.questions.filter((q) => (answers[q.id] ?? '').trim().length === 0).length ?? 0
    if (unanswered > 0 && !window.confirm(`${lang === 'ar' ? 'لديك' : 'You have'} ${unanswered} ${lang === 'ar' ? 'سؤال بدون إجابة. تأكيد التسليم؟' : 'unanswered question(s). Submit anyway?'}`)) {
      return
    }
    submit()
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }
  if (!payload) return null

  if (submission) {
    const res = computeResult(submission.grades ?? [], payload.questions)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
          <h2 className="mt-2 text-lg font-semibold text-gray-900">
            {lang === 'ar' ? 'تم التسليم' : 'Submitted'}
          </h2>
          <p className="mt-1 text-3xl font-bold text-gray-900">{res.earned} / {payload.assessment.totalPoints}</p>
          <p className="text-sm text-gray-500">
            {lang === 'ar' ? 'النتيجة تعتمد على الأسئلة المُصححة تلقائيًا' : 'Score from auto-graded questions'}
          </p>
        </div>
        <div className="mt-6 space-y-4">
          {payload.questions.map((q, i) => {
            const r = res.items[i]
            return (
              <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{q.text}</p>
                  {r.status === 'correct' && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />}
                  {r.status === 'incorrect' && <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />}
                  {r.status === 'pending' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{lang === 'ar' ? 'بانتظار التصحيح' : 'Awaiting grading'}</span>}
                </div>
                {r.status !== 'pending' && (
                  <p className="mt-1 text-xs text-gray-500">{lang === 'ar' ? 'إجابتك' : 'Your answer'}: {answers[q.id]}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="sticky top-0 z-10 -mx-4 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{payload.assessment.titleAr || payload.assessment.title}</h1>
            <p className="text-xs text-gray-500">{payload.assessment.type} · {payload.assessment.totalPoints} pts</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{answeredCount}/{payload.questions.length}</span>
            {secondsLeft != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                <Clock className="h-4 w-4" /> {formatCountdown(secondsLeft)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {payload.questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-900">{i + 1}. {q.text} <span className="text-xs font-normal text-gray-400">({q.points} pts)</span></p>
            {q.type === 'multiple_choice' && (
              <div className="mt-3 space-y-2">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'true_false' && (
              <div className="mt-3 flex gap-3">
                {['true', 'false'].map((v) => (
                  <label key={v} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    <input type="radio" name={q.id} value={v} checked={answers[q.id] === v} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                    {lang === 'ar' ? (v === 'true' ? 'صح' : 'خطأ') : v === 'true' ? 'True' : 'False'}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'short_answer' && (
              <input
                className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder={lang === 'ar' ? 'اكتب إجابتك' : 'Type your answer'}
              />
            )}
            {q.type === 'essay' && (
              <textarea
                className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
                rows={4}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder={lang === 'ar' ? 'اكتب إجابتك' : 'Type your answer'}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={confirmSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <ClipboardCheck className="h-4 w-4" />
          {submitting ? (lang === 'ar' ? 'جارٍ التسليم…' : 'Submitting…') : (lang === 'ar' ? 'تسليم' : 'Submit')}
        </button>
      </div>
    </div>
  )
}
```

Note: The `useEffect` for the timer references `submit` (a `const` arrow function) — that is a TDZ error as written. Reorder so `submit` is defined **before** the timer effect.

**Important (auto-submit must submit current answers):** a `setInterval` callback captures `submit`/`answers` from the render in which the effect ran, so at 0:00 it could submit stale (empty) answers. Fix this by reading the latest answers from a ref. Add a ref and update it on every answer change, and have `submit` read from the ref:

```tsx
const answersRef = useRef<AnswerMap>({})
const setAnswer = (qid: string, value: string) => {
  setAnswers((a) => { const n = { ...a, [qid]: value }; answersRef.current = n; return n })
}
const submit = async () => {
  if (submittedRef.current) return
  submittedRef.current = true
  setSubmitting(true)
  const current = answersRef.current
  const answerList = payload!.questions.map((q) => ({ questionId: q.id, answer: current[q.id] ?? '' }))
  // ...same body/url handling as the sample...
}
```

Replace every `setAnswers((a) => ({ ...a, [q.id]: value }))` in the component with `setAnswer(q.id, value)`. The `submittedRef` guard prevents double-submit from both the timer and a manual click. If you instead prefer `setInterval` with a ref to the latest `submit`, that is also acceptable — the requirement is that an auto-submit uses the student's current answers.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (from `frontend/`)
Expected: clean. Fix any hook-order / dependency lint issues (the timer effect depends on `durationSec`; `submit` is stable enough via the ref guard; if exhaustive-deps complains, that's a warning, not a tsc error — but keep the behavior correct).

- [ ] **Step 3: Run full vitest suite to confirm nothing regressed**

Run: `npx vitest run` (from `frontend/`)
Expected: all green (including the new `take-helpers.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/assessments/take-assessment.tsx
git commit -m "feat(assessments): add TakeAssessment component"
```

---

### Task 7: Frontend — surface the take flow in portal + dashboard

**Files:**
- Create: `frontend/src/app/student-portal/[code]/assessment/[assessmentId]/take/page.tsx`
- Create: `frontend/src/app/dashboard/assessments/[id]/take/page.tsx`
- Modify: `frontend/src/app/student-portal/[code]/page.tsx` (assessment cards ~line 376)
- Modify: `frontend/src/app/dashboard/assessments/page.tsx` (students modal `openStudents` ~line 339)

**Interfaces:**
- Consumes: `TakeAssessment` (Task 6), existing `http()` / portal / dashboard patterns.
- Produces: reachable take pages for both surfaces.

- [ ] **Step 1: Portal take route**

Create `frontend/src/app/student-portal/[code]/assessment/[assessmentId]/take/page.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import TakeAssessment from '@/components/assessments/take-assessment'

export default function PortalTakePage() {
  const params = useParams()
  const code = String(params.code)
  const assessmentId = String(params.assessmentId)
  return <TakeAssessment assessmentId={assessmentId} mode="portal" accessKey={code} />
}
```

- [ ] **Step 2: Dashboard take route**

Create `frontend/src/app/dashboard/assessments/[id]/take/page.tsx`:

```tsx
'use client'

import { useParams, useSearchParams } from 'next/navigation'
import TakeAssessment from '@/components/assessments/take-assessment'

export default function DashboardTakePage() {
  const params = useParams()
  const search = useSearchParams()
  const assessmentId = String(params.id)
  const studentId = search.get('student') ?? ''
  return <TakeAssessment assessmentId={assessmentId} mode="dashboard" studentId={studentId} />
}
```

- [ ] **Step 3: Make pending portal assessment cards link to the take page**

In `frontend/src/app/student-portal/[code]/page.tsx`, wrap the pending/not-completed assessment card (the `else` branch that renders the blue "Pending" pill, ~line 406-413) so the whole card becomes a `Link` to `/student-portal/${code}/assessment/${a.id}/take`. `Link` is already imported. Keep completed/overdue cards as plain `<div>`s (do not link completed ones).

Replace the card's outer `<div ...>` (the one with the conditional `bg-...` class) so that when `!isCompleted` it is a `Link`:

```tsx
const cardClasses = `rounded-xl border px-4 py-3 ${
  isCompleted ? 'bg-green-50 border-green-200' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
}`
const cardInner = (
  <>
    {/* existing inner content unchanged */}
  </>
)
return isCompleted ? (
  <div key={a.id} className={cardClasses}>{cardInner}</div>
) : (
  <Link key={a.id} href={`/student-portal/${code}/assessment/${a.id}/take`} className={`block ${cardClasses}`}>{cardInner}</Link>
)
```

If the inner content is easier to inline than extract to a variable, wrap the existing inner JSX in the `Link` directly and leave the completed case as-is. Do not over-engineer — the goal is that pending/overdue (non-completed) cards navigate to the take page.

- [ ] **Step 4: Add "Take for student" action in the dashboard students modal**

In `frontend/src/app/dashboard/assessments/page.tsx`, in the students modal (rendered from `openStudents`, ~line 339), add a small action per student row that navigates to the dashboard take route for that student, e.g. next to the existing "mark"/"reassess" buttons:

```tsx
<a
  href={`/dashboard/assessments/${selectedAssessment.id}/take?student=${student.id}`}
  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
>
  {lang === 'ar' ? 'أداء الاختبار' : 'Take for student'}
</a>
```

Confirm the modal already has access to `selectedAssessment.id` and each student's `student.id` (it does — the modal lists students with their ids). If the modal's student rows already use a flex layout with existing action buttons, place this link alongside them and match the styling.

- [ ] **Step 5: Typecheck + run tests**

Run: `npx tsc --noEmit` (from `frontend/`)
Expected: clean.

Run: `npx vitest run` (from `frontend/`)
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/student-portal frontend/src/app/dashboard/assessments
git commit -m "feat(assessments): surface take flow in portal and dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** durationMinutes opt-in (Tasks 1, 5, 6); question-fetch without answers for both surfaces (Tasks 2, 4); submit assignment hardening + essay deferral (Task 3); shared component + result (Tasks 5, 6); surfacing in portal and dashboard (Task 7). All spec sections map to tasks.
- **Type consistency:** `getTakeQuestions` shape from Task 2 is consumed by the frontend `TakePayload` in Task 6; `computeResult`/`formatCountdown`/`TakeQuestion` from Task 5 are used in Task 6; `SubmitAssessmentDto` from the existing DTO is used in Task 4 portal submit.
- **No placeholders:** every task has real code; frontend surfacing steps reference exact existing code (portal cards, `openStudents` modal) and give concrete implementations.
- **Known simplification:** the countdown auto-submit is client-side; a determined client can bypass it (documented in the spec as accepted).

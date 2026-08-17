# Assessments Foundation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make assessment `type` real and filterable, stop `update()` from destroying question IDs, fix the students-modal grade filter, enforce server-side validation, and surface the `closed` status.

**Architecture:** Backend-authoritative. Persist `type` (5-value whitelist, default `quiz`) on the existing `String` column; add an optional `id` to the question DTO so `update()` upserts questions by ID inside a Prisma `$transaction` (preserving historical grade rows). Add `BadRequestException` validations in the service (points sum, MC correctAnswer, mark caps, duplicate submit). Frontend mirrors the rules with a small testable validation helper, adds the Type select + `closed` status, carries question IDs, and removes the bogus `gradeId` (grade-name-as-UUID) param.

**Tech Stack:** NestJS + Prisma + class-validator (backend); Next.js App Router + React + Vitest (frontend).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-17-assessments-foundation-design.md`.
- Work from `origin/main` (currently `e521aa1`). Run `git pull --rebase --autostash` before any push.
- `Assessment.type` and `Assessment.status` are `String` columns — **no Prisma migration**.
- Type whitelist (verbatim): `['quiz','test','exam','oral','homework']`; default when omitted: `'quiz'`.
- Status values supported in UI (verbatim): `draft`, `published`, `archived`, `closed`.
- Backend has 17 pre-existing unrelated Jest failures — do **not** touch/fix them.
- Frontend: `npx tsc --noEmit` must be clean; `npx vitest run` must stay green.
- Do not alter behavior outside Unit A (no analytics, take-flow, bulk actions, or export — those are Units B/C/D).

---

### Task 1: Backend DTO — `type` whitelist + question `id`

**Files:**
- Modify: `backend/src/modules/assessments/dto/assessment.dto.ts`

**Interfaces:**
- Produces: `CreateAssessmentDto.type?: string`, `UpdateAssessmentDto.type?: string`, `CreateQuestionDto.id?: string` (optional UUID). `CreateQuestionDto` still exposes `text`, `type`, `options`, `correctAnswer`, `points`, `orderIndex`.

- [ ] **Step 1: Write the failing test**

The DTO is exercised through the service, but the whitelist + optional `id` are validated by class-validator at the controller boundary. Add a small compile-time/schema assertion test in `backend/src/modules/assessments/assessments.service.spec.ts` (new describe block) that verifies `CreateQuestionDto` accepts an optional `id` and that the five valid types are accepted by `@IsIn`:

```ts
import { CreateQuestionDto, CreateAssessmentDto } from './dto/assessment.dto';
import { validate } from 'class-validator';

describe('DTO validation', () => {
  it('accepts a question with an optional id', async () => {
    const q = new CreateQuestionDto();
    q.id = '11111111-1111-1111-1111-111111111111';
    q.text = 'Q1';
    q.type = 'multiple_choice';
    q.options = ['A', 'B'];
    q.correctAnswer = 'A';
    q.points = 10;
    q.orderIndex = 0;
    const errors = await validate(q);
    expect(errors).toHaveLength(0);
  });

  it.each(['quiz', 'test', 'exam', 'oral', 'homework'])('accepts type %s', async (t) => {
    const dto = new CreateAssessmentDto();
    (dto as any).type = t;
    // force validation of the IsIn rule by copying to a plain object via the pipe path:
    const errors = await validate(dto as any);
    expect(errors.filter(e => e.property === 'type')).toHaveLength(0);
  });

  it('rejects an invalid type', async () => {
    const dto = new CreateAssessmentDto();
    (dto as any).type = 'general';
    const errors = await validate(dto as any);
    expect(errors.filter(e => e.property === 'type').length).toBeGreaterThan(0);
  });
});
```

> Note: to make these pass you must add the `@IsIn` decorator on `CreateAssessmentDto.type`. `class-validator` is already a dependency (used by the controller `ValidationPipe`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "DTO validation"`
Expected: FAIL — `validate(dto)` returns errors for `type` (no `@IsIn` present yet) and/or `type` isn't rejected.

- [ ] **Step 3: Implement DTO changes**

In `backend/src/modules/assessments/dto/assessment.dto.ts`:

Add `IsIn` to the existing class-validator import:
```ts
import { IsIn } from 'class-validator';
```

Add to `CreateQuestionDto` (after `orderIndex`):
```ts
  @IsOptional()
  @IsUUID()
  id?: string;
```

Add to `CreateAssessmentDto` (after `description`):
```ts
  @IsOptional()
  @IsIn(['quiz', 'test', 'exam', 'oral', 'homework'])
  type?: string;
```

Add to `UpdateAssessmentDto` (after `description`):
```ts
  @IsOptional()
  @IsIn(['quiz', 'test', 'exam', 'oral', 'homework'])
  type?: string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "DTO validation"`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/assessments/dto/assessment.dto.ts backend/src/modules/assessments/assessments.service.spec.ts
git commit -m "feat(assessments): add type whitelist and question id to DTOs"
```

---

### Task 2: Backend — persist `type` and filter by it

**Files:**
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`create` at ~line 69-124, `findAll` at ~line 13-49)
- Modify: `backend/src/modules/assessments/assessments.controller.ts` (`findAll` at ~line 34-49)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Consumes: `CreateAssessmentDto.type?: string` (Task 1).
- Produces: `create()` persists `type` (default `'quiz'`); `findAll(schoolIdentifier, filters)` accepts `filters.type?: string` and filters `where.type`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/modules/assessments/assessments.service.spec.ts` inside `describe('create')`:

```ts
it('persists the provided type', async () => {
  prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
  prisma.assessment.create.mockResolvedValue({ id: 'a1' });

  await service.create({ ...baseDto, type: 'exam' }, 'school-1');

  const data = prisma.assessment.create.mock.calls[0][0].data;
  expect(data.type).toBe('exam');
});

it('defaults type to quiz when omitted', async () => {
  prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
  prisma.assessment.create.mockResolvedValue({ id: 'a1' });

  await service.create({ ...baseDto }, 'school-1');

  const data = prisma.assessment.create.mock.calls[0][0].data;
  expect(data.type).toBe('quiz');
});
```

Add a new `describe('findAll')`:

```ts
describe('findAll', () => {
  it('filters by type', async () => {
    prisma.assessment.findMany.mockResolvedValue([]);
    prisma.assessment.count.mockResolvedValue(0);

    await service.findAll('school-1', { type: 'exam' });

    const where = prisma.assessment.findMany.mock.calls[0][0].where;
    expect(where.type).toBe('exam');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "type"`
Expected: FAIL — `data.type` is `'general'`; `where.type` is `undefined`.

- [ ] **Step 3: Implement**

In `assessments.service.ts` `create()`, change the hardcoded type (line ~88):
```ts
type: dto.type || 'quiz',
```

In `findAll()`, change the signature (line ~13-19) to include `type`:
```ts
async findAll(schoolIdentifier: string, filters: {
  page?: number;
  limit?: number;
  levelId?: string;
  subjectId?: string;
  status?: string;
  type?: string;
}) {
  const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
  const { page = 1, limit = 20, levelId, subjectId, status, type } = filters;

  const where: any = { schoolId, deletedAt: null };
  if (levelId) where.levelId = levelId;
  if (subjectId) where.subjectId = subjectId;
  if (status) where.status = status;
  if (type) where.type = type;
```

In `assessments.controller.ts` `findAll()` (line ~34-49), add the query param and pass it:
```ts
async findAll(
  @Query('schoolId') schoolId: string = '',
  @Query('page') page?: string,
  @Query('limit') limit?: string,
  @Query('levelId') levelId?: string,
  @Query('subjectId') subjectId?: string,
  @Query('status') status?: string,
  @Query('type') type?: string,
) {
  return this.assessmentsService.findAll(schoolId, {
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
    levelId,
    subjectId,
    status,
    type,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "type"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/assessments/assessments.service.ts backend/src/modules/assessments/assessments.controller.ts backend/src/modules/assessments/assessments.service.spec.ts
git commit -m "feat(assessments): persist type and filter list by type"
```

---

### Task 3: Backend — `update()` upserts questions by ID in a transaction

**Files:**
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`update` at ~line 126-181)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Consumes: `CreateQuestionDto.id?: string` (Task 1).
- Produces: `update()` runs `prisma.$transaction`; `assessmentQuestion.upsert`/`update`/`create` and `deleteMany` (with `grades: { none: {} }`). A private `validateQuestions(questions, totalPoints)` helper (also used by Task 4).

- [ ] **Step 1: Write the failing test**

Add a mock for `$transaction` in the `prismaMock` (top of `assessments.service.spec.ts`), so `update()`'s transaction executes with the mock as the tx client:

```ts
$transaction: jest.fn(async (fn: any) => fn(prismaMock)),
```

Add `assessmentQuestion.upsert` to the `assessmentQuestion` mock:
```ts
assessmentQuestion: {
  deleteMany: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
},
```

Add inside `describe('update')`:

```ts
it('upserts questions preserving existing ids', async () => {
  prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100 });
  prisma.assessment.update.mockResolvedValue({ id: 'a1' });
  prisma.assessmentQuestion.update.mockResolvedValue({});
  prisma.assessmentQuestion.create.mockResolvedValue({});
  prisma.assessmentQuestion.deleteMany.mockResolvedValue({});

  await service.update('a1', {
    totalPoints: 100,
    passingPoints: 60,
    questions: [
      { id: 'q1', text: 'Kept', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 50, orderIndex: 0 },
      { text: 'New', type: 'true_false', correctAnswer: 'true', points: 50, orderIndex: 1 },
    ],
  });

  expect(prisma.assessmentQuestion.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'q1' } }),
  );
  expect(prisma.assessmentQuestion.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ assessmentId: 'a1', questionText: 'New' }) }),
  );
});

it('does not delete questions that have grades', async () => {
  prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', metadata: {}, deletedAt: null, totalPoints: 100 });
  prisma.assessment.update.mockResolvedValue({ id: 'a1' });
  prisma.assessmentQuestion.update.mockResolvedValue({});
  prisma.assessmentQuestion.create.mockResolvedValue({});
  prisma.assessmentQuestion.deleteMany.mockResolvedValue({});

  await service.update('a1', {
    totalPoints: 100,
    passingPoints: 60,
    questions: [
      { id: 'q1', text: 'Kept', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 100, orderIndex: 0 },
    ],
  });

  // keptIds = ['q1']; deleteMany must exclude q1 and only target questions with no grades
  const args = prisma.assessmentQuestion.deleteMany.mock.calls[0][0];
  expect(args.where.assessmentId).toBe('a1');
  expect(args.where.id.notIn).toEqual(['q1']);
  expect(args.where.grades.none).toEqual({});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "upserts questions"`
Expected: FAIL — currently `update()` calls `assessmentQuestion.deleteMany` for all questions and uses nested `data.questions.create` (no `assessmentQuestion.update`/`create` calls, no `$transaction`).

- [ ] **Step 3: Implement**

Replace the `update()` questions block (lines ~154-168) with:

```ts
if (dto.questions !== undefined) {
  this.validateQuestions(dto.questions, dto.totalPoints ?? Number(existing.totalPoints));
  await this.prisma.$transaction(async (tx) => {
    const keptIds = dto.questions.filter(q => q.id).map(q => q.id as string);
    if (keptIds.length > 0) {
      await tx.assessmentQuestion.deleteMany({
        where: { assessmentId: id, id: { notIn: keptIds }, grades: { none: {} } },
      });
    } else {
      await tx.assessmentQuestion.deleteMany({
        where: { assessmentId: id, grades: { none: {} } },
      });
    }
    for (const q of dto.questions) {
      const questionData = {
        questionText: q.text,
        type: q.type,
        options: q.options || undefined,
        correctAnswer: q.correctAnswer,
        points: q.points,
        orderIndex: q.orderIndex,
      };
      if (q.id) {
        await tx.assessmentQuestion.update({ where: { id: q.id }, data: questionData });
      } else {
        await tx.assessmentQuestion.create({
          data: { assessmentId: id, ...questionData },
        });
      }
    }
  });
}
```

Add the private helper `validateQuestions` (used by Task 4 too). Place it after the constructor or near the bottom of the class:

```ts
private validateQuestions(questions: CreateQuestionDto[], totalPoints: number) {
  const sum = questions.reduce((a, q) => a + q.points, 0);
  if (sum > totalPoints) {
    throw new BadRequestException(`Question points (${sum}) exceed total points (${totalPoints})`);
  }
  for (const q of questions) {
    if (q.type === 'multiple_choice') {
      const opts = Array.isArray(q.options) ? q.options.map(String) : [];
      if (opts.some(o => !o || !String(o).trim())) {
        throw new BadRequestException('Multiple-choice options cannot be empty');
      }
      if (q.correctAnswer && !opts.includes(String(q.correctAnswer))) {
        throw new BadRequestException('Correct answer must be one of the options');
      }
    }
  }
}
```

Update the class-validator import already present (`CreateQuestionDto` is imported at the top — verify it is in the import on line 4).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "upserts questions"`
Expected: PASS. Also re-run the full spec: `npx jest backend/src/modules/assessments/assessments.service.spec.ts` — the two pre-existing `update` tests must still pass (their `prisma.assessment.update` assertion is unaffected because the transaction runs before it).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/assessments/assessments.service.ts backend/src/modules/assessments/assessments.service.spec.ts
git commit -m "feat(assessments): upsert questions by id in update, preserving grades"
```

---

### Task 4: Backend — validation (points, MC, mark caps, duplicate submit)

**Files:**
- Modify: `backend/src/modules/assessments/assessments.service.ts` (`create` ~line 101, `submit` ~line 197, `markStudent` ~line 339)
- Test: `backend/src/modules/assessments/assessments.service.spec.ts`

**Interfaces:**
- Consumes: `validateQuestions(questions, totalPoints)` (Task 3).
- Produces: `create()` validates questions; `submit()` rejects duplicate submissions (status `submitted`/`completed`); `markStudent()` validates `score`/`maxScore` caps.

- [ ] **Step 1: Write the failing tests**

Add to the spec (new describe blocks):

```ts
describe('create validation', () => {
  it('throws when question points exceed totalPoints', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    await expect(
      service.create(
        {
          ...baseDto,
          totalPoints: 10,
          questions: [
            { text: 'A', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 20, orderIndex: 0 },
          ],
        },
        'school-1',
      ),
    ).rejects.toThrow('exceed total points');
  });

  it('throws when multiple-choice correctAnswer is not an option', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    await expect(
      service.create(
        {
          ...baseDto,
          questions: [
            { text: 'A', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'Z', points: 10, orderIndex: 0 },
          ],
        },
        'school-1',
      ),
    ).rejects.toThrow('Correct answer must be one of the options');
  });
});

describe('submit validation', () => {
  it('rejects a duplicate submission', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'a1', deletedAt: null, status: 'published', questions: [],
    });
    prisma.assessmentSubmission.findFirst.mockResolvedValue({ id: 's1', status: 'submitted' });

    await expect(
      service.submit('a1', 'stu-1', { answers: [] }),
    ).rejects.toThrow('already submitted');
  });
});

describe('markStudent validation', () => {
  it('throws when score exceeds maxScore', async () => {
    prisma.assessment.findUnique.mockResolvedValue({ id: 'a1', deletedAt: null, totalPoints: 100 });
    prisma.assessmentSubmission.findFirst.mockResolvedValue(null);
    prisma.assessmentSubmission.create.mockResolvedValue({ id: 's1' });
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

    await expect(
      service.markStudent('a1', 'stu-1', 90, 80, 'ok', 'u1'),
    ).rejects.toThrow('score cannot exceed maxScore');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "validation"`
Expected: FAIL — no such validation exists yet (or create succeeds / submit succeeds / mark succeeds).

- [ ] **Step 3: Implement**

In `create()`, after the `adminUser` lookup and before `return this.prisma.assessment.create(...)`, add:

```ts
if (dto.questions && dto.questions.length > 0) {
  this.validateQuestions(dto.questions, dto.totalPoints);
}
```

In `submit()`, immediately after the `assessment.status !== 'published'` check (line ~207), add:

```ts
const already = await this.prisma.assessmentSubmission.findFirst({
  where: { assessmentId, studentId, status: { in: ['submitted', 'completed'] } },
});
if (already) {
  throw new BadRequestException('This student has already submitted this assessment');
}
```

In `markStudent()`, immediately after the `deletedAt` check (line ~343), add:

```ts
const total = Number(assessment.totalPoints);
if (maxScore <= 0) {
  throw new BadRequestException('maxScore must be greater than zero');
}
if (score < 0 || score > maxScore) {
  throw new BadRequestException('score cannot exceed maxScore');
}
if (Number(maxScore) > total) {
  throw new BadRequestException('maxScore cannot exceed the assessment total');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest backend/src/modules/assessments/assessments.service.spec.ts -t "validation"`
Expected: PASS. Then run the whole spec to confirm nothing else broke.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/assessments/assessments.service.ts backend/src/modules/assessments/assessments.service.spec.ts
git commit -m "feat(assessments): validate points, correctAnswer, mark caps, duplicate submit"
```

---

### Task 5: Frontend — type select, closed status, question IDs, grade-filter fix

**Files:**
- Modify: `frontend/src/app/dashboard/assessments/page.tsx`

**Interfaces:**
- Consumes: backend now persists/filters `type` and accepts question `id` on update (Tasks 1-3).
- Produces: form carries `type: string` (default `'quiz'`); question drafts carry `id?: string`; `closed` appears in the status dropdown; the bogus `gradeId` (name-as-UUID) param is removed.

- [ ] **Step 1: Make the changes (frontend — verified via tsc + existing tests, since the page is not unit-mounted)**

Edit `emptyForm` (line ~111-127): add `type: 'quiz',` (e.g. after `status: 'draft',`).

Edit `QuestionDraft` interface (line ~88-94): add `id?: string`.

Edit the edit-load mapping (line ~307-313) to carry the id:
```ts
questions: (detail.questions || []).map(q => ({
  id: q.id,
  text: q.questionText,
  type: q.type as QuestionDraft['type'],
  options: Array.isArray(q.options) ? q.options.join('\n') : (q.options || ''),
  correctAnswer: q.correctAnswer,
  points: String(q.points),
})),
```

Edit the form-set when loading (near line ~294-307) to set the type — after `status: detail.status,` add `type: detail.type || 'quiz',`.

Edit the POST/PUT body questions mapping (line ~555-563) to include the id:
```ts
questions: form.questions.map((q, i) => ({
  id: q.id || undefined,
  text: q.text,
  type: q.type,
  options: q.type === 'multiple_choice'
    ? q.options.split('\n').map(o => o.trim()).filter(Boolean)
    : undefined,
  correctAnswer: q.correctAnswer,
  points: parseInt(q.points, 10) || 0,
  orderIndex: i,
})),
```

Add `type: form.type,` to the POST/PUT body (alongside `status: form.status,` at ~line 550).

Remove the bogus grade filter param in `openStudents` (line ~342): delete `if (grade) p.gradeId = grade`.

Add `closed` to the form status dropdown (line ~991-995), after the `archived` option:
```tsx
<option value="closed">{lang === 'ar' ? 'مغلق' : 'Closed'}</option>
```

Add a **Type** select to the form. Insert a new `FormField` just above the Status field (line ~991). Place it as its own field in the same grid row (or reuse the layout pattern of the neighboring fields):
```tsx
<FormField label={lang === 'ar' ? 'النوع' : 'Type'} as="select" value={form.type} onChange={e => updateForm({ type: e.target.value })}>
  <option value="quiz">{lang === 'ar' ? 'مسابقة' : 'Quiz'}</option>
  <option value="test">{lang === 'ar' ? 'اختبار' : 'Test'}</option>
  <option value="exam">{lang === 'ar' ? 'امتحان' : 'Exam'}</option>
  <option value="oral">{lang === 'ar' ? 'شفوي' : 'Oral'}</option>
  <option value="homework">{lang === 'ar' ? 'واجب' : 'Homework'}</option>
</FormField>
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (confirm `q.id` exists on the question objects and `form.type` is typed).

- [ ] **Step 3: Run existing frontend tests**

Run: `cd frontend && npx vitest run`
Expected: all existing tests pass (unchanged behavior outside the touched form).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/assessments/page.tsx
git commit -m "feat(assessments): type select, closed status, question ids, grade-filter fix"
```

---

### Task 6: Frontend — testable validation helper + tests

**Files:**
- Create: `frontend/src/app/dashboard/assessments/validation.ts`
- Create: `frontend/src/app/dashboard/assessments/validation.test.ts`
- Modify: `frontend/src/app/dashboard/assessments/page.tsx` (wire warnings)

**Interfaces:**
- Produces: `validateQuestions(questions, totalPoints): ValidationIssue[]` where
  `ValidationIssue = { questionIndex: number; message: string }`. Returns a points-sum issue and per-question MC correctAnswer/empty-option issues. Pure, no I/O — unit-testable.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/dashboard/assessments/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateQuestions } from './validation';

const mk = (over: any = {}) => ({
  text: 'Q',
  type: 'multiple_choice' as const,
  options: 'A\nB',
  correctAnswer: 'A',
  points: '10',
  ...over,
});

describe('validateQuestions', () => {
  it('flags when points exceed total', () => {
    const issues = validateQuestions([mk({ points: '70' })], 50);
    expect(issues.some(i => i.message.includes('exceed'))).toBe(true);
  });

  it('flags multiple-choice whose correctAnswer is not in options', () => {
    const issues = validateQuestions([mk({ correctAnswer: 'Z' })], 100);
    expect(issues.some(i => i.message.includes('one of the options'))).toBe(true);
  });

  it('returns no issues for a valid question set', () => {
    const issues = validateQuestions([mk(), mk({ type: 'true_false', options: '', correctAnswer: 'true' })], 100);
    expect(issues).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/app/dashboard/assessments/validation.test.ts`
Expected: FAIL — module `./validation` does not exist.

- [ ] **Step 3: Implement the helper**

Create `frontend/src/app/dashboard/assessments/validation.ts`:

```ts
export interface QuestionDraftLike {
  text: string
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  options: string
  correctAnswer: string
  points: string
}

export interface ValidationIssue {
  questionIndex: number
  message: string
}

export function validateQuestions(questions: QuestionDraftLike[], totalPoints: number): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const sum = questions.reduce((a, q) => a + (parseInt(q.points, 10) || 0), 0)
  if (sum > totalPoints) {
    issues.push({ questionIndex: -1, message: `Question points (${sum}) exceed total points (${totalPoints})` })
  }
  questions.forEach((q, i) => {
    if (q.type !== 'multiple_choice') return
    const opts = q.options.split('\n').map(o => o.trim()).filter(Boolean)
    if (opts.some(o => !o)) {
      issues.push({ questionIndex: i, message: 'Multiple-choice options cannot be empty' })
    }
    if (q.correctAnswer && !opts.includes(q.correctAnswer.trim())) {
      issues.push({ questionIndex: i, message: 'Correct answer must be one of the options' })
    }
  })
  return issues
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/app/dashboard/assessments/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire warnings into the page**

In `page.tsx`, near the top of the form's Questions section (line ~998-1011), compute and render issues. Add after `const { toast } = useToast()` (component top, ~line 130):

```ts
const formIssues = useMemo(() => validateQuestions(form.questions, parseInt(form.totalPoints, 10) || 0), [form.questions, form.totalPoints])
```

(Ensure `useMemo` is imported; add to the React import if missing.)

Render a warning banner in the Questions section header area (line ~998-1006), before the question list:

```tsx
{formIssues.length > 0 && (
  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
    {formIssues.map((iss, idx) => (
      <div key={idx}>{iss.message}</div>
    ))}
  </div>
)}
```

- [ ] **Step 6: Typecheck + full frontend tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/dashboard/assessments/validation.ts frontend/src/app/dashboard/assessments/validation.test.ts frontend/src/app/dashboard/assessments/page.tsx
git commit -m "feat(assessments): add frontend validation helper and inline warnings"
```

---

### Task 7: Full verification + push

**Files:**
- None (verification only).

- [ ] **Step 1: Run backend assessments spec**

Run: `cd backend && npx jest src/modules/assessments/assessments.service.spec.ts`
Expected: all `AssessmentsService` and `DTO validation` tests pass. (Do not run the whole backend suite — 17 unrelated failures exist and must be ignored.)

- [ ] **Step 2: Run frontend typecheck + tests**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: clean; all frontend tests pass.

- [ ] **Step 3: Optional production build sanity check**

Run: `cd frontend && npx next build 2>&1 | tail -20`
Expected: build succeeds (compiles `page.tsx` changes). If it fails for unrelated reasons, report but do not block the commit.

- [ ] **Step 4: Pull, push**

```bash
git pull --rebase --autostash
git push origin main
```

- [ ] **Step 5: Report**

Summarize: files changed, tests run/passed, and note that Units B/C/D remain (analytics, student take flow, bulk actions/export).
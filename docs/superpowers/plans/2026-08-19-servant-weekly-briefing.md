# Servant Weekly Briefing ("This Sunday") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a servant-facing `/dashboard/briefing` ("This Sunday") screen showing Coptic liturgical context, the next upcoming lesson to prepare, the next class session, and a read-only follow-up checklist — backed by a new `GET /dashboard/weekly-briefing` endpoint.

**Architecture:** Approach A. Move the private Coptic-calendar helpers out of `hymn-learning.service.ts` into a shared `backend/src/common/utils/coptic-calendar.ts` util (add Arabic month names, season labels, a feast/fast table, and a `getCopticContext` convenience). Extract the roster assembly from `getClassOverview` into a shared `buildClassRoster` helper (behavior-preserving). Add `findNextUpcomingLesson` and `getWeeklyBriefing` to `DashboardService` + a `weekly-briefing` controller route. Build the frontend page + nav item.

**Tech Stack:** NestJS + Prisma (Postgres) backend; Next.js App Router + Tailwind + lucide-react + Vitest frontend; Jest for backend specs.

**Spec:** `docs/superpowers/specs/2026-08-19-servant-weekly-briefing-design.md`

## Global Constraints

- Bilingual: every user-visible frontend string has `en`/`ar` pair resolved via `useLanguage()` (`lang === 'ar' ? ar : en`). RTL-aware layout via Tailwind.
- Backend copy is code-constant bilingual objects (e.g. `{ en, ar }`), never interpolated prose.
- The two unrelated untracked files `backend/prisma/upload-servants.ts` and `docs/superpowers/plans/2026-08-18-servant-module-enhancements.md` must NOT be committed — stage files EXPLICITLY, never `git add -A`.
- Two ESLint rules are ERROR-LEVEL (block builds): `@next/next/no-img-element` and `@typescript-eslint/no-this-alias`. Any `<img>` in frontend code MUST carry `// eslint-disable-next-line @next/next/no-img-element`.
- Pre-existing unrelated failing test `users.service.spec.ts` — ignore it; never change its assertions.
- Verification gate before push: `cd backend && npx jest dashboard.service.spec.ts` + `npx jest src/common/utils/coptic-calendar.spec.ts` + `npx jest src/modules/curriculum/hymn-learning.service.spec.ts`; `cd frontend && npx tsc --noEmit && npx vitest run && npx next build`.
- Follow repo conventions: 2-space indent, single quotes, no unnecessary comments.
- The Coptic helpers must be moved to the shared util with IDENTICAL behavior — `hymn-learning.service.ts` must keep compiling and its spec must still pass.

---
## File Structure

- **Backend**
  - Create: `backend/src/common/utils/coptic-calendar.ts` — shared Coptic calendar util.
  - Modify: `backend/src/modules/curriculum/hymn-learning.service.ts` — import moved helpers from the util; remove local definitions (lines ~40-82).
  - Create: `backend/src/common/utils/coptic-calendar.spec.ts` — util tests.
  - Modify: `backend/src/modules/dashboard/dashboard.service.ts` — extract `buildClassRoster`, add `findNextUpcomingLesson`, `getWeeklyBriefing`.
  - Modify: `backend/src/modules/dashboard/dashboard.controller.ts` — add `@Get('weekly-briefing')`.
  - Modify: `backend/src/modules/dashboard/dashboard.service.spec.ts` — extend prismaMock + add tests.
- **Frontend**
  - Modify: `frontend/src/components/dashboard-shell.tsx` — add "This Sunday" nav item.
  - Create: `frontend/src/app/dashboard/briefing/page.tsx` — the screen.
  - Create: `frontend/src/app/dashboard/briefing/__tests__/briefing.test.tsx` — page tests.

---

### Task 1: Shared Coptic calendar util + refactor hymn-learning

**Files:**
- Create: `backend/src/common/utils/coptic-calendar.ts`
- Modify: `backend/src/modules/curriculum/hymn-learning.service.ts`
- Test: `backend/src/common/utils/coptic-calendar.spec.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces (later tasks use these):
  - `COPTIC_MONTHS: string[]`, `COPTIC_MONTHS_AR: string[]` (index 0 is empty; 1..13 = Thout..Nasie)
  - `getCopticContext(date: Date): { coptic: { month, day, year, monthName, monthNameAr }, season, seasonLabel: { en, ar }, feastFast: { key, en, ar } | null }`
  - `getCopticDateLabel(coptic): { en, ar }`
  - `getFeastOrFast(month, day): { key, en, ar } | null`
  - `getCopticSeason(month, day): CopticSeason`
  - `getUpcomingSundayDate(from?: Date): Date`
  - `jdToCoptic(jd): { month, day, year }`, `gregorianToJD(year, month, day): number`

- [ ] **Step 1: Create the util**

Create `backend/src/common/utils/coptic-calendar.ts`:

```ts
export const COPTIC_EPOCH_JD = 1825029.5; // Julian Day for 1 Thout 1 AM (29 Aug 284 CE)

export function gregorianToJD(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) -
    Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function jdToCoptic(jd: number): { month: number; day: number; year: number } {
  const copticDays = jd - COPTIC_EPOCH_JD;
  const year = Math.floor(copticDays / 365.25);
  const remaining = copticDays - year * 365.25;
  const month = Math.floor(remaining / 30) + 1;
  const day = Math.floor(remaining % 30) + 1;
  return { year: Math.floor(year) + 1, month: Math.max(1, Math.min(13, month)), day: Math.max(1, Math.min(30, day)) };
}

// Coptic month names (1=Thout ... 13=Nasie)
export const COPTIC_MONTHS = ['', 'Thout', 'Paopi', 'Hathor', 'Kiahk', 'Tobi', 'Meshir', 'Paremhat', 'Parmouti', 'Pashons', 'Paoni', 'Epip', 'Mesori', 'Nasie'];
export const COPTIC_MONTHS_AR = ['', 'توت', 'بابه', 'هاتور', 'كيهك', 'طوبه', 'أمشير', 'برمهات', 'برموده', 'بشنس', 'بؤونه', 'أبيب', 'مسرا', 'نسيئ'];

export type CopticSeason = 'kiahk' | 'nativity' | 'great_lent' | 'bright_week' | 'regular';

export function getCopticSeason(month: number, day: number): CopticSeason {
  if (month === 4) return 'kiahk';
  if (month === 5 && day <= 11) return 'nativity';
  if (month === 7 || month === 8) return 'great_lent';
  if (month === 9 && day <= 7) return 'bright_week';
  return 'regular';
}

export const SEASON_LABEL: Record<CopticSeason, { en: string; ar: string }> = {
  kiahk: { en: 'Month of Kiahk', ar: 'شهر كيهك' },
  nativity: { en: 'Nativity Season', ar: 'زمن الميلاد' },
  great_lent: { en: 'Great Lent', ar: 'الصوم الكبير' },
  bright_week: { en: 'Bright Week', ar: 'أسبوع الفرح' },
  regular: { en: 'Ordinary Time', ar: 'زمن عادي' },
};

export function getUpcomingSundayDate(from = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  return d;
}

const FEASTS: Array<{ month: number; day: number; key: string; en: string; ar: string }> = [
  { month: 1, day: 1, key: 'nayrouz', en: 'Nayrouz (New Year / Martyrs)', ar: 'النيروز (رأس السنة / عيد الشهداء)' },
  { month: 3, day: 16, key: 'assumption', en: 'Feast of the Assumption', ar: 'عيد صعود العذراء' },
  { month: 4, day: 29, key: 'nativity_paramoun', en: 'Paramoun of the Nativity', ar: 'برمون الميلاد' },
  { month: 5, day: 1, key: 'nativity', en: 'Feast of the Nativity', ar: 'عيد الميلاد' },
  { month: 5, day: 6, key: 'epiphany_paramoun', en: 'Paramoun of the Epiphany', ar: 'برمون الغطاس' },
  { month: 5, day: 11, key: 'epiphany', en: 'Feast of the Epiphany', ar: 'عيد الغطاس' },
  { month: 7, day: 25, key: 'annunciation', en: 'Feast of the Annunciation', ar: 'عيد البشارة' },
  { month: 11, day: 5, key: 'apostles_feast', en: 'Feast of Sts. Peter & Paul', ar: 'عيد الرسل' },
];

const FASTS: Array<{ month: number; from: number; to: number; key: string; en: string; ar: string }> = [
  { month: 3, from: 1, to: 15, key: 'theotokos_fast', en: 'Fast of the Theotokos', ar: 'صوم السيدة العذراء' },
  { month: 3, from: 16, to: 30, key: 'nativity_fast', en: 'Nativity Fast (Advent)', ar: 'صوم الميلاد' },
  { month: 4, from: 1, to: 28, key: 'nativity_fast', en: 'Nativity Fast (Advent)', ar: 'صوم الميلاد' },
  { month: 5, from: 21, to: 23, key: 'nineveh_fast', en: 'Fast of Nineveh', ar: 'صوم نينوى' },
  { month: 11, from: 1, to: 5, key: 'apostles_fast', en: 'Apostles\' Fast', ar: 'صوم الرسل' },
];

export function getFeastOrFast(month: number, day: number): { key: string; en: string; ar: string } | null {
  const feast = FEASTS.find(f => f.month === month && f.day === day);
  if (feast) return { key: feast.key, en: feast.en, ar: feast.ar };
  const fast = FASTS.find(f => f.month === month && day >= f.from && day <= f.to);
  if (fast) return { key: fast.key, en: fast.en, ar: fast.ar };
  return null;
}

export function getCopticDateLabel(coptic: { month: number; day: number; year: number }): { en: string; ar: string } {
  return {
    en: `${coptic.day} ${COPTIC_MONTHS[coptic.month] || ''} ${coptic.year}`.trim(),
    ar: `${coptic.day} ${COPTIC_MONTHS_AR[coptic.month] || ''} ${coptic.year}`.trim(),
  };
}

export function getCopticContext(date: Date): {
  coptic: { month: number; day: number; year: number; monthName: string; monthNameAr: string };
  season: CopticSeason;
  seasonLabel: { en: string; ar: string };
  feastFast: { key: string; en: string; ar: string } | null;
} {
  const jd = gregorianToJD(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const coptic = jdToCoptic(jd);
  const season = getCopticSeason(coptic.month, coptic.day);
  return {
    coptic: {
      month: coptic.month,
      day: coptic.day,
      year: coptic.year,
      monthName: COPTIC_MONTHS[coptic.month] || '',
      monthNameAr: COPTIC_MONTHS_AR[coptic.month] || '',
    },
    season,
    seasonLabel: SEASON_LABEL[season],
    feastFast: getFeastOrFast(coptic.month, coptic.day),
  };
}
```

- [ ] **Step 2: Write the util test**

Create `backend/src/common/utils/coptic-calendar.spec.ts`:

```ts
import {
  gregorianToJD, jdToCoptic, getCopticSeason, getCopticDateLabel,
  getFeastOrFast, getCopticContext, COPTIC_MONTHS, COPTIC_MONTHS_AR, SEASON_LABEL,
} from './coptic-calendar';

describe('coptic-calendar', () => {
  describe('jdToCoptic epoch', () => {
    it('maps 29 Aug 284 CE to 1 Thout, year 1 (epoch)', () => {
      const jd = gregorianToJD(284, 8, 29);
      expect(jdToCoptic(jd)).toEqual({ year: 1, month: 1, day: 1 });
    });
    it('maps 28 Oct 284 CE to 1 Hathor, year 1 (60 days after epoch)', () => {
      const jd = gregorianToJD(284, 10, 28);
      expect(jdToCoptic(jd)).toEqual({ year: 1, month: 3, day: 1 });
    });
  });

  describe('getCopticSeason', () => {
    it('returns kiahk for month 4', () => expect(getCopticSeason(4, 10)).toBe('kiahk'));
    it('returns nativity for Tobi 1-11', () => expect(getCopticSeason(5, 1)).toBe('nativity'));
    it('returns great_lent for months 7-8', () => expect(getCopticSeason(8, 3)).toBe('great_lent'));
    it('returns bright_week for Pashons 1-7', () => expect(getCopticSeason(9, 1)).toBe('bright_week'));
    it('returns regular otherwise', () => expect(getCopticSeason(2, 5)).toBe('regular'));
  });

  describe('getFeastOrFast', () => {
    it('nayrouz on Thout 1', () => expect(getFeastOrFast(1, 1)?.key).toBe('nayrouz'));
    it('exact-day feast (Assumption) wins over nativity_fast on Hathor 16', () =>
      expect(getFeastOrFast(3, 16)?.key).toBe('assumption'));
    it('nativity_fast spans Hathor 16-30 and Koiak 1-28', () => {
      expect(getFeastOrFast(3, 20)?.key).toBe('nativity_fast');
      expect(getFeastOrFast(4, 28)?.key).toBe('nativity_fast');
    });
    it('nativity_paramoun on Koiak 29', () => expect(getFeastOrFast(4, 29)?.key).toBe('nativity_paramoun'));
    it('nativity on Tobi 1', () => expect(getFeastOrFast(5, 1)?.key).toBe('nativity'));
    it('epiphany on Tobi 11', () => expect(getFeastOrFast(5, 11)?.key).toBe('epiphany'));
    it('nineveh_fast on Tobi 21-23', () => expect(getFeastOrFast(5, 22)?.key).toBe('nineveh_fast'));
    it('annunciation on Paremhat 25', () => expect(getFeastOrFast(7, 25)?.key).toBe('annunciation'));
    it('exact-day feast (Peter & Paul) wins over apostles_fast on Epip 5', () =>
      expect(getFeastOrFast(11, 5)?.key).toBe('apostles_feast'));
    it('apostles_fast on Epip 1-4', () => expect(getFeastOrFast(11, 3)?.key).toBe('apostles_fast'));
    it('returns null on an ordinary day', () => expect(getFeastOrFast(2, 5)).toBeNull());
  });

  describe('getCopticDateLabel', () => {
    it('formats en and ar labels', () => {
      const label = getCopticDateLabel({ month: 4, day: 5, year: 1742 });
      expect(label.en).toBe('5 Kiahk 1742');
      expect(label.ar).toBe('5 كيهك 1742');
    });
  });

  describe('getCopticContext', () => {
    it('returns coptic, season and feast/fast for a date', () => {
      // 29 Aug 284 = 1 Thout 1 AM = Nayrouz
      const ctx = getCopticContext(new Date(284, 7, 29));
      expect(ctx.coptic).toEqual({ month: 1, day: 1, year: 1, monthName: 'Thout', monthNameAr: 'توت' });
      expect(ctx.season).toBe('regular');
      expect(ctx.seasonLabel).toEqual(SEASON_LABEL.regular);
      expect(ctx.feastFast?.key).toBe('nayrouz');
    });
  });

  it('exposes month name arrays', () => {
    expect(COPTIC_MONTHS[4]).toBe('Kiahk');
    expect(COPTIC_MONTHS_AR[4]).toBe('كيهك');
  });
});
```

- [ ] **Step 3: Run the util test to verify it passes**

Run: `cd backend && npx jest src/common/utils/coptic-calendar.spec.ts`
Expected: PASS (all tests above; the util is created before the test run, so both exist).

- [ ] **Step 4: Refactor `hymn-learning.service.ts` to import the moved helpers**

In `backend/src/modules/curriculum/hymn-learning.service.ts`:
- Delete the local definitions at lines ~40-82: the `COPTIC_EPOCH_JD` const, the `GREGORIAN_EPOCH_JD` const, and the functions/arrays `gregorianToJD`, `jdToCoptic`, `COPTIC_MONTHS`, `getCopticSeason`, `getUpcomingSundayDate`.
- Add an import at the top of the file (after the existing imports):

```ts
import {
  COPTIC_MONTHS, gregorianToJD, jdToCoptic,
  getCopticSeason, getUpcomingSundayDate,
} from '../../common/utils/coptic-calendar';
```

- Verify the file's call sites (lines ~248-253 use `getUpcomingSundayDate`, `gregorianToJD`, `jdToCoptic`, `getCopticSeason`, `COPTIC_MONTHS`) now resolve via the import. Do not change those call sites.
- Note: `GREGORIAN_EPOCH_JD` was unused and is simply removed.

- [ ] **Step 5: Run hymn-learning + curriculum tests to verify no regression**

Run: `cd backend && npx jest src/modules/curriculum/hymn-learning.service.spec.ts src/modules/curriculum/curriculum.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/utils/coptic-calendar.ts backend/src/common/utils/coptic-calendar.spec.ts backend/src/modules/curriculum/hymn-learning.service.ts
git commit -m "feat(calendar): shared coptic-calendar util with season and feast/fast"
```

---

### Task 2: Extract `buildClassRoster` (behavior-preserving refactor)

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts`
- Test: `backend/src/modules/dashboard/dashboard.service.spec.ts`

**Interfaces:**
- Consumes: `resolveServantClass` (exists).
- Produces (Task 3 uses it):
  - `private async buildClassRoster(studentIds: string[], followUpLessonId: string | null, nextSessionWeekday: number | null): Promise<any[]>`
  - Returns the same roster array shape as `getClassOverview` currently returns.

- [ ] **Step 1: Extract the helper and make `getClassOverview` use it**

In `backend/src/modules/dashboard/dashboard.service.ts`, extract the entire roster block from `getClassOverview` (the `const roster: any[] = []; if (studentIds.length > 0) { ... } return ...roster` block, lines ~1004-1082) into a private method. Add the helper immediately below `getClassOverview`:

```ts
private async buildClassRoster(
  studentIds: string[],
  followUpLessonId: string | null,
  nextSessionWeekday: number | null,
): Promise<any[]> {
  const roster: any[] = [];
  if (studentIds.length === 0) return roster;

  const students = await this.prisma.student.findMany({
    where: { id: { in: studentIds }, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true,
      firstNameAr: true, lastNameAr: true, photoUrl: true,
    },
  });

  const records = await this.prisma.attendanceRecord.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: { recordedAt: 'desc' },
    select: {
      studentId: true, status: true, recordedAt: true,
      note: true, noteCategory: true, isPrivateNote: true,
    },
  });

  let progressByStudent: Record<string, any> = {};
  if (followUpLessonId) {
    const progresses = await this.prisma.lessonProgress.findMany({
      where: { lessonId: followUpLessonId, studentId: { in: studentIds } },
      select: { studentId: true, masteryStatus: true },
    });
    progressByStudent = Object.fromEntries(progresses.map(p => [p.studentId, p]));
  }

  const overdueIds = new Set(
    (await this.prisma.lessonProgress.findMany({
      where: { studentId: { in: studentIds }, nextReviewAt: { lt: new Date() } },
      select: { studentId: true },
    })).map(p => p.studentId),
  );

  const ungradedIds = new Set(
    (await this.prisma.assessmentSubmission.findMany({
      where: { studentId: { in: studentIds }, grades: { none: {} } },
      select: { studentId: true },
    })).map(s => s.studentId),
  );

  for (const student of students) {
    const sr = records.filter(r => r.studentId === student.id);
    const presentCount = sr.filter(r => r.status === 'present' || r.status === 'late').length;
    const attendanceRate = sr.length ? Math.round(presentCount / sr.length * 100) : 0;
    const lastStatus = sr[0]?.status ?? null;

    const lastTwo = sr.slice(0, 2);
    const lastTwoAbsent = lastTwo.length >= 2 && lastTwo.every(r => r.status === 'absent');
    const historicallyAbsentOnWeekday = nextSessionWeekday !== null
      && sr.filter(r => r.status === 'absent' && new Date(r.recordedAt).getDay() === nextSessionWeekday).length >= 2;
    const likelyAbsent = attendanceRate < 60 || lastTwoAbsent || historicallyAbsentOnWeekday;

    const reasons: string[] = [];
    if (overdueIds.has(student.id)) reasons.push('overdue_review');
    if (followUpLessonId) {
      const p = progressByStudent[student.id];
      if (p && (p.masteryStatus === 'not_started' || p.masteryStatus === 'introduced')) reasons.push('low_mastery');
    }
    if (sr.length >= 3 && sr.slice(0, 3).every(r => r.status === 'absent')) reasons.push('absent_3plus');
    if (ungradedIds.has(student.id)) reasons.push('ungraded_assessment');

    const notes = sr
      .filter(r => r.note)
      .slice(0, 5)
      .map(r => ({ category: r.noteCategory, note: r.note, isPrivate: r.isPrivateNote, createdAt: r.recordedAt }));

    roster.push({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      photoUrl: student.photoUrl,
      attendanceRate,
      lastAttendanceStatus: lastStatus,
      likelyAbsent,
      needsFollowUp: reasons.length > 0,
      followUpReasons: reasons,
      notes,
    });
  }

  roster.sort((a, b) => {
    const aFlag = a.likelyAbsent || a.needsFollowUp ? 0 : 1;
    const bFlag = b.likelyAbsent || b.needsFollowUp ? 0 : 1;
    if (aFlag !== bFlag) return aFlag - bFlag;
    return (a.lastName || '').localeCompare(b.lastName || '');
  });

  return roster;
}
```

Then in `getClassOverview`, replace the whole `const roster: any[] = []; if (studentIds.length > 0) { ... }` block with a single call, and drop the now-unused `records`/`students`/`progressByStudent`/`overdueIds`/`ungradedIds`/`nextWeekday` locals:

```ts
const nextWeekday = nextSession ? new Date(nextSession.scheduledDate).getDay() : null;
const roster = await this.buildClassRoster(studentIds, todayLesson ? todayLesson.lessonId : null, nextWeekday);
```

- [ ] **Step 2: Run the existing tests to verify no behavior change**

Run: `cd backend && npx jest dashboard.service.spec.ts`
Expected: PASS — the existing `getClassOverview`, `getMine`, `resolveServantClass`, and follow-up-token tests must all still pass unchanged. This is the behavior-preservation proof.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.service.ts
git commit -m "refactor(dashboard): extract shared buildClassRoster helper"
```

---

### Task 3: `getWeeklyBriefing` + `findNextUpcomingLesson` + endpoint

**Files:**
- Modify: `backend/src/modules/dashboard/dashboard.service.ts`
- Modify: `backend/src/modules/dashboard/dashboard.controller.ts`
- Test: `backend/src/modules/dashboard/dashboard.service.spec.ts`

**Interfaces:**
- Consumes: `resolveServantClass`, `buildClassRoster` (Task 2), `getCopticContext` (Task 1).
- Produces (Task 4 uses this exact response shape):
  - `GET /dashboard/weekly-briefing` returns:
    ```
    {
      generatedAt: Date,
      coptic: { coptic: {month, day, year, monthName, monthNameAr}, season, seasonLabel: {en, ar}, feastFast: {key, en, ar} | null },
      nextSession: { id, scheduledDate, levelId, levelName?, levelNumber?, groupId, groupName? } | null,
      nextLesson: { lessonId, title, titleAr?, titleCoptic?, levelId, levelName, levelNumber, subjectName, scheduledDate } | null,
      roster: [<buildClassRoster item>]
    }
    ```

- [ ] **Step 1: Write the failing tests**

In `backend/src/modules/dashboard/dashboard.service.spec.ts`, the existing `prismaMock` already has: `attendanceSession.{findMany,findFirst}`, `student.findMany`, `curriculumAllocation.findFirst`, `lessonProgress.findMany`, `assessmentSubmission.findMany`, `attendanceRecord.findMany`. Add `curriculumAllocation.findFirst` is present; no new mock keys are required for this task. Append a new describe block:

```ts
describe('getWeeklyBriefing', () => {
  function briefingBaseline() {
    (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue([{ groupId: 'g1', levelId: 'l1' }]);
    (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue(null);
  }

  it('returns coptic context, null lesson, null session, and empty roster', async () => {
    briefingBaseline();
    const result = await service.getWeeklyBriefing(user, schoolId);
    expect(result.coptic).toHaveProperty('season');
    expect(result.coptic).toHaveProperty('seasonLabel');
    expect(result.coptic).toHaveProperty('feastFast');
    expect(result.nextLesson).toBeNull();
    expect(result.nextSession).toBeNull();
    expect(result.roster).toEqual([]);
  });

  it('uses the nextSession date for coptic context and returns nextLesson + roster', async () => {
    briefingBaseline();
    (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
      id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'), levelId: 'l1',
      level: { id: 'l1', name: 'Level 3', number: 3 }, group: { id: 'g1', name: 'Group A' },
    });
    (prisma.curriculumAllocation.findFirst as jest.Mock).mockResolvedValue({
      lessonId: 'les1', scheduledDate: new Date('2026-08-23T00:00:00Z'),
      lesson: { id: 'les1', title: 'Kyrie', titleAr: null, titleCoptic: 'ⲕⲩⲣⲓⲉ' },
      level: { id: 'l1', name: 'Level 3', number: 3 },
      subject: { name: 'Tasbeha' },
    });
    (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
    const result = await service.getWeeklyBriefing(user, schoolId);
    expect(result.nextSession.groupName).toBe('Group A');
    expect(result.nextLesson.title).toBe('Kyrie');
    expect(result.nextLesson.subjectName).toBe('Tasbeha');
    expect(result.roster).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest dashboard.service.spec.ts -t "getWeeklyBriefing"`
Expected: FAIL — `service.getWeeklyBriefing is not a function`.

- [ ] **Step 3: Implement `findNextUpcomingLesson` and `getWeeklyBriefing`**

Add the import at the top of `dashboard.service.ts` (after existing imports):

```ts
import { getCopticContext } from '../../common/utils/coptic-calendar';
```

Add `findNextUpcomingLesson` and `getWeeklyBriefing` to `DashboardService` (below `buildClassRoster`):

```ts
private async findNextUpcomingLesson(levelIds: string[], schoolId: string) {
  if (levelIds.length === 0) return null;
  const alloc = await this.prisma.curriculumAllocation.findFirst({
    where: {
      academicYear: { schoolId },
      levelId: { in: levelIds },
      scheduledDate: { gte: new Date() },
    },
    orderBy: { scheduledDate: 'asc' },
    include: {
      lesson: { select: { id: true, title: true, titleAr: true, titleCoptic: true } },
      level: { select: { id: true, name: true, number: true } },
      subject: { select: { name: true } },
    },
  });
  if (!alloc) return null;
  return {
    lessonId: alloc.lessonId,
    title: alloc.lesson.title,
    titleAr: alloc.lesson.titleAr,
    titleCoptic: alloc.lesson.titleCoptic,
    levelId: alloc.levelId,
    levelName: alloc.level.name,
    levelNumber: alloc.level.number,
    subjectName: alloc.subject.name,
    scheduledDate: alloc.scheduledDate,
  };
}

async getWeeklyBriefing(user: any, schoolIdentifier: string): Promise<any> {
  const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
  const { levelIds, studentIds } = await this.resolveServantClass(user.id, schoolId);

  const nextSession = await this.prisma.attendanceSession.findFirst({
    where: { schoolId, servantId: user.id, status: 'scheduled', scheduledDate: { gte: new Date() } },
    orderBy: { scheduledDate: 'asc' },
    include: {
      level: { select: { id: true, name: true, number: true } },
      group: { select: { id: true, name: true } },
    },
  });

  const teachingDate = nextSession ? new Date(nextSession.scheduledDate) : new Date();
  const coptic = getCopticContext(teachingDate);
  const nextLesson = await this.findNextUpcomingLesson(levelIds, schoolId);
  const nextSessionWeekday = nextSession ? new Date(nextSession.scheduledDate).getDay() : null;
  const roster = await this.buildClassRoster(studentIds, nextLesson ? nextLesson.lessonId : null, nextSessionWeekday);

  return {
    generatedAt: new Date(),
    coptic,
    nextSession: nextSession ? {
      id: nextSession.id,
      scheduledDate: nextSession.scheduledDate,
      levelId: nextSession.levelId,
      levelName: nextSession.level?.name,
      levelNumber: nextSession.level?.number,
      groupId: nextSession.groupId,
      groupName: nextSession.group?.name,
    } : null,
    nextLesson,
    roster,
  };
}
```

- [ ] **Step 4: Add the controller endpoint**

In `backend/src/modules/dashboard/dashboard.controller.ts`, add after the `class-overview` endpoint:

```ts
@Get('weekly-briefing')
@ApiOperation({ summary: 'Get servant weekly briefing — coptic context, next lesson, follow-up roster' })
async getWeeklyBriefing(
  @CurrentUser() user: any,
  @Query('schoolId') schoolId: string = '',
) {
  return this.service.getWeeklyBriefing(user, schoolId);
}
```

- [ ] **Step 5: Run tests to verify**

Run: `cd backend && npx jest dashboard.service.spec.ts`
Expected: PASS — the 2 new `getWeeklyBriefing` tests plus all existing tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/dashboard/dashboard.service.ts backend/src/modules/dashboard/dashboard.controller.ts backend/src/modules/dashboard/dashboard.service.spec.ts
git commit -m "feat(dashboard): weekly-briefing endpoint with coptic context and next lesson"
```

---

### Task 4: Frontend nav item + briefing page + tests

**Files:**
- Modify: `frontend/src/components/dashboard-shell.tsx`
- Create: `frontend/src/app/dashboard/briefing/page.tsx`
- Test: `frontend/src/app/dashboard/briefing/__tests__/briefing.test.tsx`

**Interfaces:**
- Consumes: `GET /dashboard/weekly-briefing` returning the Task 3 response shape.
- Produces: the screen + nav.

- [ ] **Step 1: Write the failing frontend test**

Create `frontend/src/app/dashboard/briefing/__tests__/briefing.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import BriefingPage from '../page'

const mockGet = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard/briefing',
}))

jest.mock('@/lib/http-client', () => ({
  http: { get: (...args: any[]) => mockGet(...args) },
}))

jest.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

jest.mock('@/lib/asset-url', () => ({ assetUrl: (u?: string | null) => u ?? '' }))

describe('BriefingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockReset()
  })

  it('renders coptic banner, next session, next lesson, and follow-up checklist', async () => {
    mockGet.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 4, day: 5, year: 1742, monthName: 'Kiahk', monthNameAr: 'كيهك' },
        season: 'kiahk',
        seasonLabel: { en: 'Month of Kiahk', ar: 'شهر كيهك' },
        feastFast: { key: 'nativity_fast', en: 'Nativity Fast (Advent)', ar: 'صوم الميلاد' },
      },
      nextSession: {
        id: 'n1', scheduledDate: new Date('2026-08-23T00:00:00Z'),
        levelName: 'Level 3', groupName: 'Group A',
      },
      nextLesson: {
        lessonId: 'l1', title: 'Kyrie Eleison', titleCoptic: 'ⲕⲩⲣⲓⲉ',
        levelName: 'Level 3', subjectName: 'Tasbeha', scheduledDate: new Date().toISOString(),
      },
      roster: [
        { studentId: 's1', firstName: 'Mina', lastName: 'A', attendanceRate: 40, lastAttendanceStatus: 'absent', likelyAbsent: true, needsFollowUp: true, followUpReasons: ['absent_3plus'], notes: [{ note: 'Seems tired', isPrivate: true, createdAt: new Date().toISOString() }] },
      ],
    })
    render(<BriefingPage />)

    expect(await screen.findByText('5 Kiahk 1742')).toBeInTheDocument()
    expect(screen.getByText('Nativity Fast (Advent)')).toBeInTheDocument()
    expect(screen.getByText('Kyrie Eleison')).toBeInTheDocument()
    expect(screen.getByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Mina A')).toBeInTheDocument()
    expect(screen.getByText('Missed 3+')).toBeInTheDocument()
  })

  it('shows all-caught-up when nothing is flagged', async () => {
    mockGet.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 2, day: 5, year: 1742, monthName: 'Paopi', monthNameAr: 'بابه' },
        season: 'regular', seasonLabel: { en: 'Ordinary Time', ar: 'زمن عادي' }, feastFast: null,
      },
      nextSession: null,
      nextLesson: null,
      roster: [],
    })
    render(<BriefingPage />)
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText('No lesson scheduled yet')).toBeInTheDocument()
  })

  it('shows an error state and recovers on retry', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    render(<BriefingPage />)
    expect(await screen.findByText('Retry')).toBeInTheDocument()
    mockGet.mockResolvedValueOnce({
      generatedAt: new Date().toISOString(),
      coptic: {
        coptic: { month: 2, day: 5, year: 1742, monthName: 'Paopi', monthNameAr: 'بابه' },
        season: 'regular', seasonLabel: { en: 'Ordinary Time', ar: 'زمن عادي' }, feastFast: null,
      },
      nextSession: null,
      nextLesson: null,
      roster: [],
    })
    fireEvent.click(screen.getByText('Retry'))
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run briefing`
Expected: FAIL — page module not found.

- [ ] **Step 3: Implement the page**

Create `frontend/src/app/dashboard/briefing/page.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Sun, CalendarDays, BookOpen, AlertTriangle, User, ChevronDown, CheckCircle2 } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { assetUrl } from '@/lib/asset-url'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Note { category?: string; note?: string; isPrivate: boolean; createdAt: string }
interface RosterStudent {
  studentId: string; firstName: string; lastName: string
  firstNameAr?: string; lastNameAr?: string; photoUrl?: string
  attendanceRate: number; lastAttendanceStatus: string | null
  likelyAbsent: boolean; needsFollowUp: boolean; followUpReasons: string[]; notes: Note[]
}
interface WeeklyBriefing {
  generatedAt: string
  coptic: {
    coptic: { month: number; day: number; year: number; monthName: string; monthNameAr: string }
    season: string; seasonLabel: { en: string; ar: string }
    feastFast: { key: string; en: string; ar: string } | null
  }
  nextSession: {
    id: string; scheduledDate: string; levelId?: string; levelName?: string; levelNumber?: number; groupId?: string; groupName?: string
  } | null
  nextLesson: {
    lessonId: string; title: string; titleAr?: string; titleCoptic?: string
    levelName?: string; subjectName?: string; scheduledDate?: string
  } | null
  roster: RosterStudent[]
}

const REASON_LABEL: Record<string, { en: string; ar: string }> = {
  overdue_review: { en: 'Review due', ar: 'مراجعة مستحقة' },
  low_mastery: { en: 'New lesson', ar: 'درس جديد' },
  absent_3plus: { en: 'Missed 3+', ar: 'تغيب 3+' },
  ungraded_assessment: { en: 'To grade', ar: 'بانتظار التقييم' },
}

export default function BriefingPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [data, setData] = useState<WeeklyBriefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openStudent, setOpenStudent] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(false)
    setLoading(true)
    http.get<WeeklyBriefing>('/dashboard/weekly-briefing')
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6"><div className="h-6 w-40 bg-gray-200 rounded animate-pulse" /></div>
        <TableSkeleton rows={4} cols={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-gray-900">{t('Could not load your briefing.', 'تعذر تحميل الموجز.')}</p>
          <button type="button" onClick={load} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            {t('Retry', 'إعادة المحاولة')}
          </button>
        </div>
      </div>
    )
  }

  const flagged = (data?.roster ?? []).filter(s => s.likelyAbsent || s.needsFollowUp)
  const copticLabel = data?.coptic
    ? lang === 'ar'
      ? `${data.coptic.coptic.day} ${data.coptic.coptic.monthNameAr} ${data.coptic.coptic.year}`
      : `${data.coptic.coptic.day} ${data.coptic.coptic.monthName} ${data.coptic.coptic.year}`
    : ''

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <Sun className="h-6 w-6 text-gold-500" />
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('This Sunday', 'أحد الأسبوع')}</h1>
      </div>

      {data?.coptic && (
        <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <CalendarDays className="h-4 w-4 text-gold-600" />
            <span className="font-semibold">{copticLabel}</span>
            <span>·</span>
            <span>{lang === 'ar' ? data.coptic.seasonLabel.ar : data.coptic.seasonLabel.en}</span>
          </div>
          {data.coptic.feastFast && (
            <span className="mt-2 inline-block rounded-full bg-gold-600 px-3 py-1 text-xs font-semibold text-gray-950">
              {lang === 'ar' ? data.coptic.feastFast.ar : data.coptic.feastFast.en}
            </span>
          )}
        </div>
      )}

      {data?.nextSession && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('Next session', 'الجلسة القادمة')}</div>
            <div className="mt-1 text-sm text-gray-900">
              {data.nextSession.groupName} · {data.nextSession.levelName} ·{' '}
              {new Date(data.nextSession.scheduledDate).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>
          <Link
            href={`/dashboard/attendance?sessionId=${data.nextSession.id}&prefill=present`}
            className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gold-600"
          >
            {t('Start Class', 'ابدأ الفصل')}
          </Link>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <BookOpen className="h-4 w-4" />
          {t('Prepare this lesson', 'حضّر هذا الدرس')}
        </div>
        {data?.nextLesson ? (
          <>
            <h2 className="mt-2 text-lg font-bold text-gray-900">
              {lang === 'ar' ? data.nextLesson.titleAr || data.nextLesson.title : data.nextLesson.title}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {data.nextLesson.titleCoptic && <span className="coptic-text">{data.nextLesson.titleCoptic} · </span>}
              {data.nextLesson.subjectName} · {data.nextLesson.levelName}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">{t('No lesson scheduled yet.', 'لم يُجدول درس بعد.')}</p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {t('Follow up before Sunday', 'متابعة قبل الأحد')}
        </h3>
        <Link href="/dashboard/my-class" className="text-xs font-medium text-blue-700 hover:text-blue-800">
          {t('View full class →', 'عرض الفصل كاملاً →')}
        </Link>
      </div>

      {flagged.length === 0 ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            {t('All caught up', 'لا توجد متابعات')}
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {flagged.map(s => {
            const open = openStudent === s.studentId
            return (
              <div key={s.studentId} className="rounded-xl border border-amber-200 bg-white">
                <button type="button" onClick={() => setOpenStudent(open ? null : s.studentId)} className="flex w-full items-center gap-3 p-3 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-500">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(s.photoUrl)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {lang === 'ar' ? `${s.firstNameAr || s.firstName} ${s.lastNameAr || s.lastName}` : `${s.firstName} ${s.lastName}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {s.followUpReasons.map(r => (
                        <span key={r} className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                          {REASON_LABEL[r] ? (lang === 'ar' ? REASON_LABEL[r].ar : REASON_LABEL[r].en) : r}
                        </span>
                      ))}
                      {s.likelyAbsent && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">{t('Likely absent', 'غائب غالباً')}</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-3 py-3">
                    {s.notes.length > 0 ? (
                      <ul className="space-y-2">
                        {s.notes.map((n, i) => (
                          <li key={i} className={`rounded-lg p-2 text-sm ${n.isPrivate ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'text-gray-600'}`}>
                            {n.note}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400">{t('No notes.', 'لا توجد ملاحظات.')}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the nav item**

In `frontend/src/components/dashboard-shell.tsx`:
- Add `Sun` to the lucide import block.
- Add after the `My Class` item in `navigation`:
```ts
{ name: 'This Sunday', nameAr: 'أحد الأسبوع', href: '/dashboard/briefing', icon: Sun, perm: 'attendance:record' as const },
```

- [ ] **Step 5: Run tests to verify**

Run: `cd frontend && npx vitest run briefing`
Expected: PASS.

- [ ] **Step 6: Typecheck + full frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS. Then `npx next build` — Expected: succeeds, includes `/dashboard/briefing`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/dashboard/briefing/page.tsx frontend/src/app/dashboard/briefing/__tests__/briefing.test.tsx frontend/src/components/dashboard-shell.tsx
git commit -m "feat(dashboard): This Sunday briefing screen with coptic context and follow-up"
```

---

### Task 5: Final verification and push

**Files:**
- N/A (verification)

- [ ] **Step 1: Run backend specs**

Run: `cd backend && npx jest dashboard.service.spec.ts && npx jest src/common/utils/coptic-calendar.spec.ts && npx jest src/modules/curriculum/hymn-learning.service.spec.ts`
Expected: all PASS.

- [ ] **Step 2: Run full frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx vitest run && npx next build`
Expected: all pass; build includes `/dashboard/briefing`.

- [ ] **Step 3: Push (stage explicitly; do not commit the two unrelated untracked files)**

```bash
cd /Users/amir.adly/cohep-platform && git pull --rebase --autostash
git push origin main
```

---

## Self-Review

- **Spec coverage:** Coptic util + season/feast labels (Task 1) ✓; `buildClassRoster` extraction, behavior-preserved (Task 2) ✓; `findNextUpcomingLesson` + `getWeeklyBriefing` + endpoint with exact response shape (Task 3) ✓; nav + page + tests (Task 4) ✓; verification + push (Task 5) ✓. Coptic banner, next-session CTA, prepare-lesson card, follow-up checklist, empty/error states all present.
- **Type consistency:** `getCopticContext` return shape consistent between Task 1 and Task 3's `coptic` field; `buildClassRoster` signature consistent between Task 2 and Task 3; `nextLesson`/`nextSession` shapes match between Task 3 backend and Task 4 frontend interfaces; `REASON_LABEL` keys (`overdue_review`, `low_mastery`, `absent_3plus`, `ungraded_assessment`) match the backend tokens.
- **Placeholder scan:** all steps contain concrete code; no TBD/TODO.
- **Out of scope honored:** no new DB tables, no AI, no outreach persistence, no changes to `getServantDigest` or the main ministry dashboard.

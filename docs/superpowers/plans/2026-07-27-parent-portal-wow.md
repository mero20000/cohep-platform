# Parent Portal WOW Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement 4 WOW features (Practice Together, Family Liturgy Tracker, Progress in Coptic Terms, Spiritual Growth Story) for the COHEP parent portal.

**Architecture:** Monorepo with NestJS backend (Prisma/PostgreSQL) and Next.js 15 frontend. All 4 features share the same child detail page. Each is independently deployable.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL 15, Next.js 15, Tailwind CSS, jsPDF (already installed), framer-motion, lucide-react.

## Global Constraints

- All new models go into `backend/prisma/schema.prisma` with `@@map()` snake_case table names
- All new backend endpoints use `@UseGuards(JwtAuthGuard, RolesGuard)` with appropriate `@Roles()` decorator
- All parent endpoints: `@Roles('parent', 'admin')`
- All servant endpoints: `@Roles('servant', 'admin', ...STAFF_ROLES)`
- SystemConfig queries use pattern: `findUnique({ where: { schoolId_key: { schoolId, key } } })`
- XPTransaction created with `balanceAfter` computed via `aggregate({ _sum: { amount: true } })` inside `$transaction`
- Frontend API calls use `http` singleton from `@/lib/http-client`
- Frontend translations use `useLanguage()` hook + `t(en, ar)` inline helper
- All new tables must be created in a single Prisma migration `20260727200200_add_wow_features`
- Render `npx prisma migrate deploy && npm run seed && npm run start:prod` must continue to work

---

### Task 1: Prisma Schema + Migration + Seed Updates

**Files:**
- Modify: `backend/prisma/schema.prisma` (add FamilyPractice and FamilyLiturgy models before the AuditLog model block)
- Modify: `backend/prisma/seed.ts` (add Faithful Worshipper badge + SystemConfig defaults)
- Create: `backend/prisma/migrations/20260727200200_add_wow_features/` (via `prisma migrate dev`)

**Interfaces:**
- Produces: `FamilyPractice` table with `@@map("family_practices")`
- Produces: `FamilyLiturgy` table with `@@map("family_liturgies")`
- Produces: Seed badge "Faithful Worshipper" with criteria `{ "rule": "liturgy_total", "count": 10 }`
- Produces: SystemConfig `practice_xp_reward = 20`, `practice_weekly_limit = 3`, `liturgy_badge_threshold = 10`

- [ ] **Step 1: Add FamilyPractice model to schema.prisma**

Insert before `model AuditLog {` (around line 1069):

```prisma
model FamilyPractice {
  id              String   @id @default(uuid())
  studentId       String   @map("student_id")
  lessonId        String   @map("lesson_id")
  practicedAt     DateTime @default(now()) @map("practiced_at")
  durationMinutes Int?     @map("duration_minutes")
  source          String   @default("parent")

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson  @relation(fields: [lessonId], references: [id])

  @@index([studentId, practicedAt])
  @@map("family_practices")
}
```

- [ ] **Step 2: Add FamilyLiturgy model to schema.prisma**

Insert after the FamilyPractice model:

```prisma
model FamilyLiturgy {
  id         String    @id @default(uuid())
  studentId  String    @map("student_id")
  date       DateTime  @map("date")
  notedBy    String    @map("noted_by")
  verifiedBy String?   @map("verified_by")
  verifiedAt DateTime? @map("verified_at")
  status     String    @default("pending")
  notes      String?
  createdAt  DateTime  @default(now()) @map("created_at")

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, date])
  @@index([studentId, status])
  @@map("family_liturgies")
}
```

- [ ] **Step 3: Update seed.ts with Faithful Worshipper badge + SystemConfigs**

Find the seed section that creates badges (search for `Badge.create` or `badge`) and add:

```typescript
// Faithful Worshipper badge
await prisma.badge.upsert({
  where: { id: 'faithful-worshipper-default' },
  update: {},
  create: {
    id: 'faithful-worshipper-default',
    schoolId: school.id,
    name: 'Faithful Worshipper',
    nameAr: 'المُصَلّي الأمين',
    description: 'Attended 10 liturgy sessions verified by servants',
    descriptionAr: 'حضر 10 قداسات معتمدة من الخدام',
    iconUrl: '/uploads/badges/faithful-worshipper.png',
    category: 'liturgy',
    xpReward: 50,
    criteria: { rule: 'liturgy_total', count: 10 },
    isActive: true,
  },
});
```

Then add SystemConfig entries:

```typescript
const configs = [
  { key: 'practice_xp_reward', value: 20, description: 'XP earned per practice session' },
  { key: 'practice_weekly_limit', value: 3, description: 'Max practice sessions per week per child' },
  { key: 'liturgy_badge_threshold', value: 10, description: 'Verified liturgies needed for Faithful Worshipper badge' },
];
for (const cfg of configs) {
  await prisma.systemConfig.upsert({
    where: { schoolId_key: { schoolId: school.id, key: cfg.key } },
    update: { value: cfg.value },
    create: { schoolId: school.id, key: cfg.key, value: cfg.value, description: cfg.description },
  });
}
```

- [ ] **Step 4: Run migration**

```bash
cd /Users/amir.adly/niangelos-platform/backend && npx prisma migrate dev --name add_wow_features
```

Expected: Creates `20260727200200_add_wow_features` migration with `family_practices` and `family_liturgies` tables.

- [ ] **Step 5: Run seed**

```bash
cd /Users/amir.adly/niangelos-platform/backend && npx prisma db seed
```

Expected: Seed runs without errors, Faithful Worshipper badge + configs created.

---

### Task 2: Practice Together — Backend Endpoints

**Files:**
- Modify: `backend/src/modules/parents/parents.controller.ts` (add 3 endpoints)
- Modify: `backend/src/modules/parents/parents.service.ts` (add 3 methods)

**Interfaces:**
- Produces: `GET /parents/me/children/:id/current-lesson` → `{ lesson, sessions, subject, level }`
- Produces: `POST /parents/me/children/:id/practice` → `{ practiced, xpAwarded, weeklyCount, weeklyLimit }`
- Produces: `GET /parents/me/children/:id/practice-summary` → `{ weeklyCount, weeklyLimit, lastPracticedAt, totalPractices }`

- [ ] **Step 1: Add `getCurrentLesson` to ParentsService**

This finds the student's current lesson by looking at CurriculumAllocations for their level in the current academic year and term:

```typescript
async getCurrentLesson(studentId: string, userId: string) {
  await this.verifyParent(userId, studentId);
  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true, levelId: true, groupId: true, academicYearId: true },
  });
  if (!student) throw new NotFoundException('Student not found');

  // Find current academic year
  const academicYear = await this.prisma.academicYear.findFirst({
    where: { schoolId: student.schoolId, isCurrent: true },
  });
  if (!academicYear) return null;

  // Determine current term based on academic year dates
  const now = new Date();
  const yearStart = new Date(academicYear.startDate);
  const yearEnd = new Date(academicYear.endDate);
  const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
  const elapsed = (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
  const term = totalDays > 0 ? Math.min(Math.ceil((elapsed / totalDays) * 3), 3) : 1;

  // Find the current allocation (most recent by scheduledDate or orderIndex)
  const allocation = await this.prisma.curriculumAllocation.findFirst({
    where: {
      academicYearId: academicYear.id,
      levelId: student.levelId,
      term,
      scheduledDate: { lte: now },
      status: 'active',
    },
    include: {
      lesson: {
        include: {
          sessions: { orderBy: { orderIndex: 'asc' } },
          subject: { select: { name: true, nameAr: true } },
          level: { select: { number: true, name: true } },
        },
      },
      subject: { select: { name: true, nameAr: true } },
    },
    orderBy: { scheduledDate: 'desc' },
  });

  if (!allocation) return null;

  return {
    lesson: {
      id: allocation.lesson.id,
      title: allocation.lesson.title,
      titleAr: allocation.lesson.titleAr,
      titleCoptic: allocation.lesson.titleCoptic,
      description: allocation.lesson.description,
      descriptionAr: allocation.lesson.descriptionAr,
      requiredMemorization: allocation.lesson.requiredMemorization,
      requiredMemorizationAr: allocation.lesson.requiredMemorizationAr,
      sessions: allocation.lesson.sessions.map(s => ({
        id: s.id,
        title: s.title,
        titleAr: s.titleAr,
        orderIndex: s.orderIndex,
        contentEn: s.contentEn,
        contentAr: s.contentAr,
        contentCoptic: s.contentCoptic,
      })),
    },
    subject: { name: allocation.subject.name, nameAr: allocation.subject.nameAr },
    level: { number: allocation.lesson.level.number, name: allocation.lesson.level.name },
  };
}
```

- [ ] **Step 2: Add `logPractice` to ParentsService**

```typescript
async logPractice(studentId: string, lessonId: string, userId: string) {
  await this.verifyParent(userId, studentId);
  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true },
  });
  if (!student) throw new NotFoundException('Student not found');

  // Read config
  const [xpRewardCfg, weeklyLimitCfg] = await Promise.all([
    this.prisma.systemConfig.findUnique({
      where: { schoolId_key: { schoolId: student.schoolId, key: 'practice_xp_reward' } },
    }),
    this.prisma.systemConfig.findUnique({
      where: { schoolId_key: { schoolId: student.schoolId, key: 'practice_weekly_limit' } },
    }),
  ]);
  const xpReward = (xpRewardCfg?.value as number) ?? 20;
  const weeklyLimit = (weeklyLimitCfg?.value as number) ?? 3;

  // Count this week's practices
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weeklyCount = await this.prisma.familyPractice.count({
    where: { studentId, practicedAt: { gte: startOfWeek } },
  });

  if (weeklyCount >= weeklyLimit) {
    throw new HttpException(
      { error: 'Weekly limit reached', weeklyCount, weeklyLimit },
      429,
    );
  }

  // Create practice + XP transaction in a transaction
  const result = await this.prisma.$transaction(async (tx) => {
    const practice = await tx.familyPractice.create({
      data: { studentId, lessonId, source: 'parent' },
    });

    const xpAgg = await tx.xPTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });
    const currentBalance = xpAgg._sum.amount || 0;

    await tx.xPTransaction.create({
      data: {
        studentId,
        amount: xpReward,
        balanceAfter: currentBalance + xpReward,
        type: 'practice',
        referenceType: 'family_practice',
        referenceId: practice.id,
        description: 'Practiced lesson at home',
        createdBy: userId,
      },
    });

    return practice;
  });

  return { practiced: true, xpAwarded: xpReward, weeklyCount: weeklyCount + 1, weeklyLimit };
}
```

Add import for `HttpException, HttpStatus` at the top of the service (or add `HttpException` to existing `@nestjs/common` import).

- [ ] **Step 3: Add `getPracticeSummary` to ParentsService**

```typescript
async getPracticeSummary(studentId: string, userId: string) {
  await this.verifyParent(userId, studentId);
  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true },
  });
  if (!student) throw new NotFoundException('Student not found');

  const weeklyLimitCfg = await this.prisma.systemConfig.findUnique({
    where: { schoolId_key: { schoolId: student.schoolId, key: 'practice_weekly_limit' } },
  });
  const weeklyLimit = (weeklyLimitCfg?.value as number) ?? 3;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [weeklyCount, lastPractice, totalPractices] = await Promise.all([
    this.prisma.familyPractice.count({
      where: { studentId, practicedAt: { gte: startOfWeek } },
    }),
    this.prisma.familyPractice.findFirst({
      where: { studentId },
      orderBy: { practicedAt: 'desc' },
      select: { practicedAt: true },
    }),
    this.prisma.familyPractice.count({ where: { studentId } }),
  ]);

  return { weeklyCount, weeklyLimit, lastPracticedAt: lastPractice?.practicedAt || null, totalPractices };
}
```

- [ ] **Step 4: Add endpoints to ParentsController**

Add inside the `ParentsController` class, after the existing `getChildHome` endpoint:

```typescript
@Get('me/children/:id/current-lesson')
@Roles('parent', 'admin')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get the current lesson for practice together' })
async getCurrentLesson(@Param('id') id: string, @Req() req: any) {
  return this.parentsService.getCurrentLesson(id, req.user.id);
}

@Post('me/children/:id/practice')
@Roles('parent', 'admin')
@ApiBearerAuth()
@ApiOperation({ summary: 'Log a practice session and award XP' })
async logPractice(@Param('id') id: string, @Body('lessonId') lessonId: string, @Req() req: any) {
  return this.parentsService.logPractice(id, lessonId, req.user.id);
}

@Get('me/children/:id/practice-summary')
@Roles('parent', 'admin')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get practice summary for the week' })
async getPracticeSummary(@Param('id') id: string, @Req() req: any) {
  return this.parentsService.getPracticeSummary(id, req.user.id);
}
```

Add `Body` to the imports from `@nestjs/common` in the controller if not already there.

- [ ] **Step 5: Verify backend compiles**

```bash
cd /Users/amir.adly/niangelos-platform/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No TypeScript errors.

---

### Task 3: Practice Together — Frontend Component

**Files:**
- Modify: `frontend/src/app/portal/children/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /parents/me/children/${id}/current-lesson` (Task 2)
- Consumes: `POST /parents/me/children/${id}/practice` (Task 2)
- Consumes: `GET /parents/me/children/${id}/practice-summary` (Task 2)

- [ ] **Step 1: Add the Practice Together card to the child detail page**

Read the full file first. Then add these imports at the top:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Music, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
```

Add a `PracticeTogetherCard` component before the main page component (or after imports):

```typescript
function PracticeTogetherCard({ childId, language }: { childId: string; language: string }) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [lesson, setLesson] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [practicing, setPracticing] = useState(false);
  const [xpFeedback, setXpFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [lessonRes, summaryRes] = await Promise.all([
        http.get(`/parents/me/children/${childId}/current-lesson`),
        http.get(`/parents/me/children/${childId}/practice-summary`),
      ]);
      setLesson(lessonRes);
      setSummary(summaryRes);
    } catch { /* no current lesson */ }
    setLoading(false);
  }, [childId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePractice = async () => {
    if (!lesson || practicing) return;
    setPracticing(true);
    try {
      const res = await http.post(`/parents/me/children/${childId}/practice`, { lessonId: lesson.lesson.id });
      setXpFeedback(`+${res.xpAwarded} XP`);
      setSummary({ weeklyCount: res.weeklyCount, weeklyLimit: res.weeklyLimit, lastPracticedAt: new Date().toISOString(), totalPractices: (summary?.totalPractices || 0) + 1 });
      setTimeout(() => setXpFeedback(null), 3000);
    } catch (err: any) {
      if (err.status === 429) {
        setXpFeedback(t('Weekly limit reached!', 'تم الوصول للحد الأسبوعي!'));
        setTimeout(() => setXpFeedback(null), 3000);
      }
    }
    setPracticing(false);
  };

  if (loading) return null;
  if (!lesson) return null;

  const limitReached = summary && summary.weeklyCount >= summary.weeklyLimit;

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-lg text-gray-900">{t('Practice Together', 'تدرب معًا')}</h3>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        {t('Current Lesson:', 'الدرس الحالي:')} <span className="font-medium text-gray-900">{language === 'ar' ? (lesson.lesson.titleAr || lesson.lesson.title) : lesson.lesson.title}</span>
      </p>

      {lesson.lesson.sessions?.map((s: any) => (
        <details key={s.id} className="mb-2 group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 hover:text-indigo-600">
            <Music className="w-4 h-4 text-indigo-400" />
            {language === 'ar' ? (s.titleAr || s.title) : s.title}
          </summary>
          <div className="mt-2 ml-6 p-3 bg-white rounded-lg border border-gray-100 text-sm space-y-2">
            {s.contentCoptic && <p className="font-coptic text-lg text-gray-800" dir="ltr">{s.contentCoptic}</p>}
            {s.contentEn && <p className="text-gray-600">{s.contentEn}</p>}
            {s.contentAr && <p className="text-gray-600 text-right" dir="rtl">{s.contentAr}</p>}
            <div className="mt-2 h-12 bg-gray-50 rounded flex items-center justify-center text-xs text-gray-400">
              {t('Audio coming soon', 'التسجيل الصوتي قريبًا')} 🎧
            </div>
          </div>
        </details>
      ))}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handlePractice}
          disabled={limitReached || practicing}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all ${
            limitReached
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {practicing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {limitReached ? t('Weekly limit reached', 'تم الوصول للحد الأسبوعي') : t("We practiced together!", 'تدربنا معًا!')}
        </button>
        {xpFeedback && (
          <span className={`text-sm font-bold animate-pulse ${xpFeedback.includes('+') ? 'text-green-600' : 'text-amber-600'}`}>
            {xpFeedback}
          </span>
        )}
      </div>

      {summary && (
        <p className="mt-2 text-xs text-gray-500">
          {t('Practiced', 'تم التدرب')} {summary.weeklyCount}x {t('this week', 'هذا الأسبوع')}
          {summary.weeklyLimit > 0 && ` · ${t('Limit', 'الحد الأقصى')}: ${summary.weeklyLimit}`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render the PracticeTogetherCard on the child detail page**

Find the main page component function and add `<PracticeTogetherCard childId={id} language={language} />` above the tabs section (before the `<Tabs>` component).

The main component already has `id` from `useParams()` and `language` from `useLanguage()`. Insert the card with a conditional wrapper:

```typescript
{/* Practice Together */}
<PracticeTogetherCard childId={id} language={language} />
```

- [ ] **Step 3: Verify frontend compiles**

```bash
cd /Users/amir.adly/niangelos-platform/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No TypeScript errors.

---

### Task 4: Family Liturgy Tracker — Backend Endpoints

**Files:**
- Modify: `backend/src/modules/parents/parents.controller.ts` (add 2 liturgy endpoints)
- Modify: `backend/src/modules/parents/parents.service.ts` (add 2 liturgy methods)
- Create: `backend/src/modules/servants/servants.module.ts`
- Create: `backend/src/modules/servants/servants.controller.ts`
- Create: `backend/src/modules/servants/servants.service.ts`
- Modify: `backend/src/app.module.ts` (import ServantsModule)

**Interfaces:**
- Produces: `POST /parents/me/children/:id/liturgy` → `{ id, status: 'pending', date }`
- Produces: `GET /parents/me/children/:id/liturgy` → `[{ id, date, status, notes, verifiedAt, createdAt }]`
- Produces: `GET /servants/liturgy-pending` → `[{ id, student, parent, date, notes, createdAt }]`
- Produces: `PATCH /servants/liturgy/:id/verify` → `{ id, status: 'verified', badgeAwarded: boolean }`
- Produces: `DELETE /servants/liturgy/:id` → `{ deleted: true }`

- [ ] **Step 1: Add liturgy methods to ParentsService**

Add to `parents.service.ts`:

```typescript
async logLiturgy(studentId: string, date: string, notes: string | undefined, userId: string) {
  await this.verifyParent(userId, studentId);
  const liturgyDate = new Date(date);
  liturgyDate.setHours(0, 0, 0, 0);

  const existing = await this.prisma.familyLiturgy.findUnique({
    where: { studentId_date: { studentId, date: liturgyDate } },
  });
  if (existing) {
    throw new HttpException({ error: 'Liturgy already logged for this date' }, 409);
  }

  const record = await this.prisma.familyLiturgy.create({
    data: { studentId, date: liturgyDate, notedBy: userId, notes, status: 'pending' },
  });

  return { id: record.id, status: record.status, date: record.date };
}

async getLiturgyRecords(studentId: string, userId: string) {
  await this.verifyParent(userId, studentId);
  const records = await this.prisma.familyLiturgy.findMany({
    where: { studentId },
    orderBy: { date: 'desc' },
    take: 30,
  });
  return records.map(r => ({
    id: r.id,
    date: r.date,
    status: r.status,
    notes: r.notes,
    verifiedAt: r.verifiedAt,
    createdAt: r.createdAt,
  }));
}
```

- [ ] **Step 2: Add liturgy endpoints to ParentsController**

After the practice endpoints:

```typescript
@Post('me/children/:id/liturgy')
@Roles('parent', 'admin')
@ApiBearerAuth()
@ApiOperation({ summary: 'Log a liturgy attendance' })
async logLiturgy(
  @Param('id') id: string,
  @Body('date') date: string,
  @Body('notes') notes: string | undefined,
  @Req() req: any,
) {
  return this.parentsService.logLiturgy(id, date, notes, req.user.id);
}

@Get('me/children/:id/liturgy')
@Roles('parent', 'admin')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get liturgy records for a child' })
async getLiturgyRecords(@Param('id') id: string, @Req() req: any) {
  return this.parentsService.getLiturgyRecords(id, req.user.id);
}
```

- [ ] **Step 3: Create ServantsModule**

`backend/src/modules/servants/servants.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ServantsController } from './servants.controller';
import { ServantsService } from './servants.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [DatabaseModule, GamificationModule],
  controllers: [ServantsController],
  providers: [ServantsService],
  exports: [ServantsService],
})
export class ServantsModule {}
```

- [ ] **Step 4: Create ServantsService**

`backend/src/modules/servants/servants.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class ServantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async getPendingLiturgies(userId: string) {
    const servant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (!servant) throw new NotFoundException('User not found');

    const records = await this.prisma.familyLiturgy.findMany({
      where: { status: 'pending', student: { schoolId: servant.schoolId } },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });

    const userIds = [...new Set(records.map(r => r.notedBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return records.map(r => ({
      id: r.id,
      student: r.student,
      parent: userMap.get(r.notedBy) || null,
      date: r.date,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  }

  async verifyLiturgy(id: string, userId: string) {
    const record = await this.prisma.familyLiturgy.findUnique({
      where: { id },
      include: { student: { select: { schoolId: true } } },
    });
    if (!record) throw new NotFoundException('Liturgy record not found');

    const servant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (record.student.schoolId !== servant?.schoolId) {
      throw new ForbiddenException('Cannot verify liturgy from another school');
    }

    const updated = await this.prisma.familyLiturgy.update({
      where: { id },
      data: { status: 'verified', verifiedBy: userId, verifiedAt: new Date() },
    });

    let badgeAwarded = false;
    const thresholdCfg = await this.prisma.systemConfig.findUnique({
      where: { schoolId_key: { schoolId: record.student.schoolId, key: 'liturgy_badge_threshold' } },
    });
    const threshold = (thresholdCfg?.value as number) ?? 10;

    const verifiedCount = await this.prisma.familyLiturgy.count({
      where: { studentId: record.studentId, status: 'verified' },
    });

    if (verifiedCount >= threshold) {
      const badge = await this.prisma.badge.findFirst({
        where: {
          schoolId: record.student.schoolId,
          criteria: { path: ['rule'], equals: 'liturgy_total' },
        },
      });
      if (badge) {
        try {
          await this.gamification.awardBadge(record.studentId, badge.id);
          badgeAwarded = true;
        } catch {
          // Badge may already be awarded
        }
      }
    }

    return { id: updated.id, status: updated.status, badgeAwarded };
  }

  async rejectLiturgy(id: string, userId: string) {
    const record = await this.prisma.familyLiturgy.findUnique({
      where: { id },
      include: { student: { select: { schoolId: true } } },
    });
    if (!record) throw new NotFoundException('Liturgy record not found');

    const servant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (record.student.schoolId !== servant?.schoolId) {
      throw new ForbiddenException('Cannot reject liturgy from another school');
    }

    await this.prisma.familyLiturgy.delete({ where: { id } });
    return { deleted: true };
  }
}
```

- [ ] **Step 5: Create ServantsController**

`backend/src/modules/servants/servants.controller.ts`:

```typescript
import { Controller, Get, Patch, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ServantsService } from './servants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';

@ApiTags('servants')
@Controller('servants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServantsController {
  constructor(private readonly servantsService: ServantsService) {}

  @Get('liturgy-pending')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pending liturgy verifications' })
  async getPendingLiturgies(@Req() req: any) {
    return this.servantsService.getPendingLiturgies(req.user.id);
  }

  @Patch('liturgy/:id/verify')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a liturgy record' })
  async verifyLiturgy(@Param('id') id: string, @Req() req: any) {
    return this.servantsService.verifyLiturgy(id, req.user.id);
  }

  @Delete('liturgy/:id')
  @Roles(...STAFF_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject/delete a liturgy record' })
  async rejectLiturgy(@Param('id') id: string, @Req() req: any) {
    return this.servantsService.rejectLiturgy(id, req.user.id);
  }
}
```

- [ ] **Step 6: Register ServantsModule in app.module.ts**

```typescript
import { ServantsModule } from './modules/servants/servants.module';
```

Add `ServantsModule` to the `imports` array in the `@Module()` decorator.

- [ ] **Step 7: Verify backend compiles**

```bash
cd /Users/amir.adly/niangelos-platform/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No TypeScript errors.

---

### Task 6: Progress in Coptic Terms — Milestones

**Files:**
- Modify: `backend/src/modules/parents/parents.controller.ts` (add milestones endpoint)
- Modify: `backend/src/modules/parents/parents.service.ts` (add milestones method)
- Modify: `frontend/src/app/portal/children/[id]/page.tsx` (add milestones section)

**Interfaces:**
- Produces: `GET /parents/me/children/:id/milestones` → `{ milestones: [{ text, textAr, completedAt, category }] }`
- Consumes: milestones endpoint from frontend

- [ ] **Step 1: Add `getMilestones` to ParentsService**

```typescript
async getMilestones(studentId: string, userId: string) {
  await this.verifyParent(userId, studentId);

  const [lessonProgress, liturgyRecords, badges] = await Promise.all([
    this.prisma.lessonProgress.findMany({
      where: { studentId, status: 'completed' },
      include: {
        lesson: { select: { title: true, titleAr: true } },
      },
      orderBy: { completedAt: 'desc' },
    }),
    this.prisma.familyLiturgy.findMany({
      where: { studentId, status: 'verified' },
      select: { date: true },
      orderBy: { date: 'desc' },
    }),
    this.prisma.studentBadge.findMany({
      where: { studentId },
      include: { badge: { select: { name: true, nameAr: true, category: true } } },
      orderBy: { awardedAt: 'desc' },
    }),
  ]);

  const milestones: any[] = [];

  for (const lp of lessonProgress) {
    milestones.push({
      text: `Can sing ${lp.lesson.title}`,
      textAr: `${lp.lesson.titleAr || lp.lesson.title}`,
      completedAt: lp.completedAt?.toISOString() || null,
      category: 'hymn',
    });
  }

  if (liturgyRecords.length > 0) {
    milestones.push({
      text: `Has attended ${liturgyRecords.length} liturgy sessions`,
      textAr: `حضر ${liturgyRecords.length} قداسًا`,
      completedAt: liturgyRecords[0]?.date?.toISOString() || null,
      category: 'liturgy',
    });
  }

  for (const sb of badges) {
    milestones.push({
      text: `Earned the ${sb.badge.name} badge`,
      textAr: `حصل على شارة ${sb.badge.nameAr || sb.badge.name}`,
      completedAt: sb.awardedAt.toISOString(),
      category: sb.badge.category,
    });
  }

  return { milestones };
}
```

- [ ] **Step 2: Add milestones endpoint to ParentsController**

```typescript
@Get('me/children/:id/milestones')
@Roles('parent', 'admin')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get spiritual milestones for a child' })
async getMilestones(@Param('id') id: string, @Req() req: any) {
  return this.parentsService.getMilestones(id, req.user.id);
}
```

- [ ] **Step 3: Add MilestonesSection to child detail page**

Add a new component:

```typescript
function MilestonesSection({ childId, language }: { childId: string; language: string }) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http.get(`/parents/me/children/${childId}/milestones`)
      .then(res => setMilestones(res?.milestones || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) return <div className="h-20 bg-gray-50 rounded-xl animate-pulse mb-6" />;

  return (
    <div className="rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Sprout className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-lg text-gray-900">{t('Spiritual Milestones', 'المراحل الروحية')}</h3>
      </div>

      {milestones.length === 0 ? (
        <p className="text-sm text-gray-500">{t('No milestones yet', 'لا توجد مراحل بعد')}</p>
      ) : (
        <div className="space-y-3">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                m.completedAt ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                {m.completedAt ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">{language === 'ar' ? (m.textAr || m.text) : m.text}</p>
                {m.completedAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('Completed', 'أكتمل')} {new Date(m.completedAt).toLocaleDateString()}
                  </p>
                )}
                {!m.completedAt && (
                  <p className="text-xs text-gray-400 mt-0.5">{t('In progress', 'قيد التنفيذ')}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Add these to imports: `import { Sprout, Check, Clock } from 'lucide-react';`

Then render `<MilestonesSection childId={id} language={language} />` on the page.

- [ ] **Step 4: Verify both backend and frontend compile**

```bash
cd /Users/amir.adly/niangelos-platform/backend && npx tsc --noEmit 2>&1 | head -10
cd /Users/amir.adly/niangelos-platform/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No TypeScript errors in either.

---

### Task 7: Spiritual Growth Story — Term Report PDF

**Files:**
- Modify: `backend/src/modules/parents/parents.controller.ts` (add term-report endpoint)
- Modify: `backend/src/modules/parents/parents.service.ts` (add term-report method)
- Modify: `frontend/src/app/portal/children/[id]/page.tsx` (add Term Report button + preview modal)
- Install: `html2pdf.js` in frontend

**Interfaces:**
- Produces: `GET /parents/me/children/:id/term-report?term=1&academicYearId=xxx` → `{ child, term, academicYear, hymnsLearned, feastsAttended, badges, servantNote, totalXP, attendanceRate, practiceCount }`
- Consumes: term-report endpoint from frontend

- [ ] **Step 1: Add `getTermReport` to ParentsService**

```typescript
async getTermReport(studentId: string, term: number, academicYearId: string | undefined, userId: string) {
  await this.verifyParent(userId, studentId);

  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    include: {
      level: { select: { number: true, name: true } },
      group: { select: { name: true } },
      xpTransactions: { select: { amount: true } },
    },
  });
  if (!student) throw new NotFoundException('Student not found');

  // Resolve academic year
  let yearId = academicYearId;
  if (!yearId) {
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: student.schoolId, isCurrent: true },
    });
    yearId = currentYear?.id;
  }
  const academicYear = yearId
    ? await this.prisma.academicYear.findUnique({ where: { id: yearId }, select: { name: true } })
    : null;

  // Completed lessons (hymns learned)
  const lessonProgress = await this.prisma.lessonProgress.findMany({
    where: { studentId, status: 'completed' },
    include: { lesson: { select: { title: true, titleAr: true } } },
    orderBy: { completedAt: 'desc' },
  });

  // Feast attendances — liturgy records that coincide with feast dates
  // For now, show all verified liturgies
  const liturgyRecords = await this.prisma.familyLiturgy.findMany({
    where: { studentId, status: 'verified' },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  // Badges
  const badges = await this.prisma.studentBadge.findMany({
    where: { studentId },
    include: { badge: { select: { name: true, nameAr: true, iconUrl: true } } },
    orderBy: { awardedAt: 'desc' },
  });

  // Practice count
  const practiceCount = await this.prisma.familyPractice.count({ where: { studentId } });

  // Attendance stats
  const attRecords = await this.prisma.attendanceRecord.findMany({
    where: { studentId },
    select: { status: true },
  });
  const total = attRecords.length;
  const present = attRecords.filter(r => r.status === 'present').length;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  // XP total
  const totalXP = student.xpTransactions.reduce((sum, t) => sum + t.amount, 0);

  return {
    child: {
      firstName: student.firstName,
      lastName: student.lastName,
      firstNameAr: student.firstNameAr,
      lastNameAr: student.lastNameAr,
      level: student.level?.name || '',
      group: student.group?.name || '',
    },
    term,
    academicYear: academicYear?.name || `Term ${term}`,
    hymnsLearned: lessonProgress.map(lp => ({
      name: lp.lesson.title,
      nameAr: lp.lesson.titleAr || lp.lesson.title,
      completedAt: lp.completedAt,
    })),
    feastsAttended: liturgyRecords.map(r => ({ date: r.date })),
    badges: badges.map(sb => ({
      name: sb.badge.name,
      nameAr: sb.badge.nameAr || sb.badge.name,
      iconUrl: sb.badge.iconUrl,
    })),
    servantNote: null, // Placeholder — servant notes feature TBD
    totalXP,
    attendanceRate,
    practiceCount,
  };
}
```

- [ ] **Step 2: Add term-report endpoint to ParentsController**

```typescript
@Get('me/children/:id/term-report')
@Roles('parent', 'admin')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get term report data for spiritual growth story PDF' })
async getTermReport(
  @Param('id') id: string,
  @Query('term') term: string,
  @Query('academicYearId') academicYearId: string | undefined,
  @Req() req: any,
) {
  return this.parentsService.getTermReport(id, parseInt(term) || 1, academicYearId, req.user.id);
}
```

Add `Query` to the `@nestjs/common` import.

- [ ] **Step 3: Install html2pdf.js in frontend**

```bash
cd /Users/amir.adly/niangelos-platform/frontend && npm install html2pdf.js
```

jsPDF is already installed, but `html2pdf.js` wraps jsPDF + html2canvas for HTML-to-PDF conversion.

- [ ] **Step 4: Add Term Report modal + button to child detail page**

Add a `TermReportModal` component:

```typescript
function TermReportModal({ childId, language, onClose }: { childId: string; language: string; onClose: () => void }) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    http.get(`/parents/me/children/${childId}/term-report?term=1`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `spiritual-growth-report-${childId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
      }).from(reportRef.current).save();
    } catch { /* fallback */ }
    setGenerating(false);
  };

  if (loading) return <Modal><div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div></Modal>;

  if (!data) return null;

  return (
    <Modal onClose={onClose}>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('Spiritual Growth Report', 'تقرير النمو الروحي')}</h2>
          <button onClick={handleDownload} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {t('Download PDF', 'تحميل PDF')}
          </button>
        </div>

        <div ref={reportRef} className="bg-[#FFF8F0] p-8 rounded-xl border border-gray-200" style={{ fontFamily: 'Georgia, serif' }}>
          {/* Header */}
          <div className="text-center mb-6 pb-4 border-b-2 border-[#C9A84C]">
            <p className="text-2xl mb-1">☦</p>
            <h1 className="text-2xl font-bold text-[#1E3A5F]">COHEP</h1>
            <p className="text-sm text-[#1E3A5F]">{t('Spiritual Growth Report', 'تقرير النمو الروحي')}</p>
            <p className="text-xs text-gray-500 mt-1">{data.child.firstName} {data.child.lastName} · {data.child.level} · {data.academicYear}</p>
          </div>

          {/* Hymns Learned */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-2">{t('Hymns Learned', 'التراتيل المُتعلَّمة')}</h3>
            {data.hymnsLearned.map((h: any, i: number) => (
              <p key={i} className="text-sm text-gray-700">☦ {language === 'ar' ? (h.nameAr || h.name) : h.name} <span className="text-xs text-gray-400">— {new Date(h.completedAt).toLocaleDateString()}</span></p>
            ))}
            {data.hymnsLearned.length === 0 && <p className="text-xs text-gray-400 italic">{t('No hymns completed yet', 'لم يتم تعلم تراتيل بعد')}</p>}
          </div>

          {/* Feasts Attended */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-2">{t('Liturgies Attended', 'القداسات التي تم حضورها')}</h3>
            {data.feastsAttended.length > 0 ? (
              <p className="text-sm text-gray-700">{data.feastsAttended.length} {t('verified liturgies', 'قداس معتمد')}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">{t('No liturgies recorded', 'لم يتم تسجيل قداسات')}</p>
            )}
          </div>

          {/* Badges */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#1E3A5F] uppercase tracking-wider mb-2">{t('Badges Earned', 'الشارات التي تم الحصول عليها')}</h3>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((b: any, i: number) => (
                <span key={i} className="text-xs bg-[#C9A84C]/10 text-[#C9A84C] px-2 py-1 rounded-full">{language === 'ar' ? (b.nameAr || b.name) : b.name}</span>
              ))}
              {data.badges.length === 0 && <p className="text-xs text-gray-400 italic">{t('No badges earned yet', 'لم يتم الحصول على شارات بعد')}</p>}
            </div>
          </div>

          {/* Servant Note */}
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-100 italic">
            <p className="text-xs text-gray-500">{data.servantNote || t('(Servant note will appear here)', '(ستظهر ملاحظة الخادم هنا)')}</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-center pt-4 border-t border-gray-200">
            <div>
              <p className="text-lg font-bold text-[#1E3A5F]">{data.totalXP}</p>
              <p className="text-xs text-gray-500">{t('Total XP', 'إجمالي XP')}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#1E3A5F]">{data.attendanceRate}%</p>
              <p className="text-xs text-gray-500">{t('Attendance', 'الحضور')}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#1E3A5F]">{data.practiceCount}</p>
              <p className="text-xs text-gray-500">{t('Practices', 'تمارين')}</p>
            </div>
          </div>

          <div className="mt-4 text-center text-[8px] text-gray-400">
            {t('Generated by COHEP — Coptic Orthodox Hymn Education Platform', 'تم الإنشاء بواسطة COHEP — منصة التربية الروحية القبطية الأرثوذكسية')}
          </div>
        </div>
      </div>
    </Modal>
  );
}
```

Add imports: `import { FileDown } from 'lucide-react';` and `import { useRef } from 'react';`.

- [ ] **Step 5: Add "Term Report" button to the child detail page**

Find the header area of the child detail page and add a button:

```typescript
<button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
  <FileDown className="w-4 h-4" />
  {t('Term Report', 'تقرير الفصل')}
</button>
```

Add state: `const [showReport, setShowReport] = useState(false);` in the main component.

And render the modal conditionally: `{showReport && <TermReportModal childId={id} language={language} onClose={() => setShowReport(false)} />}`

Also import the Modal component: `import { Modal } from '@/components/ui/modal';` (check the actual import path for Modal).

- [ ] **Step 6: Verify both backend and frontend compile**

```bash
cd /Users/amir.adly/niangelos-platform/backend && npx tsc --noEmit 2>&1 | head -10
cd /Users/amir.adly/niangelos-platform/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No TypeScript errors.
- Consumes: `POST /parents/me/children/${id}/liturgy` (Task 4)
- Consumes: `GET /parents/me/children/${id}/liturgy` (Task 4)
- Consumes: `GET /servants/liturgy-pending` (Task 4)
- Consumes: `PATCH /servants/liturgy/${id}/verify` (Task 4)
- Consumes: `DELETE /servants/liturgy/${id}` (Task 4)

- [ ] **Step 1: Add imports and LiturgySection component to child detail page**

Add to the existing imports in `frontend/src/app/portal/children/[id]/page.tsx`:
```typescript
import { Church, Plus, Loader2 } from 'lucide-react';
```

Add the `LiturgySection` component before the page's main component function:

```typescript
function LiturgySection({ childId, language }: { childId: string; language: string }) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await http.get(`/parents/me/children/${childId}/liturgy`);
      setRecords(res || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [childId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleLogLiturgy = async () => {
    setLogging(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await http.post(`/parents/me/children/${childId}/liturgy`, { date: today });
      setFeedback(t('Logged! Awaiting verification.', 'تم التسجيل! في انتظار التحقق.'));
      fetchRecords();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      if (err.status === 409) {
        setFeedback(t('Already logged for today', 'تم التسجيل مسبقًا لهذا اليوم'));
      } else {
        setFeedback(t('Error logging liturgy', 'حدث خطأ في التسجيل'));
      }
      setTimeout(() => setFeedback(null), 3000);
    }
    setLogging(false);
  };

  const verifiedCount = records.filter(r => r.status === 'verified').length;
  const threshold = 10;

  return (
    <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Church className="w-5 h-5 text-amber-700" />
        <h3 className="font-semibold text-lg text-gray-900">{t('Liturgy Attendance', 'حضور القداسات')}</h3>
      </div>

      <button
        onClick={handleLogLiturgy}
        disabled={logging}
        className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all mb-4"
      >
        {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {t('Attended Divine Liturgy today', 'حضر القداس اليوم')}
      </button>

      {feedback && (
        <p className="text-sm font-medium text-amber-700 mb-3 animate-pulse">{feedback}</p>
      )}

      <p className="text-xs text-gray-500 mb-3">
        {verifiedCount} {t('verified liturgies', 'قداس معتمد')}
        {verifiedCount < threshold && ` — ${threshold - verifiedCount} ${t('more for Faithful Worshipper badge', 'متبقي لشارة المُصلّي الأمين')}`}
      </p>

      {!loading && records.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
              <span className="text-sm text-gray-700">{new Date(r.date).toLocaleDateString()}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                r.status === 'verified' ? 'bg-green-100 text-green-700' :
                r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {r.status === 'verified' ? t('Verified', 'معتمد') :
                 r.status === 'rejected' ? t('Rejected', 'مرفوض') :
                 t('Pending', 'قيد الانتظار')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Also add `useState, useEffect, useCallback` to the React import if not already present.

- [ ] **Step 2: Render LiturgySection on child detail page**

Find the main component's return statement and add `<LiturgySection childId={id} language={language} />` after the PracticeTogetherCard or before the tabs.

- [ ] **Step 3: Create servant liturgy verification page**

`frontend/src/app/dashboard/liturgy/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { http } from '@/lib/http-client';
import { useLanguage } from '@/lib/use-language';
import { Church, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface PendingLiturgy {
  id: string;
  student: { id: string; firstName: string; lastName: string; firstNameAr: string; lastNameAr: string };
  parent: { id: string; firstName: string; lastName: string } | null;
  date: string;
  notes: string | null;
  createdAt: string;
}

export default function LiturgyVerificationPage() {
  const { language } = useLanguage();
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;
  const [records, setRecords] = useState<PendingLiturgy[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await http.get('/servants/liturgy-pending');
      setRecords(res || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleVerify = async (id: string) => {
    try {
      const res = await http.patch(`/servants/liturgy/${id}/verify`);
      setRecords(prev => prev.filter(r => r.id !== id));
      const msg = res.badgeAwarded
        ? t('Verified! Faithful Worshipper badge awarded!', 'تم التحقق! تم منح شارة المُصَلّي الأمين!')
        : t('Verified!', 'تم التحقق!');
      setActionFeedback(msg);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback(t('Error verifying', 'خطأ في التحقق'));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await http.delete(`/servants/liturgy/${id}`);
      setRecords(prev => prev.filter(r => r.id !== id));
      setActionFeedback(t('Rejected', 'تم الرفض'));
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback(t('Error rejecting', 'خطأ في الرفض'));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Church className="w-6 h-6 text-amber-700" />
        <h1 className="text-2xl font-bold text-gray-900">{t('Liturgy Verification', 'التحقق من القداسات')}</h1>
      </div>

      {actionFeedback && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium animate-pulse">{actionFeedback}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('No pending liturgy verifications', 'لا توجد طلبات تحقق معلقة')}</div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">
                  {language === 'ar' ? `${r.student.firstNameAr} ${r.student.lastNameAr}` : `${r.student.firstName} ${r.student.lastName}`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t('Reported by', 'تم الإبلاغ بواسطة')}: {r.parent ? `${r.parent.firstName} ${r.parent.lastName}` : '-'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(r.date).toLocaleDateString()}
                  {r.notes && ` · ${r.notes}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleVerify(r.id)} className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title={t('Verify', 'تحقق')}>
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button onClick={() => handleReject(r.id)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title={t('Reject', 'رفض')}>
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Liturgy Verification link to the sidebar**

Read `frontend/src/components/dashboard/sidebar.tsx` and find the nav links section. Add a Liturgy Verification nav item using the existing `NavItem` pattern, importing `Church` from `lucide-react`.

- [ ] **Step 5: Verify frontend compiles**

```bash
cd /Users/amir.adly/niangelos-platform/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No TypeScript errors.

---


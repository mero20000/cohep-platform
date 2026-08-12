# Servant Recognition & Formation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build servant recognition features — a dashboard card, private ministry timeline, and background job that detects milestones.

**Architecture:** Cached stats in `ServantProfile` updated nightly by a cron job. Permanent milestone log in `ServantMilestone`. Backend endpoints serve profile and timeline data. Frontend dashboard card and profile page render the ministry journey.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js, Tailwind CSS, shadcn/ui, `@nestjs/schedule`

## Global Constraints

- Backend: NestJS 10, Prisma 5, PostgreSQL 16
- Frontend: Next.js 14/15 (App Router), shadcn/ui, Tailwind CSS
- Auth: JWT with `@CurrentUser()` decorator, `@Roles()` for access control
- Soft-delete pattern: `deletedAt` column, `updateMany` for deletes
- Multi-tenant: `schoolId` scoping on all queries
- API prefix: `/api/`
- Naming: `snake_case` in DB, `camelCase` in TypeScript

---

## File Structure

| File | Purpose |
|------|---------|
| `backend/prisma/schema.prisma` | Add ServantProfile, ServantMilestone models |
| `backend/src/modules/servants/servants.service.ts` | Add profile, timeline, milestone detection methods |
| `backend/src/modules/servants/servants.controller.ts` | Add profile, timeline, me, school summary endpoints |
| `backend/src/modules/servants/servants.module.ts` | Add ScheduleModule import for cron |
| `backend/src/modules/servants/servants.service.spec.ts` | Add tests for new methods |
| `frontend/src/components/dashboard/servant-journey-card.tsx` | Dashboard card component |
| `frontend/src/components/servants/ministry-timeline.tsx` | Timeline component |
| `frontend/src/components/servants/hooks.ts` | Frontend hooks (useMyServantProfile, useServantTimeline, etc.) |
| `frontend/src/app/dashboard/servants/[id]/profile/page.tsx` | Profile page |
| `frontend/src/app/dashboard/dashboard-client.tsx` | Add ServantJourneyCard to dashboard |

---

## Task 1: Prisma Schema — ServantProfile and ServantMilestone

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260811_add_servant_recognition/migration.sql`

**Interfaces:**
- Produces: `ServantProfile`, `ServantMilestone` Prisma models

- [ ] **Step 1: Add ServantProfile model to schema.prisma**

Add after the existing `User` model (around line 178):

```prisma
model ServantProfile {
  id              String   @id @default(uuid())
  userId          String   @unique @map("user_id")
  schoolId        String   @map("school_id")

  yearsOfService  Int      @default(0) @map("years_of_service")
  totalStudents   Int      @default(0) @map("total_students")
  totalSessions   Int      @default(0) @map("total_sessions")
  totalHymns      Int      @default(0) @map("total_hymns")
  totalReviews    Int      @default(0) @map("total_reviews")

  currentLevelName String? @map("current_level_name")
  currentGroupName String? @map("current_group_name")

  previousRoles   String[] @default([]) @map("previous_roles")

  lastCalculatedAt DateTime @map("last_calculated_at")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  school   School @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  milestones ServantMilestone[]

  @@index([schoolId])
  @@map("servant_profiles")
}
```

- [ ] **Step 2: Add ServantMilestone model to schema.prisma**

Add immediately after ServantProfile:

```prisma
model ServantMilestone {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  profileId       String   @map("profile_id")

  type            String
  threshold       Int
  reachedAt       DateTime @default(now()) @map("reached_at")

  label           String
  description     String?

  createdAt       DateTime @default(now()) @map("created_at")

  profile ServantProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([userId, type, threshold])
  @@index([userId])
  @@map("servant_milestones")
}
```

- [ ] **Step 3: Add relations to existing models**

In the `User` model, add:

```prisma
  servantProfile ServantProfile?
```

In the `School` model, add:

```prisma
  servantProfiles ServantProfile[]
```

- [ ] **Step 4: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_servant_recognition
```

- [ ] **Step 5: Verify Prisma client generates**

```bash
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add ServantProfile and ServantMilestone models"
```

---

## Task 2: Backend Service — Profile and Timeline Methods

**Files:**
- Modify: `backend/src/modules/servants/servants.service.ts`

**Interfaces:**
- Consumes: Prisma models (ServantProfile, ServantMilestone, User, AttendanceSession, AttendanceRecord, HymnPracticeSession, SubjectItem)
- Produces: `getServantProfile(userId, viewerId)`, `getServantTimeline(userId, viewerId)`, `getMyServantProfile(userId)`, `getSchoolServantSummary(schoolId)`, `checkAndLogMilestones()`

- [ ] **Step 1: Add ServantProfile types to servants.service.ts**

Add at the top of the file, after imports:

```typescript
interface ServantProfileData {
  userId: string
  name: string
  photoUrl: string | null
  roles: string[]
  assignedLevel: string | null
  assignedGroup: string | null
  teachingSubjects: string[]
  yearsOfService: number
  totalStudents: number
  totalSessions: number
  totalHymns: number
  totalReviews: number
  lastCalculatedAt: Date
}

interface ServantMilestoneData {
  type: string
  threshold: number
  label: string
  reachedAt: Date
}

const MILESTONE_THRESHOLDS = {
  years_of_service: [1, 3, 5, 10, 15, 20],
  students_taught: [10, 50, 100, 500],
  sessions_taught: [25, 50, 100, 250, 500],
  hymns_covered: [10, 25, 50, 100],
}
```

- [ ] **Step 2: Implement getServantProfile method**

Add to the ServantsService class:

```typescript
async getServantProfile(userId: string, viewerId: string): Promise<ServantProfileData | null> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
      servantProfile: true,
    },
  })
  if (!user || user.deletedAt) return null

  // Check viewer is in same school
  const viewer = await this.prisma.user.findUnique({ where: { id: viewerId } })
  if (!viewer || viewer.schoolId !== user.schoolId) return null

  const roles = user.roles.map(ur => ur.role.name)
  const metadata = (user.metadata as any) || {}

  const profile = user.servantProfile

  return {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`,
    photoUrl: user.photoUrl,
    roles,
    assignedLevel: profile?.currentLevelName || null,
    assignedGroup: profile?.currentGroupName || null,
    teachingSubjects: metadata.teachingSubjects || [],
    yearsOfService: profile?.yearsOfService || 0,
    totalStudents: profile?.totalStudents || 0,
    totalSessions: profile?.totalSessions || 0,
    totalHymns: profile?.totalHymns || 0,
    totalReviews: profile?.totalReviews || 0,
    lastCalculatedAt: profile?.lastCalculatedAt || new Date(0),
  }
}
```

- [ ] **Step 3: Implement getServantTimeline method**

```typescript
async getServantTimeline(userId: string, viewerId: string): Promise<ServantMilestoneData[]> {
  // Only the servant themselves can view their timeline
  if (userId !== viewerId) return []

  const milestones = await this.prisma.servantMilestone.findMany({
    where: { userId },
    orderBy: { reachedAt: 'asc' },
    select: {
      type: true,
      threshold: true,
      label: true,
      reachedAt: true,
    },
  })

  return milestones
}
```

- [ ] **Step 4: Implement getMyServantProfile method**

```typescript
async getMyServantProfile(userId: string): Promise<ServantProfileData | null> {
  return this.getServantProfile(userId, userId)
}
```

- [ ] **Step 5: Implement getSchoolServantSummary method**

```typescript
async getSchoolServantSummary(schoolId: string): Promise<ServantProfileData[]> {
  const servants = await this.prisma.user.findMany({
    where: {
      schoolId,
      deletedAt: null,
      roles: { some: { role: { name: { in: ['servant', 'group_leader', 'level_leader'] } } } },
    },
    include: {
      roles: { include: { role: true } },
      servantProfile: true,
    },
  })

  return servants.map(user => {
    const roles = user.roles.map(ur => ur.role.name)
    const metadata = (user.metadata as any) || {}
    const profile = user.servantProfile

    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      photoUrl: user.photoUrl,
      roles,
      assignedLevel: profile?.currentLevelName || null,
      assignedGroup: profile?.currentGroupName || null,
      teachingSubjects: metadata.teachingSubjects || [],
      yearsOfService: profile?.yearsOfService || 0,
      totalStudents: profile?.totalStudents || 0,
      totalSessions: profile?.totalSessions || 0,
      totalHymns: profile?.totalHymns || 0,
      totalReviews: profile?.totalReviews || 0,
      lastCalculatedAt: profile?.lastCalculatedAt || new Date(0),
    }
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/servants/servants.service.ts
git commit -m "feat: add servant profile and timeline methods to service"
```

---

## Task 3: Backend Service — Background Job and Milestone Detection

**Files:**
- Modify: `backend/src/modules/servants/servants.service.ts`
- Modify: `backend/src/modules/servants/servants.module.ts`

**Interfaces:**
- Consumes: Prisma models, @nestjs/schedule Cron
- Produces: `@Cron('0 3 * * *') updateServantProfiles()`

- [ ] **Step 1: Add Cron import to servants.module.ts**

```typescript
import { ScheduleModule } from '@nestjs/schedule'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ... existing imports
  ],
})
```

- [ ] **Step 2: Add computeServantStats helper method**

```typescript
private async computeServantStats(userId: string, schoolId: string) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const now = new Date()
  const yearsOfService = Math.floor((now.getTime() - user.createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

  const totalSessions = await this.prisma.attendanceSession.count({
    where: { servantId: userId, deletedAt: null },
  })

  const totalStudents = await this.prisma.attendanceRecord.groupBy({
    by: ['studentId'],
    where: {
      session: { servantId: userId, deletedAt: null },
    },
  }).then(records => records.length)

  const metadata = (user.metadata as any) || {}
  const totalHymns = await this.prisma.subjectItem.count({
    where: {
      subject: {
        levelSubjects: { some: { levelId: metadata.levelId } },
      },
    },
  })

  const totalReviews = await this.prisma.hymnPracticeSession.count({
    where: { reviewedBy: userId },
  })

  return {
    yearsOfService,
    totalStudents,
    totalSessions,
    totalHymns,
    totalReviews,
    currentLevelName: null as string | null,
    currentGroupName: null as string | null,
  }
}
```

- [ ] **Step 3: Implement checkAndLogMilestones method**

```typescript
private async checkAndLogMilestones(profileId: string, userId: string, stats: {
  yearsOfService: number
  totalStudents: number
  totalSessions: number
  totalHymns: number
}) {
  const checks = [
    { type: 'years_of_service', value: stats.yearsOfService, labelFn: (t: number) => `${t} year${t > 1 ? 's' : ''} of service` },
    { type: 'students_taught', value: stats.totalStudents, labelFn: (t: number) => `${t}th student taught` },
    { type: 'sessions_taught', value: stats.totalSessions, labelFn: (t: number) => `${t}th session taught` },
    { type: 'hymns_covered', value: stats.totalHymns, labelFn: (t: number) => `${t}th hymn covered` },
  ]

  for (const check of checks) {
    const thresholds = MILESTONE_THRESHOLDS[check.type as keyof typeof MILESTONE_THRESHOLDS] || []
    for (const threshold of thresholds) {
      if (check.value >= threshold) {
        await this.prisma.servantMilestone.upsert({
          where: {
            userId_type_threshold: { userId, type: check.type, threshold },
          },
          create: {
            userId,
            profileId,
            type: check.type,
            threshold,
            label: check.labelFn(threshold),
          },
          update: {}, // Already exists, do nothing
        })
      }
    }
  }
}
```

- [ ] **Step 4: Implement the cron job**

```typescript
@Cron('0 3 * * *')
async updateServantProfiles() {
  const servants = await this.prisma.user.findMany({
    where: {
      deletedAt: null,
      roles: { some: { role: { name: { in: ['servant', 'group_leader', 'level_leader'] } } } },
    },
  })

  for (const servant of servants) {
    const stats = await this.computeServantStats(servant.id, servant.schoolId)
    if (!stats) continue

    const profile = await this.prisma.servantProfile.upsert({
      where: { userId: servant.id },
      create: {
        userId: servant.id,
        schoolId: servant.schoolId,
        ...stats,
        lastCalculatedAt: new Date(),
      },
      update: {
        ...stats,
        lastCalculatedAt: new Date(),
      },
    })

    await this.checkAndLogMilestones(profile.id, servant.id, stats)
  }

  this.logger.log(`Updated ${servants.length} servant profiles`)
}
```

- [ ] **Step 5: Add logger to the service**

```typescript
private readonly logger = new Logger(ServantsService.name)
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/servants/servants.service.ts backend/src/modules/servants/servants.module.ts
git commit -m "feat: add background job for servant profile updates and milestone detection"
```

---

## Task 4: Backend Controller — Profile and Timeline Endpoints

**Files:**
- Modify: `backend/src/modules/servants/servants.controller.ts`

**Interfaces:**
- Consumes: `ServantsService.getServantProfile()`, `getServantTimeline()`, `getMyServantProfile()`, `getSchoolServantSummary()`
- Produces: 4 GET endpoints

- [ ] **Step 1: Add profile endpoint**

```typescript
@Get(':id/profile')
@Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
@ApiOperation({ summary: 'Get servant profile with ministry stats' })
async getServantProfile(
  @Param('id') id: string,
  @CurrentUser() user: any,
) {
  const profile = await this.servantsService.getServantProfile(id, user.id)
  if (!profile) throw new NotFoundException('Servant not found')
  return profile
}
```

- [ ] **Step 2: Add timeline endpoint**

```typescript
@Get(':id/timeline')
@Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
@ApiOperation({ summary: 'Get servant ministry timeline (private)' })
async getServantTimeline(
  @Param('id') id: string,
  @CurrentUser() user: any,
) {
  return this.servantsService.getServantTimeline(id, user.id)
}
```

- [ ] **Step 3: Add profile/me endpoint**

```typescript
@Get('profile/me')
@Roles('servant', 'group_leader', 'level_leader')
@ApiOperation({ summary: 'Get current servant own profile' })
async getMyProfile(@CurrentUser() user: any) {
  return this.servantsService.getMyServantProfile(user.id)
}
```

- [ ] **Step 4: Add school/summary endpoint**

```typescript
@Get('school/summary')
@Roles('servant', 'group_leader', 'level_leader', 'admin', 'principal', 'super_admin')
@ApiOperation({ summary: 'Get all servant profiles for the school' })
async getSchoolSummary(@CurrentUser() user: any) {
  return this.servantsService.getSchoolServantSummary(user.schoolId)
}
```

- [ ] **Step 5: Add NotFoundException import**

```typescript
import { NotFoundException } from '@nestjs/common'
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/servants/servants.controller.ts
git commit -m "feat: add servant profile and timeline API endpoints"
```

---

## Task 5: Frontend Hooks

**Files:**
- Create: `frontend/src/components/servants/hooks.ts`

**Interfaces:**
- Consumes: `http.get()` from `@/lib/http-client`
- Produces: `useMyServantProfile()`, `useServantProfile(userId)`, `useServantTimeline(userId)`, `useSchoolServantSummary()`

- [ ] **Step 1: Create hooks file with types**

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { http } from '@/lib/http-client'

export interface ServantProfileData {
  userId: string
  name: string
  photoUrl: string | null
  roles: string[]
  assignedLevel: string | null
  assignedGroup: string | null
  teachingSubjects: string[]
  yearsOfService: number
  totalStudents: number
  totalSessions: number
  totalHymns: number
  totalReviews: number
  lastCalculatedAt: string
}

export interface ServantMilestoneData {
  type: string
  threshold: number
  label: string
  reachedAt: string
}

const servantKeys = {
  all: ['servants'] as const,
  profile: (id: string) => [...servantKeys.all, 'profile', id] as const,
  myProfile: () => [...servantKeys.all, 'myProfile'] as const,
  timeline: (id: string) => [...servantKeys.all, 'timeline', id] as const,
  schoolSummary: () => [...servantKeys.all, 'schoolSummary'] as const,
}
```

- [ ] **Step 2: Add useMyServantProfile hook**

```typescript
export function useMyServantProfile() {
  return useQuery({
    queryKey: servantKeys.myProfile(),
    queryFn: () => http.get<ServantProfileData>('/servants/profile/me'),
    staleTime: 60_000,
  })
}
```

- [ ] **Step 3: Add useServantProfile hook**

```typescript
export function useServantProfile(userId: string) {
  return useQuery({
    queryKey: servantKeys.profile(userId),
    queryFn: () => http.get<ServantProfileData>(`/servants/${userId}/profile`),
    enabled: !!userId,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 4: Add useServantTimeline hook**

```typescript
export function useServantTimeline(userId: string) {
  return useQuery({
    queryKey: servantKeys.timeline(userId),
    queryFn: () => http.get<ServantMilestoneData[]>(`/servants/${userId}/timeline`),
    enabled: !!userId,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 5: Add useSchoolServantSummary hook**

```typescript
export function useSchoolServantSummary() {
  return useQuery({
    queryKey: servantKeys.schoolSummary(),
    queryFn: () => http.get<ServantProfileData[]>('/servants/school/summary'),
    staleTime: 60_000,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/servants/hooks.ts
git commit -m "feat: add servant recognition frontend hooks"
```

---

## Task 6: Frontend — ServantJourneyCard Component

**Files:**
- Create: `frontend/src/components/dashboard/servant-journey-card.tsx`

**Interfaces:**
- Consumes: `useMyServantProfile()` from `@/components/servants/hooks`
- Produces: `<ServantJourneyCard />` component

- [ ] **Step 1: Create the component**

```tsx
'use client'

import Link from 'next/link'
import { useMyServantProfile } from '@/components/servants/hooks'
import { Cross, ArrowRight } from 'lucide-react'

export function ServantJourneyCard() {
  const { data: profile, isLoading } = useMyServantProfile()

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 p-6 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
        <div className="flex gap-6">
          <div className="h-8 w-16 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Cross className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">Your Ministry Journey</h3>
      </div>
      
      <div className="flex items-center gap-8 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.yearsOfService}</div>
          <div className="text-xs text-gray-500">years</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.totalStudents}</div>
          <div className="text-xs text-gray-500">students</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{profile.totalHymns}</div>
          <div className="text-xs text-gray-500">hymns</div>
        </div>
      </div>

      <Link
        href={`/dashboard/servants/${profile.userId}/profile`}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
      >
        View Full Profile
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/dashboard/servant-journey-card.tsx
git commit -m "feat: add ServantJourneyCard dashboard component"
```

---

## Task 7: Frontend — MinistryTimeline Component

**Files:**
- Create: `frontend/src/components/servants/ministry-timeline.tsx`

**Interfaces:**
- Consumes: `ServantMilestoneData[]`
- Produces: `<MinistryTimeline />` component

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { ServantMilestoneData } from './hooks'

interface MinistryTimelineProps {
  milestones: ServantMilestoneData[]
  isLoading: boolean
}

const TYPE_ICONS: Record<string, string> = {
  years_of_service: '📅',
  students_taught: '👨‍🎓',
  sessions_taught: '📖',
  hymns_covered: '🎵',
  role_change: '⭐',
}

export function MinistryTimeline({ milestones, isLoading }: MinistryTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-3 w-3 bg-gray-200 rounded-full" />
            <div className="h-4 w-48 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        Your ministry journey will appear here as you reach milestones.
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="space-y-6">
        {milestones.map((milestone, i) => (
          <div key={i} className="relative flex items-start gap-4">
            <div className="relative z-10 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 ring-4 ring-white">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900">{milestone.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {new Date(milestone.reachedAt).toLocaleDateString('en-GB', {
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/servants/ministry-timeline.tsx
git commit -m "feat: add MinistryTimeline component"
```

---

## Task 8: Frontend — Servant Profile Page

**Files:**
- Create: `frontend/src/app/dashboard/servants/[id]/profile/page.tsx`

**Interfaces:**
- Consumes: `useServantProfile(id)`, `useServantTimeline(id)` from `@/components/servants/hooks`
- Produces: `/dashboard/servants/[id]/profile` page

- [ ] **Step 1: Create the profile page**

```tsx
'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useServantProfile, useServantTimeline } from '@/components/servants/hooks'
import { MinistryTimeline } from '@/components/servants/ministry-timeline'
import { ArrowLeft, Cross, Loader2 } from 'lucide-react'

export default function ServantProfilePage() {
  const params = useParams()
  const id = params?.id as string

  const { data: profile, isLoading: profileLoading } = useServantProfile(id)
  const { data: timeline, isLoading: timelineLoading } = useServantTimeline(id)

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Servant not found or you don't have access.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              {profile.photoUrl ? (
                <Image
                  src={profile.photoUrl}
                  alt={profile.name}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <Cross className="h-7 w-7 text-blue-600" />
              )}
            </div>
            
            <div>
              <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {profile.roles.includes('level_leader') ? 'Level Leader' :
                 profile.roles.includes('group_leader') ? 'Group Leader' : 'Servant'}
                {profile.assignedLevel && ` · ${profile.assignedLevel}`}
                {profile.assignedGroup && ` · ${profile.assignedGroup}`}
              </p>
              {profile.teachingSubjects.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Teaching: {profile.teachingSubjects.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { value: profile.yearsOfService, label: 'years' },
            { value: profile.totalStudents, label: 'students' },
            { value: profile.totalSessions, label: 'sessions' },
            { value: profile.totalHymns, label: 'hymns' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Ministry Timeline</h2>
          <MinistryTimeline milestones={timeline || []} isLoading={timelineLoading} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/servants/[id]/profile/page.tsx
git commit -m "feat: add servant profile page with ministry timeline"
```

---

## Task 9: Frontend — Integrate Card into Dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard-client.tsx`

**Interfaces:**
- Consumes: `<ServantJourneyCard />` from `@/components/dashboard/servant-journey-card`
- Produces: ServantJourneyCard rendered in dashboard for servant roles

- [ ] **Step 1: Add import to dashboard-client.tsx**

```typescript
import { ServantJourneyCard } from '@/components/dashboard/servant-journey-card'
```

- [ ] **Step 2: Add the card to the dashboard**

Find the section after the hero/stats section (around line 200-300) and add:

```tsx
{/* Servant Journey Card */}
{user && ['servant', 'group_leader', 'level_leader'].some(r => user.roles?.includes(r)) && (
  <ServantJourneyCard />
)}
```

- [ ] **Step 3: Verify the user object is available in the dashboard**

Check that `user` is defined in the component's props or context. If not, use the `useAuth()` hook or similar.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/dashboard-client.tsx
git commit -m "feat: integrate ServantJourneyCard into dashboard"
```

---

## Task 10: Backend Tests

**Files:**
- Modify: `backend/src/modules/servants/servants.service.spec.ts`

**Interfaces:**
- Consumes: ServantsService methods
- Produces: Unit tests for profile, timeline, milestone detection

- [ ] **Step 1: Add test for getServantProfile**

```typescript
describe('getServantProfile', () => {
  it('should return profile for same-school viewer', async () => {
    const result = await service.getServantProfile('servant-1', 'viewer-1')
    expect(result).toBeDefined()
    expect(result?.userId).toBe('servant-1')
  })

  it('should return null for different-school viewer', async () => {
    const result = await service.getServantProfile('servant-1', 'viewer-from-other-school')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Add test for getServantTimeline**

```typescript
describe('getServantTimeline', () => {
  it('should return timeline for owner', async () => {
    const result = await service.getServantTimeline('servant-1', 'servant-1')
    expect(Array.isArray(result)).toBe(true)
  })

  it('should return empty array for non-owner', async () => {
    const result = await service.getServantTimeline('servant-1', 'other-user')
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 3: Add test for milestone detection**

```typescript
describe('checkAndLogMilestones', () => {
  it('should create milestones when thresholds are crossed', async () => {
    // Mock stats that cross a threshold
    await service.checkAndLogMilestones('profile-1', 'servant-1', {
      yearsOfService: 5,
      totalStudents: 50,
      totalSessions: 100,
      totalHymns: 25,
    })
    // Verify milestones were created
  })
})
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/servants/servants.service.spec.ts
git commit -m "test: add unit tests for servant recognition"
```

---

## Task 11: Verification

- [ ] **Step 1: Run backend tests**

```bash
cd backend
npm run test -- --testPathPattern=servants
```

- [ ] **Step 2: Run backend build**

```bash
npm run build
```

- [ ] **Step 3: Run frontend build**

```bash
cd frontend
npm run build
```

- [ ] **Step 4: Manual verification**

1. Start backend: `npm run start:dev`
2. Start frontend: `npm run dev`
3. Login as a servant user
4. Verify dashboard card appears with stats
5. Click "View Full Profile" and verify timeline loads
6. Verify other users cannot see the profile page (403)

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: servant recognition verification fixes"
```

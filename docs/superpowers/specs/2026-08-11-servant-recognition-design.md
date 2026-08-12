# Servant Recognition & Formation — Module 3a Design Spec

**Date:** 2026-08-11
**Status:** Approved
**Effort:** Low-Medium
**Part of:** Module 3 — Servant Empowerment

---

## 1. Purpose

Servants are not employees — they are ministers. The platform must honour their service without gamification. No badges, no points, no competition. Just a quiet acknowledgement of the work they do.

This feature provides:
- A brief **dashboard card** showing years of service, students taught, hymns covered
- A private **full profile page** with a permanent ministry timeline — a living history of their service
- **Milestone detection** via a background job that logs significant moments in a servant's journey

The dashboard card is visible to the servant and their church community. The full profile page is private — only the servant sees their own journey.

---

## 2. Database Schema

### ServantProfile

Cached stats for fast reads. Updated nightly by background job.

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

  // For role change detection
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

### ServantMilestone

Permanent log of milestones reached. Once logged, it stays forever.

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

**Key decisions:**
- `ServantProfile` is one-per-servant, created when the background job first runs
- `ServantMilestone` is permanent — once reached, it stays forever
- Unique constraint on `[userId, type, threshold]` prevents duplicate milestones
- Stats are cached for fast reads; background job updates them nightly

---

## 3. API Endpoints

### GET /servants/:id/profile

Returns `ServantProfile` with all stats.

**Visibility:** The servant themselves + anyone in the same school.

**Response:**
```json
{
  "userId": "abc-123",
  "name": "Mirna Hatem",
  "photoUrl": "...",
  "roles": ["group_leader"],
  "assignedLevel": "Level 2",
  "assignedGroup": "Group A",
  "teachingSubjects": ["coptic_hymns"],
  "yearsOfService": 5,
  "totalStudents": 47,
  "totalSessions": 128,
  "totalHymns": 12,
  "totalReviews": 256,
  "lastCalculatedAt": "2026-08-10T03:00:00Z"
}
```

### GET /servants/:id/timeline

Returns `ServantMilestone[]` sorted by `reachedAt` descending.

**Visibility:** Only the servant themselves (private).

**Response:**
```json
[
  {
    "type": "years_of_service",
    "threshold": 1,
    "label": "1 year of service",
    "reachedAt": "2022-09-15T00:00:00Z"
  },
  {
    "type": "students_taught",
    "threshold": 10,
    "label": "10th student taught",
    "reachedAt": "2023-02-20T00:00:00Z"
  },
  {
    "type": "years_of_service",
    "threshold": 5,
    "label": "5 years of service",
    "reachedAt": "2026-09-15T00:00:00Z"
  }
]
```

### GET /servants/profile/me

Convenience endpoint — returns the current servant's own profile.

Uses `@CurrentUser()` to resolve `userId`. Returns the same shape as `GET /servants/:id/profile`.

### GET /servants/school/summary

Returns all servant profiles for the school (for directory/leaderboard).

**Visibility:** Servants, group_leaders, level_leaders, admins.

---

## 4. Dashboard Card

A quiet, dignified card on the servant's main dashboard.

**Layout:**
```
+---------------------------------------------+
|  Your Ministry Journey                      |
|                                             |
|  5 years   47 students   12 hymns           |
|                                             |
|  [View Full Profile]                        |
+---------------------------------------------+
```

**Behavior:**
- Appears on the main dashboard for users with `servant`, `group_leader`, or `level_leader` roles
- Shows three key numbers: years of service, total students taught, hymns covered
- "View Full Profile" links to `/dashboard/servants/[id]/profile`
- The card is always visible — not a one-time notification
- Uses the servant's own data (calls `GET /servants/profile/me`)

**Visual style:**
- Clean, minimal, no gamification elements
- No badges, no stars, no "achievement unlocked" flash
- Just numbers and a quiet statement of service
- Matches the existing dashboard aesthetic (white cards, subtle borders)

**Route:** Rendered on `/dashboard` (main dashboard page).

---

## 5. Full Profile Page with Timeline

The full ministry journey — a page that tells the story of their service.

**Page layout:**
```
+-----------------------------------------------------+
|  Back to Dashboard                                  |
|                                                     |
|  [Photo]  Mirna Hatem                               |
|           Group Leader - Level 2                    |
|           Teaching: Coptic Hymns                    |
|           Member since September 2021               |
|                                                     |
|  [5 years] [47 students] [128 sessions] [12 hymns] |
|                                                     |
|  Ministry Timeline                                  |
|  --------------------------------------------------|
|                                                     |
|  o Sep 2021 — Joined COHEP as a servant            |
|  |                                                   |
|  o Feb 2022 — Taught 10th student                   |
|  |                                                   |
|  o Sep 2022 — 1 year of service                     |
|  |                                                   |
|  o Mar 2023 — Taught 25th student                   |
|  |                                                   |
|  o Jun 2023 — 50th session taught                   |
|  |                                                   |
|  o Sep 2023 — Promoted to Group Leader              |
|  |                                                   |
|  o Jan 2024 — Covered 10th hymn                     |
|  |                                                   |
|  o Sep 2024 — 3 years of service                    |
|  |                                                   |
|  o Aug 2026 — 5 years of service                    |
|                                                     |
+-----------------------------------------------------+
```

**Timeline entry types:**
| Type | Example labels | How detected |
|------|----------------|--------------|
| `years_of_service` | "1 year of service", "5 years of service", "10 years of service" | Background job: `yearsOfService` stat crosses threshold |
| `students_taught` | "10th student taught", "50th student taught", "100th student taught" | Background job: `totalStudents` stat crosses threshold |
| `sessions_taught` | "25th session taught", "50th session taught", "100th session taught" | Background job: `totalSessions` stat crosses threshold |
| `hymns_covered` | "10th hymn covered", "25th hymn covered", "50th hymn covered" | Background job: `totalHymns` stat crosses threshold |
| `role_change` | "Joined as servant", "Promoted to Group Leader", "Promoted to Level Leader" | User role assignment change (detected by comparing current roles to previous state) |

**Route:** `/dashboard/servants/[id]/profile`

**Visibility:** Only the servant themselves. If a user tries to view another servant's profile, return 403.

---

## 6. Background Job

A nightly cron job that:
1. Updates `ServantProfile` stats for all active servants
2. Detects new milestones and logs them to `ServantMilestone`

**Schedule:** Runs daily at 3:00 AM (server time).

**Logic:**
```
For each active servant (role in [servant, group_leader, level_leader]):
  1. Compute stats:
     - yearsOfService: difference between now and user.createdAt
     - totalStudents: count distinct students from AttendanceRecord where servantId matches
     - totalSessions: count AttendanceSession where servantId matches
     - totalHymns: count distinct SubjectItems from curriculum allocations where servant's levelId/teachingSubjects match
     - totalReviews: count HymnPracticeSession where reviewedBy matches

  2. Upsert ServantProfile with computed stats

  3. Check for new milestones:
     - For each milestone type and threshold, check if the new stat crosses it
     - If yes and no ServantMilestone exists for that threshold, insert one

  4. Check for role changes:
     - Compare current roles to previous state (stored in profile metadata or separate table)
     - If roles changed, log appropriate milestone:
       - First servant role: "Joined as servant"
       - Promotion: "Promoted to Group Leader" / "Promoted to Level Leader"
```

**Milestone thresholds:**
| Type | Thresholds | Notes |
|------|------------|-------|
| `years_of_service` | 1, 3, 5, 10, 15, 20 | Computed from `User.createdAt` |
| `students_taught` | 10, 50, 100, 500 | Count of distinct students the servant has taught (via AttendanceSession + AttendanceRecord) |
| `sessions_taught` | 25, 50, 100, 250, 500 | Count of AttendanceSession records where servantId matches |
| `hymns_covered` | 10, 25, 50, 100 | Count of distinct SubjectItems taught by the servant (via curriculum allocations for their assigned level/subject) |
| `role_change` | N/A (any change) | Detected when user's roles change. Initial assignment logs "Joined as servant". Promotions log "Promoted to [role]". |

**Implementation:**
- Use `@nestjs/schedule` Cron decorator
- Add to existing `ServantsModule`
- Log milestone detections for audit trail

---

## 7. Visibility Rules

| Element | Who can see |
|---------|-------------|
| Dashboard card | The servant + anyone in the same school |
| Full profile page | Only the servant themselves |
| Timeline | Only the servant themselves |
| School summary | Servants, group_leaders, level_leaders, admins |

**Enforcement:**
- Backend: `@Roles()` decorator on endpoints
- Backend: Check `user.schoolId === targetServant.schoolId` for school-scoped access
- Backend: For timeline, check `user.id === targetUserId` (owner-only)
- Frontend: Dashboard card only renders for servant roles
- Frontend: Profile page hides "View Full Profile" link for other servants' cards

---

## 8. UI Components

### ServantJourneyCard

Located in `frontend/src/components/dashboard/servant-journey-card.tsx`.

Props:
```typescript
interface ServantJourneyCardProps {
  profile: ServantProfile | null
  isLoading: boolean
}
```

Renders the dashboard card with years, students, hymns, and a link to the full profile.

### ServantProfilePage

Located in `frontend/src/app/dashboard/servants/[id]/profile/page.tsx`.

Full page with:
- Header: photo, name, role, assigned level/group, teaching subjects, member since
- Stats row: years, students, sessions, hymns
- Timeline: vertical list of milestones with dates and labels

### MinistryTimeline

Located in `frontend/src/components/servants/ministry-timeline.tsx`.

Props:
```typescript
interface MinistryTimelineProps {
  milestones: ServantMilestone[]
  isLoading: boolean
}
```

Renders the vertical timeline with dots, dates, and labels.

---

## 9. Frontend Hooks

Located in `frontend/src/components/servants/hooks.ts`.

```typescript
// Get current servant's own profile
export function useMyServantProfile()

// Get a specific servant's profile (for school members)
export function useServantProfile(userId: string)

// Get servant's private timeline (owner only)
export function useServantTimeline(userId: string)

// Get all servant profiles for the school
export function useSchoolServantSummary()
```

---

## 10. Migration

Add a Prisma migration for the two new models:

```bash
npx prisma migrate dev --name add_servant_recognition
```

The migration creates:
- `servant_profiles` table
- `servant_milestones` table
- Foreign key constraints
- Indexes

No data migration needed — `ServantProfile` records are created by the background job on first run.

---

## 11. Testing

**Backend:**
- Unit test `ServantsService.getServantProfile()` — stats computation
- Unit test `ServantsService.getServantTimeline()` — milestone retrieval
- Unit test `ServantsService.checkAndLogMilestones()` — milestone detection logic
- Integration test: create a servant, run background job, verify profile and milestones created
- Integration test: timeline is private (403 when accessed by non-owner)

**Frontend:**
- Render `ServantJourneyCard` with mock data
- Render `ServantProfilePage` with mock milestones
- Test visibility rules (card shows for servant roles, profile page blocks non-owners)

---

## 12. Summary

| Component | Effort |
|-----------|--------|
| Prisma schema + migration | Low |
| Background job (stats + milestones) | Medium |
| API endpoints (4 endpoints) | Low-Medium |
| Dashboard card component | Low |
| Full profile page + timeline | Medium |
| Frontend hooks | Low |
| Testing | Medium |

**Total estimated effort:** 2-3 days of focused development.

This is Module 3a — the foundation. The next sub-projects (class glance card, community, AI assistant) build on this servant-centric architecture.

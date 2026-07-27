# Parent Portal — WOW Features

## Overview

Four features that transform the parent portal from read-only observation into an active spiritual partnership between school and home:

1. **Practice Together** — Parent + child practice current lesson at home; XP reward
2. **Family Liturgy Tracker** — Parent logs liturgy attendance; servant verifies; badge awarded
3. **Progress in Coptic Terms** — Spiritual milestones replace raw scores
4. **Spiritual Growth Story** — Beautiful term report as downloadable PDF

---

## 1. Practice Together

### Model

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

### Configuration (School-level SystemConfig)

| Key | Default | Description |
|-----|---------|-------------|
| `practice_xp_reward` | `20` | XP earned per practice session |
| `practice_weekly_limit` | `3` | Max practice sessions per week per child |

These are set via `system_configs` table with keys `practice_xp_reward` and `practice_weekly_limit`.

### API Endpoints

**Parent-facing (protected by `@Roles('parent', 'admin')`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parents/me/children/:id/current-lesson` | Returns the child's most recent active lesson with its sessions, Coptic text, audio URL |
| `POST` | `/parents/me/children/:id/practice` | Logs a practice session. Body: `{ lessonId }`. Awards XP. Returns `{ practiced: true, xpAwarded: 20, weeklyCount: 2, weeklyLimit: 3 }` |
| `GET` | `/parents/me/children/:id/practice-summary` | Returns `{ weeklyCount, weeklyLimit, lastPracticedAt, totalPractices }` |

**Practice logic (`POST`):**
1. Resolve schoolId from student
2. Look up `practice_weekly_limit` and `practice_xp_reward` from `system_configs`
3. Count practices for this student in the current ISO week
4. If count >= limit, return `429` with `{ error: "Weekly limit reached" }`
5. Create `FamilyPractice` record
6. Create `XPTransaction`: type `"practice"`, amount = xpReward, source = `"family_practice"`
7. Update `StudentProgress.totalXp`
8. Return the summary

### Frontend — Child Detail Page

New "Practice Together" card, placed above the tabs:

```
┌──────────────────────────────────────────────┐
│  🎵 Practice Together                        │
│                                              │
│  Current Lesson: Introduction to Coptic Hymns│
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ▶  Session 1: Basic Melodies         │  │
│  │     ⲛⲁⲃⲣⲟⲩⲃⲟⲗ — transliteration     │  │
│  │     Coptic text + English text         │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  ▶  Session 2: ...                    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [        ✅ We practiced together!       ]  │
│  Practiced 2x this week · 20 XP each         │
│                                              │
│  Audio player placeholder (when audio         │
│  files are uploaded)                          │
└──────────────────────────────────────────────┘
```

- All sessions for the current lesson shown in expandable cards
- Coptic text, transliteration, and English shown side by side
- Audio player placeholder shows as a gray area with "Audio coming soon"
- Button disabled when weekly limit reached, shows "Weekly limit reached"
- Button shows a brief success animation and XP earned count on click

---

## 2. Family Liturgy Tracker

### Model

```prisma
model FamilyLiturgy {
  id         String   @id @default(uuid())
  studentId  String   @map("student_id")
  date       DateTime @map("date")
  notedBy    String   @map("noted_by")
  verifiedBy String?  @map("verified_by")
  verifiedAt DateTime? @map("verified_at")
  status     String   @default("pending") // pending | verified | rejected
  notes      String?
  createdAt  DateTime @default(now()) @map("created_at")

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, date])
  @@index([studentId, status])
  @@map("family_liturgies")
}
```

### Configuration (SystemConfig)

| Key | Default | Description |
|-----|---------|-------------|
| `liturgy_badge_threshold` | `10` | Number of verified liturgies needed for "Faithful Worshipper" badge |

"Faithful Worshipper" badge is created automatically in seed or manually by admin with criteria `{ "rule": "liturgy_total", "count": 10 }`.

### API Endpoints

**Parent-facing:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/parents/me/children/:id/liturgy` | Log liturgy attendance. Body: `{ date, notes? }`. Status = `pending`. |
| `GET` | `/parents/me/children/:id/liturgy` | Returns liturgy records for this child (parent's own records only + status) |

**Servant-facing:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/servants/liturgy-pending` | Pending liturgy verifications for the servant's school |
| `PATCH` | `/servants/liturgy/:id/verify` | Verifies a liturgy record (marks as verified, auto-checks badge) |
| `DELETE` | `/servants/liturgy/:id` | Reject/delete a liturgy record |

### Frontend

**Parent view (on child detail page):**

A new "Liturgy" tab or section with:
- "Attended Divine Liturgy today" button (logs with today's date)
- Calendar/log list showing past entries with status badges (Pending / Verified)
- Counter: "4 verified liturgies this year — 6 more for Faithful Worshipper badge"

**Servant view (on dashboard or attendance page):**

A new "Liturgy Verification" panel/list:
- Shows parent-reported liturgy records grouped by date
- Verify (✅) / Reject (❌) buttons
- Shows: student name, parent name, date reported, notes

### Badge Auto-Award

When a liturgy record is verified, the system checks if the student's verified liturgy count >= `liturgy_badge_threshold`. If so, it auto-awards the "Faithful Worshipper" badge (or increments if already awarded — badge allows multiple awards).

---

## 3. Progress in Coptic Terms

### Backend

New endpoint `GET /parents/me/children/:id/milestones`:

Returns an array of milestone objects derived from the child's completed lessons and progress:

```json
{
  "milestones": [
    { "text": "Can sing the Doxology of St. Mary", "textAr": "يستطيع ترتيل ذوكصولوجية السيدة العذراء", "completedAt": "2026-10-15", "category": "hymn" },
    { "text": "Learned the Aspasmos Adam", "textAr": "تعلم الأسبسموس آدام", "completedAt": "2026-11-01", "category": "hymn" },
    { "text": "Has attended 12 liturgy sessions", "textAr": "حضر 12 قداسًا", "completedAt": null, "category": "liturgy" }
  ]
}
```

**Logic:**
- For each completed `LessonProgress` where `status = "completed"`, derive milestone from lesson title: `"Can sing {lesson.title}"` / `"{lesson.titleAr}"`
- For verified liturgy records: `"Has attended {count} liturgy sessions"`
- For earned badges: `"Earned the {badge.name} badge"`

### Frontend

Replace the raw score/grades section on the child detail page with milestone cards:

```
┌──────────────────────────────────────────────┐
│  🌿 Spiritual Milestones                     │
│                                              │
│  ✅ Can sing the Doxology of St. Mary        │
│     Completed Oct 15, 2026                   │
│                                              │
│  ✅ Learned the Aspasmos Adam                │
│     Completed Nov 1, 2026                    │
│                                              │
│  ⏳ Can recite the Creed                     │
│     In progress                              │
└──────────────────────────────────────────────┘
```

The old score/grade data is still available — collapsed behind a "Show detailed scores" toggle.

---

## 4. Spiritual Growth Story (Term Report)

### Frontend-based PDF approach

Backend returns JSON data. Frontend generates the beautifully designed HTML and exports to PDF using `html2pdf.js` library (loaded via CDN or npm).

### Backend Endpoint

`GET /parents/me/children/:id/term-report?term=1&academicYearId=xxx`

Returns:
```json
{
  "child": { "firstName": "George", "lastName": "Ibrahim", "level": "Level 3", "group": "Group 1" },
  "term": 1,
  "academicYear": "2026-2027",
  "hymnsLearned": [
    { "name": "Doxology of St. Mary", "completedAt": "2026-10-15" },
    { "name": "Aspasmos Adam", "completedAt": "2026-11-01" }
  ],
  "feastsAttended": [
    { "name": "Nayrouz", "nameAr": "عيد النيروز", "date": "2026-09-11" }
  ],
  "badges": [
    { "name": "Perfect Attendance", "iconUrl": "/uploads/badges/perfect-attendance.png" }
  ],
  "servantNote": "George is a joy to teach. His enthusiasm for hymns is contagious.",
  "totalXP": 450,
  "attendanceRate": 87,
  "practiceCount": 12
}
```

### HTML Template Design

A one-page landscape document with:
- **Header:** Coptic cross ornament, "COHEP — Spiritual Growth Report", child name, term, year
- **Section 1 — Hymns Learned:** List with Coptic cross checkmarks, alternating Coptic/English names
- **Section 2 — Feasts Attended:** Calendar-style list with Coptic feast icons
- **Section 3 — Badges Earned:** Mini badge gallery showing earned badge icons
- **Section 4 — Servant's Note:** Written in italic, like a personal letter
- **Section 5 — Summary:** XP total, attendance rate, practice count, next level goal
- **Footer:** "Generated by COHEP — Coptic Orthodox Hymn Education Platform"

Color palette: Gold (#C9A84C), Deep Blue (#1E3A5F), Warm White (#FFF8F0), Dark Text (#2D2D2D)
Font: Georgia (serif) for print quality

### Frontend

New "Term Report" button/modal on child detail page:
- Click opens a preview modal with the rendered HTML report
- "Download PDF" button uses `html2pdf.js` to export
- "Share" button (future)

---

## Data Flow Diagram

```
Parent Browser                   Backend API                         Database
─────────────                    ──────────                         ────────
                                     │                                  │
  Practice Together:                  │                                  │
  POST /practice {lessonId} ──────►  │── check weekly limit ──────────► │
                                     │── create FamilyPractice ────────► │
                                     │── create XPTransaction ─────────► │
  ◄── {xpAwarded, weeklyCount} ──────│                                  │
                                     │                                  │
  Liturgy:                            │                                  │
  POST /liturgy {date} ────────────►  │── create FamilyLiturgy (pending) │
  ◄── {status: "pending"} ───────────│                                  │
                                     │                                  │
  Servant Dashboard:                  │                                  │
  GET /liturgy-pending ────────────►  │── query pending liturgies ──────►│
  PATCH /liturgy/:id/verify ──────►  │── update status ────────────────► │
                                     │── check badge threshold ─────────►│
                                     │── award badge if met ────────────►│
                                     │                                  │
  Milestones:                         │                                  │
  GET /milestones ─────────────────►  │── query LessonProgress ─────────►│
                                     │── query FamilyLiturgy ───────────►│
                                     │── query StudentBadge ────────────►│
  ◄── [{milestone}, ...] ────────────│                                  │
                                     │                                  │
  Term Report:                        │                                  │
  GET /term-report ────────────────►  │── aggregate all student data ───►│
  ◄── JSON data ─────────────────────│                                  │
  Frontend renders HTML + PDF export  │                                  │
```

---

## Implementation Order

1. **Practice Together** (backend model + endpoints + frontend card)
2. **Family Liturgy Tracker** (backend model + endpoints + parent + servant UIs)
3. **Progress in Coptic Terms** (backend milestones endpoint + frontend component)
4. **Spiritual Growth Story** (backend report endpoint + frontend HTML template + PDF export)

Each can be deployed independently. All share the same parent portal child detail page.

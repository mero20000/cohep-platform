# Phase 3 – Information Architecture and Navigation

**NiAngelos School for Hymns and Praises – Digital Platform**

**Document Version:** 1.0
**Date:** July 2026
**Status:** Draft – Pending Approval

---

## Table of Contents

1. [Information Architecture Principles](#1-information-architecture-principles)
2. [Site Map](#2-site-map)
3. [Navigation Structure](#3-navigation-structure)
4. [Page Inventory](#4-page-inventory)
5. [User Flow Diagrams](#5-user-flow-diagrams)
6. [Content Organization](#6-content-organization)
7. [Search Architecture](#7-search-architecture)
8. [URL Structure](#8-url-structure)
9. [Responsive Behavior](#9-responsive-behavior)
10. [Assumptions](#10-assumptions)
11. [Recommendations](#11-recommendations)
12. [Risks](#12-risks)
13. [Approval Gate](#13-approval-gate)

---

## 1. Information Architecture Principles

### 1.1 Core Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Progressive Disclosure** | Show only what's needed at each step | Default views show summary; details on demand |
| **Consistent Patterns** | Similar content uses similar layouts | All list views follow same pattern |
| **Role-Based IA** | Navigation adapts to user role | Each role sees relevant menus only |
| **Task-Oriented** | Organize by what users want to do | "Teach" not "Database Management" |
| **Shallow Hierarchy** | Minimize clicks to reach content | Max 3 clicks from home to any page |
| **Clear Labeling** | Use language users understand | "Students" not "Entity Management" |
| **RTL-Ready** | Architecture supports Arabic flip | All layouts work in both directions |

### 1.2 Mental Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER MENTAL MODEL                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  "I want to..."                                                 │
│                                                                 │
│  ├── TEACH          → Go to Curriculum / My Classes             │
│  ├── CHECK          → Go to Attendance / Progress               │
│  ├── LEARN          → Go to Lessons / Practice                  │
│  ├── MONITOR        → Go to Dashboard / Reports                 │
│  ├── COMMUNICATE    → Go to Messages / Announcements            │
│  ├── MANAGE         → Go to Users / Settings / Configuration    │
│  └── FIND           → Use Search                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Site Map

### 2.1 Global Site Map

```
niangelos.app/
│
├── 🏠 /                                    (Landing Page)
├── 🔐 /auth/                               (Authentication)
│   ├── /auth/login                          (Login)
│   ├── /auth/register                       (Register)
│   ├── /auth/forgot-password                (Password Reset)
│   ├── /auth/verify-email                   (Email Verification)
│   ├── /auth/verify-phone                   (Phone Verification)
│   └── /auth/onboarding                     (First-time Setup)
│
├── 📊 /dashboard                           (Role-Based Dashboard)
│   ├── /dashboard/student                   (Student Home)
│   ├── /dashboard/parent                    (Parent Home)
│   ├── /dashboard/servant                   (Servant Home)
│   ├── /dashboard/principal                 (Principal Home)
│   ├── /dashboard/curriculum-manager        (Curriculum Home)
│   └── /dashboard/admin                     (Super Admin Home)
│
├── 👥 /students/                           (Student Management)
│   ├── /students                            (Student List)
│   ├── /students/:id                        (Student Profile)
│   ├── /students/:id/attendance             (Attendance History)
│   ├── /students/:id/assessments            (Assessment History)
│   ├── /students/:id/progress               (Progress View)
│   ├── /students/:id/documents              (Documents)
│   ├── /students/:id/notes                  (Servant Notes)
│   ├── /students/:id/certificates           (Certificates)
│   └── /students/new                        (Add Student)
│
├── 📚 /curriculum/                         (Curriculum Management)
│   ├── /curriculum                          (Overview)
│   ├── /curriculum/levels                   (Levels List)
│   ├── /curriculum/levels/:id               (Level Detail)
│   ├── /curriculum/levels/:id/groups        (Groups in Level)
│   ├── /curriculum/levels/:id/groups/:gid   (Group Detail)
│   ├── /curriculum/subjects                 (Subjects List)
│   ├── /curriculum/subjects/:id             (Subject Detail)
│   ├── /curriculum/lessons                  (Lessons List)
│   ├── /curriculum/lessons/:id              (Lesson Detail)
│   ├── /curriculum/lessons/:id/edit         (Edit Lesson)
│   ├── /curriculum/sessions/:id             (Session Detail)
│   ├── /curriculum/quizzes                  (Quizzes)
│   ├── /curriculum/quizzes/:id              (Quiz Detail)
│   └── /curriculum/resources                (Resource Library)
│
├── 📝 /attendance/                         (Attendance)
│   ├── /attendance/mark                     (Mark Attendance)
│   ├── /attendance/history                  (Attendance History)
│   ├── /attendance/analytics                (Analytics)
│   └── /attendance/calendar                 (Calendar View)
│
├── ✏️ /assessments/                        (Assessments)
│   ├── /assessments                         (Assessment List)
│   ├── /assessments/new                     (Create Assessment)
│   ├── /assessments/:id                     (Assessment Detail)
│   ├── /assessments/:id/grade               (Grading Interface)
│   ├── /assessments/:id/results             (Results View)
│   ├── /assessments/rubrics                 (Rubric Library)
│   └── /assessments/submissions             (Pending Submissions)
│
├── 📈 /progress/                           (Progress Tracking)
│   ├── /progress/overview                   (Overall Progress)
│   ├── /progress/student/:id                (Student Progress)
│   ├── /progress/class/:id                  (Class Progress)
│   ├── /progress/level/:id                  (Level Progress)
│   └── /progress/promotion                  (Promotion Readiness)
│
├── 🏆 /gamification/                       (Gamification)
│   ├── /gamification/badges                 (Badge Collection)
│   ├── /gamification/leaderboard            (Leaderboard)
│   ├── /gamification/certificates           (Certificates)
│   ├── /gamification/streaks                (Progress Streaks)
│   └── /gamification/achievements           (Achievements)
│
├── 📢 /notifications/                      (Notifications)
│   ├── /notifications                       (Notification List)
│   ├── /notifications/announcements         (Announcements)
│   ├── /notifications/announcements/new     (Create Announcement)
│   └── /notifications/settings              (Notification Settings)
│
├── 💬 /messages/                           (Messaging)
│   ├── /messages                            (Inbox)
│   ├── /messages/:id                        (Conversation)
│   └── /messages/new                        (New Message)
│
├── 📅 /events/                             (Events)
│   ├── /events                              (Event List)
│   ├── /events/:id                          (Event Detail)
│   └── /events/new                          (Create Event)
│
├── 📋 /reports/                            (Reports)
│   ├── /reports                             (Report Center)
│   ├── /reports/attendance                  (Attendance Reports)
│   ├── /reports/progress                    (Progress Reports)
│   ├── /reports/assessments                 (Assessment Reports)
│   ├── /reports/curriculum                  (Curriculum Reports)
│   ├── /reports/servants                    (Servant Reports)
│   └── /reports/certificates                (Certificate Reports)
│
├── ⚙️ /settings/                           (Settings)
│   ├── /settings/profile                    (Profile)
│   ├── /settings/account                    (Account Settings)
│   ├── /settings/notifications              (Notification Prefs)
│   ├── /settings/language                   (Language Settings)
│   ├── /settings/academic-year              (Academic Year)
│   ├── /settings/school                     (School Settings)
│   ├── /settings/users                      (User Management)
│   ├── /settings/roles                      (Role Management)
│   └── /settings/system                     (System Settings)
│
├── 🔍 /search                              (Search Results)
│
└── 📖 /help/                               (Help & Support)
    ├── /help                                (Help Center)
    ├── /help/faq                            (FAQ)
    ├── /help/tutorials                      (Video Tutorials)
    ├── /help/contact                        (Contact Support)
    └── /help/about                          (About Platform)
```

---

## 3. Navigation Structure

### 3.1 Primary Navigation (Sidebar)

The sidebar is the main navigation element. It adapts based on user role.

```
┌─────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════╗   │
│  ║              NIANGELOS                        ║   │
│  ║          School for Hymns                     ║   │
│  ╚═══════════════════════════════════════════════╝   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔍 Search                          [⌘K]     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ MAIN ──────────────────────────────────────┐   │
│  │ 🏠 Dashboard                                 │   │
│  │ 📚 Curriculum                                │   │
│  │ 👥 Students                                  │   │
│  │ 📝 Attendance                                │   │
│  │ ✏️ Assessments                               │   │
│  │ 📈 Progress                                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ COMMUNICATE ───────────────────────────────┐   │
│  │ 💬 Messages                         [3]     │   │
│  │ 📢 Announcements                             │   │
│  │ 📅 Events                                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ TOOLS ─────────────────────────────────────┐   │
│  │ 📋 Reports                                   │   │
│  │ 🏆 Achievements                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ ADMIN ─────────────────────────────────────┐   │
│  │ ⚙️ Settings                                  │   │
│  │ 👤 User Management              [Admin]      │   │
│  │ 🏫 School Settings             [Admin]      │   │
│  │ 📊 System Overview             [Super]      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ───────────────────────────────────────────────   │
│  ┌─────────────────────────────────────────────┐   │
│  │  👤 Servant Mariam                           │   │
│  │  Level 5-6 Servant                           │   │
│  │  ⚙️ Settings  🚪 Logout                     │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 3.2 Role-Based Navigation Matrix

| Menu Item | Student | Parent | Servant | Asst. Servant | Curriculum Mgr | Principal | Super Admin |
|-----------|:-------:|:------:|:-------:|:-------------:|:--------------:|:---------:|:-----------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| My Lessons | ✅ | - | - | - | - | - | - |
| Curriculum | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| Students | - | 👶 | ✅ | ✅ | - | ✅ | ✅ |
| Attendance | - | 👶 | ✅ | ✅ | - | ✅ | ✅ |
| Assessments | ✅ | 👶 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Progress | ✅ | 👶 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Messages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Announcements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Events | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reports | - | 👶 | ✅ | - | ✅ | ✅ | ✅ |
| Achievements | ✅ | 👶 | - | - | - | - | - |
| Settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| User Management | - | - | - | - | - | ✅ | ✅ |
| School Settings | - | - | - | - | - | ✅ | ✅ |
| System Overview | - | - | - | - | - | - | ✅ |

> 👶 = View only for own children

### 3.3 Mobile Navigation (Bottom Tab Bar)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [Main Content Area]                 │
│                                                 │
├─────────────────────────────────────────────────┤
│  🏠      📚      ✏️      📝      👤            │
│  Home  Lessons  Actions  Attendance  Profile    │
└─────────────────────────────────────────────────┘
```

**Mobile Navigation Rules:**
- Bottom tab bar shows 5 primary actions
- "Actions" button opens a quick-action sheet
- Sidebar collapses to hamburger menu
- Search accessible from header on all pages
- Back button always visible on sub-pages

### 3.4 Top Header Bar

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰  NiAngelos              🔍 Search...           🔔  👤  🌐  │
└─────────────────────────────────────────────────────────────────┘

Components:
- ☰  Hamburger menu (mobile only)
- Logo + School Name
- 🔍 Global Search (⌘K shortcut)
- 🔔 Notification Bell (with badge count)
- 👤 User Avatar (profile dropdown)
- 🌐 Language Toggle (EN/AR)
```

---

## 4. Page Inventory

### 4.1 Public Pages

| Page | URL | Purpose | Key Elements |
|------|-----|---------|--------------|
| Landing Page | `/` | Marketing, sign-up | Hero, features, testimonials, CTA |
| Login | `/auth/login` | User authentication | Email/password, social login, register link |
| Register | `/auth/register` | Account creation | Role selection, form, verification |
| Forgot Password | `/auth/forgot-password` | Password reset | Email input, reset link |
| Email Verification | `/auth/verify-email` | Account activation | Verification status |
| About | `/help/about` | Platform information | Mission, team, contact |
| Help Center | `/help` | Support resources | FAQ, tutorials, contact |
| Privacy Policy | `/legal/privacy` | Legal compliance | Privacy terms |
| Terms of Service | `/legal/terms` | Legal compliance | Usage terms |

### 4.2 Student Pages

| Page | URL | Purpose | Key Elements |
|------|-----|---------|--------------|
| Student Dashboard | `/dashboard/student` | Home base | Welcome, today's lessons, XP, streak |
| My Lessons | `/curriculum/student` | View lessons | Lesson list, progress, start button |
| Lesson View | `/curriculum/lessons/:id` | View content | Content tabs, audio player, quiz |
| My Progress | `/progress/student` | See progress | Charts, completion %, achievements |
| My Achievements | `/gamification/student` | Badges, certs | Badge grid, certificate wallet |
| My Attendance | `/attendance/student` | Attendance | Calendar view, history |
| My Assessments | `/assessments/student` | Test results | Score list, details |
| Submit Practice | `/assessments/submit` | Upload recording | Record/upload audio/video |

### 4.3 Parent Pages

| Page | URL | Purpose | Key Elements |
|------|-----|---------|--------------|
| Parent Dashboard | `/dashboard/parent` | Family overview | Child selector, summaries |
| Child Profile | `/students/:id` | Child details | Profile, progress, attendance |
| Child Progress | `/progress/student/:id` | Detailed progress | Charts, reports, trends |
| Child Attendance | `/attendance/student/:id` | Attendance history | Calendar, stats |
| Child Assessments | `/assessments/student/:id` | Assessment results | Scores, feedback |
| Certificates | `/gamification/certificates/:id` | View/download | Certificate preview, download |
| Reports | `/reports/parent` | Generate reports | Report builder, export |

### 4.4 Servant Pages

| Page | URL | Purpose | Key Elements |
|------|-----|---------|--------------|
| Servant Dashboard | `/dashboard/servant` | Teaching overview | Schedule, class summary, alerts |
| My Classes | `/students?view=classes` | Class management | Level/group tabs, student list |
| Mark Attendance | `/attendance/mark` | Record attendance | Roster, status toggles, save |
| Curriculum Browser | `/curriculum` | View curriculum | Tree view, lesson details |
| Lesson Plan | `/curriculum/lessons/:id/plan` | Teaching guide | Objectives, resources, timeline |
| Grade Assessments | `/assessments/:id/grade` | Grade submissions | Student list, rubric, scores |
| Student Notes | `/students/:id/notes` | Add/view notes | Note form, history |
| Class Reports | `/reports/class` | Class analytics | Charts, stats, export |

### 4.5 Curriculum Manager Pages

| Page | URL | Purpose | Key Elements |
|------|-----|---------|--------------|
| CM Dashboard | `/dashboard/curriculum-manager` | Curriculum overview | Status, gaps, stats |
| Manage Levels | `/curriculum/levels` | Level configuration | Level list, settings |
| Manage Groups | `/curriculum/levels/:id/groups` | Group configuration | Group list, capacity |
| Manage Subjects | `/curriculum/subjects` | Subject configuration | Subject list, details |
| Create/Edit Lesson | `/curriculum/lessons/new` | Lesson builder | Form, content tabs, resources |
| Resource Library | `/curriculum/resources` | Content management | File grid, upload, search |
| Quiz Builder | `/curriculum/quizzes/new` | Quiz creation | Question editor, settings |
| Curriculum Publish | `/curriculum/publish` | Publishing | Version list, publish button |

### 4.6 Principal Pages

| Page | URL | Purpose | Key Elements |
|------|-----|---------|--------------|
| Principal Dashboard | `/dashboard/principal` | School overview | KPIs, charts, alerts |
| User Management | `/settings/users` | User administration | User list, actions |
| School Reports | `/reports` | Report center | Report categories, filters |
| Promotion | `/progress/promotion` | Promotion decisions | Readiness list, batch action |
| School Settings | `/settings/school` | School config | Academic year, branding |
| Servant Performance | `/reports/servants` | Staff metrics | Performance cards |

### 4.7 Super Admin Pages

| Page | URL | Purpose | Key Elements |
|------|-----|---------|--------------|
| Admin Dashboard | `/dashboard/admin` | System overview | Metrics, health, usage |
| Church Management | `/admin/churches` | Church CRUD | Church list, details |
| School Management | `/admin/schools` | School CRUD | School list, config |
| System Settings | `/settings/system` | System config | Feature flags, integrations |
| Audit Logs | `/admin/audit-logs` | Security logs | Log viewer, filters |
| Monitoring | `/admin/monitoring` | System health | Uptime, performance |

---

## 5. User Flow Diagrams

### 5.1 New Parent Registration Flow

```
┌─────────────┐
│  Landing     │
│  Page        │
└──────┬──────┘
       │ Click "Register"
       ▼
┌─────────────┐     ┌─────────────┐
│  Select      │     │  Already     │
│  Role:       │     │  have an     │
│  Parent      │     │  account?    │
└──────┬──────┘     └──────┬──────┘
       │                    │ Login
       ▼                    │
┌─────────────┐             │
│  Fill        │             │
│  Registration│             │
│  Form        │             │
└──────┬──────┘             │
       │ Submit              │
       ▼                    │
┌─────────────┐             │
│  Verify      │             │
│  Email/Phone │             │
└──────┬──────┘             │
       │ Verified           │
       ▼                    │
┌─────────────┐             │
│  Complete    │             │
│  Profile     │             │
└──────┬──────┘             │
       │ Saved              │
       ▼                    │
┌─────────────┐             │
│  Add Child   │             │
│  (via code)  │             │
└──────┬──────┘             │
       │ Linked             │
       ▼                    │
┌─────────────┐             │
│  Parent      │◀────────────┘
│  Dashboard   │
└─────────────┘
```

### 5.2 Servant Attendance Flow

```
┌─────────────┐
│  Servant     │
│  Dashboard   │
└──────┬──────┘
       │ Click "Mark Attendance"
       ▼
┌─────────────┐
│  Select      │
│  Class       │
│  (Level/Grp) │
└──────┬──────┘
       │ Selected
       ▼
┌─────────────┐
│  Student     │
│  Roster      │
│  Displayed   │
└──────┬──────┘
       │ For each student:
       ▼
┌─────────────┐
│  Toggle      │
│  Status:     │
│  ✅ ⏰ 📝 ❌  │
│  Present/Late│
│  Excused/Abs │
└──────┬──────┘
       │ All marked
       ▼
┌─────────────┐
│  Add Notes   │
│  (optional)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Save        │
│  Attendance  │
└──────┬──────┘
       │ Saved
       ▼
┌─────────────┐     ┌─────────────┐
│  Confirmation│     │  Parents     │
│  + Summary   │     │  notified    │
└─────────────┘     │  (if absent) │
                    └─────────────┘
```

### 5.3 Student Learning Flow

```
┌─────────────┐
│  Student     │
│  Dashboard   │
└──────┬──────┘
       │ Click "Continue Learning"
       ▼
┌─────────────┐
│  Current     │
│  Lesson      │
│  View        │
└──────┬──────┘
       │
       ├──▶ ┌─────────────┐
       │    │  Read        │
       │    │  Content     │
       │    │  (EN/AR/CO)  │
       │    └──────┬──────┘
       │           │
       ├──▶ ┌─────────────┐
       │    │  Listen to   │
       │    │  Hymn Audio  │
       │    └──────┬──────┘
       │           │
       ├──▶ ┌─────────────┐
       │    │  Watch       │
       │    │  Video       │
       │    └──────┬──────┘
       │           │
       ├──▶ ┌─────────────┐
       │    │  Practice    │
       │    │  & Record    │
       │    └──────┬──────┘
       │           │
       ▼           ▼
┌─────────────┐
│  Complete    │
│  Quiz/       │
│  Assessment  │
└──────┬──────┘
       │ Submitted
       ▼
┌─────────────┐
│  Earn XP     │
│  Badge?      │
│  🎉          │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Progress    │
│  Updated     │
└─────────────┘
```

### 5.4 Curriculum Creation Flow

```
┌─────────────────┐
│  Curriculum Mgr   │
│  Dashboard        │
└────────┬─────────┘
         │ Click "Create Lesson"
         ▼
┌─────────────────┐
│  Select Level    │
│  Select Group    │
│  Select Subject  │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Lesson Details  │
│  ├── Title       │
│  ├── Description │
│  ├── Objectives  │
│  ├── Duration    │
│  └── Prerequisites│
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Add Content     │
│  ├── English Tab │
│  ├── Arabic Tab  │
│  └── Coptic Tab  │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Upload          │
│  Resources       │
│  ├── PDF         │
│  ├── Audio       │
│  ├── Video       │
│  └── Images      │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Configure       │
│  Sessions        │
│  ├── Session 1   │
│  ├── Session 2   │
│  └── Session N   │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│  Preview &       │
│  Publish         │
└─────────────────┘
```

---

## 6. Content Organization

### 6.1 Content Taxonomy

```
CONTENT TYPES
│
├── CURRICULUM CONTENT
│   ├── Levels (1-10)
│   │   ├── Groups (1-4)
│   │   │   ├── Subjects
│   │   │   │   ├── Lessons
│   │   │   │   │   ├── Sessions
│   │   │   │   │   ├── Resources
│   │   │   │   │   └── Assessments
│   │   │   │   └── Quizzes
│   │   │   └── Group Settings
│   │   └── Level Settings
│   └── Cross-Level Resources
│
├── USER CONTENT
│   ├── Student Profiles
│   ├── Parent Profiles
│   ├── Servant Profiles
│   ├── Notes
│   ├── Submissions (Audio/Video)
│   └── Documents
│
├── SYSTEM CONTENT
│   ├── Announcements
│   ├── Events
│   ├── Notifications
│   ├── Reports
│   └── Certificates
│
└── MEDIA CONTENT
    ├── Images
    ├── Audio Files
    ├── Video Files
    ├── Documents (PDF, PPTX)
    └── Sheet Music
```

### 6.2 Content Relationships

```
                    ┌─────────────┐
                    │   SCHOOL    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  LEVEL   │ │  LEVEL   │ │  LEVEL   │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
        ┌────┼────┐   ┌───┼───┐   ┌───┼───┐
        ▼    ▼    ▼   ▼   ▼   ▼   ▼   ▼   ▼
      ┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐
      │G1 ││G2 ││G3 ││G1 ││G2 ││G3 ││G1 ││G2 ││G3 │
      └─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘└─┬─┘
        │    │    │    │    │    │    │    │    │
        ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼    ▼
      ┌─────────────────────────────────────────────┐
      │              SUBJECTS                       │
      │  (Coptic Hymns, Coptic Rites, Coptic Lang) │
      └──────────────────┬──────────────────────────┘
                         │
                    ┌────┼────┐
                    ▼    ▼    ▼
                 ┌────┐┌────┐┌────┐
                 │L1  ││L2  ││L3  │  (Lessons)
                 └──┬─┘└──┬─┘└──┬─┘
                    │     │     │
                 ┌──┼──┐┌─┼─┐┌─┼─┐
                 ▼  ▼  ▼ ▼ ▼ ▼ ▼ ▼
               ┌─────────────────────┐
               │      SESSIONS       │
               │  (Session 1..N)     │
               └──────────┬──────────┘
                          │
                    ┌─────┼─────┐
                    ▼     ▼     ▼
                 ┌────┐┌────┐┌────┐
                 │Rsrc││Quiz││Assm│  (Resources, Quizzes, Assessments)
                 └────┘└────┘└────┘
```

### 6.3 Content Discovery Patterns

| Pattern | Usage | Example |
|---------|-------|---------|
| **Hierarchical Browse** | Drilling down through levels | Level → Group → Subject → Lesson |
| **Filtered List** | Finding specific content | "Show all lessons with audio" |
| **Search** | Known-item finding | "Find the Tenouchi hymn" |
| **Recommendations** | Discovery | "Students also practiced this" |
| **Recent/History** | Quick access | "Continue where you left off" |
| **Featured** | Highlighted content | "Lesson of the week" |

---

## 7. Search Architecture

### 7.1 Search Scope

```
┌─────────────────────────────────────────────────────────────────┐
│                        GLOBAL SEARCH                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ PEOPLE ─────────────────────────────────────────────────┐  │
│  │  Students (name, level, group)                            │  │
│  │  Servants (name, role)                                    │  │
│  │  Parents (name, linked children)                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ CURRICULUM ─────────────────────────────────────────────┐  │
│  │  Lessons (title, content, objectives)                     │  │
│  │  Hymns (name, Coptic/Arabic/English text)                │  │
│  │  Resources (filename, type)                               │  │
│  │  Quizzes (title)                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ CONTENT ────────────────────────────────────────────────┐  │
│  │  Announcements (title, body)                              │  │
│  │  Events (title, date)                                     │  │
│  │  Certificates (student, level)                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ SYSTEM ─────────────────────────────────────────────────┐  │
│  │  Settings (page name)                                     │  │
│  │  Reports (report name)                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Search Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Search students, lessons, hymns...              [ESC]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Recent Searches                                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🕐 Tenouchi hymn                                        │  │
│  │  🕐 Student: Malak                                        │  │
│  │  🕐 Level 3 attendance                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Suggestions                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Malak (Level 3, Group 2)                             │  │
│  │  📚 Lesson: Tenouchi Hymn (Level 5)                      │  │
│  │  🎵 Hymn: ⲠⲓⲚⲉⲟⲩ (Coptic)                             │  │
│  │  📝 Assessment: Level 3 Final Exam                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Quick Filters                                                  │
│  [Students] [Lessons] [Hymns] [Assessments] [Events]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. URL Structure

### 8.1 URL Conventions

| Convention | Example | Description |
|------------|---------|-------------|
| Kebab-case | `/curriculum/lessons` | All lowercase, hyphen-separated |
| Plural nouns | `/students`, `/lessons` | Consistent resource naming |
| IDs in path | `/students/123` | Resource identification |
| Nested for hierarchy | `/levels/1/groups/2` | Reflects data relationships |
| Actions as sub-paths | `/students/123/edit` | Action-oriented endpoints |
| Query for filtering | `/students?level=3&group=2` | Filter parameters |

### 8.2 URL Patterns

```
# Public
/                                    # Landing
/auth/login                          # Login
/auth/register                       # Register
/auth/forgot-password                # Password reset

# Dashboard (role-based)
/dashboard                           # Redirects to role dashboard
/dashboard/student                   # Student home
/dashboard/parent                    # Parent home
/dashboard/servant                   # Servant home
/dashboard/principal                 # Principal home

# Resources
/students                            # Student list
/students/:id                        # Student profile
/students/:id/attendance             # Student attendance
/students/:id/assessments            # Student assessments
/students/:id/progress               # Student progress

# Curriculum
/curriculum                          # Overview
/curriculum/levels                   # Levels list
/curriculum/levels/:id               # Level detail
/curriculum/levels/:id/groups/:gid   # Group detail
/curriculum/subjects                 # Subjects list
/curriculum/lessons                  # Lessons list
/curriculum/lessons/:id              # Lesson detail
/curriculum/lessons/:id/edit         # Edit lesson

# Attendance
/attendance/mark                     # Mark attendance
/attendance/history                  # History view
/attendance/calendar                 # Calendar view

# Assessments
/assessments                         # Assessment list
/assessments/new                     # Create assessment
/assessments/:id                     # Assessment detail
/assessments/:id/grade               # Grading interface
/assessments/:id/results             # Results view

# Reports
/reports                             # Report center
/reports/attendance                  # Attendance reports
/reports/progress                    # Progress reports

# Settings
/settings/profile                    # Profile
/settings/account                    # Account
/settings/notifications              # Notification prefs
/settings/school                     # School settings
/settings/users                      # User management

# Search
/search?q=tenouchi                   # Global search
/search?type=student&q=malak         # Filtered search
```

---

## 9. Responsive Behavior

### 9.1 Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | 320-640px | Single column, bottom nav |
| Tablet | 641-1024px | Collapsed sidebar, 2-column |
| Desktop | 1025-1440px | Full sidebar, multi-column |
| Wide | 1441px+ | Extended sidebar, full width |

### 9.2 Layout Adaptations

```
MOBILE (320-640px)
┌─────────────────────┐
│ ☰ NiAngelos    🔍 🔔 │
├─────────────────────┤
│                     │
│   [Content Area]    │
│   Single Column     │
│                     │
├─────────────────────┤
│ 🏠  📚  ✏️  📝  👤  │
│ Bottom Tab Bar      │
└─────────────────────┘

TABLET (641-1024px)
┌──────────────────────────────────────┐
│ ☰ NiAngelos           🔍 🔔  👤  🌐 │
├──────────┬───────────────────────────┤
│          │                           │
│ 🏠 Dash  │    [Content Area]         │
│ 📚 Curri │    2-Column Grid          │
│ 👥 Stude │                           │
│ 📝 Att   │                           │
│          │                           │
├──────────┴───────────────────────────┤
└──────────────────────────────────────┘

DESKTOP (1025-1440px)
┌──────────────────────────────────────────────────────┐
│ NiAngelos                      🔍 🔔  👤 Servant 🌐 │
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│ 🏠 Dashboard │       [Content Area]                  │
│ 📚 Curriculum│       3-Column Grid                   │
│ 👥 Students  │                                       │
│ 📝 Attendance│                                       │
│ ✏️ Assess    │                                       │
│ 📈 Progress  │                                       │
│ 💬 Messages  │                                       │
│ 📋 Reports   │                                       │
│ ⚙️ Settings  │                                       │
│              │                                       │
└──────────────┴───────────────────────────────────────┘
```

### 9.3 Component Responsive Behavior

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| **Sidebar** | Hidden (hamburger) | Collapsed icons | Full expanded |
| **Data Tables** | Card list view | Scrollable table | Full table |
| **Charts** | Stacked vertically | Side by side | Grid layout |
| **Forms** | Full width | 2-column | Multi-column |
| **Modals** | Full screen | Centered modal | Centered modal |
| **Search** | Full screen overlay | Dropdown panel | Dropdown panel |
| **Cards** | Single column | 2-column grid | 3-4 column grid |
| **Navigation** | Bottom tabs | Side icons | Side labels |

---

## 10. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| IA-01 | Users prefer shallow navigation over deep menus | Need to restructure hierarchy |
| IA-02 | Mobile is primary device for servants and parents | Desktop optimization needed |
| IA-03 | Arabic RTL layout mirrors entire navigation | Need separate RTL testing |
| IA-04 | Search is primary discovery method for curriculum | Browse-first approach needed |
| IA-05 | Parents primarily view, not create content | Parent creation features needed |
| IA-06 | 3-click rule is achievable for all pages | May need to accept 4 clicks |
| IA-07 | URL structure is human-readable and bookmarkable | Dynamic IDs may be better |
| IA-08 | Bottom tab bar is intuitive for target users | May need onboarding |
| IA-09 | Single search bar is sufficient | May need advanced search |
| IA-10 | Sidebar navigation is preferred over top nav | Top nav may be simpler |

---

## 11. Recommendations

### 11.1 Architecture Recommendations

1. **Implement Command Palette (⌘K)** – Power users will appreciate keyboard-driven navigation.

2. **Breadcrumb Navigation** – Essential for curriculum hierarchy (Level → Group → Subject → Lesson).

3. **Quick Actions** – Floating action button on mobile for common tasks (mark attendance, add note).

4. **Recent Items** – Show recent students, lessons, and reports for quick access.

5. **Favorites/Pinning** – Allow users to pin frequently used pages.

### 11.2 Navigation Recommendations

1. **Role Switching** – Allow super admins to switch between roles for testing.

2. **Contextual Sidebar** – Sidebar highlights current section and shows sub-items.

3. **Notification Center** – Dedicated notification page, not just dropdown.

4. **Mobile Gestures** – Swipe to mark attendance, pull to refresh.

5. **Keyboard Shortcuts** – Document and support common shortcuts.

### 11.3 Content Recommendations

1. **Empty States** – Design helpful empty states for new users.

2. **Loading States** – Skeleton screens for all data-heavy pages.

3. **Error States** – Clear error messages with recovery actions.

4. **Onboarding** – Guided tour for first-time users per role.

5. **Contextual Help** – Tooltips and help text on complex pages.

---

## 12. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| IR-01 | Navigation too complex for children | Medium | High | Simplified child mode, larger buttons |
| IR-02 | RTL layout breaks navigation | Medium | High | RTL-first component development |
| IR-03 | Deep curriculum hierarchy confuses users | Medium | Medium | Breadcrumbs, clear labeling |
| IR-04 | Search performance with large datasets | Medium | Medium | Indexing, pagination, caching |
| IR-05 | URL changes break bookmarks | Low | Medium | URL redirects, versioned URLs |
| IR-06 | Mobile navigation too cramped | Medium | Medium | Progressive disclosure, bottom sheets |
| IR-07 | Role-based nav confuses users | Low | Medium | Clear role indicators, help text |
| IR-08 | Information overload on dashboards | Medium | High | Progressive disclosure, customization |
| IR-09 | Coptic text in URLs causes issues | Medium | Low | URL encoding, slug generation |
| IR-10 | Deep linking to specific content fails | Low | Medium | Anchor links, deep link testing |

---

## 13. Approval Gate

### Deliverables Summary

| Deliverable | Status |
|-------------|--------|
| Information Architecture Principles | ✅ Complete |
| Global Site Map | ✅ Complete |
| Primary Navigation (Sidebar) | ✅ Complete |
| Role-Based Navigation Matrix | ✅ Complete |
| Mobile Navigation | ✅ Complete |
| Top Header Bar | ✅ Complete |
| Page Inventory (60+ pages) | ✅ Complete |
| User Flow Diagrams (4 flows) | ✅ Complete |
| Content Organization | ✅ Complete |
| Search Architecture | ✅ Complete |
| URL Structure | ✅ Complete |
| Responsive Behavior | ✅ Complete |
| Assumptions (10) | ✅ Complete |
| Recommendations | ✅ Complete |
| Risks (10) | ✅ Complete |

### Questions for Approval

1. Is the site map complete and logical?
2. Does the navigation structure meet user needs?
3. Are the user flows intuitive?
4. Is the URL structure SEO-friendly?
5. Are the responsive breakpoints appropriate?
6. Are there any missing pages or flows?

### Next Phase Preview

**Phase 4 – Database Design and ERD**
- Entity-relationship diagrams
- Database schema design
- Data models
- Relationships and constraints
- Indexing strategy

---

**Awaiting approval to proceed to Phase 4.**

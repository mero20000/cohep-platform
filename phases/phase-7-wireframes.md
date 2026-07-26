# Phase 7 – Wireframes

**NiAngelos School for Hymns and Praises – Digital Platform**

**Document Version:** 1.0
**Date:** July 2026
**Status:** Draft – Pending Approval

---

## Table of Contents

1. [Wireframe Overview](#1-wireframe-overview)
2. [Mobile Wireframes](#2-mobile-wireframes)
3. [Tablet Wireframes](#3-tablet-wireframes)
4. [Desktop Wireframes](#4-desktop-wireframes)
5. [User Flow Wireframes](#5-user-flow-wireframes)
6. [Assumptions](#6-assumptions)
7. [Recommendations](#7-recommendations)
8. [Approval Gate](#8-approval-gate)

---

## 1. Wireframe Overview

### 1.1 Wireframe Approach

| Principle | Description |
|-----------|-------------|
| **Low-Fidelity** | Focus on layout and functionality, not visual design |
| **Key Pages** | Wireframes for most important user flows |
| **Responsive** | Mobile, tablet, and desktop versions |
| **Annotated** | Key interactions and behaviors noted |

### 1.2 Key Pages Wireframed

| Page | Priority | Rationale |
|------|----------|-----------|
| Landing Page | High | First impression, conversion |
| Login/Register | High | Authentication flow |
| Student Dashboard | High | Primary student experience |
| Parent Dashboard | High | Primary parent experience |
| Servant Dashboard | High | Primary servant experience |
| Principal Dashboard | High | Primary admin experience |
| Student List | High | Core management page |
| Student Profile | High | Detailed student view |
| Attendance Marking | High | Daily servant task |
| Curriculum Browser | High | Content discovery |
| Lesson View | High | Learning experience |
| Assessment | Medium | Grading workflow |
| Reports | Medium | Analytics view |
| Settings | Low | Configuration |

---

## 2. Mobile Wireframes

### 2.1 Landing Page (Mobile)

```
┌─────────────────────────────┐
│  ☰  NiAngelos        EN ▾  │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │   [Church Illustration]│  │
│  │                       │  │
│  │   Learn. Grow.        │  │
│  │   Praise.             │  │
│  │                       │  │
│  │   The modern platform │  │
│  │   for Coptic hymn     │  │
│  │   education.          │  │
│  │                       │  │
│  │  [ Get Started → ]    │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ✨ Features            │  │
│  │                       │  │
│  │  📚 Curriculum        │  │
│  │  Structured learning  │  │
│  │  for all levels       │  │
│  │                       │  │
│  │  📊 Progress          │  │
│  │  Track your child's   │  │
│  │  journey              │  │
│  │                       │  │
│  │  🏆 Achievements      │  │
│  │  Earn badges and      │  │
│  │  certificates         │  │
│  │                       │  │
│  │  📱 Mobile First      │  │
│  │  Learn anywhere,      │  │
│  │  anytime              │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🙏 Testimonials        │  │
│  │                       │  │
│  │ "This platform has    │  │
│  │  transformed how our  │  │
│  │  children learn hymns"│  │
│  │  - Servant Mariam     │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 📧 Get Updates         │  │
│  │                       │  │
│  │ [email@example.com]   │  │
│  │ [ Subscribe ]         │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  🏠     📚     ✏️     👤    │
│  Home  Lessons  Menu  Profile│
└─────────────────────────────┘
```

### 2.2 Login Page (Mobile)

```
┌─────────────────────────────┐
│  ←                           │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │   [Cross Logo]        │  │
│  │                       │  │
│  │   Welcome Back        │  │
│  │   Sign in to continue │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Email                 │  │
│  │ [________________]    │  │
│  │                       │  │
│  │ Password              │  │
│  │ [________________] 👁 │  │
│  │                       │  │
│  │ Forgot Password?      │  │
│  │                       │  │
│  │ [    Sign In →     ]  │  │
│  │                       │  │
│  │ ─── OR ───            │  │
│  │                       │  │
│  │ [Sign in with Google] │  │
│  │                       │  │
│  │ Don't have account?   │  │
│  │ Register              │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### 2.3 Student Dashboard (Mobile)

```
┌─────────────────────────────┐
│  NiAngelos        🔔  👤    │
├─────────────────────────────┤
│                             │
│  Good morning, Malak! 👋   │
│  Level 3 · Group 2          │
│                             │
│  ┌───────────────────────┐  │
│  │ 🏆 Level 2 (750 XP)   │  │
│  │ ████████░░░░░░░ 75%   │  │
│  │ 250 XP to Level 3     │  │
│  └───────────────────────┘  │
│                             │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 📚  │ │ 🔥  │ │ ⭐  │  │
│  │ 12  │ │ 7   │ │ 5   │  │
│  │Done │ │Day  │ │Badge│  │
│  └─────┘ └─────┘ └─────┘  │
│                             │
│  Continue Learning →        │
│  ┌───────────────────────┐  │
│  │ 📖 Lesson 5           │  │
│  │ Tenouchi Hymn         │  │
│  │ Session 2 of 3        │  │
│  │ ████░░░░░░░ 67%       │  │
│  │ [ Continue → ]        │  │
│  └───────────────────────┘  │
│                             │
│  Today's Schedule →         │
│  ┌───────────────────────┐  │
│  │ 📅 2:00 PM            │  │
│  │ Hymn Class            │  │
│  │ Room: Church Hall     │  │
│  └───────────────────────┘  │
│                             │
│  Recent Achievements →      │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 🥇  │ │ 📝  │ │ 🎯  │  │
│  │Star │ │Quiz │ │Goal │  │
│  │     │ │100% │ │Met  │  │
│  └─────┘ └─────┘ └─────┘  │
│                             │
├─────────────────────────────┤
│  🏠    📚    ✏️    📝    👤  │
│ Home Lessons Menu Att Profile│
└─────────────────────────────┘
```

### 2.4 Attendance Marking (Mobile)

```
┌─────────────────────────────┐
│  ← Mark Attendance    💾    │
├─────────────────────────────┤
│                             │
│  Level: [Level 3 ▾]         │
│  Group: [Group 2 ▾]         │
│  Date:  [Today ▾]           │
│                             │
│  ┌───────────────────────┐  │
│  │ [Mark All Present]    │  │
│  │ 15/15 marked          │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 Malak Ahmed        │  │
│  │ [✅] [⏰] [📝] [❌]    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 Peter Soliman      │  │
│  │ [✅] [⏰] [📝] [❌]    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 Sarah Mourad       │  │
│  │ [✅] [⏰] [📝] [❌]    │  │
│  │ [Add Note]            │  │
│  │ ┌─────────────────┐   │  │
│  │ │ Note: Late due   │   │  │
│  │ │ to traffic       │   │  │
│  │ └─────────────────┘   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 Michael Girgis     │  │
│  │ [✅] [⏰] [📝] [❌]    │  │
│  └───────────────────────┘  │
│                             │
│  ... (11 more students)     │
│                             │
│  ┌───────────────────────┐  │
│  │ [    Save Attendance  ]│  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### 2.5 Student Profile (Mobile)

```
┌─────────────────────────────┐
│  ← Back            ⋮ Menu  │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │      [Photo]          │  │
│  │      Malak Ahmed      │  │
│  │      Level 3 · Group 2│  │
│  │      Age 9 · Female   │  │
│  └───────────────────────┘  │
│                             │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 85% │ │ 4.2 │ │750  │  │
│  │Attnd│ │Avg  │ │XP   │  │
│  └─────┘ └─────┘ └─────┘  │
│                             │
│  [Overview] [History] [Docs]│
│                             │
│  Progress Overview          │
│  ┌───────────────────────┐  │
│  │ ████████████░░░ 75%   │  │
│  │ Level 3               │  │
│  │                       │  │
│  │ Hymns:    ████████ 80%│  │
│  │ Rites:    ██████░ 60% │  │
│  │ Language: █████████ 90%│  │
│  └───────────────────────┘  │
│                             │
│  Recent Activity            │
│  ┌───────────────────────┐  │
│  │ ✅ Lesson 5 Complete  │  │
│  │    2 hours ago        │  │
│  │                       │  │
│  │ 📝 Quiz: 95%         │  │
│  │    Yesterday          │  │
│  │                       │  │
│  │ 🎵 Practice Recording │  │
│  │    2 days ago         │  │
│  └───────────────────────┘  │
│                             │
│  Parent Information         │
│  ┌───────────────────────┐  │
│  │ 👤 Hany Ahmed (Father)│  │
│  │ 📧 hany@email.com     │  │
│  │ 📱 +61 4XX XXX XXX    │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

---

## 3. Tablet Wireframes

### 3.1 Servant Dashboard (Tablet)

```
┌──────────────────────────────────────────────────────────────┐
│  NiAngelos                  🔍 Search...           🔔  👤  🌐│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Good morning, Servant Mariam! 👋                            │
│  Here's your teaching overview for today.                    │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ 📊 15       │ │ 📝 2        │ │ ⏰ 1        │           │
│  │ Students    │ │ Classes     │ │ Pending     │           │
│  │ Today       │ │ Today       │ │ Grades      │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  ┌──────────────────────────┐ ┌──────────────────────────┐  │
│  │                          │ │                          │  │
│  │  Today's Schedule        │ │  Class Overview          │  │
│  │  ─────────────           │ │  ──────────────          │  │
│  │                          │ │                          │  │
│  │  📅 2:00 PM              │ │  Level 3, Group 2        │  │
│  │  Level 3 - Hymns         │ │  Students: 15            │  │
│  │  Room: Church Hall       │ │  Attendance: 95%         │  │
│  │  [Mark Attendance →]     │ │  Last Score: 88%         │  │
│  │                          │ │                          │  │
│  │  📅 4:00 PM              │ │  Level 5, Group 1        │  │
│  │  Level 5 - Rites         │ │  Students: 12            │  │
│  │  Room: Classroom 2       │ │  Attendance: 92%         │  │
│  │  [Mark Attendance →]     │ │  Last Score: 85%         │  │
│  │                          │ │                          │  │
│  └──────────────────────────┘ └──────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────┐ ┌──────────────────────────┐  │
│  │                          │ │                          │  │
│  │  Recent Activity         │ │  Quick Actions           │  │
│  │  ─────────────           │ │  ──────────────          │  │
│  │                          │ │                          │  │
│  │  ✅ Malak completed      │ │  [Mark Attendance]       │  │
│  │     Lesson 5             │ │  [Grade Assessments]     │  │
│  │                          │ │  [View Reports]          │  │
│  │  📝 Peter submitted      │ │  [Send Message]          │  │
│  │     Quiz                 │ │                          │  │
│  │                          │ │                          │  │
│  │  🎵 Sarah uploaded       │ │                          │  │
│  │     Practice Audio       │ │                          │  │
│  │                          │ │                          │  │
│  └──────────────────────────┘ └──────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Curriculum Browser (Tablet)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Curriculum              🔍 Search...           🔔  👤    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [All Levels] [Level 1] [Level 2] [Level 3 ▾] [Level 4]    │
│                                                              │
│  Level 3: Coptic Hymns                                       │
│  12 Lessons · 8 Published · 4 Draft                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Filter: [All Status ▾] [All Subjects ▾]  Sort: [Newest]│  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────┐ ┌────────────────────┐              │
│  │ ┌────────────────┐ │ │ ┌────────────────┐ │              │
│  │ │   [Cover]      │ │ │ │   [Cover]      │ │              │
│  │ └────────────────┘ │ │ └────────────────┘ │              │
│  │                    │ │                    │              │
│  │ Lesson 1           │ │ Lesson 2           │              │
│  │ Tenouchi Hymn      │ │ ⲠⲓⲚⲉⲟⲩ            │              │
│  │                    │ │                    │              │
│  │ Sessions: 3        │ │ Sessions: 2        │              │
│  │ Resources: 5       │ │ Resources: 3       │              │
│  │ Status: Published  │ │ Status: Published  │              │
│  │                    │ │                    │              │
│  │ [View] [Edit]      │ │ [View] [Edit]      │              │
│  └────────────────────┘ └────────────────────┘              │
│                                                              │
│  ┌────────────────────┐ ┌────────────────────┐              │
│  │ ┌────────────────┐ │ │ ┌────────────────┐ │              │
│  │ │   [Cover]      │ │ │ │   [Cover]      │ │              │
│  │ └────────────────┘ │ │ └────────────────┘ │              │
│  │                    │ │                    │              │
│  │ Lesson 3           │ │ Lesson 4           │              │
│  │ Psalmody           │ │ Doxology           │              │
│  │                    │ │                    │              │
│  │ Sessions: 4        │ │ Sessions: 3        │              │
│  │ Resources: 8       │ │ Resources: 6       │              │
│  │ Status: Published  │ │ Status: Draft      │              │
│  │                    │ │                    │              │
│  │ [View] [Edit]      │ │ [View] [Edit]      │              │
│  └────────────────────┘ └────────────────────┘              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Desktop Wireframes

### 4.1 Principal Dashboard (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════════════╗ │
│  ║  NiAngelos                    🔍 Search students, lessons...    🔔  👤  🌐 ║ │
│  ╚══════════════════════════════════════════════════════════════════════════════╝ │
│  ┌────────────────────┬─────────────────────────────────────────────────────────┐│
│  │                    │                                                         ││
│  │  🏠 Dashboard      │  Welcome back, Principal Boutros! 👋                    ││
│  │  📚 Curriculum     │  Here's what's happening at your school.               ││
│  │  👥 Students       │                                                         ││
│  │  📝 Attendance     │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     ││
│  │  ✏️ Assessments    │  │ 👥      │ │ 📊      │ │ 📈      │ │ 🎓      │     ││
│  │  📈 Progress       │  │ 245     │ │ 94%     │ │ 87%     │ │ 42      │     ││
│  │                    │  │Students │ │Attend.  │ │Avg Score│ │Badges   │     ││
│  │  ─────────────     │  │ ↑12     │ │ ↑2%     │ │ ↑3%     │ │This Month│    ││
│  │                    │  └─────────┘ └─────────┘ └─────────┘ └─────────┘     ││
│  │  💬 Messages [3]   │                                                         ││
│  │  📢 Announcements  │  ┌─────────────────────────────┐ ┌───────────────────┐││
│  │  📅 Events         │  │                             │ │                   │││
│  │                    │  │  Attendance Trends           │ │  Level Performance │││
│  │  ─────────────     │  │  (Line Chart)               │ │  (Bar Chart)      │││
│  │                    │  │                             │ │                   │││
│  │  📋 Reports        │  │  📈                         │ │  📊               │││
│  │  🏆 Achievements   │  │     ╱╲                      │ │  ████░░ Level 1   │││
│  │                    │  │   ╱   ╲    ╱╲              │ │  ██████░ Level 2  │││
│  │  ─────────────     │  │  ╱     ╲  ╱  ╲╱╲          │ │  ███░░░░ Level 3  │││
│  │                    │  │ ╱       ╲╱        ╲        │ │  █████░░ Level 4  │││
│  │  ⚙️ Settings       │  │╱                    ╲      │ │  ████░░░ Level 5  │││
│  │  👤 Users          │  └─────────────────────────────┘ └───────────────────┘││
│  │  🏫 School         │                                                         ││
│  │                    │  ┌─────────────────────────────┐ ┌───────────────────┐││
│  │                    │  │  At-Risk Students            │ │  Recent Activity  │││
│  │                    │  │  ─────────────────           │ │  ──────────────   │││
│  │                    │  │                             │ │                   │││
│  │                    │  │  ⚠️ Peter Soliman            │ │  ✅ 15 students   │││
│  │                    │  │     Attendance: 65%         │ │     promoted      │││
│  │                    │  │                             │ │                   │││
│  │                    │  │  ⚠️ Michael Girgis           │ │  📝 3 assessments │││
│  │                    │  │     Score: 55%              │ │     graded        │││
│  │                    │  │                             │ │                   │││
│  │                    │  │  [View All At-Risk →]       │ │  📢 2 announcements│││
│  │                    │  └─────────────────────────────┘ │     sent          │││
│  │                    │                                  └───────────────────┘││
│  └────────────────────┴─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Student List (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════════════╗ │
│  ║  NiAngelos                    🔍 Search...                      🔔  👤  🌐 ║ │
│  ╚══════════════════════════════════════════════════════════════════════════════╝ │
│  ┌────────────────────┬─────────────────────────────────────────────────────────┐│
│  │                    │  Students                                    [+ Add] ││
│  │  🏠 Dashboard      │                                                         ││
│  │  📚 Curriculum     │  Filter: [All Levels ▾] [All Groups ▾] [All Status ▾]  ││
│  │  👥 Students       │  Search: [________________] 🔍                          ││
│  │  📝 Attendance     │                                                         ││
│  │  ✏️ Assessments    │  ┌─────┬──────────────┬───────┬────────┬──────┬──────┐││
│  │  📈 Progress       │  │ ☐   │ Name         │ Level │ Group  │ Att  │ Sts  │││
│  │                    │  ├─────┼──────────────┼───────┼────────┼──────┼──────┤││
│  │  ─────────────     │  │ ☐   │ 👤 Malak     │ L3    │ G2     │ 95%  │ ✅   │││
│  │                    │  │ ☐   │ 👤 Peter     │ L3    │ G2     │ 65%  │ ⚠️   │││
│  │  💬 Messages       │  │ ☐   │ 👤 Sarah     │ L3    │ G2     │ 92%  │ ✅   │││
│  │  📢 Announcements  │  │ ☐   │ 👤 Michael   │ L5    │ G1     │ 88%  │ ✅   │││
│  │  📅 Events         │  │ ☐   │ 👤 Maria     │ L5    │ G1     │ 91%  │ ✅   │││
│  │                    │  │ ☐   │ 👤 John      │ L7    │ G3     │ 78%  │ ✅   │││
│  │  ─────────────     │  │ ☐   │ 👤 Anna      │ L2    │ G1     │ 85%  │ ✅   │││
│  │                    │  │ ☐   │ 👤 David     │ L8    │ G2     │ 82%  │ ✅   │││
│  │  📋 Reports        │  │ ☐   │ 👤 Sarah     │ L4    │ G1     │ 90%  │ ✅   │││
│  │  🏆 Achievements   │  │ ☐   │ 👤 George    │ L6    │ G1     │ 75%  │ ⚠️   │││
│  │                    │  ├─────┴──────────────┴───────┴────────┴──────┴──────┤││
│  │  ─────────────     │  │  Showing 1-10 of 245 students                      │││
│  │                    │  │  [← Prev]  1  2  3  ...  25  [Next →]              │││
│  │  ⚙️ Settings       │  └────────────────────────────────────────────────────┘││
│  │  👤 Users          │                                                         ││
│  │  🏫 School         │  Bulk Actions: [Promote ▾] [Export ▾] [Delete]          ││
│  │                    │                                                         ││
│  └────────────────────┴─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Lesson View (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════════════╗ │
│  ║  NiAngelos                    🔍 Search...                      🔔  👤  🌐 ║ │
│  ╚══════════════════════════════════════════════════════════════════════════════╝ │
│  ┌────────────────────┬─────────────────────────────────────────────────────────┐│
│  │                    │  ← Back to Curriculum                                   ││
│  │  🏠 Dashboard      │                                                         ││
│  │  📚 Curriculum     │  Lesson 5: Tenouchi Hymn (Second Part)                  ││
│  │  👥 Students       │  Level 3 · Coptic Hymns · Session 2 of 3               ││
│  │  📝 Attendance     │                                                         ││
│  │  ✏️ Assessments    │  [Overview] [Content] [Resources] [Quiz] [Progress]     ││
│  │  📈 Progress       │                                                         ││
│  │                    │  ┌─────────────────────────────────────────────────────┐││
│  │  ─────────────     │  │                                                     │││
│  │                    │  │  Learning Objectives                                 │││
│  │  💬 Messages       │  │  ───────────────────                                 │││
│  │  📢 Announcements  │  │  ✅ Student can recite the Tenouchi from memory     │││
│  │  📅 Events         │  │  ✅ Student understands the theological meaning     │││
│  │                    │  │  ⬜ Student can chant with proper pronunciation     │││
│  │  ─────────────     │  │                                                     │││
│  │                    │  │  Required Memorization                               │││
│  │  📋 Reports        │  │  Ⲡⲓⲙⲱⲟⲩⲉⲓ ⲙⲫⲙⲏⲓ... (Coptic text)               │││
│  │  🏆 Achievements   │  │                                                     │││
│  │                    │  │  ⏱️ Estimated Duration: 45 minutes                  │││
│  │  ─────────────     │  │                                                     │││
│  │                    │  └─────────────────────────────────────────────────────┘││
│  │  ⚙️ Settings       │                                                         ││
│  │  👤 Users          │  ┌─────────────────────────────────────────────────────┐││
│  │  🏫 School         │  │                                                     │││
│  │                    │  │  Session Content                                     │││
│  │                    │  │  ────────────────                                    │││
│  │                    │  │                                                     │││
│  │                    │  │  [English] [العربية] [ⲙⲛⲧⲣⲙⲛⲕⲏⲙⲉ]               │││
│  │                    │  │                                                     │││
│  │                    │  │  The Tenouchi hymn is sung during the               │││
│  │                    │  │  offering portion of the Divine Liturgy...          │││
│  │                    │  │                                                     │││
│  │                    │  │  ┌────────────────────────────────────────────────┐ │││
│  │                    │  │  │  🎵 Audio Player                              │ │││
│  │                    │  │  │  ▶️ ───────●──────────── 3:45                  │ │││
│  │                    │  │  │  Tenouchi_Hymn.mp3          🔊  ⚡ 0.75x 1x  │ │││
│  │                    │  │  └────────────────────────────────────────────────┘ │││
│  │                    │  │                                                     │││
│  │                    │  │  [📄 View PDF] [📥 Download] [▶️ Watch Video]       │││
│  │                    │  │                                                     │││
│  │                    │  └─────────────────────────────────────────────────────┘││
│  └────────────────────┴─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. User Flow Wireframes

### 5.1 New Student Registration Flow

```
Step 1              Step 2              Step 3              Step 4
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Parent      │    │ Enter       │    │ Add Child   │    │ Confirmation│
│ Registers   │    │ Details     │    │ Details     │    │ & Login     │
│             │    │             │    │             │    │             │
│ [Email]     │    │ [Name]      │    │ [Child Name]│    │ ✅ Account  │
│ [Phone]     │    │ [Phone]     │    │ [DOB]       │    │   Created   │
│ [Password]  │    │ [Password]  │    │ [Gender]    │    │             │
│ [Register]  │    │ [Next →]    │    │ [Next →]    │    │ [Dashboard] │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 5.2 Attendance Marking Flow

```
Step 1              Step 2              Step 3              Step 4
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Select      │    │ View        │    │ Mark        │    │ Save &      │
│ Class       │    │ Roster      │    │ Students    │    │ Notify      │
│             │    │             │    │             │    │             │
│ Level: [▼]  │    │ 👤 Student1 │    │ ✅ Present  │    │ ✅ Saved    │
│ Group: [▼]  │    │ 👤 Student2 │    │ ⏰ Late     │    │             │
│ Date: [▼]   │    │ 👤 Student3 │    │ ❌ Absent   │    │ 📧 Parents  │
│ [Next →]    │    │ ...         │    │ ...         │    │ notified    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 5.3 Lesson Learning Flow (Student)

```
Step 1              Step 2              Step 3              Step 4
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ View        │    │ Read        │    │ Listen to   │    │ Complete    │
│ Lesson      │    │ Content     │    │ Hymn        │    │ Quiz        │
│             │    │             │    │             │    │             │
│ Objectives  │    │ [English]   │    │ ▶️ Play     │    │ Q1: [A] ✓   │
│ Duration    │    │ [Arabic]    │    │ ⏱️ 3:45     │    │ Q2: [B] ✓   │
│ Prereqs     │    │ [Coptic]    │    │ 🔊 Volume   │    │ Q3: [C] ✗   │
│ [Start →]   │    │ [Next →]    │    │ [Next →]    │    │ [Submit]    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                              │
                                                              ▼
                                                       ┌─────────────┐
                                                       │ 🎉 Results  │
                                                       │             │
                                                       │ Score: 67%  │
                                                       │ +150 XP     │
                                                       │ 🏆 Badge?   │
                                                       │ [Continue]  │
                                                       └─────────────┘
```

---

## 6. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| WF-01 | Wireframes adequately communicate layout | Need higher fidelity |
| WF-02 | Key pages are identified correctly | May need additional wireframes |
| WF-03 | Mobile-first approach is correct | May need desktop-first |
| WF-04 | Annotation is sufficient for interactions | May need prototype |
| WF-05 | Wireframes will guide design phase | May need more detail |

---

## 7. Recommendations

### 7.1 Wireframe Recommendations

1. **Interactive Prototype** – Consider creating Figma prototype for user testing.

2. **User Testing** – Test wireframes with real users before high-fidelity design.

3. **Accessibility Review** – Review wireframes for accessibility concerns.

4. **Mobile Testing** – Test mobile wireframes on actual devices.

5. **Iteration** – Expect to iterate based on feedback.

---

## 8. Approval Gate

### Deliverables Summary

| Deliverable | Status |
|-------------|--------|
| Mobile Wireframes (5 pages) | ✅ Complete |
| Tablet Wireframes (2 pages) | ✅ Complete |
| Desktop Wireframes (3 pages) | ✅ Complete |
| User Flow Wireframes (3 flows) | ✅ Complete |

### Questions for Approval

1. Are the wireframe layouts appropriate?
2. Are the key pages covered?
3. Do the user flows make sense?
4. Should any additional pages be wireframed?

### Next Phase Preview

**Phase 8 – High-Fidelity Interface Designs**
- Detailed visual designs
- Component specifications
- Design file handoff

---

**Awaiting approval to proceed to Phase 8.**

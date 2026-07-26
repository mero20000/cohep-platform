# Phase 8 – High-Fidelity Interface Designs

**NiAngelos School for Hymns and Praises – Digital Platform**

**Document Version:** 1.0
**Date:** July 2026
**Status:** Draft – Pending Approval

---

## Table of Contents

1. [Design Specifications](#1-design-specifications)
2. [Component Specifications](#2-component-specifications)
3. [Page Designs](#3-page-designs)
4. [Responsive Specifications](#4-responsive-specifications)
5. [Interaction Specifications](#5-interaction-specifications)
6. [Design Tokens Implementation](#6-design-tokens-implementation)
7. [Assumptions](#7-assumptions)
8. [Recommendations](#8-recommendations)
9. [Approval Gate](#9-approval-gate)

---

## 1. Design Specifications

### 1.1 Design Tools

| Tool | Purpose | Version |
|------|---------|---------|
| **Figma** | Primary design tool | Latest |
| **Storybook** | Component documentation | 8.x |
| **Tailwind CSS** | Utility-first CSS | 4.x |
| **shadcn/ui** | Component library | Latest |

### 1.2 Design File Structure

```
NiAngelos Design/
├── 00 - Foundations/
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Icons
│   └── Shadows
│
├── 01 - Components/
│   ├── Primitives/
│   │   ├── Button
│   │   ├── Input
│   │   ├── Select
│   │   ├── Checkbox
│   │   ├── Radio
│   │   └── Switch
│   │
│   ├── Layout/
│   │   ├── Card
│   │   ├── Modal
│   │   ├── Drawer
│   │   ├── Tabs
│   │   └── Sidebar
│   │
│   ├── Data Display/
│   │   ├── Table
│   │   ├── List
│   │   ├── Badge
│   │   ├── Avatar
│   │   ├── Progress
│   │   └── Chart
│   │
│   └── Coptic-Specific/
│       ├── AudioPlayer
│       ├── CopticText
│       ├── LessonCard
│       └── ProgressRing
│
├── 02 - Pages/
│   ├── Public/
│   │   ├── Landing
│   │   ├── Login
│   │   └── Register
│   │
│   ├── Student/
│   │   ├── Dashboard
│   │   ├── MyLessons
│   │   ├── LessonView
│   │   ├── Achievements
│   │   └── Profile
│   │
│   ├── Parent/
│   │   ├── Dashboard
│   │   ├── ChildProfile
│   │   └── Reports
│   │
│   ├── Servant/
│   │   ├── Dashboard
│   │   ├── StudentList
│   │   ├── Attendance
│   │   └── Curriculum
│   │
│   └── Principal/
│       ├── Dashboard
│       ├── StudentManagement
│       ├── Reports
│       └── Settings
│
├── 03 - Flows/
│   ├── Registration
│   ├── Attendance
│   ├── Learning
│   └── Assessment
│
└── 04 - Responsive/
    ├── Mobile (375px)
    ├── Tablet (768px)
    ├── Desktop (1280px)
    └── Wide (1440px)
```

---

## 2. Component Specifications

### 2.1 Button Specifications

#### Primary Button

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIMARY BUTTON                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Size: MD (default)                                             │
│  ┌─────────────────────────────────────┐                       │
│  │          Button Text                │                       │
│  └─────────────────────────────────────┘                       │
│  Width: Auto (min: 120px)                                      │
│  Height: 44px                                                  │
│  Padding: 12px 24px                                            │
│  Border Radius: 8px                                            │
│  Font: Inter Medium 14px                                       │
│  Color: #D4A843 (Coptic Gold)                                  │
│  Text: #FFFFFF                                                  │
│                                                                 │
│  States:                                                        │
│  ┌─────────────────────────────────────┐                       │
│  │ Default:  #D4A843 bg, #FFF text     │                       │
│  │ Hover:    #B8912A bg                 │                       │
│  │ Active:   #8B6914 bg                 │                       │
│  │ Disabled: #E5E7EB bg, #9CA3AF text  │                       │
│  │ Loading:  Spinner + "Loading..."     │                       │
│  └─────────────────────────────────────┘                       │
│                                                                 │
│  Sizes:                                                        │
│  ┌──────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ SM   │  │ MD (default)│  │ LG           │  │ XL           │ │
│  │ 32px │  │ 44px        │  │ 48px         │  │ 56px         │ │
│  │ 8px  │  │ 12px        │  │ 16px         │  │ 20px         │ │
│  │ 16px │  │ 24px        │  │ 32px         │  │ 40px         │ │
│  └──────┘  └────────────┘  └──────────────┘  └──────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Button Variants

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUTTON VARIANTS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Primary ]      Gold bg (#D4A843), White text                │
│  [ Secondary ]    White bg, Gold border, Gold text              │
│  [ Ghost ]        Transparent bg, Gray text                    │
│  [ Danger ]       Red bg (#EF4444), White text                 │
│  [ Link ]         No bg, Blue text (#2563EB), Underline        │
│                                                                 │
│  Icon Buttons:                                                  │
│  ┌───┐  ┌───┐  ┌───┐                                         │
│  │ + │  │ ✏️ │  │ 🗑️ │  (Same variants, square shape)          │
│  └───┘  └───┘  └───┘                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Input Specifications

#### Text Input

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEXT INPUT                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Label: "Email Address" (Inter Medium 14px, #374151)           │
│  Required: * (Red)                                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📧  Enter your email...                         │   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  Height: 44px                                                  │
│  Padding: 12px 16px                                            │
│  Border: 1px solid #D1D5DB                                     │
│  Border Radius: 8px                                            │
│  Font: Inter Regular 16px                                      │
│  Placeholder: #9CA3AF                                          │
│                                                                 │
│  States:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Default:  Border #D1D5DB                                │   │
│  │ Focus:    Border #D4A843, Ring 2px rgba(212,168,67,0.2) │   │
│  │ Error:    Border #EF4444, Ring 2px rgba(239,68,68,0.2)  │   │
│  │ Disabled: bg #F3F4F6, text #9CA3AF                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Error State:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📧  invalid-email                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ❌ Please enter a valid email address                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Card Specifications

#### Content Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT CARD                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │                 [Cover Image]                   │   │   │
│  │  │                 Height: 160px                   │   │   │
│  │  │                 Object-fit: cover               │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  Padding: 24px                                         │   │
│  │                                                         │   │
│  │  Title (Inter Semibold 18px, #111827)                  │   │
│  │  Description (Inter Regular 14px, #6B7280)             │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  Status Badge    │   Progress Ring              │   │   │
│  │  │  [Published]     │   ████░░░░ 75%               │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  ─────────────────────────────────────────────────     │   │
│  │                                                         │   │
│  │  [View Details →]                    [Edit] [Delete]   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)                         │
│  Border: 1px solid #E5E7EB                                     │
│  Border Radius: 12px                                           │
│  Background: #FFFFFF                                           │
│                                                                 │
│  Hover: Shadow 0 4px 6px rgba(0, 0, 0, 0.1)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Stats Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATS CARD                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  📊  Icon (24px, #D4A843)                              │   │
│  │                                                         │   │
│  │  245  Number (Inter Bold 30px, #111827)                 │   │
│  │  Students  Label (Inter Regular 14px, #6B7280)         │   │
│  │                                                         │   │
│  │  ↑ 12% from last month                                 │   │
│  │  (Inter Regular 12px, #22C55E)                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Padding: 24px                                                 │
│  Background: #FFFFFF                                           │
│  Border: 1px solid #E5E7EB                                     │
│  Border Radius: 12px                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Audio Player Specifications

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIO PLAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Compact Version (for lesson cards):                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▶️  ────────●──────────────── 3:45    🔊               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Full Version (for lesson view):                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  🎵 Tenouchi Hymn (Second Part)                        │   │
│  │     Coptic Hymns · Level 3                             │   │
│  │                                                         │   │
│  │  ▶️  ──────────────●───────────────────── 3:45          │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  🔊 Volume     ⚡ Speed     🔄 Loop    📋 Info  │   │   │
│  │  │  ████░░░░░    [0.75x][1x]                     │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  │  [← Previous]              [Next →]                     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Colors:                                                       │
│  - Progress: #D4A843 (Coptic Gold)                            │
│  - Background: #F3F4F6                                         │
│  - Icons: #6B7280                                              │
│  - Active Icon: #D4A843                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Progress Ring Specifications

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROGRESS RING                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Small (48px):                                                  │
│  ┌─────┐                                                       │
│  │ ███ │  For inline use (cards, tables)                       │
│  │ ░░░ │  Stroke width: 4px                                    │
│  └─────┘  Font: Inter Bold 12px                                │
│                                                                 │
│  Medium (80px):                                                 │
│  ┌───────────┐                                                 │
│  │   ████    │  For dashboard widgets                          │
│  │   ░░░░    │  Stroke width: 6px                              │
│  │   75%     │  Font: Inter Bold 16px                          │
│  └───────────┘                                                 │
│                                                                 │
│  Large (120px):                                                 │
│  ┌───────────────┐                                             │
│  │    ██████     │  For profile pages                          │
│  │    ░░░░░░     │  Stroke width: 8px                          │
│  │     75%       │  Font: Inter Bold 24px                      │
│  └───────────────┘                                             │
│                                                                 │
│  Colors:                                                       │
│  - Progress fill: #D4A843 (Coptic Gold)                       │
│  - Background track: #E5E7EB                                   │
│  - Text: #111827                                               │
│                                                                 │
│  Animations:                                                   │
│  - Animate on mount (stroke-dashoffset)                        │
│  - Transition: 0.5s ease-out                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Page Designs

### 3.1 Landing Page Design

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════════════╗ │
│  ║  🏛️ NiAngelos                    Features  Pricing  About    [Sign In]     ║ │
│  ║                                  Curriculum  Contact    [Get Started]       ║ │
│  ╚══════════════════════════════════════════════════════════════════════════════╝ │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │                    Learn. Grow. Praise.                                      ││
│  │                                                                              ││
│  │            The modern platform for Coptic hymn education                     ││
│  │                                                                              ││
│  │        ┌──────────────────────────────────────────────────────────┐         ││
│  │        │                                                          │         ││
│  │        │           [Hero Illustration]                            │         ││
│  │        │           Church + Students + Music                      │         ││
│  │        │                                                          │         ││
│  │        └──────────────────────────────────────────────────────────┘         ││
│  │                                                                              ││
│  │        [ Get Started Free → ]        [ Watch Demo → ]                       ││
│  │                                                                              ││
│  │        ✨ No credit card required · Free for small churches                  ││
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │                           Trusted by 50+ Churches                            ││
│  │                                                                              ││
│  │     [Logo]  [Logo]  [Logo]  [Logo]  [Logo]  [Logo]                          ││
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │                    Everything you need to teach & learn                      ││
│  │                                                                              ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              ││
│  │  │  📚              │  │  📊              │  │  🏆              │              ││
│  │  │                  │  │                  │  │                  │              ││
│  │  │  Structured      │  │  Real-time       │  │  Gamified        │              ││
│  │  │  Curriculum      │  │  Progress        │  │  Learning        │              ││
│  │  │                  │  │                  │  │                  │              ││
│  │  │  Organized       │  │  Track student   │  │  XP points,      │              ││
│  │  │  lessons with    │  │  attendance and  │  │  badges, and     │              ││
│  │  │  audio, video,   │  │  assessment      │  │  certificates    │              ││
│  │  │  and resources   │  │  scores          │  │  keep students   │              ││
│  │  │                  │  │                  │  │  motivated       │              ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘              ││
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │                    Built for the Coptic community                            ││
│  │                                                                              ││
│  │  ┌──────────────────────────────┐  ┌──────────────────────────────┐         ││
│  │  │                              │  │                              │         ││
│  │  │  [Feature Image 1]           │  │  Coptic Text Support         │         ││
│  │  │                              │  │                              │         ││
│  │  │                              │  │  Full Unicode support for     │         ││
│  │  │                              │  │  Coptic language with proper  │         ││
│  │  │                              │  │  rendering and search         │         ││
│  │  │                              │  │                              │         ││
│  │  └──────────────────────────────┘  └──────────────────────────────┘         ││
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │                    Start teaching today                                      ││
│  │                                                                              ││
│  │        [ Get Started Free → ]                                                ││
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │  🏛️ NiAngelos                          Features  Curriculum  Pricing        ││
│  │  School for Hymns                       About  Contact  Blog                 ││
│  │                                                                              ││
│  │  © 2026 NiAngelos. All rights reserved.                                     ││
│  │  Privacy Policy  ·  Terms of Service  ·  Contact                            ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Student Dashboard Design (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════════════╗ │
│  ║  🏛️ NiAngelos              🔍 Search...        🔔 [3]  👤 Malak  🌐 EN ▾   ║ │
│  ╚══════════════════════════════════════════════════════════════════════════════╝ │
│  ┌──────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                              ││
│  │  ┌────────────────────────────────────────────────────────────────────────┐  ││
│  │  │                                                                        │  ││
│  │  │  Good morning, Malak! 👋                                               │  ││
│  │  │  Level 3 · Group 2 · Today is Sunday, July 13                         │  ││
│  │  │                                                                        │  ││
│  │  └────────────────────────────────────────────────────────────────────────┘  ││
│  │                                                                              ││
│  │  ┌────────────────────────────────────────────────────────────────────────┐  ││
│  │  │                                                                        │  ││
│  │  │  Your Progress                                                         │  ││
│  │  │  ───────────────                                                       │  ││
│  │  │                                                                        │  ││
│  │  │  ┌────────────────────────────────────────────────────────────────┐   │  ││
│  │  │  │  Level 3 Progress                                              │   │  ││
│  │  │  │                                                                │   │  ││
│  │  │  │  ┌──────────┐                                                  │   │  ││
│  │  │  │  │  ██████  │  75% Complete                                  │   │  ││
│  │  │  │  │  ░░░░░░  │  12 of 16 lessons done                        │   │  ││
│  │  │  │  └──────────┘                                                  │   │  ││
│  │  │  │                                                                │   │  ││
│  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │   │  ││
│  │  │  │  │ 🔥 7    │  │ ⭐ 750  │  │ 📊 85%  │  │ 🎯 3    │          │   │  ││
│  │  │  │  │ Day     │  │ XP      │  │ Average │  │ Badges  │          │   │  ││
│  │  │  │  │ Streak  │  │ Points  │  │ Score   │  │ Earned  │          │   │  ││
│  │  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │   │  ││
│  │  │  │                                                                │   │  ││
│  │  │  └────────────────────────────────────────────────────────────────┘   │  ││
│  │  │                                                                        │  ││
│  │  └────────────────────────────────────────────────────────────────────────┘  ││
│  │                                                                              ││
│  │  ┌────────────────────────────────────────────────────────────────────────┐  ││
│  │  │                                                                        │  ││
│  │  │  Continue Learning                                                     │  ││
│  │  │  ─────────────────                                                     │  ││
│  │  │                                                                        │  ││
│  │  │  ┌──────────────────────────────────────────────────────────────────┐ │  ││
│  │  │  │                                                                  │ │  ││
│  │  │  │  📖 Lesson 5: Tenouchi Hymn (Second Part)                       │ │  ││
│  │  │  │     Session 2 of 3                                              │ │  ││
│  │  │  │                                                                  │ │  ││
│  │  │  │  ┌────────────────────────────────────────────────────────────┐ │ │  ││
│  │  │  │  │  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  67%      │ │ │  ││
│  │  │  │  └────────────────────────────────────────────────────────────┘ │ │  ││
│  │  │  │                                                                  │ │  ││
│  │  │  │  [ Continue Learning → ]                                         │ │  ││
│  │  │  │                                                                  │ │  ││
│  │  │  └──────────────────────────────────────────────────────────────────┘ │  ││
│  │  │                                                                        │  ││
│  │  └────────────────────────────────────────────────────────────────────────┘  ││
│  │                                                                              ││
│  │  ┌────────────────────────────────────────────────────────────────────────┐  ││
│  │  │                                                                        │  ││
│  │  │  Recent Achievements                                                   │  ││
│  │  │  ───────────────────                                                   │  ││
│  │  │                                                                        │  ││
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  ││
│  │  │  │  🥇     │  │  📝     │  │  🎯     │  │  🔥     │  │  ⭐     │    │  ││
│  │  │  │  Star   │  │  Quiz   │  │  Goal   │  │  Streak │  │  Master │    │  ││
│  │  │  │  Student│  │  Master │  │  Met    │  │  King   │  │  Badge  │    │  ││
│  │  │  │  +50 XP │  │  +100XP │  │  +75 XP │  │  +50 XP │  │  +200XP │    │  ││
│  │  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │  ││
│  │  │                                                                        │  ││
│  │  └────────────────────────────────────────────────────────────────────────┘  ││
│  │                                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Responsive Specifications

### 4.1 Breakpoint Behavior

| Component | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|-----------|-----------------|---------------------|-------------------|
| **Sidebar** | Hidden (hamburger) | Collapsed (icons) | Expanded (labels) |
| **Header** | Compact | Standard | Standard |
| **Cards** | Single column | 2 columns | 3-4 columns |
| **Tables** | Card view | Scrollable | Full table |
| **Charts** | Full width | Half width | Quarter width |
| **Modals** | Full screen | Centered | Centered |
| **Search** | Full overlay | Dropdown | Dropdown |

### 4.2 Touch Targets

| Element | Minimum Size | Recommended |
|---------|--------------|-------------|
| Button | 44x44px | 48x48px |
| Link | 44x44px | 48x48px |
| Icon | 44x44px | 48x48px |
| Checkbox | 44x44px | 48x48px |
| Radio | 44x44px | 48x48px |
| Switch | 44x44px | 48x48px |

---

## 5. Interaction Specifications

### 5.1 Animations

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Button hover | Scale 1.02 | 150ms | ease-out |
| Button active | Scale 0.98 | 100ms | ease-in |
| Card hover | Shadow increase | 200ms | ease-out |
| Modal open | Fade in + scale | 250ms | ease-out |
| Modal close | Fade out + scale | 200ms | ease-in |
| Page transition | Fade | 300ms | ease-in-out |
| Toast enter | Slide up + fade | 300ms | ease-out |
| Toast exit | Slide right + fade | 200ms | ease-in |
| Progress fill | Stroke animation | 500ms | ease-out |
| Dropdown open | Fade + slide down | 200ms | ease-out |
| Skeleton pulse | Opacity animation | 1.5s | ease-in-out |

### 5.2 Loading States

```
Skeleton Loading:
┌─────────────────────────────────────────┐
│  ┌─────────────────────────────────┐   │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │   │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            │   │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Pulse animation: opacity 0.5 → 1      │
└─────────────────────────────────────────┘

Spinner Loading:
┌─────────────────────────────────────────┐
│                                         │
│              ┌─────────┐                │
│              │   ⟳     │                │
│              │ Loading │                │
│              └─────────┘                │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 Empty States

```
Empty State Design:
┌─────────────────────────────────────────┐
│                                         │
│          📭                             │
│          No students yet                │
│                                         │
│          Get started by adding          │
│          your first student.            │
│                                         │
│          [ + Add Student ]              │
│                                         │
└─────────────────────────────────────────┘
```

---

## 6. Design Tokens Implementation

### 6.1 Tailwind CSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF9E6',
          100: '#FFF0BF',
          200: '#FFE699',
          300: '#FFD966',
          400: '#FFCC33',
          500: '#D4A843', // Coptic Gold
          600: '#B8912A',
          700: '#8B6914',
          800: '#5E4A0D',
          900: '#312607',
        },
        secondary: {
          500: '#2563EB', // Coptic Blue
        },
        accent: {
          500: '#E11D48', // Coptic Red
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'Inter', 'sans-serif'],
        coptic: ['Noto Sans Coptic', 'Antinoou', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px rgba(0, 0, 0, 0.1)',
      },
    },
  },
}
```

---

## 7. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| HF-01 | Figma is the chosen design tool | Need to adapt for Sketch/Adobe XD |
| HF-02 | shadcn/ui provides sufficient base | May need more custom components |
| HF-03 | Tailwind CSS is acceptable | May need CSS modules |
| HF-04 | Design tokens can be implemented in code | May need manual translation |
| HF-05 | High-fidelity designs will guide development | May need more specifications |

---

## 8. Recommendations

### 8.1 Design Recommendations

1. **Figma Component Library** – Create reusable components in Figma.

2. **Design Tokens as Code** – Use Style Dictionary for token management.

3. **Design QA** – Regular design reviews with development team.

4. **User Testing** – Test high-fidelity designs with real users.

5. **Design System Documentation** – Document all components and patterns.

---

## 9. Approval Gate

### Deliverables Summary

| Deliverable | Status |
|-------------|--------|
| Design Specifications | ✅ Complete |
| Component Specifications (5 components) | ✅ Complete |
| Page Designs (2 pages) | ✅ Complete |
| Responsive Specifications | ✅ Complete |
| Interaction Specifications | ✅ Complete |
| Design Tokens Implementation | ✅ Complete |

### Questions for Approval

1. Are the component specifications clear?
2. Are the page designs appropriate?
3. Are the responsive behaviors correct?
4. Are the animations and interactions appropriate?

### Next Phase Preview

**Phase 9 – Interactive HTML Prototype**
- Fully functional prototype
- Responsive design
- Interactive components

---

**Awaiting approval to proceed to Phase 9.**

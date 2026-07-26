# Phase 6 – UI/UX Design System

**NiAngelos School for Hymns and Praises – Digital Platform**

**Document Version:** 1.0
**Date:** July 2026
**Status:** Draft – Pending Approval

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Design Tokens](#2-design-tokens)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Iconography](#6-iconography)
7. [Components](#7-components)
8. [Patterns](#8-patterns)
9. [Accessibility](#9-accessibility)
10. [Dark Mode](#10-dark-mode)
11. [RTL Support](#11-rtl-support)
12. [Assumptions](#12-assumptions)
13. [Recommendations](#13-recommendations)
14. [Approval Gate](#14-approval-gate)

---

## 1. Design Principles

### 1.1 Core Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Sacred Simplicity** | Clean, elegant design that respects the spiritual context | Minimal decoration, focus on content |
| **Child-First** | Primary users are children aged 6-12 | Large touch targets, simple navigation, rewarding feedback |
| **Apple-Inspired** | Premium, polished aesthetic | Generous whitespace, subtle shadows, smooth animations |
| **Church-Rooted** | Subtle Coptic identity | Warm colors, cross motifs, Coptic typography accents |
| **Accessible** | Usable by everyone | WCAG 2.1 AA, keyboard navigation, screen reader support |
| **Bilingual** | Seamless English/Arabic switching | RTL-ready layouts, proper Coptic text rendering |

### 1.2 Design Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESIGN PHILOSOPHY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     INSPIRATION                         │   │
│  │                                                         │   │
│  │  Apple Design     +  Coptic Heritage  +  Education     │   │
│  │  (Clean, Modern)     (Warm, Sacred)     (Engaging)     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     EXPRESSION                          │   │
│  │                                                         │   │
│  │  Elegant UI    +  Warm Colors   +  Rewarding UX       │   │
│  │  (Polished)       (Coptic Gold)    (Gamification)      │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Tokens

### 2.1 Spacing Scale

```css
--space-0: 0px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-9: 36px;
--space-10: 40px;
--space-12: 48px;
--space-14: 56px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### 2.2 Border Radius

```css
--radius-none: 0px;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

### 2.3 Shadows

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

### 2.4 Animation

```css
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
--duration-slower: 500ms;

--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### 2.5 Z-Index

```css
--z-base: 0;
--z-dropdown: 1000;
--z-sticky: 1100;
--z-fixed: 1200;
--z-modal-backdrop: 1300;
--z-modal: 1400;
--z-popover: 1500;
--z-tooltip: 1600;
--z-toast: 1700;
```

---

## 3. Color System

### 3.1 Brand Colors (Coptic-Inspired)

```css
/* Primary - Coptic Gold (Warm, Sacred) */
--color-primary-50: #FFF9E6;
--color-primary-100: #FFF0BF;
--color-primary-200: #FFE699;
--color-primary-300: #FFD966;
--color-primary-400: #FFCC33;
--color-primary-500: #D4A843;  /* Main Coptic Gold */
--color-primary-600: #B8912A;
--color-primary-700: #8B6914;
--color-primary-800: #5E4A0D;
--color-primary-900: #312607;

/* Secondary - Coptic Blue (Heavenly, Peaceful) */
--color-secondary-50: #EFF6FF;
--color-secondary-100: #DBEAFE;
--color-secondary-200: #BFDBFE;
--color-secondary-300: #93C5FD;
--color-secondary-400: #60A5FA;
--color-secondary-500: #2563EB;  /* Main Coptic Blue */
--color-secondary-600: #1D4ED8;
--color-secondary-700: #1E40AF;
--color-secondary-800: #1E3A8A;
--color-secondary-900: #172554;

/* Accent - Coptic Red (Martyrdom, Passion) */
--color-accent-50: #FFF1F2;
--color-accent-100: #FFE4E6;
--color-accent-200: #FECDD3;
--color-accent-300: #FDA4AF;
--color-accent-400: #FB7185;
--color-accent-500: #E11D48;  /* Main Coptic Red */
--color-accent-600: #BE123C;
--color-accent-700: #9F1239;
--color-accent-800: #881337;
--color-accent-900: #4C0519;

/* Success - Growth, Life */
--color-success-50: #F0FDF4;
--color-success-100: #DCFCE7;
--color-success-200: #BBF7D0;
--color-success-300: #86EFAC;
--color-success-400: #4ADE80;
--color-success-500: #22C55E;
--color-success-600: #16A34A;
--color-success-700: #15803D;
--color-success-800: #166534;
--color-success-900: #14532D;

/* Warning - Caution, Attention */
--color-warning-50: #FFFBEB;
--color-warning-100: #FEF3C7;
--color-warning-200: #FDE68A;
--color-warning-300: #FCD34D;
--color-warning-400: #FBBF24;
--color-warning-500: #F59E0B;
--color-warning-600: #D97706;
--color-warning-700: #B45309;
--color-warning-800: #92400E;
--color-warning-900: #78350F;

/* Error/Danger */
--color-error-50: #FFF1F2;
--color-error-100: #FFE4E6;
--color-error-200: #FECDD3;
--color-error-300: #FDA4AF;
--color-error-400: #FB7185;
--color-error-500: #EF4444;
--color-error-600: #DC2626;
--color-error-700: #B91C1C;
--color-error-800: #991B1B;
--color-error-900: #7F1D1D;
```

### 3.2 Neutral Colors

```css
/* Gray Scale */
--color-gray-50: #F9FAFB;
--color-gray-100: #F3F4F6;
--color-gray-200: #E5E7EB;
--color-gray-300: #D1D5DB;
--color-gray-400: #9CA3AF;
--color-gray-500: #6B7280;
--color-gray-600: #4B5563;
--color-gray-700: #374151;
--color-gray-800: #1F2937;
--color-gray-900: #111827;
--color-gray-950: #030712;

/* White */
--color-white: #FFFFFF;

/* Black */
--color-black: #000000;
```

### 3.3 Semantic Colors

```css
/* Background */
--color-background: var(--color-white);
--color-background-secondary: var(--color-gray-50);
--color-background-tertiary: var(--color-gray-100);

/* Foreground */
--color-foreground: var(--color-gray-900);
--color-foreground-secondary: var(--color-gray-600);
--color-foreground-tertiary: var(--color-gray-400);

/* Border */
--color-border: var(--color-gray-200);
--color-border-strong: var(--color-gray-300);

/* Interactive */
--color-interactive: var(--color-primary-500);
--color-interactive-hover: var(--color-primary-600);
--color-interactive-active: var(--color-primary-700);
--color-interactive-disabled: var(--color-gray-300);

/* Link */
--color-link: var(--color-secondary-500);
--color-link-hover: var(--color-secondary-600);
```

### 3.4 Color Usage

| Element | Color | Usage |
|---------|-------|-------|
| **Primary Action** | Coptic Gold | CTA buttons, active states, highlights |
| **Navigation** | Coptic Blue | Links, sidebar active, breadcrumbs |
| **Success** | Green | Completed, passed, present |
| **Warning** | Yellow/Orange | In progress, needs attention, late |
| **Error** | Red | Failed, absent, critical alerts |
| **Neutral** | Gray | Text, borders, backgrounds |
| **Accent** | Coptic Red | Badges, achievements, special highlights |

---

## 4. Typography

### 4.1 Font Family

```css
/* English */
--font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-family-display: 'Plus Jakarta Sans', 'Inter', sans-serif;
--font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Arabic */
--font-family-arabic: 'Noto Sans Arabic', 'Inter', sans-serif;

/* Coptic */
--font-family-coptic: 'Noto Sans Coptic', 'Antinoou', 'Inter', sans-serif;
```

### 4.2 Font Size Scale

```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */
--text-6xl: 3.75rem;   /* 60px */
```

### 4.3 Font Weight

```css
--font-weight-light: 300;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### 4.4 Line Height

```css
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

### 4.5 Typography Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display Large | 60px | Bold | 1.1 | Hero headings |
| Display Medium | 48px | Bold | 1.2 | Page titles |
| Display Small | 36px | Bold | 1.2 | Section headings |
| H1 | 30px | Bold | 1.3 | Page headers |
| H2 | 24px | Semibold | 1.3 | Section headers |
| H3 | 20px | Semibold | 1.4 | Card titles |
| H4 | 18px | Medium | 1.4 | Subsection headers |
| Body Large | 18px | Regular | 1.6 | Important body text |
| Body | 16px | Regular | 1.5 | Default body text |
| Body Small | 14px | Regular | 1.5 | Secondary text |
| Caption | 12px | Regular | 1.4 | Labels, captions |
| Overline | 12px | Medium | 1.5 | Category labels |

---

## 5. Spacing & Layout

### 5.1 Grid System

```
┌─────────────────────────────────────────────────────────────────┐
│                      12-COLUMN GRID                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Desktop (1200px+):                                             │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐                                  │
│  │ │ │ │ │ │ │ │ │ │ │ │ │  Column width: ~72px               │
│  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘  Gap: 24px                        │
│  Margins: Auto (max-width: 1440px)                              │
│                                                                 │
│  Tablet (768-1199px):                                           │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┐                                           │
│  │ │ │ │ │ │ │ │     Column width: ~60px                      │
│  └─┴─┴─┴─┴─┴─┴─┴─┘  Gap: 20px                                │
│  Margins: 32px                                                  │
│                                                                 │
│  Mobile (<768px):                                               │
│  ┌─────────────────┐                                           │
│  │                 │  Single column                             │
│  │                 │  Gap: 16px                                 │
│  │                 │  Margins: 16px                             │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Content Width

```css
--content-width-sm: 640px;    /* Single column */
--content-width-md: 768px;    /* Narrow two column */
--content-width-lg: 1024px;   /* Standard layout */
--content-width-xl: 1280px;   /* Wide layout */
--content-width-2xl: 1440px;  /* Full width */
```

### 5.3 Spacing Patterns

| Element | Spacing |
|---------|---------|
| Card padding | 24px (desktop), 16px (mobile) |
| Section spacing | 48px (desktop), 32px (mobile) |
| Component gap | 16px |
| Inline element gap | 8px |
| Form field gap | 24px |
| Modal padding | 32px |
| Sidebar width | 280px (expanded), 72px (collapsed) |
| Header height | 64px |
| Bottom nav height | 64px |

---

## 6. Iconography

### 6.1 Icon System

| Category | Icons | Usage |
|----------|-------|-------|
| **Navigation** | Home, Book, Users, Clipboard, Chart, Settings | Sidebar, tabs |
| **Actions** | Plus, Edit, Delete, Search, Filter, Download, Upload | Buttons, actions |
| **Status** | Check, X, Alert, Info, Clock | Status indicators |
| **Content** | Play, Pause, Volume, Image, File, Music | Media playback |
| **Gamification** | Star, Trophy, Medal, Badge, Fire | Rewards, achievements |
| **Church** | Cross, Church, Hymn, Prayer | Coptic-specific |

### 6.2 Icon Specifications

```css
--icon-size-xs: 12px;
--icon-size-sm: 16px;
--icon-size-md: 20px;
--icon-size-lg: 24px;
--icon-size-xl: 32px;
--icon-size-2xl: 48px;
```

### 6.3 Recommended Icon Libraries

| Library | License | Usage |
|---------|---------|-------|
| **Lucide Icons** | MIT | Primary icon set |
| **Heroicons** | MIT | Alternative/supplementary |
| **Phosphor Icons** | MIT | Child-friendly options |

---

## 7. Components

### 7.1 Component Inventory

#### Primitives
| Component | Description | Variants |
|-----------|-------------|----------|
| **Button** | Click action | Primary, Secondary, Ghost, Danger, Sizes |
| **Input** | Text input | Default, Error, Disabled, With icon |
| **Select** | Dropdown selection | Single, Multi, Searchable |
| **Checkbox** | Toggle option | Checked, Unchecked, Indeterminate |
| **Radio** | Single selection | Selected, Unselected, Disabled |
| **Switch** | Toggle switch | On, Off, Disabled |
| **Textarea** | Multi-line input | Default, Auto-resize |

#### Layout
| Component | Description | Variants |
|-----------|-------------|----------|
| **Card** | Content container | Default, Interactive, Stats, Profile |
| **Modal** | Overlay dialog | Default, Full-screen, Confirm |
| **Drawer** | Side panel | Left, Right, Bottom |
| **Tabs** | Content switching | Underline, Pill, Enclosed |
| **Accordion** | Collapsible content | Single, Multiple |
| **Sidebar** | Navigation panel | Expanded, Collapsed |

#### Data Display
| Component | Description | Variants |
|-----------|-------------|----------|
| **Table** | Tabular data | Sortable, Selectable, Expandable |
| **List** | Item list | Static, Interactive, Nested |
| **Badge** | Status indicator | Success, Warning, Error, Info |
| **Avatar** | User image | Image, Initials, Icon |
| **Progress** | Completion indicator | Bar, Circle, Steps |
| **Chart** | Data visualization | Line, Bar, Pie, Radar |
| **Timeline** | Event sequence | Vertical, Horizontal |

#### Feedback
| Component | Description | Variants |
|-----------|-------------|----------|
| **Toast** | Notification popup | Success, Error, Warning, Info |
| **Alert** | Inline message | Success, Warning, Error, Info |
| **Skeleton** | Loading placeholder | Text, Card, Avatar |
| **Spinner** | Loading indicator | Small, Medium, Large |

#### Navigation
| Component | Description | Variants |
|-----------|-------------|----------|
| **Breadcrumb** | Path navigation | Default, Collapsible |
| **Pagination** | Page navigation | Numbers, Prev/Next |
| **Command** | Search/action palette | Default, With categories |

#### Forms
| Component | Description | Variants |
|-----------|-------------|----------|
| **DatePicker** | Date selection | Single, Range, DateTime |
| **TimePicker** | Time selection | 12h, 24h |
| **FileUpload** | File input | Single, Multi, Dropzone |
| **ColorPicker** | Color selection | Default, Compact |

#### Coptic-Specific
| Component | Description | Variants |
|-----------|-------------|----------|
| **AudioPlayer** | Hymn playback | Compact, Full, Mini |
| **VideoPlayer** | Video playback | Inline, Fullscreen |
| **CopticText** | Coptic text display | Decorated, Plain |
| **LessonCard** | Lesson display | Grid, List, Featured |
| **ProgressRing** | Circular progress | Small, Medium, Large |
| **BadgeCard** | Achievement display | Earned, Locked, Secret |

### 7.2 Component Examples

#### Button Variants

```
┌─────────────────────────────────────────────────────────────────┐
│                        BUTTON VARIANTS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Primary ]      [ Secondary ]      [ Ghost ]      [ Danger ]  │
│  Gold bg          Blue outline       Transparent    Red bg      │
│  White text       Blue text          Gray text      White text  │
│                                                                 │
│  Sizes:                                                        │
│  [SM]  [MD]  [LG]  [XL]                                       │
│                                                                 │
│  States:                                                       │
│  [Default]  [Hover]  [Active]  [Disabled]  [Loading]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Card Variants

```
┌─────────────────────────────────────────────────────────────────┐
│                        CARD VARIANTS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │  ┌─────────────┐    │  │  📊  125            │              │
│  │  │   Image     │    │  │  Students           │              │
│  │  └─────────────┘    │  │  ↑ 12% from last    │              │
│  │  Card Title         │  │     month            │              │
│  │  Description text   │  └─────────────────────┘              │
│  │  [Action]           │  Stats Card                           │
│  └─────────────────────┘                                       │
│  Content Card                                                  │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │  👤 Servant Mariam  │  │  ⭐ Level 5          │              │
│  │  Level 5-6 Servant  │  │  ████████░░ 75%     │              │
│  │  Active             │  │  Progress            │              │
│  └─────────────────────┘  └─────────────────────┘              │
│  Profile Card          Progress Card                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Patterns

### 8.1 Dashboard Patterns

```
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD LAYOUT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Welcome back, Mariam! 👋                               │   │
│  │  Here's what's happening today.                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│  │ 📊      │ │ 👥      │ │ 📝      │ │ 📈      │             │
│  │ 125     │ │ 12      │ │ 95%     │ │ 3.5     │             │
│  │ Students│ │ Classes │ │ Attend. │ │ Avg Score│             │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
│                                                                 │
│  ┌───────────────────────────┐ ┌───────────────────────────┐   │
│  │                           │ │  Recent Activity          │   │
│  │  Attendance Chart         │ │  ─────────────            │   │
│  │  (Line/Bar Chart)         │ │  ✅ Level 3 - Marked      │   │
│  │                           │ │  📝 Level 5 - Graded      │   │
│  │                           │ │  📢 Announcement sent     │   │
│  │                           │ │  🎓 Certificate issued    │   │
│  └───────────────────────────┘ └───────────────────────────┘   │
│                                                                 │
│  ┌───────────────────────────┐ ┌───────────────────────────┐   │
│  │  Upcoming Schedule        │ │  Quick Actions            │   │
│  │  ─────────────────        │ │  ─────────────            │   │
│  │  📅 Today: Level 3 (2PM) │ │  [Mark Attendance]        │   │
│  │  📅 Tomorrow: Level 5    │ │  [View Reports]           │   │
│  │  📅 Friday: Staff Meet   │ │  [Send Announcement]      │   │
│  └───────────────────────────┘ └───────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Attendance Flow Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    ATTENDANCE MARKING                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Select Class                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Level: [Level 3 ▾]  Group: [Group 2 ▾]  Date: [Today] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 2: Mark Students                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Mark All Present]  Students: 15/15 marked             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  👤 Malak           [✅] [⏰] [📝] [❌]  [Add Note]    │   │
│  │  👤 Peter           [✅] [⏰] [📝] [❌]  [Add Note]    │   │
│  │  👤 Sarah           [✅] [⏰] [📝] [❌]  [Add Note]    │   │
│  │  👤 Michael         [✅] [⏰] [📝] [❌]  [Add Note]    │   │
│  │  ... (more students)                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Step 3: Save                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Cancel]                              [Save Attendance]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Student Profile Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT PROFILE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ← Back to Students                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────┐  ┌───────────────────────────────────────┐   │
│  │             │  │  Malak Ahmed                          │   │
│  │   [Photo]   │  │  Level 3 · Group 2                    │   │
│  │             │  │  Age: 9 · Female                       │   │
│  │             │  │  Church: St. Mary's Coptic Orthodox    │   │
│  └─────────────┘  │  Parent: Hany Ahmed (Father)          │   │
│                   │  📧 hany@email.com  📱 +61 4XX XXX    │   │
│                   └───────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Overview]  [Attendance]  [Assessments]  [Progress]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Stats                                                  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │
│  │  │ 85%     │ │ 4.2     │ │ 750     │ │ 🥇      │      │   │
│  │  │ Attend  │ │ Avg Score│ │ XP     │ │ 3 Badges│      │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Recent Progress                                        │   │
│  │  ████████████░░░░ 75%  Level 3                          │   │
│  │                                                          │   │
│  │  Coptic Hymns: ████████░░░ 80%                          │   │
│  │  Coptic Rites: ██████░░░░░ 60%                          │   │
│  │  Coptic Language: █████████░ 90%                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Accessibility

### 9.1 WCAG 2.1 AA Compliance

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| **Color Contrast** | 4.5:1 for text, 3:1 for large text | Use semantic color tokens |
| **Keyboard Navigation** | All interactive elements focusable | Tab order, focus management |
| **Screen Readers** | Semantic HTML, ARIA labels | role, aria-label, aria-describedby |
| **Focus Indicators** | Visible focus ring | 2px solid primary color |
| **Alt Text** | All images have descriptive alt | Decorative images: alt="" |
| **Form Labels** | All inputs have labels | <label> or aria-label |
| **Error Messages** | Clear, associated error text | aria-describedby, role="alert" |
| **Reduced Motion** | Respect prefers-reduced-motion | Disable animations |
| **Text Resize** | Support 200% zoom | Relative units (rem) |
| **Target Size** | Minimum 44x44px touch targets | Button sizes |

### 9.2 Accessibility Checklist

```
□ Semantic HTML (header, nav, main, footer)
□ Heading hierarchy (h1 → h2 → h3)
□ Skip to main content link
□ ARIA landmarks on regions
□ Live regions for dynamic content (aria-live)
□ Focus trap in modals
□ Escape key closes modals
□ No keyboard traps
□ Consistent navigation
□ Consistent identification
□ Language attribute on html (lang="en" or lang="ar")
□ Page titles are descriptive
□ Link text is meaningful (not "click here")
□ Form validation is accessible
□ Color is not the only way to convey information
```

---

## 10. Dark Mode

### 10.1 Dark Mode Colors

```css
/* Dark Mode Overrides */
[data-theme="dark"] {
  --color-background: #0F172A;
  --color-background-secondary: #1E293B;
  --color-background-tertiary: #334155;
  
  --color-foreground: #F8FAFC;
  --color-foreground-secondary: #CBD5E1;
  --color-foreground-tertiary: #94A3B8;
  
  --color-border: #334155;
  --color-border-strong: #475569;
  
  --color-primary-500: #D4A843; /* Keep Coptic Gold */
  
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
}
```

### 10.2 Dark Mode Application

| Element | Light | Dark |
|---------|-------|------|
| Background | White | Dark Navy |
| Card Background | White | Dark Slate |
| Text | Dark Gray | Light Gray |
| Borders | Light Gray | Dark Gray |
| Primary | Coptic Gold | Coptic Gold (unchanged) |
| Shadows | Subtle | More pronounced |

---

## 11. RTL Support

### 11.1 RTL Layout Rules

```css
/* RTL-aware utilities */
[data-dir="rtl"] {
  --space-start: var(--space-right);
  --space-end: var(--space-left);
  --border-start: var(--border-right);
  --border-end: var(--border-left);
}

/* Direction-agnostic utilities */
.margin-inline-start { margin-inline-start: var(--space-4); }
.margin-inline-end { margin-inline-end: var(--space-4); }
.padding-inline-start { padding-inline-start: var(--space-4); }
.padding-inline-end { padding-inline-end: var(--space-4); }
```

### 11.2 RTL Considerations

| Element | LTR | RTL |
|---------|-----|-----|
| Text alignment | Left | Right |
| Sidebar | Left | Right |
| Breadcrumbs | Left → Right | Right → Left |
| Back button | ← Left | → Right |
| Icons | Standard | Mirror horizontal |
| Progress bars | Left to right | Right to left |
| Charts | Standard | May need mirroring |

---

## 12. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| DS-01 | Tailwind CSS is acceptable utility-first approach | Need to evaluate CSS modules |
| DS-02 | shadcn/ui provides sufficient component coverage | May need custom components |
| DS-03 | Inter font is available on all platforms | Fallback fonts needed |
| DS-04 | Coptic fonts are available for download | May need to host fonts |
| DS-05 | Dark mode is desired by users | May delay dark mode |
| DS-06 | RTL layout can be achieved with CSS logical properties | May need separate stylesheets |
| DS-07 | WCAG 2.1 AA is sufficient (not AAA) | May need to meet AAA |
| DS-08 | Children can understand standard UI patterns | Need child-specific testing |
| DS-09 | Animations enhance rather than distract | Need to respect reduced-motion |
| DS-10 | The design system will be used by all team members | Need training/documentation |

---

## 13. Recommendations

### 13.1 Design System Recommendations

1. **Start with shadcn/ui** – Excellent foundation, fully customizable, accessible.

2. **Document Everything** – Create Storybook for component documentation.

3. **Test with Real Users** – Test with children, parents, and servants.

4. **Mobile-First Components** – Design components for mobile first, then enhance for desktop.

5. **Component Storybook** – Use Storybook for development and documentation.

### 13.2 Accessibility Recommendations

1. **Automated Testing** – Use axe-core for automated accessibility testing.

2. **Manual Testing** – Regular screen reader testing (VoiceOver, NVDA).

3. **Keyboard Testing** – Ensure all features work via keyboard.

4. **Color Contrast Audits** – Regular contrast ratio checks.

5. **User Testing** – Include users with disabilities in testing.

---

## 14. Approval Gate

### Deliverables Summary

| Deliverable | Status |
|-------------|--------|
| Design Principles | ✅ Complete |
| Design Tokens | ✅ Complete |
| Color System (Coptic-inspired) | ✅ Complete |
| Typography (EN/AR/CO) | ✅ Complete |
| Spacing & Layout | ✅ Complete |
| Iconography | ✅ Complete |
| Component Inventory | ✅ Complete |
| UI Patterns | ✅ Complete |
| Accessibility Guidelines | ✅ Complete |
| Dark Mode | ✅ Complete |
| RTL Support | ✅ Complete |

### Questions for Approval

1. Is the color palette (Coptic Gold, Blue, Red) appropriate?
2. Is the typography hierarchy clear and readable?
3. Are the components sufficient for the platform?
4. Is the accessibility approach adequate?
5. Should dark mode be included in MVP?

### Next Phase Preview

**Phase 7 – Wireframes**
- Low-fidelity wireframes for key pages
- User flow wireframes
- Mobile wireframes
- Responsive breakpoints

---

**Awaiting approval to proceed to Phase 7.**

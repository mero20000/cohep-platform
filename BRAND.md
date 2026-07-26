# COHEP Brand Voice Guide

**Coptic Orthodox Hymn Education Platform — Copywriting & Terminology**

---

## Product Name

| Context | Usage |
|---------|-------|
| Full name | Coptic Orthodox Hymn Education Platform |
| Abbreviation | COHEP |
| Short name | COHEP |
| In-app header | COHEP |
| Marketing / landing | Coptic Orthodox Hymn Education Platform |
| Social media bio | COHEP — Learn. Grow. Praise. |

Never use: "NiAngelos Platform", "Hymn Education App", "COHE", or any other abbreviation.

---

## Terminology Glossary

### People

| Use | Don't use | Context |
|-----|-----------|---------|
| **Servant** | Teacher, instructor, tutor | Admin/leader viewing staff. "Servants" reflects Coptic ecclesial language. |
| **Student** | Child, kid, pupil | In admin, teacher, and parent contexts. |
| **Parent** | Guardian, caretaker | In portal and admin contexts. |
| **Admin** | Administrator, super admin | Role label in UI. |
| **Church** | Parish, congregation | Organization unit. |

### Content

| Use | Don't use | Context |
|-----|-----------|---------|
| **Hymn** | Song, chant, tune | The core content unit. |
| **Level** | Grade, class, tier | Curriculum progression step. |
| **Group** | Class, section, batch | Students grouped within a level. |
| **Assessment** | Test, quiz, exam | Evaluation of student progress. |
| **Attendance** | Presence, roll call | Tracking who is present. |
| **Badge** | Award, achievement, medal | Gamification reward. |
| **XP / Points** | Stars, coins, tokens | Gamification currency. |

### Actions

| Use | Don't use | Context |
|-----|-----------|---------|
| **Enroll** | Register, sign up, add | Adding a student to a group. |
| **Allocate** | Assign, schedule | Linking a hymn to a teaching session. |
| **Mark attendance** | Take attendance, check in | Recording student presence. |

---

## Voice & Tone

### Core Voice Attributes

1. **Reverent but modern** — Respect the spiritual context without being archaic.
2. **Encouraging** — Celebrate progress, never shame failure.
3. **Clear** — Prefer simple words over jargon. A 10-year-old should understand.
4. **Bilingual-first** — Every string has an English and Arabic version. Neither is an afterthought.

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| **Success** | Warm, celebratory | "Level complete! You're growing in faith." |
| **Error** | Calm, helpful | "Something went wrong. Let's try again." |
| **Empty state** | Inviting, gentle | "No hymns here yet. Start by adding your first one." |
| **Warning** | Direct, non-alarming | "This will remove the student from the group." |
| **Loading** | Brief, reassuring | "Loading..." or "Learn. Grow. Praise." |
| **Onboarding** | Friendly, step-by-step | "Welcome to COHEP. Let's set up your church." |

### Arabic Voice

- Use Modern Standard Arabic (MSA) for formal UI.
- Use Egyptian colloquial Arabic for conversational elements (matching the Coptic community dialect).
- Maintain the same tone — reverent, encouraging, clear.
- Do not translate literally; localize the feeling.

---

## Writing Rules

### General

- Use sentence case for UI labels (not Title Case): "Manage levels" not "Manage Levels".
- Use active voice: "The servant marked attendance" not "Attendance was marked by the servant".
- Keep strings under 60 characters for buttons, 120 for descriptions.
- No punctuation at the end of buttons or labels.
- Use Oxford comma in English lists.

### Numbers

- Use numerals for 10+: "12 students", not "twelve students".
- Use words for 1–9: "3 levels" is fine, but "one level" in prose.
- Always use numerals in UI: badges, stats, progress.

### Dates & Times

- English: "Jul 25, 2026" or "25 Jul 2026"
- Arabic: "٢٥ يوليو ٢٠٢٦" (use Arabic-Indic numerals in Arabic locale)
- Time: "2:30 PM" (English), "٢:٣٠ م" (Arabic)

### Errors

- Start with what went wrong, not "Error:".
- Offer a next step.
- Never show raw error codes to users.

**Good:** "We couldn't save your changes. Check your connection and try again."
**Bad:** "Error 500: Internal Server Error"

---

## Iconography

- Primary icon set: Lucide React
- Cross icon: Lucide `Cross` icon — used in headers, sidebars, and branding
- Gold cross on gold background = brand mark (used in favicon, OG images, loaders)
- Do not mix icon libraries

---

## Color Reference

| Token | Hex | Usage |
|-------|-----|-------|
| Gold 500 | `#D4A843` | Primary brand accent, CTAs, highlights |
| Gold 600 | `#C49A38` | Hover state for gold elements |
| Blue 600 | `#2563EB` | Links, interactive elements |
| Red 600 | `#DC2626` | Destructive actions, errors |
| Gray 900 | `#111827` | Primary text |
| Gray 500 | `#6B7280` | Secondary text |

---

## Bilingual Pattern

All user-facing strings use the `t()` helper:

```tsx
t('English text', 'النص العربي')
```

- Arabic is always the second argument.
- Never leave the Arabic argument empty or as a transliteration.
- Test both languages before shipping any UI change.

---

*This guide is a living document. Update it as the product evolves.*

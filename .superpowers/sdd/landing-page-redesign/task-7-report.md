# Task 7 — SEO Updates Report

## 1. layout.tsx Metadata Changes

**File:** `frontend/src/app/layout.tsx`

- `title` changed from flat string to `{ default, template }` object with em-dash branding
- `title.default`: `'COHEP — Free Coptic Orthodox Hymn Education Platform'`
- `title.template`: `'%s | COHEP'`
- `description` rewritten from feature-first ("Structured curriculum, progress tracking...") to mission-first ("free, open-source platform...built by the community for the Church")
- `openGraph.title`, `openGraph.description`, `twitter.title`, `twitter.description` all updated to match new mission-first messaging
- New description line: *"Teach hymns, preserve heritage, and help children belong to the Church."*

## 2. JSON-LD Structured Data

**File:** `frontend/src/app/page.tsx`

- Added `jsonLd` constant (type `WebApplication`) after state declarations (line ~644)
- Added `<script type="application/ld+json">` inside the outer `min-h-screen bg-white` wrapper, after the skip-to-content link, before `<noscript>`
- Schema fields: `@context`, `@type: WebApplication`, `name`, `applicationCategory: EducationalApplication`, `operatingSystem: Web`, `description`, `offers` (free/$0), `author` (Organization)

## 3. Heading Hierarchy Check

| Heading level | Count | Usage | Correct? |
|---|---|---|---|
| `<h1>` | 1 | Hero headline: "Every Child Should Know These Hymns" | Yes |
| `<h2>` | 10 | All section titles (Why COHEP, Who We Serve, Platform Preview, 10 Levels, 3 Pillars, How It Works, Open Source, Testimonials, FAQ, CTA) | Yes |
| `<h3>` | 18 | Card/feature headings (challenge title, response title, who-we-serve cards, curriculum level cards, pillar cards, step cards, open-source cards, testimonial names) | Yes |

**Result:** No heading hierarchy issues found. Exactly one `<h1>`, all section titles are `<h2>`, all card headings are `<h3>`.

## 4. Typecheck Result

`npx tsc --noEmit` passed with zero errors.

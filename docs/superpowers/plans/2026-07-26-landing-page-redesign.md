# Landing Page Redesign — Copy, Structure, Visual, SEO

> **Sub-skill:** Use subagent-driven-development or executing-plans to implement task-by-task.

**Goal:** Rewrite the COHEP landing page from a features-first SaaS pitch to a mission-first ministry introduction, following the strategic analysis delivered in the prior conversation.

**Architecture:** Single-file page (`page.tsx`) with extracted content object (EN/AR). No new files needed — all changes are to the existing page file and minor metadata updates. The page structure changes from 10 sections to 12, with 3 new sections and 2 removed.

**Tech Stack:** Next.js 14, Tailwind CSS, Framer Motion, TypeScript. Bilingual (EN + AR) via inline content object.

## Global Constraints

- Brand name: "Coptic Orthodox Hymn Education Platform (COHEP)" — never "COHE" or "NiAngelos"
- Hero concept: "Every Child Belongs" (Concept B from the strategic analysis)
- No fabricated testimonials — use placeholder if real ones are unavailable
- All user-facing text MUST have both English and Arabic versions via the `t()` pattern
- The gold palette (`#D4A843`, `gold-500`) is the primary brand accent
- Preserve existing animation infrastructure (FadeInUp, SectionBadge, AnimatedCounter, etc.)
- `'use client'` directive must remain at top of file
- Arabic `dir="rtl"` and RTL-friendly styles must be maintained

---

## File Map

| File | Change | What |
|------|--------|------|
| `frontend/src/app/page.tsx` | **Rewrite** | Content data, structure, sections (1121→~1000 lines) |
| `frontend/src/app/opengraph-image.tsx` | **Update** | If hero concept changes OG copy |
| `frontend/src/app/layout.tsx` | **Update** | SEO metadata refresh |
| `BRAND.md` | **Update** | Already done in previous session — verify alignment |

---

## Dependency Graph

```
Task 1 (Content Data)
  ├── Task 2 (Hero)
  │     └── Task 6 (Visual Refinements)
  ├── Task 3 (Core Sections: Why, Who, Approach)
  │     └── Task 6 (Visual Refinements)
  ├── Task 4 (New Sections: Open Source, FAQ)
  │     └── Task 6 (Visual Refinements)
  ├── Task 5 (CTA + Footer)
  └── Task 7 (SEO)
        └── Task 8 (Animation Polish)
```

**Priority tiers:**
- **P0** (foundation): Tasks 1-5 — content and structure. Nothing works without these.
- **P1** (enhancement): Tasks 6-7 — visual consistency and SEO. Can run in parallel with each other.
- **P2** (polish): Task 8 — animations after structure is stable.
- **External** (non-code): Testimonial outreach — independent, no code dependency.

---

### Task 1: Rewrite Content Data Object [P0] [FOUNDATION — NO DEPS]

**Files:**
- Modify: `frontend/src/app/page.tsx` lines 18-167 (the entire `content` object)

**What:** Rewrite the bilingual content data object from the current 10-section structure to the new 12-section structure. Every other task reads from this object, so it must be finalized first.

**New content structure (EN + AR):**

```
en: {
  nav — unchanged structure but updated nav items (About, Curriculum, Open Source, Community)
  hero — Concept B "Every Child Belongs"
    badge: 'Coptic Orthodox Hymn Education Platform'
    headline: 'Every Child in Your Church Should Know These Hymns.'
    subheadline: 'COHEP is a free, open-source platform built by the Coptic Orthodox community to teach hymns, preserve heritage, and help children belong to the Church — not as visitors, but as members.'
    belovedQuote: '"Children must feel the Church considers them members, not merely their parents\' companions." — H.G. Bishop Samuel'
    cta: 'Register Your Church'
    ctaSecondary: 'Explore the Platform'
    note: 'Free forever · No credit card · Open-source'
  stats — keep 255+ Hymns, 10 Curriculum Levels
  whyExists — NEW section
    headline, body (The Challenge facing churches, Our Response)
  whoWeServe — NEW section (replaces unfocused "Features")
    headline: 'Built for Everyone in the Church'
    cards: 4 cards — Servants, Parents, Students, Church Leaders
      each with icon, title, desc, features[]
  features — REPLACED by the above, but keep a condensed version
    remove: Multi-Role Access, Bulk Operations (admin detail)
    group remaining 12 into 4 categories for the "Approach" section
  approach — renamed from "pillars"
    headline: 'Three Pillars of Coptic Education'
    pillars: Hymns, Rites, Language (same content, refined copy)
  curriculum — same structure, refined copy
  howItWorks — refined copy
  openSource — NEW section
    headline: 'Built by the Community, for the Church'
    subtitle: 'COHEP is open-source. Every line of code belongs to the Church.'
    items:
      - icon: Heart / Free forever — No paywalls, no hidden costs, no credit card
      - icon: Code / Open-source — Browse, audit, and contribute on GitHub
      - icon: Shield / No vendor lock-in — Your data belongs to your church
      - icon: Sliders / Customizable — Adapt curricula, hymns, and roles to your tradition
      - icon: Globe / Community-governed — Built by Coptic developers worldwide
    cta: 'Contribute on GitHub'
  testimonials — placeholders (honest: "Testimonials coming soon from churches worldwide")
  faq — expand from 3 to 7+ questions
    add: Is my data secure?, Can I customize?, Who maintains COHEP?, Can I contribute?, What languages?
  cta — 3 CTAs instead of 1
    headline: 'The Church's Heritage. The Community's Platform. Your Children's Future.'
    cta1: 'Register Your Church'
    cta2: 'View the Curriculum'
    cta3: 'Contribute on GitHub'
  footer — add GitHub link, community info
    github: 'Contribute on GitHub'
    community: 'Join Our Community'
}
ar: { ... same structure, Arabic translations }
```

**Translation strategy for Arabic:**
- Use Modern Standard Arabic for formal sections
- Match existing site terminology (منصة تعليم التسبحة القبطية الأرثوذكسية)
- Translate "Every child belongs" as كل طفل له مكانه في الكنيسة
- Translate Bishop Samuel's teaching: الأطفال في حاجة إلى الشعور بأن الكنيسة تعتبرهم أعضاء فيها، وليس مجرد مرافقين لوالديهم

**Steps:**

- [ ] **Step 1: Define the new content object structure**

Open the file and rewrite the `content` object skeleton with all new keys (values can be placeholder text initially):

```typescript
const content = {
  en: {
    nav: { features: 'Features', curriculum: 'Curriculum', ... },
    hero: {
      badge: 'Coptic Orthodox Hymn Education Platform',
      headline: '',
      subheadline: '',
      cta: '',
      ctaSecondary: '',
      note: ''
    },
    whyExists: {
      headline: '',
      body: ''
    },
    whoWeServe: {
      headline: '',
      cards: [
        { icon: Users, title: 'For Servants', desc: '', features: [] },
        { icon: Heart, title: 'For Parents', desc: '', features: [] },
        { icon: Star, title: 'For Students', desc: '', features: [] },
        { icon: Church, title: 'For Church Leaders', desc: '', features: [] },
      ]
    },
    approach: { headline: '', subtitle: '', pillars: [...] },
    curriculum: { headline: '', subtitle: '', levels: [...] },
    openSource: { headline: '', subtitle: '', items: [] },
    testimonials: { headline: '', subtitle: '', quotes: [] },
    faq: { headline: '', questions: [] },
    cta: { headline: '', ctas: [] },
    footer: { desc: '', copyright: '', links: [] }
  },
  ar: { ... same structure }
}
```

- [ ] **Step 2: Write English values for every section**

Fill in all `en` values with the final copy from the strategic analysis. This is the most important step — get this right and everything else flows.

- [ ] **Step 3: Write Arabic values for every section**

Translate using existing site patterns and proper ecclesiastical Arabic.

- [ ] **Step 4: Verify key consistency**

Ensure `en` and `ar` have identical key structures (no missing keys). Verify all referenced icons exist.

**Acceptance:** Content object is complete, has matching EN/AR structure, and covers all 12 new sections.

---

### Task 2: Implement Hero Section [P0] [DEPENDS ON: Task 1]

**Files:**
- Modify: `frontend/src/app/page.tsx` lines 663-778 (main component, Hero region)

**What:** Replace the current hero with "Every Child Belongs" concept. Keep the dark gradient background, HeroAlpha, HeroCross3D, CrossPatternBg, and GradientOrbs. Replace headline, subheadline, CTAs, and stats.

**Key changes from current hero:**
- Headline: "Learn. Grow. Praise." → "Every Child in Your Church Should Know These Hymns."
- Subheadline: Rewrite per Task 1 values
- CTA1: "Start Free Today" → "Register Your Church"
- CTA2: "Sign In to Dashboard" → "Explore the Platform"
- Remove "Free for small churches" note → replace with "Free forever · No credit card · Open-source"
- Insert Bishop Samuel's teaching as a subtle pull-quote beneath the headline (or as a fade-in element after the CTA)

- [ ] **Step 1: Replace hero headline and subheadline**

```tsx
<motion.h1 ...>
  {t.hero.headline}
</motion.h1>
<motion.p ...>
  {t.hero.subheadline}
</motion.p>
```

- [ ] **Step 2: Replace CTA buttons**

```tsx
<Link href="/auth/register">
  <Button size="lg">{t.hero.cta}</Button>
</Link>
<Link href="/auth/register">
  <Button variant="outline" size="lg">{t.hero.ctaSecondary}</Button>
</Link>
```

- [ ] **Step 3: Add Bishop Samuel pull-quote (optional, subtle)**

```tsx
<motion.blockquote
  className="mt-6 text-sm text-gold-400/70 italic max-w-xl mx-auto"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 1.1 }}
>
  {t.hero.belovedQuote}
</motion.blockquote>
```

- [ ] **Step 4: Verify stats bar renders correctly**

Stats should use `AnimatedCounter` as before, just with the new content keys.

**Acceptance:** Hero shows new headline, subheadline, CTAs, and Bishop Samuel quote. All text comes from `t.hero.*` keys.

---

### Task 3: Implement Core Sections (Why + Who + Approach) [P0] [DEPENDS ON: Task 1]

**Files:**
- Modify: `frontend/src/app/page.tsx` lines 780-890

**What:** Replace current Features and Three Pillars sections with the new structure. Three new sections replace the old ones.

**Section order:**
1. **Why COHEP Exists** — after hero. Two-column layout: left = The Challenge, right = Our Response
2. **Who We Serve** — 4 audience cards (Servants, Parents, Students, Leaders). Grid layout, each card has icon + bullet features
3. **The COHEP Approach** — maintained from existing "Three Pillars" but with refined copy

- [ ] **Step 1: Add "Why COHEP Exists" section**

```tsx
<section id="why" className="py-20 sm:py-28">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <FadeInUp className="mx-auto max-w-2xl text-center">
      <SectionBadge icon={Heart}>{isAr ? 'لماذا COHEP' : 'Why COHEP Exists'}</SectionBadge>
      <h2 className="mt-4 text-3xl font-bold sm:text-5xl">{t.whyExists.headline}</h2>
    </FadeInUp>
    <div className="mt-10 grid gap-8 lg:grid-cols-2">
      {/* Left: The Challenge */}
      <FadeInUp variant="left">
        <div className="rounded-2xl border border-gray-200 bg-white p-8">
          <h3 className="text-lg font-bold text-gray-900">{t.whyExists.challengeTitle}</h3>
          <p className="mt-3 text-sm text-gray-600">{t.whyExists.challengeBody}</p>
        </div>
      </FadeInUp>
      {/* Right: Our Response */}
      <FadeInUp variant="right">
        <div className="rounded-2xl border border-gold-200 bg-gold-50/50 p-8">
          <h3 className="text-lg font-bold text-gray-900">{t.whyExists.responseTitle}</h3>
          <p className="mt-3 text-sm text-gray-600">{t.whyExists.responseBody}</p>
        </div>
      </FadeInUp>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add "Who We Serve" section (replaces unfocused features grid)**

4-column grid of audience cards with icon + bullet list:

```tsx
<section id="audience" className="py-20 sm:py-28 bg-gray-50">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <FadeInUp className="mx-auto max-w-2xl text-center">
      <SectionBadge icon={Users}>{isAr ? 'لمن هذه المنصة' : 'Who We Serve'}</SectionBadge>
      <h2 className="mt-4 text-3xl font-bold sm:text-5xl">{t.whoWeServe.headline}</h2>
    </FadeInUp>
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {t.whoWeServe.cards.map((card, i) => (
        <FadeInUp key={card.title} delay={i * 0.08}>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white">
              <card.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900">{card.title}</h3>
            <p className="mt-1.5 text-sm text-gray-600">{card.desc}</p>
            <ul className="mt-3 space-y-1.5">
              {card.features.map((f: string) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-gold-500" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </FadeInUp>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Refine "The COHEP Approach" (keep existing Three Pillars, update copy)**

Same visual structure as current "Curriculum Deep Dive" section. Just update the text to come from `t.approach.*` keys.

- [ ] **Step 4: Remove old Features section (14 cards)**

Delete the old `section#features` with the 14-card grid. The new "Who We Serve" section replaces it.

**Acceptance:** 3 new/replacement sections render correctly. All text from content object. No broken references. Old Features section removed.

---

### Task 4: Implement New Sections (Open Source + Expanded FAQ) [P1] [DEPENDS ON: Task 1]

**Files:**
- Modify: `frontend/src/app/page.tsx` — insert after Approach section, before Testimonials

**What:** Add two new sections that don't currently exist.

- [ ] **Step 1: Add "Open Source & Community" section**

```tsx
<section id="open-source" className="py-20 sm:py-28 relative">
  <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800" />
  <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <FadeInUp className="mx-auto max-w-2xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/20 bg-gold-500/10 px-4 py-1.5 text-sm font-medium text-gold-400">
        <Globe className="h-4 w-4" /> {isAr ? 'مصدر مفتوح' : 'Open Source'}
      </div>
      <h2 className="mt-4 text-3xl font-bold text-white sm:text-5xl">{t.openSource.headline}</h2>
      <p className="mt-3 text-lg text-gray-400">{t.openSource.subtitle}</p>
    </FadeInUp>
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {t.openSource.items.map((item, i) => (
        <FadeInUp key={item.title} delay={i * 0.05}>
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <item.icon className="h-6 w-6 text-gold-400" />
            <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
            <p className="mt-1 text-xs text-gray-400">{item.desc}</p>
          </div>
        </FadeInUp>
      ))}
    </div>
    <FadeInUp className="mt-8 text-center">
      <a href="https://github.com/..." target="_blank" rel="noopener noreferrer">
        <Button variant="outline" className="border-gold-500/30 text-gold-400 hover:bg-gold-500/10">
          {t.openSource.cta} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </a>
    </FadeInUp>
  </div>
</section>
```

- [ ] **Step 2: Expand FAQ to 7+ questions**

Update existing FAQ accordion to iterate over `t.faq.questions` instead of `t.faq`. Each question has `q` and `a` fields. Minimum 7 questions from the strategic analysis.

**Acceptance:** FAQ has 7 questions. Open Source section renders with items + CTA. Both bilingual.

---

### Task 5: Implement CTA + Footer Refinements [P1] [DEPENDS ON: Task 1]

**Files:**
- Modify: `frontend/src/app/page.tsx` lines 1006-1118

**What:** Replace single CTA with 3-option CTA. Update footer with community links and GitHub.

- [ ] **Step 1: Replace CTA with multi-option layout**

```tsx
<section className="py-20 sm:py-28 relative">
  <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-900" />
  <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
    <FadeInUp variant="scale">
      <h2 className="text-3xl font-bold text-white sm:text-4xl">{t.cta.headline}</h2>
      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <Link href="/auth/register">
          <Button size="lg">{t.cta.cta1}</Button>
        </Link>
        <Link href="/auth/register">
          <Button variant="outline" size="lg" className="border-gray-600 text-gray-300">{t.cta.cta2}</Button>
        </Link>
        <a href="https://github.com/..." target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="lg" className="text-gray-400">{t.cta.cta3}</Button>
        </a>
      </div>
    </FadeInUp>
  </div>
</section>
```

- [ ] **Step 2: Update footer**

Add GitHub link, community section, privacy/terms links. Replace "N" icon in footer logo with COHEP cross.

**Acceptance:** 3 CTA buttons render. Footer has GitHub and community links. Logo uses cross icon.

> **Note:** "View the Curriculum" CTA currently links to `/auth/register` since no standalone `/curriculum` page exists. When a curriculum overview page is built in the future, update this link.

---

### Task 6: Visual Refinements [P1] [NO CONTENT DEPS — CAN RUN IN PARALLEL WITH 2-5]

**Files:**
- Modify: `frontend/src/app/page.tsx` multiple scattered lines

**What:** Fix visual inconsistencies identified in the audit. This task has NO content dependencies — it can run in parallel with Tasks 2-5.

- [ ] **Step 1: Fix "N" logo in PreviewCarousel**

In lines 267, 335, 381, 429 — replace `<div className="... bg-blue-500 text-white text-[10px] font-bold">N</div>` with `<Cross className="h-3.5 w-3.5 text-white" />` or a small SVG cross.

- [ ] **Step 2: Replace "Peter Adly" student references**

In lines 361 (Students table), 466-470 (Gamification leaderboard) — replace with generic names: "Mina Bishoy", "George Magdy", "Mariam Talaat", "Youstina Nader", "Bishoy Halim".

- [ ] **Step 3: Fix rainbow gradient feature card colors → gold-centric**

Feature card colors currently use 14 different gradient pairs (from-cyan-400 to-cyan-600, from-rose-400 to-rose-600, etc.). Replace ALL with consistent gold gradient for the hover overlay:
```
color: 'from-gold-400 to-gold-600'
```
Keep the icon background colors (`bg` field) as-is — those add variety. Only change the hover overlay gradient.

- [ ] **Step 4: Fix sidebar "N" logos**

If any other components have the "N" placeholder logo, update them to the cross icon.

- [ ] **Step 5: Verify gold color consistency**

Search for `bg-blue-500` in the file. Any remaining blue backgrounds on CTAs, headers, or gold-branded elements should be `bg-gold-500`. Only keep blue for interactive elements (links, focus rings) per the brand guide.

**Acceptance:** No "N" logos remain. No fabricated student names. Feature card hover gradients use gold. Blue CTAs use gold.

---

### Task 7: SEO Updates [P1] [DEPENDS ON: Task 1 — needs final copy]

**Files:**
- Modify: `frontend/src/app/layout.tsx` lines 8-25
- Modify: `frontend/src/app/page.tsx` — add missing meta tags

**What:** Update metadata with new brand messaging.

- [ ] **Step 1: Update layout.tsx metadata**

```
title: 'COHEP — Free Coptic Orthodox Hymn Education Platform'
description: 'COHEP is a free, open-source platform for Coptic Orthodox hymn education. Structured curriculum, gamified learning, parent portals, and servant tools — built by the community, for the community.'
openGraph: { same as above, updated }
twitter: { same as above, updated }
```

- [ ] **Step 2: Add JSON-LD structured data to page.tsx**

Add `FAQPage` structured data after the FAQ section renders. Add `EducationalApplication` structured data to the head.

```
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "WebApplication",
  "name": "COHEP",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Web",
  "description": "..." }
</script>
```

- [ ] **Step 3: Verify H1/H2 hierarchy**

A single `<h1>` (the hero headline). All section titles are `<h2>`. Card titles are `<h3>`.

**Acceptance:** Meta tags updated. Structured data present. Heading hierarchy valid.

---

### Task 8: Animation & Polish [P2] [DEPENDS ON: Tasks 2-6 — wait for stable DOM structure]

**Files:**
- Modify: `frontend/src/app/page.tsx`

**What:** Review and refine animations. Do NOT start until all structural changes are committed.

- [ ] **Step 1: Verify reduced-motion support**

Check that all `motion.` elements respect `useReducedMotion()`. The HeroArea already does — verify new sections don't cause jarring animations for reduced-motion users.

- [ ] **Step 2: Check mobile animation performance**

`PreviewCarousel` slide transitions should be smooth on mobile. If the `x: 60` slide distance is too large for small screens, reduce it to `x: 30` for viewports under 640px.

- [ ] **Step 3: Timeline alignment**

Hero entrance animations should feel cohesive (each element staggers in by 0.1-0.2s, not 0.3-0.5s like the current 0.2/0.3/0.5/0.7/0.9/1.0 sequence which feels slow). Tighter stagger = more energetic feel.

- [ ] **Step 4: Verify scroll-trigger animations**

All `FadeInUp` elements should use `viewport={{ once: true, margin: '-80px' }}` (already the default). No section should animate more than once.

**Acceptance:** All animations work on mobile + desktop. Reduced-motion users see no spinning/scaling. Animations feel tighter.

---

### Task 9 (Non-Code): Real Testimonial Outreach [P2] [INDEPENDENT]

**What:** This task cannot be executed by code. It requires a human to contact actual Coptic churches and collect real testimonials.

- [ ] **Step 1: Identify 3-5 churches willing to give testimonials**

Priests, servants, or parents who have seen the platform or participated in development.

- [ ] **Step 2: Collect quotes with attribution**

Name, role, church name, location. Photo optional but preferred.

- [ ] **Step 3: Update testimonials section**

Replace placeholder `content.testimonials.quotes` with real entries. Mark as `[OUTREACH REQUIRED]` until done.

**Acceptance:** Replace `content.en.testimonials.quotes` placeholder with real data.

---

## Execution Order

| Phase | Tasks | Rationale |
|-------|-------|-----------|
| **Phase 1** | Task 1 | Content is the foundation — everything reads from it |
| **Phase 2** | Task 2 + Task 3 + Task 4 + Task 5 + Task 6 (parallel) | All consume Task 1's output, can be done concurrently |
| **Phase 3** | Task 7 | Needs final content from all sections |
| **Phase 4** | Task 8 | Needs stable DOM — run last |
| **External** | Task 9 | Any time, independent of code |

## Rollback Plan

If any task produces broken output, the previous state is in git. Each task should be committed separately so individual sections can be reverted:

```
git add src/app/page.tsx
git commit -m "content: rewrite landing page data structure"
git add src/app/page.tsx
git commit -m "feat: implement new hero and core sections"
...
git log --oneline  # to find the commit to revert to
git revert <commit-hash>
```

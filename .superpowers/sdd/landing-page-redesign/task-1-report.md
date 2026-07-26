# Task 1 Report: Bilingual Content Object Rewrite

## What Changed

The `content` object in `src/app/page.tsx` (lines 18-253) was rewritten from a features-first structure to a mission-first structure while maintaining full backward compatibility.

## Keys Preserved (Backward Compatible)

All keys referenced by the existing JSX were kept with their original types:

| Key | Type | JSX Usage |
|-----|------|-----------|
| `nav` | `{ features, curriculum, testimonials, signIn, getStarted, openSource, community }` | Lines 608-656 |
| `hero` | `{ badge, title1, title2, title3, subtitle, cta, cta2, note }` | Lines 680-737 |
| `stats` | `Array<{ value, suffix, label }>` | Line 762 |
| `featuresTitle` | `string` | Line 786 |
| `featuresSubtitle` | `string` | Line 787 |
| `features` | `Array<{ icon: Component, title, desc, color, bg }>` | Line 791 |
| `curriculumTitle` | `string` | Line 835 |
| `curriculumSubtitle` | `string` | Line 836 |
| `curriculum` | `Array<{ level, title, desc, color, icon: Component }>` | Line 840 |
| `pillarsTitle` | `string` | Line 865 |
| `pillarsSubtitle` | `string` | Line 866 |
| `pillars` | `Array<{ icon: Component, title, desc, items }>` | Line 870 |
| `howItWorksTitle` | `string` | Line 898 |
| `howItWorksSubtitle` | `string` | Line 899 |
| `steps` | `Array<{ num, title, desc, icon: Component }>` | Line 903 |
| `testimonialsTitle` | `string` | Line 937 |
| `testimonialsSubtitle` | `string` | Line 938 |
| `testimonials` | `Array<{ name, role, quote, rating }>` | Line 942 |
| `faq` | `Array<{ q, a }>` | Line 975 |
| `cta` | `{ title, subtitle, button }` | Lines 1016-1025 |
| `footer` | `{ desc, copyright, links, features, curriculum, openSource, community, signIn }` | Line 1115 |

**Icon components in `features`, `curriculum`, `pillars`, and `steps` were preserved as imported React components** (e.g., `BookOpen`, `Music`, `Church`, etc.) since the JSX renders them via `<f.icon>`, `<c.icon>`, `<p.icon>`, `<s.icon>`.

## Keys Added (3 New Top-Level Sections)

1. **`whyExists`** — Mission narrative with `badge`, `headline`, `challengeTitle`, `challengeBody`, `responseTitle`, `responseBody` (both EN and AR)
2. **`whoWeServe`** — Audience cards with `headline`, `cards[]` each with `icon` (string), `title`, `desc`, `features[]` (both EN and AR)
3. **`openSource`** — Open-source section with `badge`, `headline`, `subtitle`, `items[]`, `cta` (both EN and AR)

## New Sub-keys Added to Existing Sections

- **`nav`**: Added `openSource`, `community` (for future use)
- **`hero`**: Added `headline`, `subheadline`, `belovedQuote`, `ctaSecondary` (alongside preserved `title1/2/3`, `subtitle`, `cta2`)
- **`footer`**: Added `links`, `features`, `curriculum`, `openSource`, `community`, `signIn` (for future JSX)

## Value Updates

- **Hero**: `title1/2/3` split from new headline; `subtitle` uses new subheadline copy; `cta`/`cta2` updated to mission-first language; `note` updated
- **Features**: All 14 `desc` fields rewritten to be benefit-focused; removed inaccurate "8 distinct roles" reference
- **Pillars**: Updated `desc` values, refined subtitles
- **Steps**: Updated titles and `desc` values
- **Testimonials**: Replaced 3 real testimonials with 1 placeholder (as specified); updated `testimonialsTitle`/`testimonialsSubtitle`
- **FAQ**: Expanded from 3 to 8 questions
- **CTA**: Updated `title`, `subtitle`, `button` to mission-first language

## Arabic (AR) Section

Full Arabic translations were provided for all keys using Modern Standard Arabic. Key terminology:
- Platform = منصة
- Hymn = ترنيمة/تراتيب
- Servant = خادم
- Curriculum = المنهج
- Heritage = التراث
- Church = الكنيسة
- Open source = مصدر مفتوح

## Typecheck Result

**✅ Passed** — `npx tsc --noEmit` completed with zero errors.

## Concerns

1. **Footer description is hardcoded in JSX** (line 1048): Uses inline `{isAr ? '...' : '...'}` instead of `t.footer.desc`. The new `t.footer.desc` values are set but unused until the JSX is updated.
2. **Footer links are hardcoded in JSX** (lines 1052-1054): Uses inline ternaries instead of `t.footer.*`. The new `t.footer.features`, `t.footer.curriculum`, etc. are set but unused until the JSX is updated.
3. **Testimonials count changed from 3 to 1**: The existing JSX rendering (3-column grid) will show 1 card centered. This is intentional per the spec but may look sparse until the JSX is updated.
4. **New sections (`whyExists`, `whoWeServe`, `openSource`) exist in data but have no JSX**: They will be invisible until Task 2+ renders them.

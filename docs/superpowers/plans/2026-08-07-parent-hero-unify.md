# Parent Hero & Portal Unify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the parent portal, dashboard parents page, and child detail/practice-guide surfaces onto the shared `DashboardHero` by extending it with optional `avatar` and `description` props.

**Architecture:** `DashboardHero` (already used by the three role dashboards) gains two optional presentational props — `avatar` (rounded tile left of the title column) and `description` (muted text below badges). Four parent surfaces then swap their hand-rolled headers for `<DashboardHero>` with `bg="var(--hymn-indigo)"` and `orbTint="bg-indigo-500/10"`.

**Tech Stack:** Next.js 14 app router (frontend), React, TypeScript (strict), Tailwind, `motion/react`, Vitest + Testing Library, ESLint.

## Global Constraints

- TDD: write the failing test first, verify it fails, then implement, then verify pass.
- Strict TypeScript: `npm run type-check` (tsc --noEmit) must pass with 0 errors.
- ESLint: `npm run lint` must show 0 new errors (pre-existing warnings tolerated).
- All `DashboardHero` props remain optional and backward compatible; admin/ministry/existing parent dashboards render identically.
- Parent accent colors: `bg="var(--hymn-indigo)"` and `orbTint="bg-indigo-500/10"` on every converted surface.
- Do not modify the immersive child view `/portal/children/[id]/home` in any task.
- Commit after each task with a conventional message.
- Tests run from the `frontend/` directory via `npm test`.

---
### Task 1: Add `avatar` and `description` props to DashboardHero

**Files:**
- Modify: `frontend/src/app/dashboard/hero.tsx`
- Test: `frontend/src/app/dashboard/hero.test.tsx`

**Interfaces:**
- Consumes: `DashboardHeroProps` as currently defined.
- Produces: `DashboardHeroProps` with two new optional members:
  - `avatar?: ReactNode`
  - `description?: ReactNode`

- [ ] **Step 1: Write the failing tests**

Append two tests to `frontend/src/app/dashboard/hero.test.tsx` (inside the existing `describe('DashboardHero')` block, after the Arabic-greeting test):

```tsx
it('renders the avatar tile when provided', () => {
  render(
    <DashboardHero
      bg="var(--hymn-indigo)"
      title="My Children"
      avatar={<img data-testid="avatar" alt="" className="h-14 w-14" />}
    />,
  )
  expect(screen.getByTestId('avatar')).toBeInTheDocument()
})

it('renders the description below the badges when provided', () => {
  render(
    <DashboardHero
      bg="var(--hymn-indigo)"
      title="My Children"
      badges={<span>chip</span>}
      description={<p>helper text</p>}
    />,
  )
  expect(screen.getByText('helper text')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/dashboard/hero.test.tsx -t avatar`
Expected: FAIL — the `avatar` test can't find the element because `DashboardHero` doesn't render an avatar wrapper yet.

- [ ] **Step 3: Implement the props**

In `frontend/src/app/dashboard/hero.tsx`:

1. Add to the interface (after `logos`):
```ts
export interface DashboardHeroProps {
  bg: string
  title: ReactNode
  greeting?: ReactNode
  badges?: ReactNode
  logos?: ReactNode
  avatar?: ReactNode
  description?: ReactNode
  children?: ReactNode
}
```

2. Destructure the two new props:
```ts
export default function DashboardHero({
  bg,
  title,
  greeting,
  badges,
  logos,
  avatar,
  description,
  children,
}: DashboardHeroProps) {
```

3. Wrap the left column (currently the `<div className="min-w-0">` at line ~42). Replace the existing block:

```tsx
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-gold-400 text-sm font-medium mb-2">
            {greeting ?? (
              <>
                <Sun className="h-4 w-4" />
                <span>{lang === 'ar' ? getGreetingAr() : getGreeting()}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
          {badges && <div className="flex items-center gap-2 mt-1.5">{badges}</div>}
        </div>
        {logos && <div className="flex items-center gap-4 shrink-0">{logos}</div>}
      </div>
```

with:

```tsx
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {avatar && (
            <div className="shrink-0 rounded-2xl border-2 border-white/20 overflow-hidden">{avatar}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-gold-400 text-sm font-medium mb-2">
              {greeting ?? (
                <>
                  <Sun className="h-4 w-4" />
                  <span>{lang === 'ar' ? getGreetingAr() : getGreeting()}</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
            {badges && <div className="flex items-center gap-2 mt-1.5">{badges}</div>}
            {description && <p className="text-sm mt-3 opacity-80">{description}</p>}
          </div>
        </div>
        {logos && <div className="flex items-center gap-4 shrink-0">{logos}</div>}
      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/dashboard/hero.test.tsx`
Expected: 5 passing (3 existing + 2 new).

- [ ] **Step 5: Verify type-check and lint**

Run: `npm run type-check` then `npm run lint`
Expected: type-check clean; lint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/dashboard/hero.tsx frontend/src/app/dashboard/hero.test.tsx
git commit -m "feat(dashboard): add avatar and description props to DashboardHero"
```

---
### Task 2: Convert the Parent Portal home hero

**Files:**
- Modify: `frontend/src/app/portal/page.tsx` (imports, hero block ~lines 1-14 and 137-182)

**Interfaces:**
- Consumes: `DashboardHero` from `../dashboard/hero` with `avatar`, `description`, `orbTint` (from the Task 1 / earlier hero work).
- Produces: `/portal` home rendering the unified hero.

- [ ] **Step 1: Add the import and trim unused icons**

At the top of `frontend/src/app/portal/page.tsx`, add:

```tsx
import DashboardHero from '../dashboard/hero'
```

The hero block uses `Baby` (fallback tile) — keep it. If the swap leaves an icon or `Image` import unused, ESLint/`tsc` will flag it; remove only what is genuinely unused after the edit (verify with `npm run type-check` and `npm run lint`).

- [ ] **Step 2: Replace the inline hero block**

Replace the whole `<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 ...">…</div>` (currently lines ~140-182) with:

```tsx
      <DashboardHero
        bg="var(--hymn-indigo)"
        orbTint="bg-indigo-500/10"
        avatar={
          schoolIdentity?.churchLogoUrl ? (
            <Image src={schoolIdentity.churchLogoUrl} alt={schoolIdentity.churchName || 'Church'} width={56} height={56}
              className="h-14 w-14 object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center bg-white/10">
              <Baby className="h-7 w-7 text-indigo-200" />
            </div>
          )
        }
        title={t('My Children', 'أبنائي')}
        badges={
          schoolIdentity ? (
            <div className="flex flex-wrap items-center gap-2">
              {schoolIdentity.churchName && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90">
                  {schoolIdentity.churchName}
                </span>
              )}
              {schoolIdentity.churchName && schoolIdentity.name && <span className="text-white/30">·</span>}
              {schoolIdentity.name && (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
                  {schoolIdentity.logoUrl && (
                    <Image src={schoolIdentity.logoUrl} alt="" width={14} height={14} className="rounded" />
                  )}
                  {lang === 'ar' && schoolIdentity.nameAr ? schoolIdentity.nameAr : schoolIdentity.name}
                </span>
              )}
            </div>
          ) : undefined
        }
        description={
          t('Your children appear automatically when their record uses your login email, or link them manually by student code.',
            'يظهر أبناؤك تلقائياً إذا كان بريدهم مسجلاً ببريدك، أو اربطهم يدوياً بكود الطالب.')
        }
      />
```

Keep the `schoolIdentity` fetch and state exactly as-is. The `Image` and `Baby` usage above must match the existing imports.

- [ ] **Step 3: Verify the build**

Run: `npm run type-check` and `npm run lint`
Expected: type-check clean; lint 0 new errors. Remove any now-unused imports flagged by lint/tsc.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/portal/page.tsx
git commit -m "feat(portal): use DashboardHero for parent portal home"
```

---
### Task 3: Convert the dashboard parents page hero

**Files:**
- Modify: `frontend/src/app/dashboard/parents/page.tsx` (imports + hero block ~lines 124-170)

**Interfaces:**
- Consumes: `DashboardHero` (Task 1 props).
- Produces: `/dashboard/parents` rendering the unified hero.

- [ ] **Step 1: Add the import**

At the top of `frontend/src/app/dashboard/parents/page.tsx`, add:

```tsx
import DashboardHero from '../hero'
```

- [ ] **Step 2: Replace the inline hero block**

Replace the whole `<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 ...">…</div>` (currently lines ~128-170) with:

```tsx
      <DashboardHero
        bg="var(--hymn-indigo)"
        orbTint="bg-indigo-500/10"
        avatar={
          schoolIdentity?.churchLogoUrl ? (
            <Image src={schoolIdentity.churchLogoUrl} alt={schoolIdentity.churchName || 'Church'} width={56} height={56}
              className="h-14 w-14 object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center bg-white/10">
              <Baby className="h-7 w-7 text-indigo-200" />
            </div>
          )
        }
        title={lang === 'ar' ? 'أولادي' : 'My Children'}
        badges={
          schoolIdentity ? (
            <div className="flex flex-wrap items-center gap-2">
              {schoolIdentity.churchName && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90">
                  {schoolIdentity.churchName}
                </span>
              )}
              <span className="text-white/30">·</span>
              {schoolIdentity.name && (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
                  {schoolIdentity.logoUrl && (
                    <Image src={schoolIdentity.logoUrl} alt="" width={14} height={14} className="rounded" />
                  )}
                  {lang === 'ar' && schoolIdentity.nameAr ? schoolIdentity.nameAr : schoolIdentity.name}
                </span>
              )}
            </div>
          ) : undefined
        }
        description={
          lang === 'ar'
            ? 'يظهر أبناؤك تلقائياً إذا كان بريدهم مسجلاً ببريدك، أو اربطهم يدوياً بكود الطالب.'
            : 'Your children appear automatically when their record uses your login email, or link them manually by student code.'
        }
      />
```

Keep the `schoolIdentity` fetch and state exactly as-is.

- [ ] **Step 3: Verify the build**

Run: `npm run type-check` and `npm run lint`
Expected: type-check clean; lint 0 new errors. Remove now-unused imports flagged.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/parents/page.tsx
git commit -m "feat(dashboard): use DashboardHero for parents page"
```

---
### Task 4: Convert the child detail overview header

**Files:**
- Modify: `frontend/src/app/portal/children/[id]/page.tsx` (imports + header block ~lines 386-410)

**Interfaces:**
- Consumes: `DashboardHero` (Task 1 props); `student` state shape already present in this file: `{ firstName, lastName, firstNameAr, lastNameAr, photoUrl, studentCode, levelNumber, levelName, groupName }`.
- Produces: the child overview header rendered as the dark unified hero.

- [ ] **Step 1: Add the import**

At the top of `frontend/src/app/portal/children/[id]/page.tsx`, add:

```tsx
import DashboardHero from '../../../../dashboard/hero'
```

(The file lives at `frontend/src/app/portal/children/[id]/page.tsx`; `../../../../dashboard/hero` resolves to `frontend/src/app/dashboard/hero`.)

- [ ] **Step 2: Replace the white-card header**

Replace the white card header `<div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-5">…</div>` (currently lines ~387-410, inside the `{student && (…)}` block) with:

```tsx
        <DashboardHero
          bg="var(--hymn-indigo)"
          orbTint="bg-indigo-500/10"
          avatar={
            student.photoUrl ? (
              <Image src={API_ORIGIN + student.photoUrl} alt="" width={64} height={64} className="h-16 w-16 object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center bg-white/10 text-xl font-bold text-white">
                {student.firstName[0]}{student.lastName[0]}
              </div>
            )
          }
          title={
            (lang === 'ar' && student.firstNameAr) ? `${student.firstNameAr} ${student.lastNameAr}` : `${student.firstName} ${student.lastName}`
          }
          badges={
            <span className="text-white/60 text-sm">
              {t('Level', 'المستوى')} {student.levelNumber} — {student.groupName} · {t('Code', 'الكود')}: {student.studentCode}
            </span>
          }
        />
```

Keep the "Back to Children" `<Link>` above the hero and the report-modal button block (the `<div className="flex items-center gap-2">` with the Term Report button) — the button block currently sits inside the removed card. Preserve it by placing it after the hero, outside the replaced markup, matching the original layout intent. If the button block references `setShowReportModal`, keep the handler intact.

- [ ] **Step 3: Verify the build**

Run: `npm run type-check` and `npm run lint`
Expected: type-check clean; lint 0 new errors. Remove any now-unused imports flagged.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/portal/children/[id]/page.tsx"
git commit -m "feat(portal): use DashboardHero for child detail header"
```

---
### Task 5: Convert the practice-guide header

**Files:**
- Modify: `frontend/src/app/portal/children/[id]/practice-guide/page.tsx` (imports + header ~lines 62-77)

**Interfaces:**
- Consumes: `DashboardHero` (Task 1 props); `lesson` state: `{ id, title, titleAr, audioUrl, audioDuration, content, contentAr }`.
- Produces: the practice-guide page header rendered as the dark unified hero.

- [ ] **Step 1: Add the import**

At the top of `frontend/src/app/portal/children/[id]/practice-guide/page.tsx`, add:

```tsx
import DashboardHero from '../../../../dashboard/hero'
```

- [ ] **Step 2: Replace the title card**

Replace the `<div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">` opening + its `<h1>`/`<p>` header lines (currently ~69-71) with a `DashboardHero` placed directly above the remaining card content. Concretely: insert the hero right after the `Back` link and keep the rest of the card's inner content (AudioPlayer, lyrics, practice button) inside the existing white card — i.e. the card becomes a content panel below the hero:

```tsx
        <DashboardHero
          bg="var(--hymn-indigo)"
          orbTint="bg-indigo-500/10"
          title={lang === 'ar' ? lesson.titleAr : lesson.title}
          description={t('Practice this hymn with your child at home.', 'تدرب على هذه التسبيحة مع طفلك في المنزل.')}
        />

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {lesson.audioUrl && (
            <div className="mt-4">
              <AudioPlayer src={`${API_ORIGIN}${lesson.audioUrl}`} duration={lesson.audioDuration || undefined} />
            </div>
          )}
          …keep the rest (lyrics block + practice button) unchanged…
        </div>
```

The practice-guide page is a narrow `max-w-lg` column; the hero will span its width, which is acceptable and consistent with the other surfaces.

- [ ] **Step 3: Verify the build**

Run: `npm run type-check` and `npm run lint`
Expected: type-check clean; lint 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/portal/children/[id]/practice-guide/page.tsx"
git commit -m "feat(portal): use DashboardHero for practice-guide header"
```

---
### Task 6: Final verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: the merged result of Tasks 1-5.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all tests green (88 existing + 2 new hero tests = 90).

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check` then `npm run lint`
Expected: type-check clean; lint 0 new errors.

- [ ] **Step 3: Confirm no leftover hand-rolled heroes**

Run: `rg -n "bg-gradient-to-br from-indigo-900|from-indigo-950" frontend/src/app/portal frontend/src/app/dashboard/parents`
Expected: no matches in `portal/page.tsx`, `portal/children/[id]/page.tsx`, `portal/children/[id]/practice-guide/page.tsx`, or `dashboard/parents/page.tsx`. (The immersive child home `portal/children/[id]/home` may still match — that is intended and unchanged.)

- [ ] **Step 4: Confirm DashboardHero usages**

Run: `rg -n "<DashboardHero" frontend/src`
Expected: at least 7 call sites (admin, ministry, parent dashboards + portal home + parents page + child detail + practice-guide).

- [ ] **Step 5: Commit (empty verification commit)**

```bash
git commit --allow-empty -m "chore: verify parent hero unify (90 tests, type-check, lint)"
```
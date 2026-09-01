# Wave 3 — UX/UI Improvements Design

**Date**: 2026-09-01
**Status**: Approved
**Scope**: Form validation, Hide Name redaction, Reduced-motion verification, Arabic formatting

---

## 1. Form Validation Extension

### Goal

Extend the existing `validation.ts` + `useFormValidation` + `FormField` system to all 9 forms that currently use ad-hoc or no client-side validation.

### Existing Infrastructure

- **`frontend/src/lib/validation.ts`**: Rule builders (`required`, `email`, `password`, `minLength`, `maxLength`, `pattern`, `matches`, `isoDate`, `notFuture`, `numberInRange`) + `Schema<T>` type + `validateField`/`validateAll`
- **`frontend/src/hooks/use-form-validation.ts`**: Hook with touched tracking, blur validation, error state, focus-on-first-error, server error injection, `register` ref
- **`frontend/src/components/ui/form-field.tsx`**: Accessible component with `aria-invalid`, `aria-required`, `role="alert"`, hint support, `inputRef` for focus management

### Forms to Migrate

| # | Form | File | Current State | Fields to Validate |
|---|------|------|--------------|-------------------|
| 1 | Login | `app/auth/login/page.tsx` | Ad-hoc email regex on blur, password length inline | email (required + format), password (required) |
| 2 | Student create/edit | `app/dashboard/students/_components/student-form-modal.tsx` | Inline if/else chain, onChange | name (required), dateOfBirth (required + ISO date + notFuture), parentEmail (format), phone (E.164 format) |
| 3 | Announcement | `app/dashboard/announcements/_components/announcement-form-modal.tsx` | Title/body trim at submit | title (required, maxLength 200), body (required, maxLength 5000) |
| 4 | Lesson | `components/curriculum/lesson-modal.tsx` | Required fields at save | levelId (required), title (required), subjectId (required) |
| 5 | Settings: Levels | `app/dashboard/settings/_components/levels-tab.tsx` | None | name (required, minLength 2) |
| 6 | Settings: Groups | `app/dashboard/settings/_components/groups-tab.tsx` | None | name (required, minLength 2) |
| 7 | Settings: Subjects | `app/dashboard/settings/_components/subjects-tab.tsx` | None | name (required, minLength 2) |
| 8 | Forgot password | `components/auth/forgot-password-panel.tsx` | Email regex at submit | email (required + format) |
| 9 | Servants | `app/dashboard/servants/page.tsx` (or modal) | Email format on blur | email (required + format) |

### Migration Pattern (per form)

1. **Define schema**: Create a typed `Schema<FormType>` using existing rule builders
2. **Wire hook**: `useFormValidation({ values, schema, lang })`
3. **Replace validation**: Remove ad-hoc `if/else` chains, use `handleBlur` + `fieldErrors`
4. **Update JSX**: Use `FormField` with `error={fieldErrors.fieldName}`, pass `ref={register('fieldName')}`
5. **Disable browser validation**: Add `noValidate` on `<form>`
6. **Submit gate**: Call `validate()` before submit; abort if returns `false`

### Example: Login Form

```tsx
// Schema definition
const loginSchema: Schema<LoginForm> = {
  email: [required({ en: 'Email', ar: 'البريد الإلكتروني' }), email()],
  password: [required({ en: 'Password', ar: 'كلمة المرور' })],
}

// Hook wiring
const { fieldErrors, handleBlur, validate, register } = useFormValidation({
  values: form,
  schema: loginSchema,
  lang,
  fieldId: (f) => `login-${f}`,
})

// JSX
<FormField
  label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
  type="email"
  error={fieldErrors.email}
  required
  inputRef={register('email')}
  onBlur={() => handleBlur('email')}
/>
```

### No New Rules Required

The existing rule set (`required`, `email`, `minLength`, `maxLength`, `password`, `pattern`, `matches`, `isoDate`, `notFuture`) covers all fields across all 9 forms.

---

## 2. Hide Name Server-Side Redaction

### Goal

When `?redactNames=true` is passed to the student portal endpoint, the server strips name fields from the response. Names never leave the server when redacted.

### Backend Change

**File**: `backend/src/modules/students/students.controller.ts` (or the student portal endpoint handler)

- Add `@Query('redactNames') redactNames?: string` parameter
- When `redactNames === 'true'`, map the response to strip:
  - `firstName` → `null`
  - `lastName` → `null`
  - `firstNameAr` → `null`
  - `lastNameAr` → `null`

```ts
@Get('portal/:code')
async getStudentPortal(
  @Param('code') code: string,
  @Query('redactNames') redactNames?: string,
) {
  const student = await this.studentsService.getStudentByPortalCode(code)
  if (redactNames === 'true') {
    return { ...student, firstName: null, lastName: null, firstNameAr: null, lastNameAr: null }
  }
  return student
}
```

### Frontend Change

**File**: `frontend/src/app/student-portal/[code]/page.tsx`

1. **Persist toggle**: Store `showName` in `localStorage` key `niangelos_hide_name`
2. **API call**: When `showName` is `false`, append `?redactNames=true` to the fetch URL
3. **Remove client filtering**: Remove the `displayName` ternary that hides names client-side (server handles it now)

```ts
const [showName, setShowName] = useState(() => {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('niangelos_hide_name') !== 'true'
})

const toggleName = () => {
  const next = !showName
  setShowName(next)
  localStorage.setItem('niangelos_hide_name', String(!next))
}

// In fetch URL:
const url = `/api/student-portal/${code}${!showName ? '?redactNames=true' : ''}`
```

---

## 3. Reduced-Motion Verification

### Goal

Audit all animation sites and fix any gaps where `prefers-reduced-motion` is not respected.

### Current State (Verified)

| Layer | Mechanism | Status |
|-------|-----------|--------|
| CSS global reset | `animation-duration: 0.01ms`, `transition-duration: 0.01ms` | ✅ Working |
| Tailwind variants | `motion-safe:` / `motion-reduce:` registered | ✅ Working |
| `motion/react` | `useReducedMotion()` in hero, cross, alpha, modal | ✅ Working |
| `AnimatedNumber` | Checks `matchMedia` directly | ✅ Working |
| Button press | `active:motion-safe:scale-*` | ✅ Working |

### Gaps to Fix

1. **Landing page scroll reveal**: Verify that the JS reveal hook (`useRevealOnScroll`) does not re-add animations after the CSS reset fires. If it does, gate the IntersectionObserver callback on `!prefersReducedMotion`.

2. **Audit remaining `transition-all` without `motion-safe:`**: Search for Tailwind `transition-*` classes that don't use `motion-safe:` prefix. These transitions will fire even when the user prefers reduced motion (the CSS global reset catches them, but explicit gating is better practice).

### Approach

- Quick grep for `transition-` without `motion-safe:` in Tailwind classes
- Verify landing page reveal hook behavior
- Fix any gaps found
- No architecture changes

---

## 4. Arabic Formatting Consistency

### Goal

Standardize locale codes across all `.toLocaleString()` and `.toLocaleDateString()` calls.

### Canonical Locales

- **Arabic**: `'ar-EG'` (Egyptian Arabic — matches Coptic Orthodox context)
- **English**: `'en-GB'` (DD/MM/YYYY date format, already used in most places)

### Changes

1. Find all `.toLocaleString()` and `.toLocaleDateString()` calls in `frontend/src/`
2. Replace bare `'ar'` → `'ar-EG'`
3. Replace `'ar-SA'` → `'ar-EG'`
4. Replace `'en-US'` → `'en-GB'` where date formatting is involved
5. Add `'en-GB'` locale to bare `.toLocaleString()` calls that currently pass no argument (for consistent number formatting)

### Key Files

- `frontend/src/lib/datetime.ts` — date formatting helpers
- `frontend/src/components/ui/date-picker.tsx` — uses `'ar-EG'` (already correct)
- `frontend/src/components/curriculum/constants.ts` — curriculum calendar dates
- ~50+ scattered locations across components and pages

---

## Execution Order

1. **Form validation** (largest scope, highest impact)
2. **Arabic formatting** (mechanical find-and-replace, low risk)
3. **Hide Name redaction** (small backend + frontend change)
4. **Reduced-motion verification** (audit + targeted fixes)

## Files to Modify

### Form Validation (~9 files)
- `frontend/src/app/auth/login/page.tsx`
- `frontend/src/app/dashboard/students/_components/student-form-modal.tsx`
- `frontend/src/app/dashboard/announcements/_components/announcement-form-modal.tsx`
- `frontend/src/components/curriculum/lesson-modal.tsx`
- `frontend/src/app/dashboard/settings/_components/levels-tab.tsx`
- `frontend/src/app/dashboard/settings/_components/groups-tab.tsx`
- `frontend/src/app/dashboard/settings/_components/subjects-tab.tsx`
- `frontend/src/components/auth/forgot-password-panel.tsx`
- `frontend/src/app/dashboard/servants/page.tsx` (or related modal)

### Hide Name (2 files)
- `backend/src/modules/students/students.controller.ts`
- `frontend/src/app/student-portal/[code]/page.tsx`

### Reduced Motion (~2-5 files)
- `frontend/src/app/page.tsx` (verify reveal hook)
- Any files with `transition-*` without `motion-safe:` prefix

### Arabic Formatting (~50+ files)
- `frontend/src/lib/datetime.ts`
- Scattered `.toLocaleString()` / `.toLocaleDateString()` calls across components

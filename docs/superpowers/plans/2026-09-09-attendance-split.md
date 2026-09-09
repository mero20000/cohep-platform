# Attendance Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `/dashboard/attendance` 1561-line client into Mark (default today, phone-first) / Sessions (manage) / Insights routes with Save + Save & Finalize, error states with retry, and 44px accessible targets.

**Architecture:** Extract shared `useMarkingState` hook + Mark UI primitives first, then build `mark/page.tsx`, move CRUD to `sessions/page.tsx`, move stats/search to `insights/page.tsx`, keep `/dashboard/attendance/page.tsx` as redirect preserving `?sessionId&prefill&subjectItemId`. No backend changes.

**Tech Stack:** Next.js 16.3.3 App Router, React 19, Tailwind 3.4, vitest 3.1.1 + testing-library, existing `http`, `useToast`, `useLanguage`, `ds/tokens` gold ring.

## Global Constraints

- No backend API changes — reuse `GET /attendance/sessions`, `GET /attendance/sessions/:id`, `POST /sessions/:id/mark`, `PUT /sessions/:id`, `POST /attendance/start-class`, `POST /attendance/qr-checkin`, stats/search endpoints.
- Bilingual EN/AR via `t(en,ar)` / `useLanguage`, RTL aware, dates per BRAND `Jul 25, 2026`.
- WCAG AA: 44×44 targets on Mark, status icon + text (never color-only), `focus-visible:ring-2 ring-gold-500` on all interactives, modals trap + Esc, `aria-pressed`/`aria-label` preserved.
- Save + Save & Finalize only — no autosave, no offline queue, no new status values.
- TDD: failing test → implement → pass → commit per task.

---

### Task 1: Shared marking-state hook

**Files:**
- Create: `frontend/src/app/dashboard/attendance/lib/use-marking-state.ts`
- Test: `frontend/src/app/dashboard/attendance/lib/__tests__/use-marking-state.test.ts`

**Interfaces:**
- Consumes: `SessionDetail` shape from `attendance-client.tsx:34-42` (`attendanceRecords: [{student: {id}, status, behavior, participation, attendedLiturgy, note}]`).
- Produces: `useMarkingState(records)` → `{ marks, behavior, participation, liturgy, notes, dirty, setStatus(id,status), setBehavior(id,v), setParticipation(id,v), setLiturgy(id,v), setNote(id,v), markAll(status,ids), initFromRecords(records), buildSavePayload(recordedBy) }` used by Tasks 2-3.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarkingState } from '../use-marking-state'

const records = [
  { student: { id: 's1' }, status: 'present', behavior: 3, participation: 4, attendedLiturgy: true, note: 'hi' },
  { student: { id: 's2' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' },
] as any

describe('useMarkingState', () => {
  it('inits from records and builds save payload skipping unmarked', () => {
    const { result } = renderHook(() => useMarkingState(records))
    expect(result.current.marks['s1']).toBe('present')
    expect(result.current.dirty).toBe(false)
    act(() => result.current.setStatus('s2', 'late'))
    expect(result.current.dirty).toBe(true)
    const payload = result.current.buildSavePayload('u1')
    expect(payload).toEqual([
      { studentId: 's1', status: 'present', behavior: 3, participation: 4, attendedLiturgy: true, note: 'hi' },
      { studentId: 's2', status: 'late', behavior: 0, participation: 0, attendedLiturgy: false, note: undefined },
    ])
  })
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/dashboard/attendance/lib/__tests__/use-marking-state.test.ts`
Expected: FAIL with "useMarkingState not defined / Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```ts
'use client'
import { useState, useCallback } from 'react'

export function useMarkingState(initial: any[] = []) {
  const [marks, setMarks] = useState<Record<string,string>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked'])))
  const [behavior, setBehaviorState] = useState<Record<string,number>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.behavior ?? 0])))
  const [participation, setParticipationState] = useState<Record<string,number>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.participation ?? 0])))
  const [liturgy, setLiturgyState] = useState<Record<string,boolean>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.attendedLiturgy ?? false])))
  const [notes, setNotesState] = useState<Record<string,string>>(() => Object.fromEntries(initial.filter(r=>r?.student).map(r=>[r.student.id, r.note || ''])))
  const [dirty, setDirty] = useState(false)

  const setStatus = useCallback((id:string, s:string) => { setMarks(m => ({...m, [id]: m[id]===s ? 'unmarked' : s})); setDirty(true) }, [])
  const setBehavior = useCallback((id:string, v:number) => { setBehaviorState(b => ({...b, [id]: b[id]===v ? 0 : v})); setDirty(true) }, [])
  const setParticipation = useCallback((id:string, v:number) => { setParticipationState(p => ({...p, [id]: p[id]===v ? 0 : v})); setDirty(true) }, [])
  const setLiturgy = useCallback((id:string, v:boolean) => { setLiturgyState(l => ({...l, [id]: v})); setDirty(true) }, [])
  const setNote = useCallback((id:string, v:string) => { setNotes(n => ({...n, [id]: v})); setDirty(true) }, [])
  const markAll = useCallback((status:string, ids:string[]) => { setMarks(Object.fromEntries(ids.map(id=>[id,status]))); setDirty(true) }, [])
  const initFromRecords = useCallback((recs:any[]) => {
    setMarks(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.status ?? 'unmarked'])))
    setBehaviorState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.behavior ?? 0])))
    setParticipationState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.participation ?? 0])))
    setLiturgyState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.attendedLiturgy ?? false])))
    setNotesState(Object.fromEntries(recs.filter(r=>r?.student).map(r=>[r.student.id, r.note || ''])))
    setDirty(false)
  }, [])
  const buildSavePayload = useCallback((recordedBy:string) => Object.entries(marks).filter(([,s])=>s && s!=='unmarked').map(([studentId,status])=>({ studentId, status, behavior: behavior[studentId]||0, participation: participation[studentId]||0, attendedLiturgy: liturgy[studentId]||false, note: notes[studentId]||undefined, recordedBy })), [marks,behavior,participation,liturgy,notes])

  return { marks, behavior, participation, liturgy, notes, dirty, setDirty, setStatus, setBehavior, setParticipation, setLiturgy, setNote, markAll, initFromRecords, buildSavePayload }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/app/dashboard/attendance/lib/__tests__/use-marking-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/attendance/lib/use-marking-state.ts frontend/src/app/dashboard/attendance/lib/__tests__/use-marking-state.test.ts
git commit -m "feat(attendance): add useMarkingState hook with save payload"
```

### Task 2: Mark UI primitives (StatusSegment + SummaryBar + ErrorState reuse)

**Files:**
- Create: `frontend/src/app/dashboard/attendance/components/status-segment.tsx`
- Create: `frontend/src/app/dashboard/attendance/components/mark-summary-bar.tsx`
- Test: `frontend/src/app/dashboard/attendance/components/__tests__/status-segment.test.tsx`

**Interfaces:**
- Consumes: `useMarkingState` setters from Task 1; existing `STATUS_COLORS` + bilingual labels from `attendance-client.tsx:53-59`.
- Produces: `<StatusSegment value onChange lang />` (4× 44px buttons icon+text, `aria-pressed`), `<MarkSummaryBar present late absent excused marked total dirty error onRetry />`, and `<DetailExpander behavior participation liturgy note onChange lang />` (standard star: click N = N, separate Clear button, liturgy toggle 44px, note field) used by Task 3.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusSegment } from '../status-segment'

describe('StatusSegment', () => {
  it('renders 4 labeled 44px targets with aria-pressed', () => {
    const onChange = vi.fn()
    render(<StatusSegment value="present" onChange={onChange} lang="en" studentName="Mina" />)
    const btn = screen.getByRole('button', { name: /Present - Mina/i })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(btn.className).toMatch(/min-h-\[44px\]|min-w-\[44px\]/)
    fireEvent.click(screen.getByRole('button', { name: /Late - Mina/i }))
    expect(onChange).toHaveBeenCalledWith('late')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/dashboard/attendance/components/__tests__/status-segment.test.tsx`
Expected: FAIL with "Cannot find module '../status-segment'"

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client'
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'

const ITEMS = [
  { key: 'present', en: 'Present', ar: 'حاضر', Icon: CheckCircle2, active: 'bg-green-100 text-green-700' },
  { key: 'late', en: 'Late', ar: 'متأخر', Icon: Clock, active: 'bg-amber-100 text-amber-700' },
  { key: 'absent', en: 'Absent', ar: 'غائب', Icon: XCircle, active: 'bg-red-100 text-red-700' },
  { key: 'excused', en: 'Excused', ar: 'معذور', Icon: AlertCircle, active: 'bg-gray-200 text-gray-700' },
] as const

export function StatusSegment({ value, onChange, lang, studentName }: { value: string; onChange: (s:string)=>void; lang: 'en'|'ar'; studentName: string }) {
  return (
    <div role="group" aria-label={lang==='ar' ? `الحالة - ${studentName}` : `Status - ${studentName}`} className="grid grid-cols-2 gap-2">
      {ITEMS.map(({key,en,ar,Icon,active}) => {
        const label = lang==='ar' ? ar : en
        const pressed = value===key
        return (
          <button key={key} type="button" onClick={()=>onChange(key)} aria-pressed={pressed} aria-label={`${label} - ${studentName}`}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-1 ${pressed ? active : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

```tsx
'use client'
export function MarkSummaryBar({ present, late, absent, excused, marked, total, dirty, error, onRetry, lang }: any) {
  return (
    <div aria-live="polite" className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
      <span className="font-semibold">{marked}/{total}</span>
      <span className="text-green-700">● {present}</span><span className="text-amber-700">● {late}</span>
      <span className="text-red-700">● {absent}</span><span className="text-gray-600">● {excused}</span>
      {dirty && <span className="text-xs text-amber-700">{lang==='ar' ? 'تغييرات غير محفوظة' : 'Unsaved'}</span>}
      {error && <button type="button" onClick={onRetry} className="min-h-[44px] rounded-lg bg-red-50 px-3 text-sm font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">{lang==='ar' ? 'إعادة المحاولة' : 'Retry'}</button>}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/app/dashboard/attendance/components/__tests__/status-segment.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/attendance/components/status-segment.tsx frontend/src/app/dashboard/attendance/components/mark-summary-bar.tsx frontend/src/app/dashboard/attendance/components/__tests__/status-segment.test.tsx
git commit -m "feat(attendance): add StatusSegment and MarkSummaryBar primitives"
```

### Task 3: Mark route (default today, phone-first, Save + Finalize)

**Files:**
- Create: `frontend/src/app/dashboard/attendance/mark/page.tsx`
- Create: `frontend/src/app/dashboard/attendance/mark/mark-client.tsx`
- Test: `frontend/src/app/dashboard/attendance/mark/__tests__/mark-client.test.tsx`
- Modify: `frontend/src/components/dashboard-shell.tsx:44` (Attendance href → `/dashboard/attendance/mark`)

**Interfaces:**
- Consumes: Task 1 hook + Task 2 primitives; `http.post('/attendance/start-class')`, `http.get('/attendance/sessions/:id')`, `http.post('/sessions/:id/mark')`, `http.put('/sessions/:id',{status:'completed'})` — same signatures as `attendance-client.tsx:258-331,403-420`.
- Produces: default Mark screen; preserves `?sessionId&prefill=present&subjectItemId` deep-link contract for Task 6 redirect.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MarkClient } from '../mark-client'

const mockGet = vi.fn(async (url:string) => {
  if (url.startsWith('/attendance/sessions/')) return { id: 'sess-1', status: 'in_progress', attendanceRecords: [{ student: { id: 's1', firstName: 'Mina', lastName: 'G' }, status: 'unmarked', behavior: 0, participation: 0, attendedLiturgy: false, note: '' }] }
  return []
})
vi.mock('@/lib/http-client', () => ({ http: { get: (...a:any[])=>mockGet(...a), post: vi.fn(), put: vi.fn() } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: (k:string)=> k==='sessionId' ? 'sess-1' : null }) }))

describe('MarkClient', () => {
  it('loads sessionId deep-link and shows status group with save bar', async () => {
    render(<MarkClient />)
    await waitFor(() => expect(screen.getByRole('group', { name: /Status - Mina G/i })).toBeInTheDocument())
    expect(screen.getByText(/0\/1/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save & Finalize/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/dashboard/attendance/mark/__tests__/mark-client.test.tsx`
Expected: FAIL with "Cannot find module '../mark-client'"

- [ ] **Step 3: Write minimal implementation**

`mark/page.tsx`:
```tsx
import { Suspense } from 'react'
import { MarkClient } from './mark-client'
export const metadata = { title: 'Mark Attendance - COHEP', description: 'Mark today session attendance' }
export default function MarkPage() {
  return (<Suspense fallback={<div className="p-12 text-center text-gray-500">Loading…</div>}><MarkClient /></Suspense>)
}
```

`mark-client.tsx` (minimal, reuse patterns from `attendance-client.tsx:258-331`):
```tsx
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { EmptyState } from '@/components/ui/empty-state'
import { useMarkingState } from '../lib/use-marking-state'
import { StatusSegment } from '../components/status-segment'
import { MarkSummaryBar } from '../components/mark-summary-bar'

export function MarkClient() {
  const lang = useLanguage() as 'en'|'ar'
  const { toast } = useToast()
  const params = useSearchParams()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const marking = useMarkingState([])

  const load = async (id?: string) => {
    setLoading(true); setLoadError('')
    try {
      let sid = id || params?.get('sessionId') || ''
      if (!sid) {
        const started = await http.post<any>('/attendance/start-class', { schoolId: getSchoolId() })
        sid = (started as any).session?.id || ''
      }
      if (!sid) { setSession(null); return }
      const detail = await http.get<any>(`/attendance/sessions/${sid}`)
      setSession(detail)
      marking.initFromRecords(detail.attendanceRecords || [])
      if (params?.get('prefill') === 'present') marking.markAll('present', (detail.attendanceRecords||[]).map((r:any)=>r.student?.id).filter(Boolean))
    } catch (e:any) { setLoadError(e?.message || 'Failed to load') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async (finalize=false) => {
    if (!session) return
    setSaving(true); setSaveError('')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const records = marking.buildSavePayload(user.id || '00000000-0000-0000-0000-000000000000').map(({recordedBy, ...r}:any)=>r)
    try {
      await http.post(`/attendance/sessions/${session.id}/mark`, { records, recordedBy: user.id || '00000000-0000-0000-0000-000000000000' })
      if (finalize) await http.put(`/attendance/sessions/${session.id}`, { status: 'completed' })
      toast('success', lang==='ar' ? 'تم حفظ الحضور' : 'Attendance saved')
      marking.setDirty(false)
      load(session.id)
    } catch (e:any) { setSaveError(e?.message || 'Failed to save attendance'); toast('error', lang==='ar' ? 'فشل حفظ الحضور' : 'Failed to save attendance', e?.message || '') }
    setSaving(false)
  }

  if (loading) return <div className="p-12 text-center text-gray-500">Loading…</div>
  if (loadError) return <EmptyState title={lang==='ar'?'فشل التحميل':'Failed to load'} description={loadError} actionLabel={lang==='ar'?'إعادة المحاولة':'Retry'} onAction={()=>load()} />
  if (!session) return <EmptyState title={lang==='ar'?'لا توجد جلسة اليوم':'No session today'} description={lang==='ar'?'ابدأ الحصة لفتح التحضير':'Start class to open marking'} actionLabel={lang==='ar'?'بدء الحصة':'Start class'} onAction={()=>load()} />

  const recs = session.attendanceRecords || []
  const counts = { present: recs.filter((r:any)=>marking.marks[r.student?.id]==='present').length, late: recs.filter((r:any)=>marking.marks[r.student?.id]==='late').length, absent: recs.filter((r:any)=>marking.marks[r.student?.id]==='absent').length, excused: recs.filter((r:any)=>marking.marks[r.student?.id]==='excused').length, marked: Object.values(marking.marks).filter(v=>v && v!=='unmarked').length, total: recs.length }

  return (
    <div className="space-y-4 p-4">
      <MarkSummaryBar {...counts} dirty={marking.dirty} error={saveError} onRetry={()=>save(false)} lang={lang} />
      {recs.map((r:any) => (
        <div key={r.student?.id} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-2 font-medium">{r.student?.firstName} {r.student?.lastName}</div>
          <StatusSegment value={marking.marks[r.student?.id] || 'unmarked'} onChange={(s)=>marking.setStatus(r.student.id, s)} lang={lang} studentName={`${r.student?.firstName} ${r.student?.lastName}`} />
          <details className="mt-2">
            <summary className="min-h-[44px] cursor-pointer text-sm text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">{lang==='ar'?'التفاصيل':'Details'}</summary>
            <div className="mt-2 space-y-2">
              {[['behavior', marking.behavior, marking.setBehavior], ['participation', marking.participation, marking.setParticipation]].map(([key, map, set]:any) => (
                <div key={key} role="group" aria-label={`${key} - ${r.student?.firstName}`} className="flex items-center gap-1.5">
                  {[1,2,3,4,5].map(v => (
                    <button key={v} type="button" onClick={()=>set(r.student.id, v)} aria-pressed={(map[r.student?.id]||0)===v} aria-label={`${key} ${v} of 5`}
                      className={`h-11 w-11 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${(map[r.student?.id]||0)>=v ? 'bg-emerald-500' : 'bg-gray-100 border border-gray-200'}`}>{v}</button>
                  ))}
                  <button type="button" onClick={()=>set(r.student.id, 0)} aria-label={`Clear ${key}`} className="min-h-[44px] min-w-[44px] rounded-lg text-sm text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">×</button>
                </div>
              ))}
              <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={!!marking.liturgy[r.student?.id]} onChange={(e)=>marking.setLiturgy(r.student.id, e.target.checked)} className="h-6 w-6 accent-yellow-600" />{lang==='ar'?'حضر القداس':'Attended liturgy'}</label>
              <input value={marking.notes[r.student?.id]||''} onChange={(e)=>marking.setNote(r.student.id, e.target.value)} placeholder={lang==='ar'?'ملاحظة':'Note'} aria-label="Note" className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500" />
            </div>
          </details>
        </div>
      ))}
      <p className="text-xs text-gray-500">P/L/A/E status · 1-5 behavior · ↑↓ move · Ctrl+S save</p>
      <div className="sticky bottom-0 flex gap-2 bg-white p-3">
        <Button onClick={()=>save(false)} disabled={saving} className="min-h-[44px] flex-1">{lang==='ar'?'حفظ':'Save'}</Button>
        <Button onClick={()=>save(true)} disabled={saving} variant="outline" className="min-h-[44px] flex-1">{lang==='ar'?'حفظ وإنهاء':'Save & Finalize'}</Button>
      </div>
    </div>
  )
}
```

Update `dashboard-shell.tsx:44` href: `{ name: 'Attendance', nameAr: 'الحضور', href: '/dashboard/attendance/mark', icon: Calendar, perm: 'attendance:view' as const },`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/app/dashboard/attendance/mark/__tests__/mark-client.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/attendance/mark/page.tsx frontend/src/app/dashboard/attendance/mark/mark-client.tsx frontend/src/app/dashboard/attendance/mark/__tests__/mark-client.test.tsx frontend/src/components/dashboard-shell.tsx
git commit -m "feat(attendance): add Mark route with Save and Finalize"
```

### Task 4: Sessions manage route (move CRUD out of Mark)

**Files:**
- Create: `frontend/src/app/dashboard/attendance/sessions/page.tsx`
- Modify: move create/edit/generate/batch-delete/QR logic from `attendance-client.tsx:433-600` (no behavior change, add inline field errors + `ErrorState` + filter badge).
- Test: `frontend/src/app/dashboard/attendance/sessions/__tests__/sessions-client.test.tsx` (list renders + create validation shows inline error).

**Interfaces:**
- Consumes: `GET /attendance/sessions`, `POST /attendance/sessions`, `PUT /sessions/:id`, `DELETE`, batch-delete, generate, QR-checkin signatures from existing client.
- Produces: Manage screen linked from Mark header ("Manage sessions"); Mark stays clean.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SessionsPage from '../page'
describe('Sessions manage', () => {
  it('renders manage heading', () => { render(<SessionsPage /> as any); expect(screen.getByText(/Manage sessions|إدارة الجلسات/i)).toBeInTheDocument() })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/dashboard/attendance/sessions/__tests__/sessions-client.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

Move the session-list + filter + create/edit/delete/generate/batch/QR blocks verbatim from `attendance-client.tsx` into `sessions/page.tsx` client, with deltas: replace `max-h-[500px]` with `max-h-[60vh]`; replace create-form generic toast with inline errors via existing `FormField` (`aria-invalid`, `aria-describedby`); add filter "N active + Clear All" badge; wrap list in `ErrorState` on `loadError` with Retry calling `fetchSessions`; extract duplicated create/edit into `SessionFormModal` with focus trap + Esc to close (`onKeyDown` Escape, initial focus on first field, `role="dialog" aria-modal="true"`); finalize confirm copy explains lock ("Save & Finalize locks the session — Re-open to edit"); remove all `console.error` in moved code, keep toasts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/app/dashboard/attendance/sessions/__tests__/sessions-client.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/attendance/sessions/page.tsx frontend/src/app/dashboard/attendance/sessions/__tests__/sessions-client.test.tsx
git commit -m "feat(attendance): add Sessions manage route"
```

### Task 5: Insights route (stats + by-student)

**Files:**
- Create: `frontend/src/app/dashboard/attendance/insights/page.tsx`
- Test: `frontend/src/app/dashboard/attendance/insights/__tests__/insights-client.test.tsx`

**Interfaces:**
- Consumes: `GET /attendance/stats|level-stats|group-stats`, `GET /attendance/student-search` (debounce 300ms).
- Produces: Insights screen; stat cards render only here (removes always-visible cards bug).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { InsightsClient } from '../insights-client'
vi.mock('@/lib/http-client', () => ({ http: { get: async (u:string) => u.endsWith('/attendance/stats') ? { totalSessions: 10, averageAttendanceRate: 90 } : [] } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
describe('Insights', () => {
  it('shows average rate', async () => { render(<InsightsClient />); await waitFor(()=>expect(screen.getByText(/90/)).toBeInTheDocument()) })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/dashboard/attendance/insights/__tests__/insights-client.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

Move `fetchStats` (`attendance-client.tsx:204-218`) + level/group stats + `studentResults` search (`114-120`, debounced 300ms via `setTimeout`) + 6 stat cards into `insights-client.tsx`; add `ErrorState + Retry` on stats failure; hide cards from Mark/Sessions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/app/dashboard/attendance/insights/__tests__/insights-client.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/attendance/insights/page.tsx frontend/src/app/dashboard/attendance/insights/insights-client.tsx frontend/src/app/dashboard/attendance/insights/__tests__/insights-client.test.tsx
git commit -m "feat(attendance): add Insights route with stats and search"
```

### Task 6: Redirect + cleanup + full verification

**Files:**
- Modify: `frontend/src/app/dashboard/attendance/page.tsx:10-15` → redirect to `mark` preserving query.
- Modify: `frontend/src/components/breadcrumb.tsx:13` add `mark/sessions/insights` labels.
- Delete: legacy `frontend/src/app/dashboard/attendance/attendance-client.tsx` after moves (or keep as re-export during migration, then delete).
- Test: update `frontend/src/app/dashboard/attendance/__tests__/attendance-client.test.tsx` → redirect test + deep-link compat (`?sessionId=sess-1&prefill=present` lands on Mark pre-marked).

**Interfaces:**
- Consumes: Tasks 1-5 routes.
- Produces: `/dashboard/attendance?sessionId=X&prefill=present&subjectItemId=Y` → `/dashboard/attendance/mark?same-query`; nav active state works via existing `pathname.startsWith(item.href)` in `sidebar.tsx:80`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
describe('attendance redirect', () => {
  it('preserves sessionId query', () => {
    const from = '/dashboard/attendance?sessionId=sess-1&prefill=present'
    const to = from.replace('/dashboard/attendance', '/dashboard/attendance/mark')
    expect(to).toBe('/dashboard/attendance/mark?sessionId=sess-1&prefill=present')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/app/dashboard/attendance/__tests__/redirect.test.ts`
Expected: FAIL with "Cannot find module" (file does not exist yet)

- [ ] **Step 3: Write minimal implementation**

```tsx
import { redirect } from 'next/navigation'
export default function AttendancePage({ searchParams }: { searchParams: Record<string,string> }) {
  const q = new URLSearchParams(searchParams || {}).toString()
  redirect(`/dashboard/attendance/mark${q ? `?${q}` : ''}`)
}
```

- [ ] **Step 4: Run full checks**

Run: `npm run test -- src/app/dashboard/attendance`
Expected: PASS
Run: `npm run type-check`
Expected: PASS with no errors
Run: `npm run lint`
Expected: PASS (fix `console.error` leftovers — remove all 9 in moved code, keep toasts)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/attendance/page.tsx frontend/src/components/breadcrumb.tsx
git commit -m "feat(attendance): redirect legacy route to Mark with query compat"
```

'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { EmptyState } from '@/components/ui/empty-state'
import { useMarkingState } from '../lib/use-marking-state'
import { StatusSegment } from '../components/status-segment'
import { MarkSummaryBar } from '../components/mark-summary-bar'
import { DetailExpander } from '../components/detail-expander'

const FALLBACK_USER_ID = '00000000-0000-0000-0000-000000000000'

// Read-only chips mirror the legacy completed-session pattern (static status
// indicators with an sr-only label on the active one — no interactive buttons).
const READONLY_STATUSES = [
  { key: 'present', en: 'Present', ar: 'حاضر', Icon: CheckCircle2, active: 'bg-green-100 text-green-700' },
  { key: 'late', en: 'Late', ar: 'متأخر', Icon: Clock, active: 'bg-amber-100 text-amber-700' },
  { key: 'absent', en: 'Absent', ar: 'غائب', Icon: XCircle, active: 'bg-red-100 text-red-700' },
  { key: 'excused', en: 'Excused', ar: 'معذور', Icon: AlertCircle, active: 'bg-gray-200 text-gray-700' },
] as const

function formatSessionDate(iso?: string, lang: 'en' | 'ar' = 'en') {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  if (lang === 'ar') return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MarkClient() {
  const lang = useLanguage() as 'en'|'ar'
  const { toast } = useToast()
  const params = useSearchParams()
  const [session, setSession] = useState<any>(null)
  const [subjectItemId, setSubjectItemId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [markAllTarget, setMarkAllTarget] = useState<string | null>(null)
  const marking = useMarkingState([])

  const load = async (id?: string, quiet = false) => {
    if (!quiet) setLoading(true)
    setLoadError('')
    try {
      let sid = id || params?.get('sessionId') || ''
      setSubjectItemId(params?.get('subjectItemId') ?? null)
      if (!sid) {
        const started = await http.post<any>('/attendance/start-class')
        sid = (started as any).session?.id || ''
      }
      if (!sid) { setSession(null); return }
      const detail = await http.get<any>(`/attendance/sessions/${sid}`)
      setSession(detail)
      marking.initFromRecords(detail.attendanceRecords || [])
      // Prefill only on explicit (non-quiet) loads: the quiet reload after
      // save must preserve server truth, not force all-present again.
      if (!quiet && params?.get('prefill') === 'present') {
        marking.markAll('present', (detail.attendanceRecords || []).map((r: any) => r.student?.id).filter(Boolean))
      }
    } catch (e: any) { setLoadError(e?.message || 'Failed to load') }
    finally { setLoading(false) }
  }
  // Initial mount only — later session changes reload via load(), which
  // re-seeds the hook through initFromRecords (the [] initial is ignored after mount).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const save = async (finalize = false) => {
    if (!session || saving || session.status === 'completed') return
    setSaving(true); setSaveError('')
    let userId = FALLBACK_USER_ID
    try { userId = JSON.parse(localStorage.getItem('user') || '{}').id || FALLBACK_USER_ID } catch {}
    // buildSavePayload returns records WITHOUT recordedBy — recordedBy is top-level per API shape.
    const records = marking.buildSavePayload(userId)
    try {
      await http.post(`/attendance/sessions/${session.id}/mark`, { records, recordedBy: userId })
      if (finalize) await http.put(`/attendance/sessions/${session.id}`, { status: 'completed' })
      toast('success', lang === 'ar' ? 'تم حفظ الحضور' : 'Attendance saved')
      marking.setDirty(false)
      await load(session.id, true)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save attendance')
      toast('error', lang === 'ar' ? 'فشل حفظ الحضور' : 'Failed to save attendance', e?.message || '')
    } finally { setSaving(false) }
  }

  // Mirror legacy handleReopenAttendance: PUT in_progress, toast, refetch.
  const reopen = async () => {
    if (!session || reopening) return
    setReopening(true); setSaveError('')
    try {
      await http.put(`/attendance/sessions/${session.id}`, { status: 'in_progress' })
      toast('success', lang === 'ar' ? 'تم إعادة فتح الجلسة' : 'Session reopened')
      await load(session.id, true)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to reopen session')
      toast('error', lang === 'ar' ? 'فشل إعادة فتح الجلسة' : 'Failed to reopen session', e?.message || '')
    } finally { setReopening(false) }
  }

  // Ctrl/Cmd+S saves without leaving the keyboard flow.
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleRecordKeyDown = (e: React.KeyboardEvent, recordIndex: number, record: any) => {
    const id = record.student?.id
    if (!id) return
    // Completed sessions are read-only — never mutate marks via keyboard.
    if (session?.status === 'completed') return
    // Never hijack typing inside the note field.
    const t = e.target as HTMLElement
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
    const recs = session?.attendanceRecords || []
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); marking.setStatus(id, 'present') }
    else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); marking.setStatus(id, 'late') }
    else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); marking.setStatus(id, 'absent') }
    else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); marking.setStatus(id, 'excused') }
    else if (e.key >= '1' && e.key <= '5') { e.preventDefault(); marking.setBehavior(id, parseInt(e.key, 10)) }
    else if (e.key === 'ArrowUp' && recordIndex > 0) {
      e.preventDefault()
      const prev = recs[recordIndex - 1]
      if (prev?.student) (document.querySelector(`[data-student-id="${prev.student.id}"]`) as HTMLElement)?.focus()
    } else if (e.key === 'ArrowDown' && recordIndex < recs.length - 1) {
      e.preventDefault()
      const next = recs[recordIndex + 1]
      if (next?.student) (document.querySelector(`[data-student-id="${next.student.id}"]`) as HTMLElement)?.focus()
    }
  }

  if (loading && !session) return <div className="p-12 text-center text-gray-500">Loading…</div>
  if (loadError && !session) return <EmptyState title={lang === 'ar' ? 'فشل التحميل' : 'Failed to load'} description={loadError} action={<Button onClick={() => { void load() }} className="min-h-[44px]">{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>} />
  if (!session) return <EmptyState title={lang === 'ar' ? 'لا توجد جلسة اليوم' : 'No session today'} description={lang === 'ar' ? 'ابدأ الحصة لفتح التحضير' : 'Start class to open marking'} action={<Button onClick={() => { void load() }} className="min-h-[44px]">{lang === 'ar' ? 'بدء الحصة' : 'Start class'}</Button>} />

  const recs = session.attendanceRecords || []
  const counts = {
    present: recs.filter((r: any) => marking.marks[r.student?.id] === 'present').length,
    late: recs.filter((r: any) => marking.marks[r.student?.id] === 'late').length,
    absent: recs.filter((r: any) => marking.marks[r.student?.id] === 'absent').length,
    excused: recs.filter((r: any) => marking.marks[r.student?.id] === 'excused').length,
    marked: Object.values(marking.marks).filter(v => v && v !== 'unmarked').length,
    total: recs.length,
  }
  const scopeName = session.group?.name || session.level?.name || ''
  const isCompleted = session.status === 'completed'
  const visibleIds = recs.map((r: any) => r.student?.id).filter(Boolean)
  const markAllLabel = markAllTarget === 'present'
    ? (lang === 'ar' ? 'تحديد الكل حاضر؟' : 'Mark all as Present?')
    : markAllTarget === 'late'
      ? (lang === 'ar' ? 'تحديد الكل متأخر؟' : 'Mark all as Late?')
      : (lang === 'ar' ? 'تحديد الكل غائب؟' : 'Mark all as Absent?')

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'تسجيل الحضور' : 'Mark Attendance'}</h1>
        <p className="text-sm text-gray-500">{[scopeName, formatSessionDate(session.scheduledDate, lang), session.status].filter(Boolean).join(' · ')}</p>
        {/* NOTE: `subjectItemId` is caption-only for now. Deferred follow-ups (product
            decision): subject-item actions (in-progress/completed/allocated), PDF export,
            and QR-on-Mark — all intentionally out of this split. */}
        {/* NOTE: no `mode` query param is read here on purpose — verified dead in legacy
            too (git show 70582fe:…/attendance-client.tsx has no `mode` search-param read;
            only generateMode/marking/completed identifier matches). */}
        {subjectItemId && <p className="text-xs text-gray-400">{lang === 'ar' ? 'عنصر المنهج مرتبط' : 'Lesson item linked'}</p>}
        {isCompleted && (
          <p role="note" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {lang === 'ar'
              ? 'هذه الجلسة نهائية ومقفلة للقراءة فقط. أعد فتحها لإجراء تغييرات.'
              : 'This session is finalized and read-only. Re-open it to make changes.'}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          <Link href="/dashboard/attendance/sessions" className="rounded text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
            {lang === 'ar' ? 'إدارة الجلسات' : 'Manage sessions'}
          </Link>
          {' · '}
          <Link href="/dashboard/attendance/insights" className="rounded text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
            {lang === 'ar' ? 'الإحصائيات' : 'Insights'}
          </Link>
        </p>
      </div>
      <MarkSummaryBar {...counts} dirty={marking.dirty} error={saveError} onRetry={() => save(false)} lang={lang} />
      {/* Mark-all row (hidden once finalized) — mirrors the legacy confirm pattern. */}
      {!isCompleted && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-xs text-gray-500">{lang === 'ar' ? 'تحديد الكل:' : 'Mark all:'}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMarkAllTarget('present')} className="min-h-[44px] bg-green-100 text-green-700 hover:bg-green-200">{lang === 'ar' ? 'الكل حاضر' : 'All Present'}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMarkAllTarget('late')} className="min-h-[44px] bg-amber-100 text-amber-700 hover:bg-amber-200">{lang === 'ar' ? 'الكل متأخر' : 'All Late'}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMarkAllTarget('absent')} className="min-h-[44px] bg-red-100 text-red-700 hover:bg-red-200">{lang === 'ar' ? 'الكل غائب' : 'All Absent'}</Button>
        </div>
      )}
      {recs.map((r: any, i: number) => {
        const studentName = `${r.student?.firstName} ${r.student?.lastName}`
        const current = marking.marks[r.student?.id] || 'unmarked'
        return (
        <div
          key={r.student?.id}
          data-student-id={r.student?.id}
          tabIndex={0}
          onKeyDown={(e) => handleRecordKeyDown(e, i, r)}
          className="rounded-xl border border-gray-200 bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <div className="mb-2 font-medium">{r.student?.firstName} {r.student?.lastName}</div>
          {isCompleted ? (
            <div role="group" aria-label={lang === 'ar' ? `الحالة - ${studentName} (نهائية)` : `Status - ${studentName} (finalized)`} className="grid grid-cols-2 gap-2">
              {READONLY_STATUSES.map(({ key, en, ar, Icon, active }) => {
                const label = lang === 'ar' ? ar : en
                const isCurrent = current === key
                return (
                  <div key={key} role="img" aria-label={isCurrent ? label : ''} title={label}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isCurrent ? active : 'bg-gray-50 text-gray-300'}`}>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{label}</span>
                    {isCurrent && <span className="sr-only">{label}</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <StatusSegment value={current} onChange={(s) => marking.setStatus(r.student.id, s)} lang={lang} studentName={studentName} />
          )}
          {isCompleted ? (
            <div className="mt-2 text-xs text-gray-500">
              {lang === 'ar'
                ? `السلوك: ${marking.behavior[r.student?.id] || 0}/5 · المشاركة: ${marking.participation[r.student?.id] || 0}/5${marking.liturgy[r.student?.id] ? ' · قداس' : ''}${marking.notes[r.student?.id] ? ` · ${marking.notes[r.student?.id]}` : ''}`
                : `Behavior: ${marking.behavior[r.student?.id] || 0}/5 · Participation: ${marking.participation[r.student?.id] || 0}/5${marking.liturgy[r.student?.id] ? ' · Liturgy' : ''}${marking.notes[r.student?.id] ? ` · ${marking.notes[r.student?.id]}` : ''}`}
            </div>
          ) : (
            <DetailExpander
              behavior={marking.behavior[r.student?.id] || 0}
              participation={marking.participation[r.student?.id] || 0}
              liturgy={!!marking.liturgy[r.student?.id]}
              note={marking.notes[r.student?.id] || ''}
              onBehaviorChange={(v) => marking.setBehavior(r.student.id, v)}
              onParticipationChange={(v) => marking.setParticipation(r.student.id, v)}
              onLiturgyChange={(v) => marking.setLiturgy(r.student.id, v)}
              onNoteChange={(v) => marking.setNote(r.student.id, v)}
              lang={lang}
              studentName={studentName}
            />
          )}
        </div>
        )
      })}
      {!isCompleted && (
        <p className="text-xs text-gray-500">{lang === 'ar' ? 'P/L/A/E للحالة · 1-5 للسلوك · ↑↓ للتنقل · Ctrl+S للحفظ' : 'P/L/A/E status · 1-5 behavior · ↑↓ move · Ctrl+S save'}</p>
      )}
      {isCompleted ? (
        <div className="sticky bottom-0 bg-white p-3">
          <Button onClick={() => { void reopen() }} disabled={reopening} className="min-h-[44px] w-full bg-amber-500 text-white hover:bg-amber-600">
            {lang === 'ar' ? 'إعادة فتح الحضور' : 'Re-open Attendance'}
          </Button>
        </div>
      ) : (
        <div className="sticky bottom-0 flex gap-2 bg-white p-3">
          <Button onClick={() => save(false)} disabled={saving} className="min-h-[44px] flex-1">{lang === 'ar' ? 'حفظ' : 'Save'}</Button>
          <Button onClick={() => save(true)} disabled={saving} variant="outline" className="min-h-[44px] flex-1">{lang === 'ar' ? 'حفظ وإنهاء' : 'Save & Finalize'}</Button>
        </div>
      )}
      {/* Mark-all confirm — same dialog pattern as Sessions delete confirms. */}
      {markAllTarget && !isCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMarkAllTarget(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="mark-all-title" className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 id="mark-all-title" className="mb-2 font-semibold text-gray-900">{markAllLabel}</h3>
            <p className="mb-6 text-sm text-gray-500">
              {lang === 'ar'
                ? `هذا سيحدد جميع الطلاب (${visibleIds.length}) في هذه الجلسة كـ${markAllTarget === 'present' ? ' حاضر' : markAllTarget === 'late' ? ' متأخر' : ' غائب'}`
                : `This will mark all ${visibleIds.length} students in this session as ${markAllTarget}`}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setMarkAllTarget(null)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button
                onClick={() => { marking.markAll(markAllTarget, visibleIds); setMarkAllTarget(null) }}
                className={markAllTarget === 'present' ? 'bg-green-600 hover:bg-green-700' : markAllTarget === 'late' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}>
                {lang === 'ar' ? 'تأكيد' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

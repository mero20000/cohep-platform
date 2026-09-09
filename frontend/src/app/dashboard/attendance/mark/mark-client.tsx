'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
    if (!session || saving) return
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

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'تسجيل الحضور' : 'Mark Attendance'}</h1>
        <p className="text-sm text-gray-500">{[scopeName, formatSessionDate(session.scheduledDate, lang), session.status].filter(Boolean).join(' · ')}</p>
        {subjectItemId && <p className="text-xs text-gray-400">{lang === 'ar' ? 'عنصر المنهج مرتبط' : 'Lesson item linked'}</p>}
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
      {recs.map((r: any, i: number) => (
        <div
          key={r.student?.id}
          data-student-id={r.student?.id}
          tabIndex={0}
          onKeyDown={(e) => handleRecordKeyDown(e, i, r)}
          className="rounded-xl border border-gray-200 bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <div className="mb-2 font-medium">{r.student?.firstName} {r.student?.lastName}</div>
          <StatusSegment value={marking.marks[r.student?.id] || 'unmarked'} onChange={(s) => marking.setStatus(r.student.id, s)} lang={lang} studentName={`${r.student?.firstName} ${r.student?.lastName}`} />
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
            studentName={`${r.student?.firstName} ${r.student?.lastName}`}
          />
        </div>
      ))}
      <p className="text-xs text-gray-500">{lang === 'ar' ? 'P/L/A/E للحالة · 1-5 للسلوك · ↑↓ للتنقل · Ctrl+S للحفظ' : 'P/L/A/E status · 1-5 behavior · ↑↓ move · Ctrl+S save'}</p>
      <div className="sticky bottom-0 flex gap-2 bg-white p-3">
        <Button onClick={() => save(false)} disabled={saving} className="min-h-[44px] flex-1">{lang === 'ar' ? 'حفظ' : 'Save'}</Button>
        <Button onClick={() => save(true)} disabled={saving} variant="outline" className="min-h-[44px] flex-1">{lang === 'ar' ? 'حفظ وإنهاء' : 'Save & Finalize'}</Button>
      </div>
    </div>
  )
}

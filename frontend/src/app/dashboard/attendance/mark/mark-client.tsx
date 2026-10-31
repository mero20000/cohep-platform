'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, AlertCircle, Search, X, Settings2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { EmptyState } from '@/components/ui/empty-state'
import { useMarkingState } from '../lib/use-marking-state'
import { StatusSegment } from '../components/status-segment'
import { MarkSummaryBar } from '../components/mark-summary-bar'
import { DetailExpander } from '../components/detail-expander'
import { SessionTypeBadge } from '../components/session-type-badge'
import { audienceSummary, isFinalStatus, isFutureDay, sessionTitle, sessionType, typeLabel } from '../lib/session-types'

/** Final (completed/legacy recorded), or a liturgy/event that is scheduled for a later day. */
function sessionLocked(s: any): boolean {
  if (!s) return false
  return isFinalStatus(s.status) || s.status === 'cancelled' || (sessionType(s) !== 'class' && isFutureDay(s.scheduledDate))
}

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
  const [starting, setStarting] = useState(false)
  const [markAllTarget, setMarkAllTarget] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [unmarkedOnly, setUnmarkedOnly] = useState(false)
  const [groupPickerOpen, setGroupPickerOpen] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string }>>([])
  const [availableLevels, setAvailableLevels] = useState<Array<{ id: string; name: string; number?: number }>>([])
  const [availableGrades, setAvailableGrades] = useState<Array<{ id: string; name: string; groupId: string }>>([])
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null)
  const [pickerStep, setPickerStep] = useState<'group' | 'level' | 'grade' | 'gender'>('group')
  const [pickedLevelId, setPickedLevelId] = useState<string | null>(null)
  const [pickedGradeId, setPickedGradeId] = useState<string | null>(null)
  const [needsManualStart, setNeedsManualStart] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [canMulti, setCanMulti] = useState(false)
  const [groupFilter, setGroupFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const marking = useMarkingState([])

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      setIsSuperAdmin(u.roles?.includes('super_admin') ?? false)
      setCanMulti((u.roles ?? []).some((r: string) => ['super_admin', 'admin', 'principal', 'level_leader'].includes(r)))
    } catch {}
  }, [])

  const loadSession = async (sid: string, quiet = false) => {
    if (!quiet) setLoading(true)
    setLoadError('')
    try {
      const detail = await http.get<any>(`/attendance/sessions/${sid}`)
      setSession(detail)
      marking.initFromRecords(detail.attendanceRecords || [])
      if (!quiet && params?.get('prefill') === 'present') {
        marking.markAll('present', (detail.attendanceRecords || []).map((r: any) => r.student?.id).filter(Boolean))
      }
    } catch (e: any) {
      setLoadError(e?.message || (lang === 'ar' ? 'فشل تحميل الجلسة' : 'Failed to load session'))
    } finally { setLoading(false) }
  }

  const startClassManually = async (groupId?: string, levelId?: string, gradeId?: string, gender?: string) => {
    setStarting(true)
    setLoadError('')
    try {
      const qs = new URLSearchParams()
      if (groupId) qs.set('groupId', groupId)
      if (levelId) qs.set('levelId', levelId)
      if (gradeId) qs.set('gradeId', gradeId)
      if (gender) qs.set('gender', gender)
      const url = `/attendance/start-class${qs.toString() ? `?${qs}` : ''}`
      const started = await http.post<any>(url)

      if ((started as any)?.requiresGroupPick && (started as any)?.groups) {
        setAvailableGroups((started as any).groups)
        setAvailableLevels((started as any).levels || [])
        setAvailableGrades((started as any).grades || [])
        setPickedGroupId(null)
        setPickedLevelId(null)
        setPickedGradeId(null)
        setPickerStep('group')
        setGroupPickerOpen(true)
        setSession(null)
        setNeedsManualStart(false)
        setStarting(false)
        return
      }

      const sid = (started as any)?.session?.id || ''
      if (!sid) {
        setLoadError(lang === 'ar'
          ? 'لم يتم إسناد مجموعة أو مرحلة لك بعد. الرجاء التواصل مع المسؤول.'
          : 'No group or level assigned to you yet. Please contact your admin.')
        setSession(null)
        setStarting(false)
        return
      }
      setNeedsManualStart(false)
      await loadSession(sid)
    } catch (e: any) {
      setLoadError(e?.message || (lang === 'ar' ? 'فشل بدء الحصة' : 'Failed to start class'))
    } finally { setStarting(false) }
  }

  const load = async (id?: string, quiet = false, groupId?: string, levelId?: string, gradeId?: string) => {
    if (!quiet) setLoading(true)
    setLoadError('')
    try {
      const sid = id || params?.get('sessionId') || ''
      setSubjectItemId(params?.get('subjectItemId') ?? null)
      if (!sid) {
        if (groupId) {
          await startClassManually(groupId, levelId, gradeId)
          return
        }
        setNeedsManualStart(true)
        setLoading(false)
        return
      }
      await loadSession(sid, quiet)
    } catch (e: any) {
      setLoadError(e?.message || (lang === 'ar' ? 'فشل تحميل الجلسة' : 'Failed to load session'))
      setLoading(false)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const save = async (finalize = false) => {
    if (!session || saving || sessionLocked(session)) return
    setSaving(true); setSaveError('')
    let userId = FALLBACK_USER_ID
    try { userId = JSON.parse(localStorage.getItem('user') || '{}').id || FALLBACK_USER_ID } catch {}
    // buildSavePayload returns records WITHOUT recordedBy — recordedBy is top-level per API shape.
    const records = marking.buildSavePayload(userId)
    try {
      if (finalize) {
        // One atomic call: saves marks and completes the session together.
        const type = sessionType(session)
        const unmarked = (session.attendanceRecords || []).filter((r: any) => {
          const m = marking.marks[r.student?.id]; return !m || m === 'unmarked'
        }).length
        // Anyone still unmarked is saved as absent when the session is finalized.
        if (unmarked > 0) {
          const ok = window.confirm(type === 'class'
            ? (lang === 'ar'
                ? `سيتم تسجيل ${unmarked} طالب لم يُسجَّل حاضرًا أو متأخرًا أو معذورًا كغائب. هل تريد الإنهاء؟`
                : `${unmarked} student(s) not marked present, late or excused will be saved as absent. Finalize?`)
            : (lang === 'ar'
                ? `سيتم تسجيل ${unmarked} طالب غير حاضر كغائب. هل تريد الإنهاء؟`
                : `${unmarked} student(s) not marked present will be saved as absent. Finalize?`))
          if (!ok) { setSaving(false); return }
        }
        await http.post(`/attendance/sessions/${session.id}/finalize`, { records, recordedBy: userId })
      } else {
        await http.post(`/attendance/sessions/${session.id}/mark`, { records, recordedBy: userId })
      }
      toast('success', lang === 'ar' ? 'تم حفظ الحضور' : 'Attendance saved')
      marking.setDirty(false)
      await loadSession(session.id, true)
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
      await loadSession(session.id, true)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to reopen session')
      toast('error', lang === 'ar' ? 'فشل إعادة فتح الجلسة' : 'Failed to reopen session', e?.message || '')
    } finally { setReopening(false) }
  }

  // Start a scheduled session manually
  const startSession = async () => {
    if (!session || starting) return
    setStarting(true); setSaveError('')
    try {
      await http.post(`/attendance/sessions/${session.id}/start`)
      toast('success', lang === 'ar' ? 'بدأت الحصة' : 'Class started')
      await loadSession(session.id, true)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to start session')
      toast('error', lang === 'ar' ? 'فشل بدء الحصة' : 'Failed to start session', e?.message || '')
    } finally { setStarting(false) }
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

  // Auto-save: debounce 3s after any marking change
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { void saveRef.current(false) }, 3000)
  }, [])
  useEffect(() => {
    if (marking.dirty && session && !sessionLocked(session)) autoSave()
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [marking.dirty, marking.marks, marking.behavior, marking.participation, marking.notes, session, autoSave])

  const handleRecordKeyDown = (e: React.KeyboardEvent, record: any) => {
    const id = record.student?.id
    if (!id) return
    // Completed sessions are read-only — never mutate marks via keyboard.
    if (sessionLocked(session)) return
    const binary = sessionType(session) !== 'class'
    // Never hijack typing inside the note field.
    const t = e.target as HTMLElement
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
    // Arrow navigation follows DOM order so it keeps working when the list
    // is filtered by search or the unmarked-only toggle.
    const order = Array.from(document.querySelectorAll('[data-student-id]'))
    const at = order.indexOf(e.target as Element)
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); marking.setStatus(id, 'present') }
    else if (!binary && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); marking.setStatus(id, 'late') }
    else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); marking.setStatus(id, 'absent') }
    else if (!binary && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); marking.setStatus(id, 'excused') }
    else if (!binary && e.key >= '1' && e.key <= '5') { e.preventDefault(); marking.setBehavior(id, parseInt(e.key, 10)) }
    else if (e.key === 'ArrowUp' && at > 0) {
      e.preventDefault()
      ;(order[at - 1] as HTMLElement)?.focus()
    } else if (e.key === 'ArrowDown' && at >= 0 && at < order.length - 1) {
      e.preventDefault()
      ;(order[at + 1] as HTMLElement)?.focus()
    }
  }

  if (loading && !session) return <div className="p-12 text-center text-gray-500">Loading…</div>
  if (loadError && !session) return <EmptyState title={lang === 'ar' ? 'فشل التحميل' : 'Failed to load'} description={loadError} action={<Button onClick={() => { void load() }} className="min-h-[44px]">{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>} />
  if (needsManualStart && !session && !groupPickerOpen) return (
    <EmptyState
      title={lang === 'ar' ? 'لا توجد جلسة اليوم' : 'No session today'}
      description={lang === 'ar' ? 'اضغط "بدء الحصة" لإنشاء جلسة حضور جديدة' : 'Press "Start Class" to create a new attendance session'}
      action={
        <div className="flex flex-col items-center gap-2">
          <Button onClick={() => { void startClassManually() }} disabled={starting} className="min-h-[44px]">
            {starting ? (lang === 'ar' ? 'جاري البدء…' : 'Starting…') : (lang === 'ar' ? 'بدء الحصة' : 'Start Class')}
          </Button>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/dashboard/attendance/sessions?new=liturgy"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 min-h-[40px]">
              {lang === 'ar' ? 'بدء قداس' : 'Start Liturgy'}
            </Link>
            {canMulti && (
              <Link href="/dashboard/attendance/sessions?new=event"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 min-h-[40px]">
                {lang === 'ar' ? 'بدء فعالية' : 'Start Event'}
              </Link>
            )}
          </div>
          {isSuperAdmin && (
            <Link href="/dashboard/attendance/sessions"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 min-h-[40px]">
              <Settings2 className="h-3.5 w-3.5" />{lang === 'ar' ? 'إدارة الجلسات' : 'Manage Sessions'}
            </Link>
          )}
        </div>
      }
    />
  )
  if (!session && !groupPickerOpen) return (
    <EmptyState
      title={lang === 'ar' ? 'لا توجد جلسة' : 'No session'}
      description={lang === 'ar' ? 'لم يتم العثور على جلسة' : 'No session found'}
      action={
        <div className="flex flex-col items-center gap-2">
          <Button onClick={() => { void load() }} className="min-h-[44px]">{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>
          {isSuperAdmin && (
            <Link href="/dashboard/attendance/sessions"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 min-h-[40px]">
              <Settings2 className="h-3.5 w-3.5" />{lang === 'ar' ? 'إدارة الجلسات' : 'Manage Sessions'}
            </Link>
          )}
        </div>
      }
    />
  )

  const finishPicker = (gid: string, lid?: string, grid?: string, gen?: string) => {
    setGroupPickerOpen(false)
    setPickedGroupId(null)
    setPickedLevelId(null)
    setPickedGradeId(null)
    setPickerStep('group')
    void startClassManually(gid, lid, grid, gen)
  }

  const groupGrades = pickedGroupId ? availableGrades.filter(g => g.groupId === pickedGroupId) : []

  // Group/level/grade picker is open but no session yet — render only the picker overlay
  if (!session && groupPickerOpen) return (
    <div className="p-8 text-center">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{lang === 'ar' ? 'بدء حصة جديدة' : 'Start a New Class'}</h2>
      <p className="text-sm text-gray-500 mb-6">{lang === 'ar' ? 'اختر المجموعة لبدء التحضير' : 'Select a group to begin attendance'}</p>
      <div className="mx-auto w-full max-w-sm">
        <div role="dialog" aria-labelledby="group-picker-title" className="rounded-2xl bg-white p-6 shadow-lg border border-gray-200">
          {pickerStep === 'group' && (
            <>
              <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                {lang === 'ar' ? 'اختر المجموعة' : 'Select a Group'}
              </h3>
              <p className="mb-4 text-sm text-gray-500">{lang === 'ar' ? 'المجموعة (مطلوبة)' : 'Group (required)'}</p>
              <div className="mb-4 space-y-2 max-h-96 overflow-y-auto">
                {availableGroups.map(group => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setPickedGroupId(group.id)
                      if (availableLevels.length > 0) {
                        setPickerStep('level')
                      } else {
                        const gGrades = availableGrades.filter(g => g.groupId === group.id)
                        if (gGrades.length > 0) {
                          setPickerStep('grade')
                        } else {
                          setPickerStep('gender')
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {pickerStep === 'level' && pickedGroupId && (
            <>
              <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                {lang === 'ar' ? 'اختر المرحلة' : 'Select a Level'}
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                {lang === 'ar' ? 'المرحلة (اختياري)' : 'Level (optional)'}
                {' · '}
                {availableGroups.find(g => g.id === pickedGroupId)?.name}
              </p>
              <div className="mb-4 space-y-2 max-h-96 overflow-y-auto">
                {availableLevels.map(level => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => {
                      setPickedLevelId(level.id)
                      const gGrades = availableGrades.filter(g => g.groupId === pickedGroupId)
                      if (gGrades.length > 0) {
                        setPickerStep('grade')
                      } else {
                        setPickerStep('gender')
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    {level.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const gGrades = availableGrades.filter(g => g.groupId === pickedGroupId)
                  if (gGrades.length > 0) {
                    setPickedLevelId(null)
                    setPickerStep('grade')
                  } else {
                    setPickerStep('gender')
                  }
                }}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 mb-2"
              >
                {lang === 'ar' ? 'تخطّي — كل المراحل' : 'Skip — All Levels'}
              </button>
              <Button variant="outline" onClick={() => { setPickedGroupId(null); setPickerStep('group') }} className="min-h-[44px] w-full mb-2">
                {lang === 'ar' ? 'رجوع' : 'Back'}
              </Button>
            </>
          )}
          {pickerStep === 'grade' && pickedGroupId && (
            <>
              <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                {lang === 'ar' ? 'اختر الصف' : 'Select a Grade'}
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                {lang === 'ar' ? 'الصف (اختياري)' : 'Grade (optional)'}
                {' · '}
                {availableGroups.find(g => g.id === pickedGroupId)?.name}
                {pickedLevelId && ` · ${availableLevels.find(l => l.id === pickedLevelId)?.name}`}
              </p>
              <div className="mb-4 space-y-2 max-h-96 overflow-y-auto">
                {groupGrades.map(grade => (
                  <button
                    key={grade.id}
                    type="button"
                    onClick={() => { setPickedGradeId(grade.id); setPickerStep('gender') }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    {grade.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPickerStep('gender')}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 mb-2"
              >
                {lang === 'ar' ? 'تخطّي — كل الصفوف' : 'Skip — All Grades'}
              </button>
              <Button variant="outline" onClick={() => setPickerStep(availableLevels.length > 0 ? 'level' : 'group')} className="min-h-[44px] w-full mb-2">
                {lang === 'ar' ? 'رجوع' : 'Back'}
              </Button>
            </>
          )}
          {pickerStep === 'gender' && pickedGroupId && (
            <>
              <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                {lang === 'ar' ? 'اختر الجنس' : 'Select Gender'}
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                {lang === 'ar' ? 'الجنس (اختياري)' : 'Gender (optional)'}
                {' · '}
                {availableGroups.find(g => g.id === pickedGroupId)?.name}
                {pickedLevelId && ` · ${availableLevels.find(l => l.id === pickedLevelId)?.name}`}
                {pickedGradeId && ` · ${availableGrades.find(g => g.id === pickedGradeId)?.name}`}
              </p>
              <div className="mb-4 space-y-2">
                <button type="button" onClick={() => finishPicker(pickedGroupId!, pickedLevelId ?? undefined, pickedGradeId ?? undefined, 'male')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                  {lang === 'ar' ? 'ذكور' : 'Male'}
                </button>
                <button type="button" onClick={() => finishPicker(pickedGroupId!, pickedLevelId ?? undefined, pickedGradeId ?? undefined, 'female')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                  {lang === 'ar' ? 'إناث' : 'Female'}
                </button>
              </div>
              <button type="button" onClick={() => finishPicker(pickedGroupId!, pickedLevelId ?? undefined, pickedGradeId ?? undefined)}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 mb-2">
                {lang === 'ar' ? 'تخطّي — الكل (تلقائي)' : 'Skip — All (auto)'}
              </button>
              <Button variant="outline" onClick={() => {
                const gGrades = availableGrades.filter(g => g.groupId === pickedGroupId)
                if (gGrades.length > 0) { setPickedGradeId(null); setPickerStep('grade') }
                else if (availableLevels.length > 0) setPickerStep('level')
                else setPickerStep('group')
              }} className="min-h-[44px] w-full mb-2">
                {lang === 'ar' ? 'رجوع' : 'Back'}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => { setGroupPickerOpen(false); setPickedGroupId(null); setPickedLevelId(null); setPickedGradeId(null); setPickerStep('group') }} className="min-h-[44px] w-full">
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  )

  const recs = session.attendanceRecords || []
  const isUnmarked = (r: any) => { const s = marking.marks[r.student?.id]; return !s || s === 'unmarked' }
  const matchesQuery = (r: any) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const s = r.student || {}
    return [s.firstName, s.lastName, s.firstNameAr, s.lastNameAr].some(v => (v || '').toLowerCase().includes(q))
  }
  const studentSortName = (r: any) => {
    const s = r.student || {}
    return `${s.firstName || ''} ${s.lastName || ''}`.trim() || `${s.firstNameAr || ''} ${s.lastNameAr || ''}`.trim()
  }
  const type = sessionType(session)
  const isBinary = type !== 'class'
  const isCompleted = isFinalStatus(session.status)
  const isCancelled = session.status === 'cancelled'
  const notYet = !isCompleted && isBinary && isFutureDay(session.scheduledDate)
  const readOnly = isCompleted || notYet || isCancelled
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  // Group / grade breakdown (multi-group liturgy & events, or a class spanning several grades).
  const groupOf = (r: any) => ({ id: r.student?.group?.id || r.student?.groupId || '', name: r.student?.group?.name || '' })
  const gradeOf = (r: any) => ({ id: r.student?.grade?.id || r.student?.gradeId || '', name: r.student?.grade?.name || '' })
  const matchesScope = (r: any) =>
    (!groupFilter || groupOf(r).id === groupFilter) && (!gradeFilter || gradeOf(r).id === gradeFilter)
  const groupStats = new Map<string, { id: string; name: string; total: number; marked: number }>()
  const gradeStats = new Map<string, { id: string; name: string; total: number; marked: number }>()
  for (const r of recs) {
    const g = groupOf(r)
    if (g.id) {
      const e = groupStats.get(g.id) ?? { ...g, total: 0, marked: 0 }
      e.total++; if (!isUnmarked(r)) e.marked++
      groupStats.set(g.id, e)
    }
    const gr = gradeOf(r)
    if (gr.id && (!groupFilter || g.id === groupFilter)) {
      const e = gradeStats.get(gr.id) ?? { ...gr, total: 0, marked: 0 }
      e.total++; if (!isUnmarked(r)) e.marked++
      gradeStats.set(gr.id, e)
    }
  }
  const groupChips = [...groupStats.values()].sort((a, b) => a.name.localeCompare(b.name))
  const gradeChips = [...gradeStats.values()].sort((a, b) => a.name.localeCompare(b.name))
  const showGroupChips = groupChips.length > 1
  const showGradeChips = gradeChips.length > 1
  const showSections = showGroupChips && !groupFilter

  const visibleRecs = recs
    .filter((r: any) => matchesQuery(r) && matchesScope(r) && (!unmarkedOnly || isUnmarked(r)))
    // Group first (multi-group sessions), then alphabetical so the servant scans in a predictable order.
    .sort((a: any, b: any) => (showSections ? groupOf(a).name.localeCompare(groupOf(b).name, lang === 'ar' ? 'ar' : 'en') : 0)
      || studentSortName(a).localeCompare(studentSortName(b), lang === 'ar' ? 'ar' : 'en'))
  const unmarkedCount = recs.filter(isUnmarked).length
  const isFiltering = query.trim() !== '' || unmarkedOnly || !!groupFilter || !!gradeFilter
  const counts = {
    present: recs.filter((r: any) => marking.marks[r.student?.id] === 'present').length,
    late: recs.filter((r: any) => marking.marks[r.student?.id] === 'late').length,
    absent: recs.filter((r: any) => marking.marks[r.student?.id] === 'absent').length,
    excused: recs.filter((r: any) => marking.marks[r.student?.id] === 'excused').length,
    marked: Object.values(marking.marks).filter(v => v && v !== 'unmarked').length,
    total: recs.length,
  }
  const titleText = sessionTitle(session, lang)
  const scopeIds = recs.filter(matchesScope).map((r: any) => r.student?.id).filter(Boolean)
  const visibleIds = scopeIds
  const markAllLabel = markAllTarget === 'present'
    ? (lang === 'ar' ? 'تحديد الكل حاضر؟' : 'Mark all as Present?')
    : markAllTarget === 'late'
      ? (lang === 'ar' ? 'تحديد الكل متأخر؟' : 'Mark all as Late?')
      : (lang === 'ar' ? 'تحديد الكل غائب؟' : 'Mark all as Absent?')

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'تسجيل الحضور' : 'Mark Attendance'}</h1>
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-gray-500">
              {isBinary && <SessionTypeBadge type={type} lang={lang} />}
              <span>{[titleText, isBinary ? '' : '', formatSessionDate(session.scheduledDate, lang), isFinalStatus(session.status) ? 'completed' : session.status].filter(Boolean).join(' · ')}</span>
            </p>
            {isBinary && (session.location || audienceSummary(session, lang)) && (
              <p className="text-xs text-gray-500">{[audienceSummary(session, lang), session.location].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {isSuperAdmin && (
            <Link href="/dashboard/attendance/sessions"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 min-h-[40px] shrink-0">
              <Settings2 className="h-3.5 w-3.5" />{lang === 'ar' ? 'إدارة الجلسات' : 'Manage Sessions'}
            </Link>
          )}
        </div>
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
        {isCancelled && (
          <p role="note" className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
            {lang === 'ar'
              ? 'تم إلغاء هذه الجلسة. لا حاجة لتسجيل الحضور.'
              : 'This session was cancelled. No attendance recording is needed.'}
          </p>
        )}
        {notYet && (
          <p role="note" className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {t(
              `This ${typeLabel(type, 'en').toLowerCase()} is scheduled for ${formatSessionDate(session.scheduledDate, 'en')}. Attendance can be recorded from that day.`,
              `هذه الجلسة مجدولة بتاريخ ${formatSessionDate(session.scheduledDate, 'ar')}. يمكن تسجيل الحضور من ذلك اليوم.`,
            )}
          </p>
        )}
        {session.status === 'scheduled' && !notYet && (
          <button
            type="button"
            onClick={() => void startSession()}
            disabled={starting}
            className="mt-2 flex min-h-[44px] items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50"
          >
            {starting
              ? (lang === 'ar' ? 'جاري البدء…' : 'Starting…')
              : type === 'liturgy' ? t('Start Liturgy', 'بدء القداس')
              : type === 'event' ? t('Start Event', 'بدء الفعالية')
              : (lang === 'ar' ? 'بدء الحصة' : 'Start Class')}
          </button>
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
      <div className="sticky top-0 z-10 space-y-2 bg-white/95 py-2 backdrop-blur">
        <MarkSummaryBar {...counts} binary={isBinary} dirty={marking.dirty} error={saveError} onRetry={() => save(false)} lang={lang} />
        {!readOnly && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث باسم الطالب…' : 'Search student name…'}
                aria-label={lang === 'ar' ? 'بحث باسم الطالب' : 'Search student name'}
                className="min-h-[44px] w-full rounded-lg border border-gray-300 py-2 pe-9 ps-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                  className="absolute end-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setUnmarkedOnly(v => !v)}
              aria-pressed={unmarkedOnly}
              className={`min-h-[44px] shrink-0 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${unmarkedOnly ? 'bg-gold-100 text-gold-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {lang === 'ar' ? `غير المسجل (${unmarkedCount})` : `Unmarked (${unmarkedCount})`}
            </button>
          </div>
        )}
      </div>
      {/* Mark-all row (hidden once finalized) — mirrors the legacy confirm pattern. */}
      {(showGroupChips || showGradeChips) && (
        <div className="space-y-2" aria-label={t('Filter by group and grade', 'تصفية حسب المجموعة والصف')}>
          {showGroupChips && (
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('Groups', 'المجموعات')}>
              <button type="button" aria-pressed={!groupFilter} onClick={() => { setGroupFilter(''); setGradeFilter('') }}
                className={`min-h-[40px] shrink-0 rounded-full px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${!groupFilter ? 'bg-gold-100 text-gold-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t('All groups', 'كل المجموعات')} ({counts.marked}/{counts.total})
              </button>
              {groupChips.map(g => (
                <button key={g.id} type="button" aria-pressed={groupFilter === g.id} onClick={() => { setGroupFilter(groupFilter === g.id ? '' : g.id); setGradeFilter('') }}
                  className={`min-h-[40px] shrink-0 rounded-full px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${groupFilter === g.id ? 'bg-gold-100 text-gold-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {g.name} ({g.marked}/{g.total})
                </button>
              ))}
            </div>
          )}
          {showGradeChips && (
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('Grades', 'الصفوف')}>
              <button type="button" aria-pressed={!gradeFilter} onClick={() => setGradeFilter('')}
                className={`min-h-[36px] shrink-0 rounded-full px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${!gradeFilter ? 'bg-gold-100 text-gold-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t('All grades', 'كل الصفوف')}
              </button>
              {gradeChips.map(g => (
                <button key={g.id} type="button" aria-pressed={gradeFilter === g.id} onClick={() => setGradeFilter(gradeFilter === g.id ? '' : g.id)}
                  className={`min-h-[36px] shrink-0 rounded-full px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${gradeFilter === g.id ? 'bg-gold-100 text-gold-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {g.name} ({g.marked}/{g.total})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-xs text-gray-500">{lang === 'ar' ? 'تحديد الكل:' : 'Mark all:'}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMarkAllTarget('present')} className="min-h-[44px] bg-green-100 text-green-700 hover:bg-green-200">{lang === 'ar' ? 'الكل حاضر' : 'All Present'}</Button>
          {!isBinary && <Button type="button" variant="ghost" size="sm" onClick={() => setMarkAllTarget('late')} className="min-h-[44px] bg-amber-100 text-amber-700 hover:bg-amber-200">{lang === 'ar' ? 'الكل متأخر' : 'All Late'}</Button>}
          <Button type="button" variant="ghost" size="sm" onClick={() => setMarkAllTarget('absent')} className="min-h-[44px] bg-red-100 text-red-700 hover:bg-red-200">{lang === 'ar' ? 'الكل غائب' : 'All Absent'}</Button>
        </div>
      )}
      {isFiltering && (
        <p className="text-xs text-gray-500" aria-live="polite">
          {lang === 'ar'
            ? `عرض ${visibleRecs.length} من ${recs.length}`
            : `Showing ${visibleRecs.length} of ${recs.length}`}
        </p>
      )}
      {visibleRecs.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {lang === 'ar' ? 'لا يوجد طلاب مطابقون للبحث' : 'No students match the search'}
        </p>
      )}
      {(() => {
        const readonlyStatuses = isBinary ? READONLY_STATUSES.filter(x => x.key === 'present' || x.key === 'absent') : READONLY_STATUSES
        const renderRecord = (r: any) => {
          const studentName = `${r.student?.firstName} ${r.student?.lastName}`
          const current = marking.marks[r.student?.id] || 'unmarked'
          return (
            <div
              key={r.student?.id}
              data-student-id={r.student?.id}
              tabIndex={0}
              onKeyDown={(e) => handleRecordKeyDown(e, r)}
              className="rounded-xl border border-gray-200 bg-white p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <div className="mb-1.5 truncate text-[15px] font-medium">{r.student?.firstName} {r.student?.lastName}</div>
              {readOnly ? (
                <div role="group" aria-label={lang === 'ar' ? `الحالة - ${studentName} (نهائية)` : `Status - ${studentName} (finalized)`} className="grid grid-cols-2 gap-2">
                  {readonlyStatuses.map(({ key, en, ar, Icon, active }) => {
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
                <StatusSegment compact value={current} onChange={(s) => marking.setStatus(r.student.id, s)} lang={lang} studentName={studentName}
                  statuses={isBinary ? ['present', 'absent'] : undefined} />
              )}
              {isBinary ? null : readOnly ? (
                <div className="mt-2 text-xs text-gray-500">
                  {lang === 'ar'
                    ? `السلوك: ${marking.behavior[r.student?.id] || 0}/5 · المشاركة: ${marking.participation[r.student?.id] || 0}/5${marking.notes[r.student?.id] ? ` · ${marking.notes[r.student?.id]}` : ''}`
                    : `Behavior: ${marking.behavior[r.student?.id] || 0}/5 · Participation: ${marking.participation[r.student?.id] || 0}/5${marking.notes[r.student?.id] ? ` · ${marking.notes[r.student?.id]}` : ''}`}
                </div>
              ) : (
                <DetailExpander
                  behavior={marking.behavior[r.student?.id] || 0}
                  participation={marking.participation[r.student?.id] || 0}
                  note={marking.notes[r.student?.id] || ''}
                  onBehaviorChange={(v) => marking.setBehavior(r.student.id, v)}
                  onParticipationChange={(v) => marking.setParticipation(r.student.id, v)}
                  onNoteChange={(v) => marking.setNote(r.student.id, v)}
                  lang={lang}
                  studentName={studentName}
                />
              )}
            </div>
          )
        }

        // Multi-group sessions are shown in collapsible sections, one per group.
        const sections: Array<{ id: string; name: string; recs: any[] }> = []
        if (showSections) {
          for (const r of visibleRecs) {
            const g = groupOf(r)
            const last = sections[sections.length - 1]
            if (last && last.id === g.id) last.recs.push(r)
            else sections.push({ id: g.id, name: g.name, recs: [r] })
          }
        } else {
          sections.push({ id: '', name: '', recs: visibleRecs })
        }
        return sections.map(sec => {
          const stat = groupStats.get(sec.id)
          const collapsed = showSections && !!collapsedGroups[sec.id]
          return (
            <div key={sec.id || 'all'} className="space-y-4">
              {showSections && (
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsedGroups(c => ({ ...c, [sec.id]: !c[sec.id] }))}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-gray-100 px-3 text-sm font-semibold text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                >
                  <span>{sec.name || t('Other', 'أخرى')}</span>
                  <span className="text-xs font-medium text-gray-500">{stat ? `${stat.marked}/${stat.total}` : sec.recs.length} {collapsed ? '▸' : '▾'}</span>
                </button>
              )}
              {!collapsed && sec.recs.map(renderRecord)}
            </div>
          )
        })
      })()}
      {!readOnly && !isBinary && (
        <p className="hidden text-xs text-gray-500 lg:block">{lang === 'ar' ? 'P/L/A/E للحالة · 1-5 للسلوك · ↑↓ للتنقل · Ctrl+S للحفظ' : 'P/L/A/E status · 1-5 behavior · ↑↓ move · Ctrl+S save'}</p>
      )}
      {notYet || isCancelled ? null : isCompleted ? (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-gray-100 bg-white p-3 lg:bottom-0">
          <Button onClick={() => { void reopen() }} disabled={reopening} className="min-h-[44px] w-full bg-amber-500 text-white hover:bg-amber-600">
            {lang === 'ar' ? 'إعادة فتح الحضور' : 'Re-open Attendance'}
          </Button>
        </div>
      ) : (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-gray-100 bg-white p-3 lg:bottom-0">
          {marking.dirty && <p className="text-center text-xs text-amber-600 mb-1">{saving ? (lang === 'ar' ? 'جاري الحفظ التلقائي...' : 'Auto-saving...') : (lang === 'ar' ? 'سيتم الحفظ تلقائياً' : 'Auto-save in a moment...')}</p>}
          <div className="flex gap-2">
            <Button onClick={() => save(false)} disabled={saving} className="min-h-[44px] flex-1">{lang === 'ar' ? 'حفظ' : 'Save'}</Button>
            <Button onClick={() => save(true)} disabled={saving} variant="outline" className="min-h-[44px] flex-1">{lang === 'ar' ? 'حفظ وإنهاء' : 'Save & Finalize'}</Button>
          </div>
        </div>
      )}
      {/* Mark-all confirm — same dialog pattern as Sessions delete confirms. */}
      {markAllTarget && !readOnly && (
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
      {/* Group / level / grade / gender picker — group required, rest optional */}
      {groupPickerOpen && (() => {
        const groupGrades = availableGrades.filter(g => g.groupId === pickedGroupId)
        const hasLevels = availableLevels.length > 0
        const hasGrades = groupGrades.length > 0
        const closePicker = () => { setGroupPickerOpen(false); setPickedGroupId(null); setPickedLevelId(null); setPickedGradeId(null); setPickerStep('group'); }
        const finishPicker2 = (gid: string, lid?: string, grid?: string, gen?: string) => { closePicker(); void startClassManually(gid, lid, grid, gen); }
        const afterGroup = (gid: string) => {
          setPickedGroupId(gid)
          if (hasLevels) { setPickerStep('level'); return }
          const gGrades = availableGrades.filter(g => g.groupId === gid)
          if (gGrades.length > 0) { setPickerStep('grade'); return }
          setPickerStep('gender')
        }
        const afterLevel = (lid?: string) => {
          setPickedLevelId(lid || null)
          const gGrades = availableGrades.filter(g => g.groupId === pickedGroupId)
          if (gGrades.length > 0) { setPickerStep('grade'); return }
          setPickerStep('gender')
        }
        const afterGrade = (grid?: string) => {
          setPickedGradeId(grid || null)
          setPickerStep('gender')
        }
        const totalSteps = 1 + (hasLevels ? 1 : 0) + (hasGrades ? 1 : 0) + 1
        const currentStep = pickerStep === 'group' ? 1 : pickerStep === 'level' ? 2 : pickerStep === 'grade' ? (hasLevels ? 3 : 2) : totalSteps
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closePicker}>
          <div role="dialog" aria-modal="true" aria-labelledby="group-picker-title" className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            {pickerStep === 'group' && (
              <>
                <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                  {lang === 'ar' ? 'اختر المجموعة' : 'Select a Group'}
                </h3>
                <p className="mb-4 text-sm text-gray-500">
                  {lang === 'ar' ? `الخطوة ${currentStep} من ${totalSteps}` : `Step ${currentStep} of ${totalSteps}`}
                </p>
                <div className="mb-4 space-y-2 max-h-96 overflow-y-auto">
                  {availableGroups.map(group => (
                    <button key={group.id} type="button" onClick={() => afterGroup(group.id)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                      {group.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            {pickerStep === 'level' && (
              <>
                <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                  {lang === 'ar' ? 'اختر المرحلة (اختياري)' : 'Select a Level (Optional)'}
                </h3>
                <p className="mb-4 text-sm text-gray-500">
                  {lang === 'ar' ? `الخطوة ${currentStep} من ${totalSteps}` : `Step ${currentStep} of ${totalSteps}`}
                  {' · '}{availableGroups.find(g => g.id === pickedGroupId)?.name}
                </p>
                <div className="mb-4 space-y-2 max-h-96 overflow-y-auto">
                  <button type="button" onClick={() => afterLevel(undefined)}
                    className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-start font-medium text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                    {lang === 'ar' ? 'تخطي — جميع المراحل' : 'Skip — All Levels'}
                  </button>
                  {availableLevels.map(level => (
                    <button key={level.id} type="button" onClick={() => afterLevel(level.id)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                      {level.name}
                    </button>
                  ))}
                </div>
                <Button variant="outline" onClick={() => { setPickerStep('group'); setPickedGroupId(null); }} className="min-h-[44px] w-full mb-2">
                  {lang === 'ar' ? 'رجوع' : 'Back'}
                </Button>
              </>
            )}
            {pickerStep === 'grade' && (
              <>
                <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                  {lang === 'ar' ? 'اختر الصف (اختياري)' : 'Select a Grade (Optional)'}
                </h3>
                <p className="mb-4 text-sm text-gray-500">
                  {lang === 'ar' ? `الخطوة ${currentStep} من ${totalSteps}` : `Step ${currentStep} of ${totalSteps}`}
                  {' · '}{availableGroups.find(g => g.id === pickedGroupId)?.name}
                  {pickedLevelId && <> · {availableLevels.find(l => l.id === pickedLevelId)?.name}</>}
                </p>
                <div className="mb-4 space-y-2 max-h-96 overflow-y-auto">
                  <button type="button" onClick={() => afterGrade(undefined)}
                    className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-start font-medium text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                    {lang === 'ar' ? 'تخطي — جميع الصفوف' : 'Skip — All Grades'}
                  </button>
                  {groupGrades.map(grade => (
                    <button key={grade.id} type="button" onClick={() => afterGrade(grade.id)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                      {grade.name}
                    </button>
                  ))}
                </div>
                <Button variant="outline" onClick={() => { setPickerStep(hasLevels ? 'level' : 'group'); if (!hasLevels) setPickedGroupId(null); }} className="min-h-[44px] w-full mb-2">
                  {lang === 'ar' ? 'رجوع' : 'Back'}
                </Button>
              </>
            )}
            {pickerStep === 'gender' && (
              <>
                <h3 id="group-picker-title" className="mb-1 font-semibold text-gray-900">
                  {lang === 'ar' ? 'اختر الجنس (اختياري)' : 'Select Gender (Optional)'}
                </h3>
                <p className="mb-4 text-sm text-gray-500">
                  {lang === 'ar' ? `الخطوة ${currentStep} من ${totalSteps}` : `Step ${currentStep} of ${totalSteps}`}
                  {' · '}{availableGroups.find(g => g.id === pickedGroupId)?.name}
                  {pickedLevelId && <> · {availableLevels.find(l => l.id === pickedLevelId)?.name}</>}
                  {pickedGradeId && <> · {availableGrades.find(g => g.id === pickedGradeId)?.name}</>}
                </p>
                <div className="mb-4 space-y-2">
                  <button type="button" onClick={() => finishPicker2(pickedGroupId!, pickedLevelId || undefined, pickedGradeId || undefined, 'male')}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                    {lang === 'ar' ? 'ذكور' : 'Male'}
                  </button>
                  <button type="button" onClick={() => finishPicker2(pickedGroupId!, pickedLevelId || undefined, pickedGradeId || undefined, 'female')}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-start font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                    {lang === 'ar' ? 'إناث' : 'Female'}
                  </button>
                </div>
                <button type="button" onClick={() => finishPicker2(pickedGroupId!, pickedLevelId || undefined, pickedGradeId || undefined)}
                  className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-center font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 mb-2">
                  {lang === 'ar' ? 'تخطّي — الكل (تلقائي)' : 'Skip — All (auto)'}
                </button>
                <Button variant="outline" onClick={() => {
                  const gGrades = availableGrades.filter(g => g.groupId === pickedGroupId)
                  if (gGrades.length > 0) { setPickedGradeId(null); setPickerStep('grade') }
                  else if (hasLevels) setPickerStep('level')
                  else setPickerStep('group')
                }} className="min-h-[44px] w-full mb-2">
                  {lang === 'ar' ? 'رجوع' : 'Back'}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={closePicker} className="min-h-[44px] w-full">
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

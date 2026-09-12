'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/use-language'
import {
  Calendar, Plus, Search, Loader2,
  X, Trash2, RotateCcw, QrCode, Pencil,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { FormField } from '@/components/ui/form-field'
import { QrScanner } from '@/components/qr/qr-scanner'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { track } from '@/lib/analytics'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Session {
  id: string; scheduledDate: string; scheduledTime?: string; status: string; notes?: string;
  level: { id: string; name: string; number: number };
  group: { id: string; name: string };
  servant: { id: string; firstName: string; lastName: string };
  summary?: { present: number; absent: number; late: number; excused: number; total: number };
}
interface Level { id: string; name: string; number: number; status?: string }
interface Group { id: string; name: string; levelId?: string; status?: string }
interface StudentHit {
  student: { id: string; studentCode: string; firstName: string; lastName: string; firstNameAr?: string | null; lastNameAr?: string | null };
  records: { status: string; recordedAt: string; attendanceSession?: { id: string; scheduledDate: string; status: string } }[];
}

interface SessionForm {
  levelId: string; groupId: string; servantId: string;
  scheduledDate: string; scheduledTime: string; status: string; notes: string;
}
type SessionFormErrors = Partial<Record<'levelId' | 'groupId' | 'scheduledDate', string>>

const EMPTY_FORM: SessionForm = {
  levelId: '', groupId: '', servantId: '', scheduledDate: '', scheduledTime: '12:00', status: 'scheduled', notes: '',
}

function validateSessionForm(form: SessionForm, lang: 'en' | 'ar'): SessionFormErrors {
  const errors: SessionFormErrors = {}
  if (!form.levelId) errors.levelId = lang === 'ar' ? 'المستوى مطلوب' : 'Level is required'
  if (!form.groupId) errors.groupId = lang === 'ar' ? 'المجموعة مطلوبة' : 'Group is required'
  if (!form.scheduledDate) errors.scheduledDate = lang === 'ar' ? 'التاريخ مطلوب' : 'Date is required'
  return errors
}

function SessionFormModal({
  title, submitLabel, initial, levels, groups, saving, lang, onClose, onSubmit,
}: {
  title: string; submitLabel: string; initial: SessionForm;
  levels: Level[]; groups: Group[]; saving: boolean; lang: 'en' | 'ar';
  onClose: () => void; onSubmit: (form: SessionForm) => void;
}) {
  const [form, setForm] = useState<SessionForm>(initial)
  const [errors, setErrors] = useState<SessionFormErrors>({})
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(el => !el.hasAttribute('disabled'))
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = () => {
    const validation = validateSessionForm(form, lang)
    setErrors(validation)
    if (Object.keys(validation).length > 0) {
      const firstError = validation.levelId ? firstFieldRef.current
        : dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      firstError?.focus()
      return
    }
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-form-title"
        onKeyDown={handleKeyDown}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 id="session-form-title" className="font-semibold text-gray-900">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={lang === 'ar' ? 'إغلاق' : 'Close dialog'} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              as="select"
              label={lang === 'ar' ? 'المستوى *' : 'Level *'}
              required
              value={form.levelId}
              onChange={e => setForm({ ...form, levelId: e.target.value, groupId: '' })}
              error={errors.levelId}
              inputRef={firstFieldRef as React.Ref<HTMLSelectElement>}
            >
              <option value="">{lang === 'ar' ? 'اختر المستوى...' : 'Select level...'}</option>
              {levels.map(l => <option key={l.id} value={l.id}>{lang === 'ar' ? `المستوى ${l.number}` : `Level ${l.number}`}</option>)}
            </FormField>
            <FormField
              as="select"
              label={lang === 'ar' ? 'المجموعة *' : 'Group *'}
              required
              value={form.groupId}
              onChange={e => setForm({ ...form, groupId: e.target.value })}
              error={errors.groupId}
            >
              <option value="">{lang === 'ar' ? 'اختر المجموعة...' : 'Select group...'}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="session-form-date" className="block text-sm font-medium text-gray-700">
                {lang === 'ar' ? 'التاريخ *' : 'Date *'}
              </label>
              <DatePicker
                id="session-form-date"
                value={form.scheduledDate}
                onChange={v => setForm({ ...form, scheduledDate: v })}
                error={errors.scheduledDate}
                className="mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-base sm:text-sm bg-white"
              />
            </div>
            <FormField
              label={lang === 'ar' ? 'الوقت' : 'Time'}
              type="time"
              value={form.scheduledTime}
              onChange={e => setForm({ ...form, scheduledTime: e.target.value })}
            />
          </div>
          <FormField
            as="select"
            label={lang === 'ar' ? 'الحالة' : 'Status'}
            value={form.status}
            onChange={e => setForm({ ...form, status: e.target.value })}
          >
            <option value="scheduled">{lang === 'ar' ? 'مجدول' : 'Scheduled'}</option>
            <option value="in_progress">{lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</option>
            <option value="completed">{lang === 'ar' ? 'مكتمل' : 'Completed'}</option>
            <option value="cancelled">{lang === 'ar' ? 'ملغي' : 'Cancelled'}</option>
            <option value="postponed">{lang === 'ar' ? 'مؤجل' : 'Postponed'}</option>
          </FormField>
          {form.status === 'completed' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700" role="note">
              {lang === 'ar'
                ? 'الحفظ والإنهاء يقفل الجلسة — أعد فتحها للتعديل'
                : 'Save & Finalize locks the session — Re-open to edit'}
            </p>
          )}
          <FormField
            as="textarea"
            label={lang === 'ar' ? 'ملاحظات' : 'Notes'}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="min-h-[80px]"
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function SessionsPage() {
  const { toast } = useToast()
  const lang = useLanguage()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [filterLevel, setFilterLevel] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [studentResults, setStudentResults] = useState<StudentHit[]>([])
  const [studentSearching, setStudentSearching] = useState(false)
  const [studentSearched, setStudentSearched] = useState(false)
  const studentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [levels, setLevels] = useState<Level[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateMode, setGenerateMode] = useState<'all' | 'specific'>('all')
  const [generateGroupId, setGenerateGroupId] = useState('')
  const [generateLevelId, setGenerateLevelId] = useState('')
  const [generateGradeId, setGenerateGradeId] = useState('')
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)

  const schoolId = getSchoolId()

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const params: Record<string, string> = { schoolId, limit: '500' }
    if (filterLevel) params.levelId = filterLevel
    if (filterGroup) params.groupId = filterGroup
    if (filterStatus) params.status = filterStatus
    if (filterDateFrom) params.from = filterDateFrom
    if (filterDateTo) params.to = filterDateTo
    try {
      const data = await http.get<{ data: Session[] }>('/attendance/sessions', params)
      setSessions(data.data || [])
    } catch (e: any) {
      setLoadError(e?.message || (lang === 'ar' ? 'فشل تحميل الجلسات' : 'Failed to load sessions'))
      toast('error', lang === 'ar' ? 'فشل تحميل الجلسات' : 'Failed to load sessions', e?.message || '')
    }
    setLoading(false)
  }, [filterLevel, filterGroup, filterStatus, filterDateFrom, filterDateTo, schoolId, toast, lang])

  const fetchLevelsGroups = useCallback(async () => {
    try {
      const [allLevels, allGroups] = await Promise.all([
        http.get<Level[]>('/curriculum/levels', { schoolId }),
        http.get<Group[]>('/students/groups/all', { schoolId }),
      ])
      setLevels(allLevels.filter(l => l.status !== 'inactive'))
      setGroups((allGroups || []).filter(g => g.status !== 'inactive'))
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل تحميل المستويات والمجموعات' : 'Failed to load levels and groups', e?.message || '')
    }
  }, [schoolId, toast, lang])

  useEffect(() => { fetchLevelsGroups() }, [fetchLevelsGroups])
  useEffect(() => { fetchSessions() }, [fetchSessions])

  const handleQrCheckIn = async (studentId: string) => {
    try {
      const result = await http.post<{ record: any; message: string }>('/attendance/qr-checkin', { studentId })
      toast('success', result.message || (lang === 'ar' ? 'تم تسجيل الحضور' : 'Checked in'))
      return { success: true, message: result.message }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Check-in failed' }
    }
  }

  const handleCreateSession = async (form: SessionForm) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setSaving(true)
    try {
      await http.post('/attendance/sessions', {
        ...form, servantId: form.servantId || user.id || '00000000-0000-0000-0000-000000000000', schoolId,
      })
      setShowCreateModal(false)
      toast('success', lang === 'ar' ? 'تم إنشاء الجلسة' : 'Session created')
      fetchSessions()
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل إنشاء الجلسة' : 'Failed to create session', e?.message || '')
    }
    setSaving(false)
  }

  const runStudentSearch = useCallback(async (query: string) => {
    const q = query.trim()
    if (!q) { setStudentResults([]); setStudentSearched(false); setStudentSearching(false); return }
    setStudentSearching(true)
    try {
      const data = await http.get<StudentHit[] | { data: StudentHit[] }>('/attendance/student-search', { q, schoolId })
      const list = Array.isArray(data) ? data : data?.data ?? []
      setStudentResults(list)
      setStudentSearched(true)
    } catch {
      setStudentResults([])
      setStudentSearched(true)
    }
    setStudentSearching(false)
  }, [schoolId])

  useEffect(() => {
    if (studentTimer.current) clearTimeout(studentTimer.current)
    if (!studentQuery.trim()) {
      setStudentResults([])
      setStudentSearched(false)
      setStudentSearching(false)
      return
    }
    setStudentSearching(true)
    studentTimer.current = setTimeout(() => { void runStudentSearch(studentQuery) }, 300)
    return () => { if (studentTimer.current) clearTimeout(studentTimer.current) }
  }, [studentQuery, runStudentSearch])

  useEffect(() => () => { if (studentTimer.current) clearTimeout(studentTimer.current) }, [])

  const openEditSession = (session: Session) => {
    setEditSession(session)
  }

  const handleEditSession = async (form: SessionForm) => {
    if (!editSession) return
    setSaving(true)
    try {
      await http.put(`/attendance/sessions/${editSession.id}`, form)
      setEditSession(null)
      toast('success', lang === 'ar' ? 'تم تحديث الجلسة' : 'Session updated')
      fetchSessions()
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل تحديث الجلسة' : 'Failed to update session', e?.message || '')
    }
    setSaving(false)
  }

  const handleDeleteSession = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await http.delete(`/attendance/sessions/${deleteTarget.id}`)
      setDeleteTarget(null)
      fetchSessions()
      toast('success', lang === 'ar' ? 'تم حذف الجلسة' : 'Session deleted')
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل حذف الجلسة' : 'Failed to delete session', e?.message || '')
    }
    setDeleting(false)
  }

  const handleGenerateSessions = async () => {
    setGenerating(true)
    try {
      const params: any = { schoolId }
      if (generateMode === 'specific') {
        if (generateGroupId) params.groupId = generateGroupId
        if (generateLevelId) params.levelId = generateLevelId
        if (generateGradeId) params.gradeId = generateGradeId
      }
      const result = await http.post<{ created: number; skipped: number }>('/attendance/sessions/generate', undefined, params)
      toast('success', lang === 'ar' ? `تم إنشاء ${result.created} جلسات (${result.skipped} موجودة مسبقًا)` : `Generated ${result.created} sessions (${result.skipped} already existed)`)
      fetchSessions()
    } catch { toast('error', lang === 'ar' ? 'فشل إنشاء الجلسات' : 'Failed to generate sessions') }
    setGenerating(false)
    setShowGenerateConfirm(false)
    setGenerateMode('all')
    setGenerateGroupId('')
    setGenerateLevelId('')
    setGenerateGradeId('')
  }

  const handleReopenSession = async (session: Session) => {
    try {
      await http.put(`/attendance/sessions/${session.id}`, { status: 'in_progress' })
      toast('success', lang === 'ar' ? 'تم إعادة فتح الجلسة' : 'Session reopened')
      fetchSessions()
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل إعادة فتح الجلسة' : 'Failed to reopen session', e?.message || '')
    }
  }

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const filteredSessions = sessions.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (s.level?.name || '').toLowerCase().includes(q) || (s.group?.name || '').toLowerCase().includes(q)
  })

  const toggleSelectAll = () => {
    const scheduledSessions = filteredSessions.filter(s => s.status === 'scheduled')
    if (selectedSessionIds.size === scheduledSessions.length && selectedSessionIds.size > 0) {
      setSelectedSessionIds(new Set())
    } else {
      setSelectedSessionIds(new Set(scheduledSessions.map(s => s.id)))
    }
  }

  const handleBatchDeleteSessions = async () => {
    if (selectedSessionIds.size === 0) return
    setBatchDeleting(true)
    try {
      await http.post('/attendance/sessions/batch-delete', { sessionIds: Array.from(selectedSessionIds) })
      setShowBatchDeleteConfirm(false)
      setSelectedSessionIds(new Set())
      fetchSessions()
      toast('success', lang === 'ar' ? `تم حذف ${selectedSessionIds.size} جلسات` : `Deleted ${selectedSessionIds.size} sessions`)
      track('attendance.batch_deleted', 'action', { count: selectedSessionIds.size })
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل حذف الجلسات' : 'Failed to delete sessions', e?.message || '')
    }
    setBatchDeleting(false)
  }

  const activeFilterCount = [filterLevel, filterGroup, filterStatus, filterDateFrom, filterDateTo, search].filter(Boolean).length
  const clearAllFilters = () => {
    setFilterLevel('')
    setFilterGroup('')
    setFilterStatus('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSearch('')
  }

  const editInitial: SessionForm | null = editSession ? {
    levelId: editSession.level.id,
    groupId: editSession.group.id,
    servantId: editSession.servant?.id || '',
    scheduledDate: editSession.scheduledDate.split('T')[0],
    scheduledTime: editSession.scheduledTime || '12:00',
    status: editSession.status,
    notes: editSession.notes || '',
  } : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'إدارة الجلسات' : 'Manage sessions'}</h1>
          <p className="text-sm text-gray-500">
            <Link href="/dashboard/attendance/mark" className="text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded">
              {lang === 'ar' ? 'تسجيل الحضور' : 'Mark attendance'}
            </Link>
            {' · '}
            <Link href="/dashboard/attendance/insights" className="text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded">
              {lang === 'ar' ? 'الإحصائيات' : 'Insights'}
            </Link>
            {' · '}
            {lang === 'ar' ? 'إنشاء الجلسات وتعديلها وحذفها' : 'Create, edit, and delete sessions'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowQrScanner(v => !v)}>
            <QrCode className="h-3.5 w-3.5" />{lang === 'ar' ? 'مسح QR' : 'QR Scan'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowGenerateConfirm(true)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">
            <Calendar className="h-3.5 w-3.5" />{lang === 'ar' ? 'إنشاء' : 'Generate'}
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-3.5 w-3.5" />{lang === 'ar' ? 'جلسة جديدة' : 'New Session'}
          </Button>
        </div>
      </div>

      {showQrScanner && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-3">
          <QrScanner onCheckIn={handleQrCheckIn} onClose={() => setShowQrScanner(false)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={studentQuery}
            onChange={e => setStudentQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث عن طالب بالاسم أو الكود…' : 'Find a student by name or code…'}
            aria-label={lang === 'ar' ? 'بحث عن طالب' : 'Find a student'}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 py-2 pe-3 ps-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          />
        </div>
        {studentSearching && (
          <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {lang === 'ar' ? 'جاري البحث…' : 'Searching…'}
          </p>
        )}
        {!studentSearching && studentSearched && studentResults.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">{lang === 'ar' ? 'لا يوجد طلاب مطابقون' : 'No matching students'}</p>
        )}
        {!studentSearching && studentResults.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-100" aria-live="polite">
            {studentResults.map(hit => {
              const latest = hit.records?.[0]
              const sess = latest?.attendanceSession
              const name = `${hit.student.firstName} ${hit.student.lastName}`
              return (
                <li key={hit.student.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500">
                      {hit.student.studentCode}
                      {sess?.scheduledDate && (
                        <> · {new Date(sess.scheduledDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} · {sess.status}</>
                      )}
                    </div>
                  </div>
                  {sess?.id && (
                    <Link
                      href={`/dashboard/attendance/mark?sessionId=${sess.id}`}
                      className="inline-flex min-h-[44px] items-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                    >
                      {lang === 'ar' ? 'تسجيل' : 'Mark'}
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/students?studentId=${hit.student.id}`}
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    {lang === 'ar' ? 'الملف' : 'File'}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white transition-all">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الجلسات' : 'Sessions'} ({filteredSessions.length})</h2>
        </div>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setFilterGroup('') }}
            aria-label={lang === 'ar' ? 'تصفية حسب المستوى' : 'Filter by level'}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none">
            <option value="">{lang === 'ar' ? 'جميع المستويات' : 'All Levels'}</option>
            {levels.map(l => <option key={l.id} value={l.id}>{lang === 'ar' ? `المستوى ${l.number}` : `Level ${l.number}`}</option>)}
          </select>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
            aria-label={lang === 'ar' ? 'تصفية حسب المجموعة' : 'Filter by group'}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none">
            <option value="">{lang === 'ar' ? 'جميع المجموعات' : 'All Groups'}</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            aria-label={lang === 'ar' ? 'تصفية حسب الحالة' : 'Filter by status'}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none">
            <option value="">{lang === 'ar' ? 'جميع الحالات' : 'All Status'}</option>
            <option value="scheduled">{lang === 'ar' ? 'مجدول' : 'Scheduled'}</option>
            <option value="in_progress">{lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</option>
            <option value="completed">{lang === 'ar' ? 'مكتمل' : 'Completed'}</option>
            <option value="cancelled">{lang === 'ar' ? 'ملغي' : 'Cancelled'}</option>
            <option value="postponed">{lang === 'ar' ? 'مؤجل' : 'Postponed'}</option>
          </select>
          <DatePicker value={filterDateFrom} onChange={setFilterDateFrom}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none" />
          <span className="text-xs text-gray-500">{lang === 'ar' ? 'إلى' : 'to'}</span>
          <DatePicker value={filterDateTo} onChange={setFilterDateTo}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none" />
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
              aria-label={lang === 'ar' ? 'بحث في الجلسات' : 'Search sessions'}
              className="w-full rounded-lg border border-gray-300 ps-8 pe-2 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none" />
          </div>
          {activeFilterCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-2 py-1.5 text-xs font-medium text-blue-700">
              <span>{lang === 'ar' ? `${activeFilterCount} نشط` : `${activeFilterCount} active`}</span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded px-1 font-semibold underline hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                {lang === 'ar' ? 'مسح الكل' : 'Clear All'}
              </button>
            </div>
          )}
        </div>
        {/* Session list header with select-all */}
        <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100">
          <input type="checkbox"
            checked={selectedSessionIds.size > 0 && selectedSessionIds.size === filteredSessions.filter(s => s.status === 'scheduled').length}
            onChange={toggleSelectAll}
            disabled={filteredSessions.filter(s => s.status === 'scheduled').length === 0}
            aria-label={lang === 'ar' ? 'تحديد الكل' : 'Select all'}
            className="h-5 w-5 rounded border-gray-300 text-gold-700 focus:ring-gold-500 cursor-pointer" />
          <span className="text-xs text-gray-600 font-medium">
            {selectedSessionIds.size > 0
              ? (lang === 'ar' ? `${selectedSessionIds.size} محدد` : `${selectedSessionIds.size} selected`)
              : (lang === 'ar' ? 'حدد للحذف' : 'Select to delete')}
          </span>
          {selectedSessionIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBatchDeleteConfirm(true)} disabled={batchDeleting}
              className="ms-auto">
              <Trash2 className="h-3.5 w-3.5" />
              {batchDeleting ? (lang === 'ar' ? '...جاري' : 'Deleting...') : (lang === 'ar' ? `حذف ${selectedSessionIds.size}` : `Delete ${selectedSessionIds.size}`)}
            </Button>
          )}
        </div>

        {loading && sessions.length === 0 && !loadError ? (
          <div className="px-4 py-6"><TableSkeleton rows={6} cols={4} /></div>
        ) : loadError && sessions.length === 0 ? (
          <EmptyState
            title={lang === 'ar' ? 'فشل تحميل الجلسات' : 'Failed to load sessions'}
            description={loadError}
            action={<Button onClick={() => { void fetchSessions() }} className="min-h-[44px]">{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>}
          />
        ) : (
          <>
            {loadError && (
              <div className="flex items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">
                <span>{loadError}</span>
                <Button variant="outline" size="sm" onClick={() => { void fetchSessions() }} className="min-h-[44px]">
                  {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                </Button>
              </div>
            )}
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {filteredSessions.map(s => {
                const isScheduled = s.status === 'scheduled'
                const isSelected = selectedSessionIds.has(s.id)
                return (
                  <div key={s.id} className="flex items-center px-5 py-3 hover:bg-gray-50 active:bg-gray-100">
                    {isScheduled && (
                      <input type="checkbox"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); toggleSessionSelection(s.id) }}
                        aria-label={lang === 'ar' ? `تحديد ${s.group?.name}` : `Select ${s.group?.name}`}
                        className="h-5 w-5 rounded border-gray-300 text-gold-700 focus:ring-gold-500 cursor-pointer me-3" />
                    )}
                    <button onClick={() => openEditSession(s)}
                      aria-label={lang === 'ar' ? `تعديل جلسة ${s.group?.name || s.id}` : `Edit session ${s.group?.name || s.id}`}
                      className="flex-1 flex items-center gap-3 text-start transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        s.status === 'completed' ? 'bg-green-100 text-green-600' : s.status === 'scheduled' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">L{s.level?.number || '?'} &middot; {s.group?.name || '?'}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{new Date(s.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          {s.scheduledTime && <span>&bull; {s.scheduledTime}</span>}
                          {s.summary && s.summary.total > 0 && (
                            <span>&bull; {s.summary.present + s.summary.late}/{s.summary.total} ({Math.round(((s.summary.present + s.summary.late) / s.summary.total) * 100)}%)</span>
                          )}
                        </div>
                      </div>
                      <Badge variant={s.status === 'completed' ? 'success' : s.status === 'scheduled' ? 'info' : s.status === 'cancelled' ? 'danger' : s.status === 'postponed' ? 'outline' : 'warning'} size="sm">
                        {s.status === 'completed' ? (lang === 'ar' ? 'مكتمل' : 'Completed') : s.status === 'scheduled' ? (lang === 'ar' ? 'مجدول' : 'Scheduled') : s.status === 'in_progress' ? (lang === 'ar' ? 'قيد التنفيذ' : 'In Progress') : s.status === 'cancelled' ? (lang === 'ar' ? 'ملغي' : 'Cancelled') : s.status === 'postponed' ? (lang === 'ar' ? 'مؤجل' : 'Postponed') : s.status}
                      </Badge>
                    </button>
                    <div className="flex items-center gap-1 ms-2">
                      {s.status === 'completed' && (
                        <Button variant="ghost" size="sm" onClick={() => handleReopenSession(s)}
                          aria-label={lang === 'ar' ? `إعادة فتح جلسة ${s.group?.name}` : `Re-open session ${s.group?.name}`}
                          className="text-amber-600 hover:text-amber-700">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEditSession(s)}
                        aria-label={lang === 'ar' ? `تعديل جلسة ${s.group?.name}` : `Edit session ${s.group?.name}`}
                        className="text-gray-500 hover:text-gray-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)}
                        aria-label={lang === 'ar' ? `حذف جلسة ${s.group?.name}` : `Delete session ${s.group?.name}`}
                        className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {filteredSessions.length === 0 && (
                <div className="py-12 text-center text-gray-500"><Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>{lang === 'ar' ? 'لم يتم العثور على جلسات' : 'No sessions found'}</p></div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <SessionFormModal
          title={lang === 'ar' ? 'جلسة حضور جديدة' : 'New Attendance Session'}
          submitLabel={lang === 'ar' ? 'إنشاء جلسة' : 'Create Session'}
          initial={EMPTY_FORM}
          levels={levels}
          groups={groups}
          saving={saving}
          lang={lang}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSession}
        />
      )}

      {/* Edit Modal */}
      {editSession && editInitial && (
        <SessionFormModal
          title={lang === 'ar' ? 'تعديل الجلسة' : 'Edit Session'}
          submitLabel={lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
          initial={editInitial}
          levels={levels}
          groups={groups}
          saving={saving}
          lang={lang}
          onClose={() => setEditSession(null)}
          onSubmit={handleEditSession}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-session-title" className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 id="delete-session-title" className="font-semibold text-gray-900 mb-2">{lang === 'ar' ? 'حذف الجلسة' : 'Delete Session'}</h3>
            <p className="text-sm text-gray-500 mb-6">{lang === 'ar' ? 'هل أنت متأكد من حذف هذه الجلسة؟ سيتم أيضًا إزالة سجلات الحضور.' : 'Are you sure you want to delete this session? Attendance records will also be removed.'}</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="destructive" onClick={handleDeleteSession} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {lang === 'ar' ? 'حذف' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation */}
      {showBatchDeleteConfirm && selectedSessionIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowBatchDeleteConfirm(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="batch-delete-title" className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 id="batch-delete-title" className="font-semibold text-gray-900 mb-2">{lang === 'ar' ? 'حذف جلسات متعددة' : 'Delete Multiple Sessions'}</h3>
            <p className="text-sm text-gray-500 mb-2">{lang === 'ar' ? `هل أنت متأكد من حذف ${selectedSessionIds.size} جلسات؟` : `Are you sure you want to delete ${selectedSessionIds.size} sessions?`}</p>
            <p className="text-xs text-gray-400 mb-6">{lang === 'ar' ? 'يتم حذف الجلسات غير المبلغ عنها فقط' : 'Only unscheduled/unReported sessions can be deleted'}</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setShowBatchDeleteConfirm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button variant="destructive" onClick={handleBatchDeleteSessions} disabled={batchDeleting}>
                {batchDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {lang === 'ar' ? `حذف ${selectedSessionIds.size}` : `Delete ${selectedSessionIds.size}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Sessions */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{lang === 'ar' ? 'إنشاء الجلسات' : 'Generate Sessions'}</h2>

            <div className="mb-6 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <input
                  type="radio"
                  name="generateMode"
                  value="all"
                  checked={generateMode === 'all'}
                  onChange={() => {
                    setGenerateMode('all')
                    setGenerateGroupId('')
                    setGenerateLevelId('')
                    setGenerateGradeId('')
                  }}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{lang === 'ar' ? 'إنشاء الكل' : 'Generate All'}</div>
                  <div className="text-sm text-gray-600">{lang === 'ar' ? 'إنشاء جلسات لجميع المستويات والمجموعات' : 'Create sessions for all levels and groups'}</div>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <input
                  type="radio"
                  name="generateMode"
                  value="specific"
                  checked={generateMode === 'specific'}
                  onChange={() => setGenerateMode('specific')}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{lang === 'ar' ? 'إنشاء محدد' : 'Generate Specific'}</div>
                  <div className="text-sm text-gray-600">{lang === 'ar' ? 'إنشاء جلسات لمجموعة أو مستوى معين' : 'Create sessions for specific group or level'}</div>
                </div>
              </label>
            </div>

            {generateMode === 'specific' && (
              <div className="mb-6 space-y-3 rounded-lg bg-gray-50 p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'المجموعة (اختياري)' : 'Group (Optional)'}</label>
                  <select
                    value={generateGroupId}
                    onChange={(e) => setGenerateGroupId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">{lang === 'ar' ? 'اختر مجموعة' : 'Select group'}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'المستوى (اختياري)' : 'Level (Optional)'}</label>
                  <select
                    value={generateLevelId}
                    onChange={(e) => setGenerateLevelId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">{lang === 'ar' ? 'اختر مستوى' : 'Select level'}</option>
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{lang === 'ar' ? 'الصف (اختياري)' : 'Grade (Optional)'}</label>
                  <input
                    type="text"
                    value={generateGradeId}
                    onChange={(e) => setGenerateGradeId(e.target.value)}
                    placeholder={lang === 'ar' ? 'معرّف الصف' : 'Grade ID'}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowGenerateConfirm(false)
                  setGenerateMode('all')
                  setGenerateGroupId('')
                  setGenerateLevelId('')
                  setGenerateGradeId('')
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                disabled={generating}
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleGenerateSessions}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                disabled={generating}
              >
                {generating ? <Loader2 className="inline h-4 w-4 animate-spin" /> : (lang === 'ar' ? 'إنشاء' : 'Generate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

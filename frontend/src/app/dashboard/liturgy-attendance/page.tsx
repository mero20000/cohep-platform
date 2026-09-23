'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Church, Check, X, AlertCircle, Save, Search, ChevronRight, Trash2, History, Loader2, Calendar } from 'lucide-react'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { Badge } from '@/components/ui/badge'
import { photoSrc } from '@/app/dashboard/students/_components/student-types'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { useToast } from '@/components/ui/toast'
import { TableSkeleton } from '@/components/ui/skeleton'

interface LiturgyStudent {
  studentId: string
  firstName: string
  lastName: string
  firstNameAr?: string
  lastNameAr?: string
  photoUrl?: string
  gradeName?: string
  gradeNameAr?: string
  status: 'present' | 'absent' | null
}

interface LiturgySession {
  date: string
  students: LiturgyStudent[]
  requiresGroupPick?: boolean
  groups?: Array<{ id: string; name: string }>
  levels?: Array<{ id: string; name: string; number?: number }>
}

export default function LiturgyAttendancePage() {
  const lang = useLanguage()
  const t = useMemo(() => (en: string, ar: string) => lang === 'ar' ? ar : en, [lang])
  const { toast } = useToast()
  const [session, setSession] = useState<LiturgySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'unrecorded'>('all')
  const mountedRef = useRef(true)

  const [groupPickerOpen, setGroupPickerOpen] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string }>>([])
  const [availableLevels, setAvailableLevels] = useState<Array<{ id: string; name: string; number?: number }>>([])
  const [pickedGroupId, setPickedGroupId] = useState<string | null>(null)
  const [pickedLevelId, setPickedLevelId] = useState<string | null>(null)
  const [pickerStep, setPickerStep] = useState<'group' | 'level'>('group')

  const schoolId = getSchoolId()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [liturgySessions, setLiturgySessions] = useState<Array<{
    id: string; scheduledDate: string; status: string;
    group: { id: string; name: string };
    level: { id: string; name: string; number: number } | null;
    summary?: { present: number; absent: number; total: number };
  }>>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [clearAllConfirm, setClearAllConfirm] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); setIsSuperAdmin(u.roles?.includes('super_admin') ?? false) } catch {}
  }, [])

  const fetchLiturgySessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const data = await http.get<{ data: any[] }>('/attendance/sessions', { schoolId, limit: '200', notes: 'liturgy' })
      setLiturgySessions(data.data || [])
    } catch { setLiturgySessions([]) }
    setLoadingSessions(false)
  }, [schoolId])

  const handleDeleteLiturgySession = async (sessionId: string) => {
    setDeletingSessionId(sessionId)
    try {
      await http.delete(`/attendance/sessions/${sessionId}`)
      toast('success', t('Session deleted', 'تم حذف الجلسة'))
      setLiturgySessions(prev => prev.filter(s => s.id !== sessionId))
    } catch {
      toast('error', t('Failed to delete session', 'فشل حذف الجلسة'))
    }
    setDeletingSessionId(null)
  }

  const handleClearAllLiturgySessions = async () => {
    setClearingAll(true)
    try {
      const ids = liturgySessions.map(s => s.id)
      await http.post('/attendance/sessions/batch-delete', { sessionIds: ids })
      toast('success', t(`Deleted ${ids.length} liturgy sessions`, `تم حذف ${ids.length} جلسات قداس`))
      setLiturgySessions([])
      setClearAllConfirm(false)
      loadSession(date, pickedGroupId || undefined, pickedLevelId || undefined)
    } catch {
      toast('error', t('Failed to delete sessions', 'فشل حذف الجلسات'))
    }
    setClearingAll(false)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadSession = useCallback(async (day: string, groupId?: string, levelId?: string) => {
    try {
      setLoading(true)
      const params: Record<string, string> = { date: day }
      if (groupId) params.groupId = groupId
      if (levelId) params.levelId = levelId
      const data = await http.get<LiturgySession>('/servants/liturgy-session', params)
      if (!mountedRef.current) return

      if (data.requiresGroupPick) {
        setAvailableGroups(data.groups || [])
        setAvailableLevels(data.levels || [])
        setGroupPickerOpen(true)
        setPickerStep('group')
        setSession(null)
      } else {
        setSession(data)
        setGroupPickerOpen(false)
      }
    } catch (err: any) {
      console.error('Liturgy session load error:', err)
      if (mountedRef.current) {
        const msg = err?.message || t('Failed to load liturgy session', 'فشل تحميل جلسة القداس')
        toast('error', msg)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [t, toast])

  useEffect(() => {
    loadSession(date, pickedGroupId || undefined, pickedLevelId || undefined)
  }, [loadSession, date, pickedGroupId, pickedLevelId])

  const handleGroupPick = (gId: string) => {
    if (availableLevels.length <= 1) {
      setPickedGroupId(gId)
      setGroupPickerOpen(false)
    } else {
      setPickedGroupId(gId)
      setPickerStep('level')
    }
  }

  const handleLevelPick = (lId: string) => {
    setPickedLevelId(lId)
    setGroupPickerOpen(false)
  }

  const handleSkipLevel = () => {
    setGroupPickerOpen(false)
  }

  const handleChangePick = () => {
    setPickedGroupId(null)
    setPickedLevelId(null)
    setSession(null)
    setGroupPickerOpen(true)
    setPickerStep('group')
  }

  const counts = useMemo(() => ({
    all: session?.students.length ?? 0,
    present: session?.students.filter(s => s.status === 'present').length ?? 0,
    absent: session?.students.filter(s => s.status === 'absent').length ?? 0,
    unrecorded: session?.students.filter(s => s.status === null).length ?? 0,
  }), [session?.students])

  const filteredStudents = useMemo(() => {
    if (!session?.students) return []
    let list = session.students
    if (filterStatus !== 'all') {
      list = list.filter(s => filterStatus === 'unrecorded' ? s.status === null : s.status === filterStatus)
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(s => {
      const nameEn = `${s.firstName} ${s.lastName}`.toLowerCase()
      const nameAr = `${s.firstNameAr || ''} ${s.lastNameAr || ''}`.toLowerCase()
      const grade = lang === 'ar' ? (s.gradeNameAr || s.gradeName || '') : (s.gradeName || '')
      return nameEn.includes(q) || nameAr.includes(q) || grade.toLowerCase().includes(q)
    })
  }, [session?.students, search, filterStatus, lang])

  const toggleStatus = (studentId: string, newStatus: 'present' | 'absent') => {
    setSession(prev => {
      if (!prev) return prev
      return {
        ...prev,
        students: prev.students.map(s =>
          s.studentId === studentId
            ? { ...s, status: s.status === newStatus ? null : newStatus }
            : s,
        ),
      }
    })
  }

  const markAll = (newStatus: 'present' | 'absent') => {
    setSession(prev => {
      if (!prev) return prev
      return { ...prev, students: prev.students.map(s => ({ ...s, status: newStatus })) }
    })
  }

  const clearAll = () => {
    setSession(prev => {
      if (!prev) return prev
      return { ...prev, students: prev.students.map(s => ({ ...s, status: null })) }
    })
    setFilterStatus('all')
  }

  const save = async () => {
    if (!session) return
    setSaving(true)
    try {
      const records = session.students
        .filter(s => s.status !== null)
        .map(s => ({
          studentId: s.studentId,
          status: s.status,
        }))

      const payload: any = { date, records }
      if (pickedGroupId) payload.groupId = pickedGroupId
      if (pickedLevelId) payload.levelId = pickedLevelId

      await http.post('/servants/liturgy-attendance', payload)
      toast('success', t('Liturgy attendance saved', 'تم حفظ حضور القداس'))
      loadSession(date, pickedGroupId || undefined, pickedLevelId || undefined)
    } catch {
      toast('error', t('Failed to save attendance', 'فشل حفظ الحضور'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <TableSkeleton rows={8} cols={2} />
      </div>
    )
  }

  if (!session && groupPickerOpen) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6">
          <Church className="h-6 w-6 text-amber-700" />
          <h1 className="text-2xl font-bold text-gray-900">{t('Liturgy Attendance', 'حضور القداس')}</h1>
        </div>

        <div className="mb-4 sm:max-w-xs">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('Date', 'التاريخ')}</label>
          <DatePicker value={date} onChange={setDate} max={new Date().toISOString().split('T')[0]} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          {pickerStep === 'group' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {t('Select a Group', 'اختر مجموعة')}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {t('Choose which group to record liturgy attendance for.', 'اختر المجموعة لتسجيل حضور القداس.')}
              </p>
              <div className="space-y-2">
                {availableGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleGroupPick(g.id)}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{g.name}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
              {availableGroups.length === 0 && (
                <p className="text-center text-gray-500 py-4">{t('No groups found', 'لم يتم العثور على مجموعات')}</p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {t('Select a Level (optional)', 'اختر مرحلة (اختياري)')}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {t('Optionally narrow by level, or skip to load all students in the group.', 'اختياريًا حدد المرحلة، أو تخطَّ لتحميل جميع طلاب المجموعة.')}
              </p>
              <div className="space-y-2">
                {availableLevels.map(l => (
                  <button
                    key={l.id}
                    onClick={() => handleLevelPick(l.id)}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-amber-400 hover:bg-amber-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{l.name}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPickerStep('group')}>
                  {t('Back', 'رجوع')}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSkipLevel}>
                  {t('Skip (all students)', 'تخطي (جميع الطلاب)')}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!session?.students.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-6">
          <Church className="h-6 w-6 text-amber-700" />
          <h1 className="text-2xl font-bold text-gray-900">{t('Liturgy Attendance', 'حضور القداس')}</h1>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{t('No students assigned to you yet', 'لا يوجد طلاب مسندون إليك بعد')}</p>
          <p className="mt-1 text-sm text-gray-400">{t('Ask your admin to assign a group or level.', 'اطلب من المسؤول إسناد مجموعة أو مرحلة.')}</p>
        </div>
      </div>
    )
  }

  const presentCount = session.students.filter(s => s.status === 'present').length
  const absentCount = session.students.filter(s => s.status === 'absent').length
  const recordedCount = presentCount + absentCount

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Church className="h-6 w-6 text-amber-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('Liturgy Attendance', 'حضور القداس')}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {new Date(session.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Button variant="outline" size="sm" onClick={() => { setShowSessionManager(!showSessionManager); if (!showSessionManager) fetchLiturgySessions() }}>
              <History className="h-3.5 w-3.5" />{t('Manage', 'إدارة')}
            </Button>
          )}
          <div className="text-right">
            <div className="text-xs font-medium text-gray-600 uppercase mb-1">{t('Progress', 'التقدم')}</div>
            <div className="text-2xl font-bold text-gray-900">
              {recordedCount}/{session.students.length}
            </div>
          </div>
        </div>
      </div>

      {/* Date + Change Group */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:max-w-xs sm:flex-1">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('Date', 'التاريخ')}</label>
          <DatePicker value={date} onChange={setDate} max={new Date().toISOString().split('T')[0]} />
        </div>
        {pickedGroupId && (
          <Button variant="outline" size="sm" onClick={handleChangePick}>
            {t('Change Group', 'تغيير المجموعة')}
          </Button>
        )}
      </div>

      {/* Session Manager (super admin) */}
      {isSuperAdmin && showSessionManager && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('Liturgy Sessions', 'جلسات القداس')} ({liturgySessions.length})
            </h2>
            <div className="flex items-center gap-2">
              {liturgySessions.length > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setClearAllConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5" />{t('Clear All', 'مسح الكل')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSessionManager(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {loadingSessions ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
          ) : liturgySessions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('No liturgy sessions found', 'لا يوجد جلسات قداس')}</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[40vh] overflow-y-auto">
              {liturgySessions.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {s.group?.name || '?'}{s.level ? ` · L${s.level.number}` : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(s.scheduledDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {s.summary && s.summary.total > 0 && (
                        <> · {s.summary.present}/{s.summary.total} ({Math.round((s.summary.present / s.summary.total) * 100)}%)</>
                      )}
                    </div>
                  </div>
                  <Badge variant={s.status === 'completed' ? 'success' : s.status === 'scheduled' ? 'info' : 'warning'} size="sm">
                    {s.status === 'completed' ? t('Completed', 'مكتمل') : s.status === 'scheduled' ? t('Scheduled', 'مجدول') : s.status}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteLiturgySession(s.id)}
                    disabled={deletingSessionId === s.id}
                    className="text-red-500 hover:text-red-700">
                    {deletingSessionId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clear All Liturgy Confirmation */}
      {clearAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setClearAllConfirm(false)}>
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">{t('Clear All Liturgy Sessions', 'مسح جميع جلسات القداس')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t(`Are you sure you want to delete all ${liturgySessions.length} liturgy sessions? This cannot be undone.`, `هل أنت متأكد من حذف جميع ${liturgySessions.length} جلسات القداس؟ لا يمكن التراجع عن ذلك.`)}</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setClearAllConfirm(false)}>{t('Cancel', 'إلغاء')}</Button>
              <Button variant="destructive" onClick={handleClearAllLiturgySessions} disabled={clearingAll}>
                {clearingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('Delete All', 'حذف الكل')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('Search by name...', 'بحث بالاسم...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('Filter by status', 'تصفية حسب الحالة')}>
        {([
          { key: 'all', label: t('All', 'الكل') },
          { key: 'present', label: t('Present', 'حاضر') },
          { key: 'absent', label: t('Absent', 'غائب') },
          { key: 'unrecorded', label: t('Not recorded', 'غير مسجل') },
        ] as const).map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterStatus(f.key)}
            aria-pressed={filterStatus === f.key}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filterStatus === f.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            {f.label}
            <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-600">{counts[f.key]}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => markAll('present')}>
          {t('Mark all present', 'تحديد الكل حاضر')}
        </Button>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          {t('Clear', 'مسح')}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 mb-6 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-900 uppercase">{t('Present', 'حاضرون')}</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{presentCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-900 uppercase">{t('Absent', 'غائبون')}</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{absentCount}</p>
        </div>
      </div>

      {/* Student roster */}
      <div className="space-y-2 mb-6">
        {filteredStudents.map(student => (
          <div
            key={student.studentId}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              student.status === 'present'
                ? 'border-emerald-300 bg-emerald-50'
                : student.status === 'absent'
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {/* Photo */}
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
              {student.photoUrl ? (
                <Image
                  src={photoSrc(student.photoUrl)}
                  alt={student.firstName}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-amber-100 text-sm font-bold text-amber-700">
                  {student.firstName.charAt(0)}
                </div>
              )}
            </div>

            {/* Name + Grade */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {lang === 'ar'
                  ? `${student.firstNameAr || student.firstName} ${student.lastNameAr || student.lastName}`
                  : `${student.firstName} ${student.lastName}`}
              </p>
              {(student.gradeName || student.gradeNameAr) && (
                <p className="text-xs text-gray-500 truncate">
                  {lang === 'ar' ? student.gradeNameAr || student.gradeName : student.gradeName}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => toggleStatus(student.studentId, 'present')}
                className={`min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors ${
                  student.status === 'present'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-700'
                }`}
                title={t('Present', 'حاضر')}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggleStatus(student.studentId, 'absent')}
                className={`min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors ${
                  student.status === 'absent'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
                }`}
                title={t('Absent', 'غائب')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredStudents.length === 0 && search && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <p className="text-gray-500">{t('No students match your search', 'لا يوجد طلاب يطابقون بحثك')}</p>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="sticky bottom-16 lg:bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 -mx-4 sm:-mx-6 lg:-mx-8 mt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-4 sm:mx-6 lg:mx-8 flex gap-2">
          <Button
            onClick={() => loadSession(date, pickedGroupId || undefined, pickedLevelId || undefined)}
            variant="outline"
            disabled={saving}
          >
            {t('Clear', 'مسح')}
          </Button>
          <Button
            onClick={save}
            disabled={saving || recordedCount === 0}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                {t('Saving...', 'جاري الحفظ...')}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('Save Attendance', 'حفظ الحضور')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

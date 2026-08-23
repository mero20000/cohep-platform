'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/use-language'
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Minus,
  Plus, Search, Loader2,
  FileText, BarChart3, Users,
  ArrowLeft, Save, UserCheck, UserX, User, X, Trash2, RotateCcw, Play, QrCode
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { StatCard } from '@/components/ui/stat-card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { QrScanner } from '@/components/qr/qr-scanner'
import { http } from '@/lib/http-client'
import { assetUrl } from '@/lib/asset-url'
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
interface SubjectItemInfo { id: string; name: string; nameAr?: string | null; status: string }
interface SessionDetail extends Session {
  attendanceRecords: Array<{
    id: string; status: string; homeworkStatus: string; note?: string; recordedAt: string;
    behavior?: number; participation?: number; attendedLiturgy?: boolean;
    student: { id: string; firstName: string; lastName: string; studentCode: string; photoUrl?: string | null };
  }>;
  subjectItem?: SubjectItemInfo | null;
  passedStudentIds?: string[];
}
interface Level { id: string; name: string; number: number; status?: string }
interface Group { id: string; name: string; levelId?: string; status?: string }
interface Stats {
  totalSessions: number; completedSessions: number; scheduledSessions: number; inProgressSessions: number;
  totalRecords: number; presentCount: number; lateCount: number; absentCount: number; excusedCount: number;
  averageAttendanceRate: number;
}
interface LevelStat { levelId: string; levelNumber: number; levelName: string; totalSessions: number; attendanceRate: number }
interface GroupStat { groupId: string; groupName: string; levelNumber: number; levelName: string; totalSessions: number; totalRecords: number; attendanceRate: number }

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  present: CheckCircle2, late: Clock, absent: XCircle, excused: AlertCircle, unmarked: Minus,
}
const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700', late: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700', excused: 'bg-gray-100 text-gray-600', unmarked: 'bg-gray-50 text-gray-500',
}
export function AttendanceClient() {
  const { toast } = useToast()
  const lang = useLanguage()
  const [tab, setTab] = useState<'sessions' | 'stats' | 'students'>('sessions')
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [levelStats, setLevelStats] = useState<LevelStat[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [tempMarks, setTempMarks] = useState<Record<string, string>>({})
  const [tempBehavior, setTempBehavior] = useState<Record<string, number>>({})
  const [tempParticipation, setTempParticipation] = useState<Record<string, number>>({})
  const [tempLiturgy, setTempLiturgy] = useState<Record<string, boolean>>({})
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({})

  const [filterLevel, setFilterLevel] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [search, setSearch] = useState('')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSessionId, setEditSessionId] = useState('')
  const [editForm, setEditForm] = useState({ levelId: '', groupId: '', servantId: '', scheduledDate: '', scheduledTime: '12:00', status: 'scheduled', notes: '' })
  const [createForm, setCreateForm] = useState({ levelId: '', groupId: '', servantId: '', scheduledDate: '', scheduledTime: '12:00', status: 'scheduled', notes: '' })
  const [levels, setLevels] = useState<Level[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [showQrScanner, setShowQrScanner] = useState(false)
  const [startingClass, setStartingClass] = useState(false)

  const [arrivalSubjectItemId, setArrivalSubjectItemId] = useState<string | null>(null)
  const [subjectItemInfo, setSubjectItemInfo] = useState<{
    id: string; name: string; nameAr?: string | null; status: string
    sessionsUsed?: number | null; plannedSessions?: number | null; assessmentId?: string
  } | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [studentResults, setStudentResults] = useState<{
    student: { id: string; studentCode: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string };
    records: { id: string; status: string; recordedAt: string; homeworkStatus?: string; behavior?: number; participation?: number; attendedLiturgy?: boolean; attendanceSession?: { level?: { number?: number } } }[];
  }[]>([])
  const [searching, setSearching] = useState(false)

  const schoolId = getSchoolId()
  const searchParams = useSearchParams()
  const arrivalTapHandled = useRef(false)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const TAB_IDS = ['sessions', 'stats', 'students'] as const

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, activeId: string) => {
    const idx = TAB_IDS.indexOf(activeId as (typeof TAB_IDS)[number])
    let next: (typeof TAB_IDS)[number] | undefined
    if (e.key === 'ArrowRight') next = TAB_IDS[(idx + 1) % TAB_IDS.length]
    else if (e.key === 'ArrowLeft') next = TAB_IDS[(idx + TAB_IDS.length - 1) % TAB_IDS.length]
    else if (e.key === 'Home') next = TAB_IDS[0]
    else if (e.key === 'End') next = TAB_IDS[TAB_IDS.length - 1]
    if (next) {
      e.preventDefault()
      setTab(next)
      setSelectedSession(null)
      requestAnimationFrame(() => tabRefs.current[next]?.focus())
    }
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = { schoolId, limit: '500' }
    if (filterLevel) params.levelId = filterLevel
    if (filterGroup) params.groupId = filterGroup
    if (filterStatus) params.status = filterStatus
    if (filterDateFrom) params.from = filterDateFrom
    if (filterDateTo) params.to = filterDateTo
    try {
      const data = await http.get<{ data: Session[] }>('/attendance/sessions', params)
      setSessions(data.data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [filterLevel, filterGroup, filterStatus, filterDateFrom, filterDateTo])

  const fetchStats = useCallback(async () => {
    try {
      const [statsData, levelData, groupData] = await Promise.all([
        http.get<Stats>('/attendance/stats', { schoolId }),
        http.get<LevelStat[]>('/attendance/level-stats', { schoolId }),
        http.get<GroupStat[]>('/attendance/group-stats', { schoolId }),
      ])
      setStats(statsData)
      setLevelStats(levelData)
      setGroupStats(groupData)
    } catch (e) { console.error(e) }
  }, [])

  const fetchLevelsGroups = useCallback(async () => {
    try {
      const [allLevels, allGroups] = await Promise.all([
        http.get<Level[]>('/curriculum/levels', { schoolId }),
        http.get<Group[]>('/students/groups/all', { schoolId }),
      ])
      setLevels(allLevels.filter(l => l.status !== 'inactive'))
      setGroups((allGroups || []).filter(g => g.status !== 'inactive'))
    } catch (e) { console.error(e) }
  }, [schoolId])

  useEffect(() => { fetchLevelsGroups() }, [fetchLevelsGroups])
  useEffect(() => { fetchSessions() }, [fetchSessions])

  // ── Arrival Tap ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (arrivalTapHandled.current || loading) return
    const sessionId = searchParams?.get('sessionId')
    const prefill = searchParams?.get('prefill')
    const subjectItemId = searchParams?.get('subjectItemId')
    if (subjectItemId) setArrivalSubjectItemId(subjectItemId)
    if (!sessionId) return
    arrivalTapHandled.current = true
    fetchSessionDetail(sessionId)
    if (prefill === 'present') {
      setTimeout(() => {
        handleMarkAll('present')
      }, 400)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams])
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => { if (tab === 'stats') fetchStats() }, [tab, fetchStats])

  const fetchSessionDetail = async (id: string) => {
    try {
      const data = await http.get<SessionDetail>(`/attendance/sessions/${id}`)
      setSelectedSession(data)
      setPassedIds(new Set(data.passedStudentIds || []))
      if (data.subjectItem) {
        setSubjectItemInfo({ ...data.subjectItem })
      } else if (arrivalSubjectItemId) {
        setSubjectItemInfo({ id: arrivalSubjectItemId, name: '', status: 'pending' })
      } else {
        setSubjectItemInfo(null)
      }
      const marks: Record<string, string> = {}
      const behavior: Record<string, number> = {}
      const participation: Record<string, number> = {}
      const liturgy: Record<string, boolean> = {}
      const notes: Record<string, string> = {}
      data.attendanceRecords?.forEach(r => {
        if (!r?.student) return
        marks[r.student.id] = r.status
        behavior[r.student.id] = r.behavior ?? 0
        participation[r.student.id] = r.participation ?? 0
        liturgy[r.student.id] = r.attendedLiturgy ?? false
        notes[r.student.id] = r.note || ''
      })
      setTempMarks(marks)
      setTempBehavior(behavior)
      setTempParticipation(participation)
      setTempLiturgy(liturgy)
      setTempNotes(notes)
      setTab('sessions')
    } catch (e) { console.error(e) }
  }

  const handleMarkAll = (status: string) => {
    if (!selectedSession?.attendanceRecords) return
    const marks: Record<string, string> = {}
    selectedSession.attendanceRecords.forEach(r => { if (r?.student) marks[r.student.id] = status })
    setTempMarks(marks)
  }

  const handleSaveAttendance = async (markAsCompleted = false) => {
    if (!selectedSession) return
    setMarking(true)
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const records = Object.entries(tempMarks)
      .filter(([_, status]) => status && status !== 'unmarked')
      .map(([studentId, status]) => ({
        studentId, status,
        behavior: tempBehavior[studentId] || 0,
        participation: tempParticipation[studentId] || 0,
        attendedLiturgy: tempLiturgy[studentId] || false,
        note: tempNotes[studentId] || undefined,
      }))
    try {
      await http.post(`/attendance/sessions/${selectedSession.id}/mark`, {
        records, recordedBy: user.id || '00000000-0000-0000-0000-000000000000',
      })
      if (markAsCompleted) {
        await http.put(`/attendance/sessions/${selectedSession.id}`, { status: 'completed' })
      }
      fetchSessionDetail(selectedSession.id)
      fetchSessions()
      track('attendance.marked', 'action', { count: records.length, completed: markAsCompleted, sessionId: selectedSession.id })
    } catch (e) { console.error(e) }
    setMarking(false)
  }

  const handleMarkSubjectItem = async (status: 'in_progress' | 'completed' | 'allocated') => {
    if (!selectedSession) return
    const linkId = selectedSession.subjectItem?.id || arrivalSubjectItemId || undefined
    try {
      const result = await http.post<{
        subjectItemId: string; status: string; assessment?: { id: string }; sessionsUsed?: number | null; plannedSessions?: number | null
      }>(`/attendance/sessions/${selectedSession.id}/subject-item`, { status, subjectItemId: linkId })
      setSubjectItemInfo(prev => ({
        id: result.subjectItemId,
        name: prev?.name || '',
        nameAr: prev?.nameAr,
        status: result.status,
        sessionsUsed: result.sessionsUsed ?? null,
        plannedSessions: result.plannedSessions ?? null,
        assessmentId: result.assessment?.id,
      }))
      setArrivalSubjectItemId(result.subjectItemId)
      toast('success', status === 'completed'
        ? (lang === 'ar' ? 'تم إكمال عنصر المنهج' : 'Subject item completed')
        : status === 'allocated'
          ? (lang === 'ar' ? 'تمت إعادة عنصر المنهج للتعيين' : 'Subject item reset to allocated')
          : (lang === 'ar' ? 'تم بدء عنصر المنهج' : 'Subject item in progress'))
      fetchSessionDetail(selectedSession.id)
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل تحديث عنصر المنهج' : 'Failed to update subject item', e?.message || '')
    }
  }

  const [passedIds, setPassedIds] = useState<Set<string>>(new Set())
  const [passingId, setPassingId] = useState<string | null>(null)

  const handleMarkPassed = async (studentId: string) => {
    if (!selectedSession) return
    setPassingId(studentId)
    try {
      const res = await http.post<{ passed: boolean; whatsappSent: boolean }>(
        `/attendance/sessions/${selectedSession.id}/subject-item/pass`,
        { studentId },
      )
      setPassedIds(prev => new Set(prev).add(studentId))
      toast('success',
        lang === 'ar' ? 'تم تسجيل اجتياز الطالب' : 'Student marked as passed',
        res.whatsappSent ? (lang === 'ar' ? 'تم إشعار ولي الأمر عبر واتساب' : 'Parent notified via WhatsApp') : undefined)
      track('subject_item.passed', 'action', { sessionId: selectedSession.id, studentId })
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل تسجيل الاجتياز' : 'Failed to mark passed', e?.message || '')
    }
    setPassingId(null)
  }

  const handleChangeSessionGroup = async (groupId: string) => {
    if (!selectedSession || !groupId) return
    try {
      await http.put(`/attendance/sessions/${selectedSession.id}`, { groupId })
      toast('success', lang === 'ar' ? 'تم تحديث المجموعة' : 'Group updated')
      fetchSessionDetail(selectedSession.id)
      fetchSessions()
    } catch {
      toast('error', lang === 'ar' ? 'فشل تحديث المجموعة' : 'Failed to update group')
    }
  }

  const handleStartClass = async () => {
    setStartingClass(true)
    track('onboarding.start', 'activation', { feature: 'start_class' })
    try {
      const result = await http.post<{ session: SessionDetail; created: boolean } | { groups: { id: string; name: string }[]; requiresGroupPick: boolean }>('/attendance/start-class')
      if ('requiresGroupPick' in result && result.requiresGroupPick) {
        toast('warning', 'Select a group', 'Multiple groups found. Select one from the session list.')
      } else if ('session' in result) {
        fetchSessionDetail(result.session.id)
        fetchSessions()
        toast('success', 'Class started!', 'All students pre-marked as present.')
        track('onboarding.completed', 'activation', { feature: 'start_class', sessionId: result.session.id })
      }
    } catch (e: any) {
      toast('error', 'Failed to start class', e?.message || 'Unknown error')
    }
    setStartingClass(false)
  }

  const handleQrCheckIn = async (studentId: string) => {
    try {
      const result = await http.post<{ record: any; message: string }>('/attendance/qr-checkin', { studentId })
      const sid = result.record?.student?.id
      if (sid) setTempMarks(prev => ({ ...prev, [sid]: 'present' }))
      return { success: true, message: result.message }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Check-in failed' }
    }
  }

  const handleCreateSession = async () => {
    if (!createForm.levelId || !createForm.groupId || !createForm.scheduledDate) {
      toast('warning', lang === 'ar' ? 'حقول ناقصة' : 'Missing fields', lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields'); return
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setSaving(true)
    try {
      await http.post('/attendance/sessions', {
        ...createForm, servantId: createForm.servantId || user.id || '00000000-0000-0000-0000-000000000000', schoolId,
      })
      setShowCreateModal(false)
      setCreateForm({ levelId: '', groupId: '', servantId: '', scheduledDate: '', scheduledTime: '12:00', status: 'scheduled', notes: '' })
      fetchSessions()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const openEditSession = (session: Session) => {
    setEditSessionId(session.id)
    setEditForm({
      levelId: session.level.id,
      groupId: session.group.id,
      servantId: session.servant?.id || '',
      scheduledDate: session.scheduledDate.split('T')[0],
      scheduledTime: session.scheduledTime || '12:00',
      status: session.status,
      notes: session.notes || '',
    })
    setShowEditModal(true)
  }

  const handleEditSession = async () => {
    if (!editSessionId) return
    setSaving(true)
    try {
      await http.put(`/attendance/sessions/${editSessionId}`, editForm)
      setShowEditModal(false)
      fetchSessions()
      if (selectedSession?.id === editSessionId) fetchSessionDetail(editSessionId)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleDeleteSession = async () => {
    if (!selectedSession) return
    setDeleting(true)
    try {
      await http.delete(`/attendance/sessions/${selectedSession.id}`)
      setShowDeleteConfirm(false)
      setSelectedSession(null)
      fetchSessions()
      toast('success', lang === 'ar' ? 'تم حذف الجلسة' : 'Session deleted')
    } catch (e) { console.error(e) }
    setDeleting(false)
  }

  const exportAttendance = async () => {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    doc.setFontSize(18); doc.text(lang === 'ar' ? 'COHEP - تقرير الحضور' : 'COHEP - Attendance Report', 14, 22)
    doc.setFontSize(10); doc.text(`${lang === 'ar' ? 'تم التصدير:' : 'Exported:'} ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 14, 30)
    if (stats) {
      doc.setFontSize(11)
      doc.text(`${lang === 'ar' ? 'نسبة الحضور الإجمالية:' : 'Overall Attendance Rate:'} ${stats.averageAttendanceRate}% | ${lang === 'ar' ? 'الجلسات:' : 'Sessions:'} ${stats.totalSessions} | ${lang === 'ar' ? 'السجلات:' : 'Records:'} ${stats.totalRecords}`, 14, 38)
    }
    const data = sessions.map((s, i) => [
      i + 1, `L${s.level?.number || '?'}`, s.group?.name || '?',
      new Date(s.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }), s.scheduledTime || '—',
      s.status, s.summary ? `${s.summary.present}/${s.summary.total}` : '—',
      s.summary ? `${Math.round((s.summary.present / s.summary.total) * 100)}%` : '—',
    ])
    autoTable(doc, {
      startY: 43,
      head: [[lang === 'ar' ? '#' : '#', lang === 'ar' ? 'المستوى' : 'Level', lang === 'ar' ? 'المجموعة' : 'Group', lang === 'ar' ? 'التاريخ' : 'Date', lang === 'ar' ? 'الوقت' : 'Time', lang === 'ar' ? 'الحالة' : 'Status', lang === 'ar' ? 'الحاضر/الإجمالي' : 'Present/Total', lang === 'ar' ? 'النسبة' : 'Rate']],
      body: data, styles: { fontSize: 7 },
      headStyles: { fillColor: [212, 175, 55] },
    })
    doc.save('cohep-attendance.pdf')
  }

  const filteredSessions = sessions.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (s.level?.name || '').toLowerCase().includes(q) || (s.group?.name || '').toLowerCase().includes(q)
  })

  const handleGenerateSessions = async () => {
    setGenerating(true)
    try {
      const result = await http.post<{ created: number; skipped: number }>('/attendance/sessions/generate', undefined, { schoolId })
      toast('success', lang === 'ar' ? `تم إنشاء ${result.created} جلسات (${result.skipped} موجودة مسبقًا)` : `Generated ${result.created} sessions (${result.skipped} already existed)`)
      fetchSessions()
    } catch { toast('error', lang === 'ar' ? 'فشل إنشاء الجلسات' : 'Failed to generate sessions') }
    setGenerating(false)
    setShowGenerateConfirm(false)
  }

  const handleReopenAttendance = async () => {
    if (!selectedSession) return
    setMarking(true)
    try {
      await http.put(`/attendance/sessions/${selectedSession.id}`, { status: 'in_progress' })
      fetchSessionDetail(selectedSession.id)
      fetchSessions()
    } catch (e) { console.error(e) }
    setMarking(false)
  }

  const safeRecords = selectedSession?.attendanceRecords?.filter(r => r?.student) || []
  const assignedGroupId = (() => {
    try {
      return (JSON.parse(localStorage.getItem('user') || '{}').metadata?.groupId) || ''
    } catch { return '' }
  })()
  const isCompleted = selectedSession?.status === 'completed'
  const presentCount = safeRecords.filter(r => tempMarks[r.student.id] === 'present').length || 0
  const lateCount = safeRecords.filter(r => tempMarks[r.student.id] === 'late').length || 0
  const absentCount = safeRecords.filter(r => tempMarks[r.student.id] === 'absent').length || 0
  const excusedCount = safeRecords.filter(r => tempMarks[r.student.id] === 'excused').length || 0
  const totalStudents = safeRecords.length

  if (loading && !sessions.length) {
    return <div className="h-96 px-4 py-6"><TableSkeleton rows={6} cols={4} /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'الحضور' : 'Attendance'}</h1>
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'تتبع حضور الفصول وواجبات الطلاب' : 'Track class attendance and homework status'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportAttendance}>
            <FileText className="h-3.5 w-3.5" />{lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleStartClass} disabled={startingClass}>
            <Play className="h-3.5 w-3.5" />{startingClass ? (lang === 'ar' ? '...جاري' : 'Starting...') : (lang === 'ar' ? 'بدء الفصل' : 'Start Class')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowGenerateConfirm(true)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white">
            <Calendar className="h-3.5 w-3.5" />{lang === 'ar' ? 'إنشاء' : 'Generate'}
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-3.5 w-3.5" />{lang === 'ar' ? 'جلسة جديدة' : 'New Session'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" role="tablist">
          {[
            { id: 'sessions' as const, label: lang === 'ar' ? 'الجلسات' : 'Sessions', icon: Calendar },
            { id: 'stats' as const, label: lang === 'ar' ? 'الإحصائيات' : 'Statistics', icon: BarChart3 },
            { id: 'students' as const, label: lang === 'ar' ? 'بالطالب' : 'By Student', icon: Users },
          ].map(t => (
            <button key={t.id} ref={el => { tabRefs.current[t.id] = el }}
              onClick={() => { setTab(t.id); setSelectedSession(null) }}
              onKeyDown={e => handleTabKeyDown(e, t.id)}
              role="tab" id={`tab-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
              aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                tab === t.id ? 'border-gold-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stats && (
          <>
            <StatCard label={lang === 'ar' ? 'متوسط الحضور' : 'Avg Attendance'} value={`${stats.averageAttendanceRate}%`} icon={BarChart3}
              subtitle={`${stats.completedSessions} ${lang === 'ar' ? 'مكتملة' : 'completed'} • ${stats.scheduledSessions} ${lang === 'ar' ? 'قادمة' : 'upcoming'}`} />
            <StatCard label={lang === 'ar' ? 'إجمالي الجلسات' : 'Total Sessions'} value={stats.totalSessions} icon={Calendar}
              subtitle={`${stats.completedSessions} ${lang === 'ar' ? 'مكتملة' : 'completed'} • ${stats.scheduledSessions} ${lang === 'ar' ? 'قادمة' : 'upcoming'}`} />
            <StatCard label={lang === 'ar' ? 'حاضر' : 'Present'} value={stats.presentCount} icon={UserCheck}
              iconColor="text-green-600" iconBg="bg-green-50"
              subtitle={stats.totalRecords > 0 ? `${Math.round((stats.presentCount / stats.totalRecords) * 100)}%` : '0%'} />
            <StatCard label={lang === 'ar' ? 'متأخر' : 'Late'} value={stats.lateCount} icon={Clock}
              iconColor="text-amber-600" iconBg="bg-amber-50"
              subtitle={stats.totalRecords > 0 ? `${Math.round((stats.lateCount / stats.totalRecords) * 100)}%` : '0%'} />
            <StatCard label={lang === 'ar' ? 'غائب' : 'Absent'} value={stats.absentCount} icon={UserX}
              iconColor="text-red-600" iconBg="bg-red-50"
              subtitle={stats.totalRecords > 0 ? `${Math.round((stats.absentCount / stats.totalRecords) * 100)}%` : '0%'} />
            <StatCard label={lang === 'ar' ? 'سجلات الطلاب' : 'Student Records'} value={stats.totalRecords} icon={FileText}
              subtitle={`${stats.excusedCount} ${lang === 'ar' ? 'معذور' : 'excused'}`} />
          </>
        )}
      </div>

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <div role="tabpanel" id="panel-sessions" aria-labelledby="tab-sessions" className="grid gap-6 lg:grid-cols-5">
          {/* Sessions List */}
          <div className={`${selectedSession ? 'hidden lg:hidden' : 'lg:col-span-5'} rounded-xl border border-gray-200 bg-white transition-all`}>
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
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
                  className="w-full rounded-lg border border-gray-300 ps-8 pe-2 py-1.5 text-xs min-h-[40px] focus:border-gold-500 focus:outline-none" />
              </div>
            </div>
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {filteredSessions.map(s => (
                <button key={s.id} aria-label={`session ${s.group?.name || s.id}`} onClick={() => fetchSessionDetail(s.id)}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-start transition-colors hover:bg-gray-50 active:bg-gray-100 ${
                    selectedSession?.id === s.id ? 'bg-blue-50/50 border-s-2 border-gold-500' : ''
                  }`}>
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
              ))}
              {filteredSessions.length === 0 && (
                <div className="py-12 text-center text-gray-500"><Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>{lang === 'ar' ? 'لم يتم العثور على جلسات' : 'No sessions found'}</p></div>
              )}
            </div>
          </div>

          {/* Mark Attendance Panel */}
          {selectedSession && (
            <div className="lg:col-span-5 rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedSession(null)} aria-label={lang === 'ar' ? 'العودة لقائمة الجلسات' : 'Back to sessions list'} className="hover:bg-gray-100"><ArrowLeft className="h-4 w-4" /></Button>
                    <h2 className="font-semibold text-gray-900">{isCompleted ? (lang === 'ar' ? 'عرض الحضور' : 'View Attendance') : (lang === 'ar' ? 'تسجيل الحضور' : 'Mark Attendance')}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditSession(selectedSession)} className="text-gray-500 hover:text-gray-700">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      {lang === 'ar' ? 'تعديل' : 'Edit'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" /> {lang === 'ar' ? 'حذف' : 'Delete'}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  L{selectedSession.level?.number || '?'} &middot;{' '}
                  {isCompleted ? (
                    selectedSession.group?.name || '?'
                  ) : (
                    (() => {
                      const currentGroupId = selectedSession.group?.id
                      const optionIds = new Set(groups.map(g => g.id))
                      const optionGroups = [...groups]
                      if (currentGroupId && !optionIds.has(currentGroupId)) {
                        optionGroups.push({ id: currentGroupId, name: selectedSession.group?.name || currentGroupId, levelId: selectedSession.level?.id || '', status: 'active' })
                        optionIds.add(currentGroupId)
                      }
                      if (assignedGroupId && !optionIds.has(assignedGroupId)) {
                        const assignedName = groups.find(g => g.id === assignedGroupId)?.name || assignedGroupId
                        optionGroups.push({ id: assignedGroupId, name: assignedName, levelId: '', status: 'active' })
                        optionIds.add(assignedGroupId)
                      }
                      const selectValue = currentGroupId || assignedGroupId || ''
                      return (
                        <>
                          <select
                            aria-label={lang === 'ar' ? 'المجموعة' : 'Group'}
                            value={selectValue}
                            onChange={e => handleChangeSessionGroup(e.target.value)}
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs min-h-[28px] focus:border-gold-500 focus:outline-none"
                          >
                            {optionGroups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          {assignedGroupId && assignedGroupId !== selectValue && (
                            <span className="block text-[10px] text-gray-400 mt-0.5">
                              {lang === 'ar' ? `المجموعة المخصصة: ${optionGroups.find(g => g.id === assignedGroupId)?.name || assignedGroupId}` : `Assigned: ${optionGroups.find(g => g.id === assignedGroupId)?.name || assignedGroupId}`}
                            </span>
                          )}
                        </>
                      )
                    })()
                  )}
                </div>
                <div className="text-xs text-gray-500">{new Date(selectedSession.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} {selectedSession.scheduledTime}</div>
              </div>

              {showQrScanner && !isCompleted && (
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <QrScanner onCheckIn={handleQrCheckIn} onClose={() => setShowQrScanner(false)} />
                </div>
              )}
              {!isCompleted && !showQrScanner && (
                <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-500">{lang === 'ar' ? 'تحديد الكل:' : 'Mark all:'}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleMarkAll('present')} className="bg-green-100 text-green-700 hover:bg-green-200">{lang === 'ar' ? 'الكل حاضر' : 'All Present'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleMarkAll('late')} className="bg-amber-100 text-amber-700 hover:bg-amber-200">{lang === 'ar' ? 'الكل متأخر' : 'All Late'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleMarkAll('absent')} className="bg-red-100 text-red-700 hover:bg-red-200">{lang === 'ar' ? 'الكل غائب' : 'All Absent'}</Button>
                  <div className="ms-auto">
                    <Button variant="outline" size="sm" onClick={() => setShowQrScanner(true)}>
                      <QrCode className="h-3.5 w-3.5 ms-1" />{lang === 'ar' ? 'مسح QR' : 'QR Scan'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-100 text-xs">
                <span className="text-green-600 font-medium">{presentCount} {lang === 'ar' ? 'حاضر' : 'Present'}</span>
                <span className="text-amber-600 font-medium">{lateCount} {lang === 'ar' ? 'متأخر' : 'Late'}</span>
                <span className="text-red-600 font-medium">{absentCount} {lang === 'ar' ? 'غائب' : 'Absent'}</span>
                <span className="text-gray-500 font-medium">{excusedCount} {lang === 'ar' ? 'معذور' : 'Excused'}</span>
                <span className="text-gray-500 ms-auto">{totalStudents} {lang === 'ar' ? 'إجمالي' : 'total'}</span>
              </div>

              {/* Subject Item Delivery */}
              {subjectItemInfo?.id && (
                <div className="border-b border-gray-100 bg-gold-50/60 px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">{lang === 'ar' ? 'عنصر المنهج' : 'Subject Item'}</div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-gray-900">
                        {subjectItemInfo.name || subjectItemInfo.nameAr || (lang === 'ar' ? 'عنصر منهج مرتبط' : 'Linked subject item')}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {subjectItemInfo.status === 'completed'
                          ? (lang === 'ar' ? 'مكتمل' : 'Completed')
                          : subjectItemInfo.status === 'in_progress'
                            ? (lang === 'ar' ? 'قيد التنفيذ' : 'In progress')
                            : subjectItemInfo.status === 'allocated'
                              ? (lang === 'ar' ? 'مخصص' : 'Allocated')
                              : (lang === 'ar' ? 'بانتظار البدء' : 'Pending')}
                        {subjectItemInfo.status === 'completed' && (
                          <span className="ms-2">
                            {lang === 'ar' ? 'جلسات مستخدمة' : 'Sessions used'}: {subjectItemInfo.sessionsUsed ?? 0}
                            {subjectItemInfo.plannedSessions != null && ` / ${subjectItemInfo.plannedSessions}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleMarkSubjectItem('in_progress')}
                        disabled={subjectItemInfo.status === 'in_progress' || subjectItemInfo.status === 'completed'}>
                        {lang === 'ar' ? 'بدء التنفيذ' : 'Mark in progress'}
                      </Button>
                      <Button size="sm" onClick={() => handleMarkSubjectItem('completed')}
                        disabled={subjectItemInfo.status === 'completed'}
                        className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" />{lang === 'ar' ? 'إكمال' : 'Mark completed'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleMarkSubjectItem('allocated')}
                        disabled={subjectItemInfo.status === 'allocated' || subjectItemInfo.status === 'pending'}
                        className="text-gray-600 hover:bg-gray-100">
                        <RotateCcw className="h-3.5 w-3.5" />{lang === 'ar' ? 'إعادة للتعيين' : 'Reset'}
                      </Button>
                    </div>
                  </div>
                  {subjectItemInfo.status === 'completed' && subjectItemInfo.assessmentId && (
                    <Link href={`/dashboard/assessments/${subjectItemInfo.assessmentId}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800">
                      <FileText className="h-3.5 w-3.5" />{lang === 'ar' ? 'فتح التقييم المُنشأ' : 'Open created assessment'}
                    </Link>
                  )}
                </div>
              )}

              {/* Student List */}
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {safeRecords.map(record => {
                  const status = tempMarks[record.student.id] || record.status
                  const b = tempBehavior[record.student.id] ?? 0
                  const p = tempParticipation[record.student.id] ?? 0
                  const lit = tempLiturgy[record.student.id] ?? false
                  return (
                    <div key={record.student.id} className={`px-4 sm:px-6 py-2.5 ${isCompleted ? 'opacity-80' : ''}`}>
                      {/* Row 1: Name + Status */}
                       <div className="flex items-center gap-3">
                         {record.student.photoUrl ? (
                           // eslint-disable-next-line @next/next/no-img-element
                           <img src={assetUrl(record.student.photoUrl)} alt="" className="h-9 w-9 shrink-0 rounded-full bg-gray-100 object-cover" />
                         ) : (
                           <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                             <User className="h-4 w-4" />
                           </div>
                         )}
                         <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{record.student.firstName} {record.student.lastName}</div>
                          <div className="text-xs text-gray-500">{record.student.studentCode}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {(['present', 'late', 'absent', 'excused'] as const).map(s => {
                            const Icon = STATUS_ICONS[s]
                            const statusLabel = s === 'present' ? (lang === 'ar' ? 'حاضر' : 'Present') : s === 'late' ? (lang === 'ar' ? 'متأخر' : 'Late') : s === 'absent' ? (lang === 'ar' ? 'غائب' : 'Absent') : (lang === 'ar' ? 'معذور' : 'Excused')
                            if (isCompleted) {
                              return (
                                <div key={s} className={`rounded-lg p-2 ${status === s ? STATUS_COLORS[s] : 'text-gray-200'}`} aria-hidden="true">
                                  <Icon className="h-5 w-5" />
                                </div>
                              )
                            }
                            return (
                              <button key={s} onClick={() => setTempMarks({ ...tempMarks, [record.student.id]: status === s ? 'unmarked' : s })}
                                className={`rounded-lg p-2 transition-colors ${status === s ? STATUS_COLORS[s] : 'text-gray-300 hover:bg-gray-100'}`} title={statusLabel} aria-label={`${statusLabel} - ${record.student.firstName} ${record.student.lastName}`} aria-pressed={status === s}>
                                <Icon className="h-5 w-5" />
                              </button>
                            )
                          })}
                        </div>
                        {subjectItemInfo?.id && (
                          <button type="button" onClick={() => handleMarkPassed(record.student.id)}
                            disabled={passingId === record.student.id || passedIds.has(record.student.id)}
                            title={lang === 'ar' ? 'تسجيل اجتياز هذا العنصر للطالب' : 'Mark this student as passed'}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                              passedIds.has(record.student.id)
                                ? 'bg-green-100 text-green-700'
                                : 'border border-gray-200 text-gray-600 hover:bg-green-50 hover:text-green-700'
                            }`}>
                            {passingId === record.student.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {passedIds.has(record.student.id) ? (lang === 'ar' ? 'اجتاز' : 'Passed') : (lang === 'ar' ? 'اجتياز' : 'Pass')}
                          </button>
                        )}
                      </div>
                      {/* Row 2: Behavior / Participation / Liturgy */}
                      <div className="flex flex-wrap items-center gap-4 mt-1.5">
                        {/* Behavior 0-5 */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{lang === 'ar' ? 'السلوك' : 'Behavior'}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(v => {
                              const filled = b >= v
                              if (isCompleted) {
                                return (
                                  <div key={v} className={`h-7 w-7 rounded-full ${filled ? 'bg-emerald-500' : 'bg-gray-100 border border-gray-200'}`} title={`${v}/5`} />
                                )
                              }
                              return (
<button key={v} onClick={() => setTempBehavior({ ...tempBehavior, [record.student.id]: filled && b === v ? 0 : v })}
                                  className={`h-7 w-7 rounded-full transition-all ${filled ? 'bg-emerald-500 shadow-sm shadow-emerald-200' : 'bg-gray-100 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'}`} title={`${v}/5`} aria-label={lang === 'ar' ? `السلوك ${v} من 5` : `Behavior ${v} of 5`} aria-pressed={filled} />
                              )
                            })}
                          </div>
                        </div>
                        {/* Participation 0-5 */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{lang === 'ar' ? 'المشاركة' : 'Participation'}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(v => {
                              const filled = p >= v
                              if (isCompleted) {
                                return (
                                  <div key={v} className={`h-7 w-7 rounded-full ${filled ? 'bg-blue-500' : 'bg-gray-100 border border-gray-200'}`} title={`${v}/5`} />
                                )
                              }
                              return (
<button key={v} onClick={() => setTempParticipation({ ...tempParticipation, [record.student.id]: filled && p === v ? 0 : v })}
                                  className={`h-7 w-7 rounded-full transition-all ${filled ? 'bg-blue-500 shadow-sm shadow-blue-200' : 'bg-gray-100 border border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`} title={`${v}/5`} aria-label={lang === 'ar' ? `المشاركة ${v} من 5` : `Participation ${v} of 5`} aria-pressed={filled} />
                              )
                            })}
                          </div>
                        </div>
                        {/* Attended Liturgy */}
                        {isCompleted ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`h-5 w-5 rounded border flex items-center justify-center ${lit ? 'bg-blue-500 border-gold-500' : 'bg-gray-100 border-gray-200'}`}>
                              {lit && <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className={`text-xs font-medium ${lit ? 'text-blue-700' : 'text-gray-500'}`}>{lang === 'ar' ? 'القداس' : 'Liturgy'}</span>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="checkbox" checked={lit} onChange={e => setTempLiturgy({ ...tempLiturgy, [record.student.id]: e.target.checked })}
                              className="h-5 w-5 rounded border-gray-300 text-gold-700 focus:ring-blue-500" />
                            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{lang === 'ar' ? 'القداس' : 'Liturgy'}</span>
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Save / Re-open */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
                {isCompleted ? (
                  <Button onClick={handleReopenAttendance} disabled={marking}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                    {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    {lang === 'ar' ? 'إعادة فتح الحضور' : 'Re-open Attendance'}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => handleSaveAttendance(false)} disabled={marking}
                      className="flex-1 border-gold-500 text-blue-700 hover:bg-blue-50">
                      {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {lang === 'ar' ? 'حفظ الحضور' : 'Save Attendance'}
                    </Button>
                    <Button onClick={() => handleSaveAttendance(true)} disabled={marking}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {lang === 'ar' ? 'إنهاء الفصل' : 'End Class'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && selectedSession && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(false)}>
              <div role="dialog" aria-modal="true" aria-labelledby="delete-session-title" className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
                <h3 id="delete-session-title" className="font-semibold text-gray-900 mb-2">{lang === 'ar' ? 'حذف الجلسة' : 'Delete Session'}</h3>
                <p className="text-sm text-gray-500 mb-6">{lang === 'ar' ? 'هل أنت متأكد من حذف هذه الجلسة؟ سيتم أيضًا إزالة سجلات الحضور.' : 'Are you sure you want to delete this session? Attendance records will also be removed.'}</p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}
                    >{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
                  <Button variant="destructive" onClick={handleDeleteSession} disabled={deleting}
                    >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {lang === 'ar' ? 'حذف' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {tab === 'stats' && (
        <div role="tabpanel" id="panel-stats" aria-labelledby="tab-stats" className="space-y-6">
          {levelStats.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{lang === 'ar' ? 'الحضور حسب المستوى' : 'Attendance by Grade'}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {levelStats.map(ls => (
                  <div key={ls.levelId} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">L{ls.levelNumber}</div>
                      <span className="text-2xl font-bold text-gray-900">{ls.attendanceRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 mb-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${ls.attendanceRate}%` }} />
                    </div>
                    <div className="text-xs text-gray-500">{ls.totalSessions} {lang === 'ar' ? 'جلسة مكتملة' : 'sessions completed'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {groupStats.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{lang === 'ar' ? 'الحضور حسب المجموعة' : 'Attendance by Group'}</h3>
              <div className="overflow-x-auto table-to-cards">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-start text-xs text-gray-500">
                      <th className="pb-2 font-medium">{lang === 'ar' ? 'المجموعة' : 'Group'}</th>
                      <th className="pb-2 font-medium">{lang === 'ar' ? 'المستوى' : 'Level'}</th>
                      <th className="pb-2 font-medium text-end">{lang === 'ar' ? 'الجلسات' : 'Sessions'}</th>
                      <th className="pb-2 font-medium text-end">{lang === 'ar' ? 'السجلات' : 'Records'}</th>
                      <th className="pb-2 font-medium text-end">{lang === 'ar' ? 'النسبة' : 'Rate'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groupStats.map(g => (
                      <tr key={g.groupId} className="hover:bg-gray-50 active:bg-gray-100">
                        <td data-label="Group" className="py-2.5 font-medium text-gray-900">{g.groupName}</td>
                        <td data-label="Level" className="py-2.5 text-gray-500">{lang === 'ar' ? `المستوى ${g.levelNumber}` : `Level ${g.levelNumber}`}</td>
                        <td data-label="Sessions" className="py-2.5 text-end text-gray-700">{g.totalSessions}</td>
                        <td data-label="Records" className="py-2.5 text-end text-gray-700">{g.totalRecords}</td>
                        <td data-label="Rate" className="py-2.5 text-end">
                          <span className={`font-semibold ${g.attendanceRate >= 75 ? 'text-green-600' : g.attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {g.attendanceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {stats && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{lang === 'ar' ? 'التوزيع العام' : 'Overall Distribution'}</h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: lang === 'ar' ? 'حاضر' : 'Present', count: stats.presentCount, color: 'bg-green-500', pct: stats.totalRecords > 0 ? Math.round((stats.presentCount / stats.totalRecords) * 100) : 0 },
                  { label: lang === 'ar' ? 'متأخر' : 'Late', count: stats.lateCount, color: 'bg-amber-500', pct: stats.totalRecords > 0 ? Math.round((stats.lateCount / stats.totalRecords) * 100) : 0 },
                  { label: lang === 'ar' ? 'غائب' : 'Absent', count: stats.absentCount, color: 'bg-red-500', pct: stats.totalRecords > 0 ? Math.round((stats.absentCount / stats.totalRecords) * 100) : 0 },
                  { label: lang === 'ar' ? 'معذور' : 'Excused', count: stats.excusedCount, color: 'bg-gray-400', pct: stats.totalRecords > 0 ? Math.round((stats.excusedCount / stats.totalRecords) * 100) : 0 },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <div className={`w-full h-3 rounded-full bg-gray-100`}>
                        <div className={`h-3 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{item.count}</div>
                    <div className="text-xs text-gray-500">{item.label} ({item.pct}%)</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* By Student Tab */}
      {tab === 'students' && (
        <div role="tabpanel" id="panel-students" aria-labelledby="tab-students" className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'سجل حضور الطلاب' : 'Student Attendance History'}</h2>
            <p className="text-xs text-gray-500">{lang === 'ar' ? 'عرض سجلات الحضور للطلاب بشكل فردي' : 'View attendance records for individual students'}</p>
          </div>
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') document.getElementById('search-student-btn')?.click() }}
                placeholder={lang === 'ar' ? 'بحث بالاسم أو الكود...' : 'Search by name, code...'} className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 focus:border-gold-500 focus:outline-none" />
              <Button id="search-student-btn" onClick={async () => {
                if (!searchQuery.trim()) return
                setSearching(true)
                try {
                  const data = await http.get('/attendance/student-search', { q: searchQuery.trim(), schoolId })
                  setStudentResults(data as any)
                } catch (e) { console.error(e) }
                setSearching(false)
              }} aria-label={lang === 'ar' ? 'بحث عن طالب' : 'Search student'} className="px-4" disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {studentResults.length > 0 && (
            <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
              {studentResults.map(({ student, records }) => (
                <div key={student.id} className="px-5 py-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    {student.firstName} {student.lastName}
                    {student.firstNameAr && <span className="text-gray-500 ms-2">{student.firstNameAr} {student.lastNameAr}</span>}
                    <span className="text-gray-500 ms-2 text-xs">({student.studentCode})</span>
                  </div>
                  {records.length === 0 ? (
                    <p className="text-xs text-gray-500">{lang === 'ar' ? 'لم يتم العثور على سجلات حضور' : 'No attendance records found'}</p>
                  ) : (
                    <div className="space-y-1">
                      {records.map(r => (
                        <div key={r.id} className="flex items-center gap-2 text-sm">
                          <Badge variant={r.status === 'present' ? 'success' : r.status === 'late' ? 'warning' : r.status === 'absent' ? 'danger' : 'default'}>
                            {r.status === 'present' ? (lang === 'ar' ? 'حاضر' : 'Present') : r.status === 'late' ? (lang === 'ar' ? 'متأخر' : 'Late') : r.status === 'absent' ? (lang === 'ar' ? 'غائب' : 'Absent') : r.status === 'excused' ? (lang === 'ar' ? 'معذور' : 'Excused') : r.status}
                          </Badge>
                          <span className="text-gray-600">
                            L{r.attendanceSession?.level?.number} &bull; {new Date(r.recordedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                          {r.behavior != null && r.behavior > 0 && (
                            <span className="text-xs text-emerald-600">Beh:{r.behavior}/5</span>
                          )}
                          {r.participation != null && r.participation > 0 && (
                            <span className="text-xs text-blue-600">Part:{r.participation}/5</span>
                          )}
                          {r.attendedLiturgy && (
                            <span className="text-xs text-blue-700">{lang === 'ar' ? 'قداس' : 'Liturgy'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {studentResults.length === 0 && searchQuery && !searching && (
            <EmptyState size="sm" title={lang === 'ar' ? `لا توجد نتائج مطابقة "${searchQuery}"` : `No students found matching "${searchQuery}"`} />
          )}
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowEditModal(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-session-title" className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 id="edit-session-title" className="font-semibold text-gray-900">{lang === 'ar' ? 'تعديل الجلسة' : 'Edit Session'}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowEditModal(false)} aria-label={lang === 'ar' ? 'إغلاق' : 'Close dialog'} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></Button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المستوى' : 'Level'}</label>
                    <select value={editForm.levelId} onChange={e => setEditForm({ ...editForm, levelId: e.target.value })}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none">
                      {levels.map(l => <option key={l.id} value={l.id}>{lang === 'ar' ? `المستوى ${l.number}` : `Level ${l.number}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المجموعة' : 'Group'}</label>
                  <select value={editForm.groupId} onChange={e => setEditForm({ ...editForm, groupId: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none">
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
                    <DatePicker value={editForm.scheduledDate} onChange={v => setEditForm({ ...editForm, scheduledDate: v })}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الوقت' : 'Time'}</label>
                  <input type="time" value={editForm.scheduledTime} onChange={e => setEditForm({ ...editForm, scheduledTime: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الحالة' : 'Status'}</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none">
                  <option value="scheduled">{lang === 'ar' ? 'مجدول' : 'Scheduled'}</option><option value="in_progress">{lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</option>
                  <option value="completed">{lang === 'ar' ? 'مكتمل' : 'Completed'}</option><option value="cancelled">{lang === 'ar' ? 'ملغي' : 'Cancelled'}</option>
                  <option value="postponed">{lang === 'ar' ? 'مؤجل' : 'Postponed'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleEditSession} disabled={saving}
                >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCreateModal(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-session-title" className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 id="create-session-title" className="font-semibold text-gray-900">{lang === 'ar' ? 'جلسة حضور جديدة' : 'New Attendance Session'}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)} aria-label={lang === 'ar' ? 'إغلاق' : 'Close dialog'} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></Button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المستوى *' : 'Level *'}</label>
                    <select value={createForm.levelId} onChange={e => setCreateForm({ ...createForm, levelId: e.target.value, groupId: '' })}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none">
                      <option value="">{lang === 'ar' ? 'اختر المستوى...' : 'Select level...'}</option>
                      {levels.map(l => <option key={l.id} value={l.id}>{lang === 'ar' ? `المستوى ${l.number}` : `Level ${l.number}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'المجموعة *' : 'Group *'}</label>
                    <select value={createForm.groupId} onChange={e => setCreateForm({ ...createForm, groupId: e.target.value })}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none">
                      <option value="">{lang === 'ar' ? 'اختر المجموعة...' : 'Select group...'}</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'التاريخ *' : 'Date *'}</label>
                    <DatePicker value={createForm.scheduledDate} onChange={v => setCreateForm({ ...createForm, scheduledDate: v })}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الوقت' : 'Time'}</label>
                  <input type="time" value={createForm.scheduledTime} onChange={e => setCreateForm({ ...createForm, scheduledTime: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'الحالة' : 'Status'}</label>
                <select value={createForm.status} onChange={e => setCreateForm({ ...createForm, status: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none">
                  <option value="scheduled">{lang === 'ar' ? 'مجدول' : 'Scheduled'}</option><option value="in_progress">{lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</option>
                  <option value="completed">{lang === 'ar' ? 'مكتمل' : 'Completed'}</option><option value="cancelled">{lang === 'ar' ? 'ملغي' : 'Cancelled'}</option>
                  <option value="postponed">{lang === 'ar' ? 'مؤجل' : 'Postponed'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                <textarea value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} rows={2}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleCreateSession} disabled={saving}
                >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{lang === 'ar' ? 'إنشاء جلسة' : 'Create Session'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showGenerateConfirm}
        onClose={() => setShowGenerateConfirm(false)}
        onConfirm={handleGenerateSessions}
        title={lang === 'ar' ? 'إنشاء الجلسات' : 'Generate Sessions'}
        message={lang === 'ar' ? 'هل تريد إنشاء جلسات حضور لجميع الأيام النشطة؟ سيتم إنشاء جلسات لكل مستوى ومجموعة في كل يوم نشط لا توجد فيه جلسة بعد.' : 'Generate attendance sessions for all active days? This will create sessions for every level and group on each active day where no session exists yet.'}
        confirmLabel={lang === 'ar' ? 'إنشاء' : 'Generate'}
        cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="warning"
        loading={generating}
      />
    </div>
  )
}

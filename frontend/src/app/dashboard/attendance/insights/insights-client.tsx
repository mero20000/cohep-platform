'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/use-language'
import {
  Calendar, Clock, Search, Loader2, ChevronLeft, ChevronRight,
  BarChart3, Users, UserCheck, UserX, ChevronDown, ChevronUp, Ban,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface Stats {
  totalSessions: number; completedSessions: number; scheduledSessions: number; inProgressSessions: number; cancelledSessions?: number;
  totalRecords: number; presentCount: number; lateCount: number; absentCount: number; excusedCount: number;
  averageAttendanceRate: number; unmarkedCount?: number; distinctStudents?: number;
}
interface LevelStat { levelId: string | null; levelNumber: number | null; levelName: string | null; totalSessions: number; attendanceRate: number }
interface GroupStat { groupId: string; groupName: string; levels: { number: number; name: string }[]; totalSessions: number; totalRecords: number; attendanceRate: number }
interface Absentee { studentId: string; studentCode: string; name: string; nameAr?: string | null; absences: number; lastAbsence: string; groupName: string | null }
interface DrillSession { id: string; scheduledDate: string; status: string; servant?: { firstName: string; lastName: string }; summary?: { present: number; absent: number; late: number; excused: number; total: number } }
interface StudentResult {
  student: { id: string; studentCode: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string };
  records: { id: string; status: string; recordedAt: string; homeworkStatus?: string; behavior?: number; participation?: number; attendedLiturgy?: boolean; attendanceSession?: { scheduledDate?: string; notes?: string | null; level?: { number?: number } | null } }[];
}

// Monday-Sunday week containing `now + offset*7 days`, matching the
// backend's inclusive from/to scheduledDate range (YYYY-MM-DD).
function weekRange(offset: number) {
  const now = new Date()
  const day = now.getDay() // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() + diffToMonday + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(monday), to: fmt(sunday), monday, sunday }
}

export function InsightsClient() {
  const { toast } = useToast()
  const lang = useLanguage() as 'en' | 'ar'
  const [weekOffset, setWeekOffset] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [levelStats, setLevelStats] = useState<LevelStat[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])
  const [absentees, setAbsentees] = useState<Absentee[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAbsentees, setShowAbsentees] = useState(false)
  const [drillKey, setDrillKey] = useState<string | null>(null)
  const [drillSessions, setDrillSessions] = useState<DrillSession[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schoolId = getSchoolId()
  const { from, to, monday, sunday } = weekRange(weekOffset)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [statsData, levelData, groupData, absenteeData, enrolledData] = await Promise.all([
        http.get<Stats>('/attendance/stats', { schoolId, from, to }),
        http.get<LevelStat[]>('/attendance/level-stats', { schoolId, from, to }),
        http.get<GroupStat[]>('/attendance/group-stats', { schoolId, from, to }),
        http.get<Absentee[]>('/attendance/top-absentees', { schoolId, from, to }),
        http.get<{ enrolledStudents: number }>('/attendance/enrolled-count', { schoolId }),
      ])
      setStats(statsData)
      setLevelStats(levelData || [])
      setGroupStats(groupData || [])
      setAbsentees((absenteeData as any) || [])
      setEnrolledStudents((enrolledData as any)?.enrolledStudents ?? null)
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load statistics')
      toast('error', lang === 'ar' ? 'فشل تحميل الإحصائيات' : 'Failed to load statistics', e?.message || '')
    }
    setLoading(false)
  }, [schoolId, from, to, toast, lang])

  useEffect(() => { fetchStats() }, [fetchStats])
  // Collapse open drill-downs whenever the selected week changes — they'd
  // otherwise keep showing last week's sessions under this week's header.
  useEffect(() => { setDrillKey(null); setShowAbsentees(false) }, [weekOffset])

  const runStudentSearch = useCallback(async (query: string) => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      const data = await http.get<StudentResult[]>('/attendance/student-search', { q, schoolId })
      setStudentResults((data as StudentResult[]) || [])
      setSearched(true)
    } catch {
      toast('error', lang === 'ar' ? 'فشل البحث' : 'Search failed')
    }
    setSearching(false)
  }, [schoolId, toast, lang])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchQuery.trim()) return
    searchTimer.current = setTimeout(() => { runStudentSearch(searchQuery) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchQuery, runStudentSearch])

  const toggleDrill = async (key: string, filter: { levelId?: string; groupId?: string }) => {
    if (drillKey === key) { setDrillKey(null); return }
    setDrillKey(key)
    setDrillLoading(true)
    try {
      const res = await http.get<{ data: DrillSession[] }>('/attendance/sessions', {
        schoolId, from, to, status: 'completed', limit: '50', ...filter,
      })
      setDrillSessions((res as any)?.data || [])
    } catch {
      setDrillSessions([])
    }
    setDrillLoading(false)
  }

  const weekLabel = (() => {
    const fmt = (d: Date) => d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })
    const prefix = weekOffset === 0 ? (lang === 'ar' ? 'هذا الأسبوع · ' : 'This week · ') : ''
    return `${prefix}${fmt(monday)} – ${fmt(sunday)}`
  })()

  if (loading && !stats && !loadError) {
    return <div className="h-96 px-4 py-6"><TableSkeleton rows={6} cols={4} /></div>
  }

  if (loadError && !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'الإحصائيات' : 'Insights'}</h1>
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'إحصائيات الحضور وسجل الطلاب' : 'Attendance statistics and student history'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title={lang === 'ar' ? 'فشل تحميل الإحصائيات' : 'Failed to load statistics'}
            description={loadError}
            action={<Button onClick={fetchStats} className="min-h-[44px]">{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'الإحصائيات' : 'Insights'}</h1>
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'ملخص أسبوعي للحضور — جاهز للمشاركة' : 'Weekly attendance summary — ready to share'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/dashboard/attendance/mark" className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-white">
            {lang === 'ar' ? 'تسجيل الحضور' : 'Mark'}
          </Link>
          <Link href="/dashboard/attendance/sessions" className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-white">
            {lang === 'ar' ? 'إدارة الجلسات' : 'Sessions'}
          </Link>
        </div>
      </div>

      {/* Week selector — Insights now reports a selected week, not a lifetime
          cumulative total (which is why "Present" could exceed enrollment). */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w - 1)} aria-label={lang === 'ar' ? 'الأسبوع السابق' : 'Previous week'}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <Calendar className="h-4 w-4 text-gray-400" />
          {weekLabel}
          {weekOffset !== 0 && (
            <button type="button" onClick={() => setWeekOffset(0)} className="rounded text-xs text-blue-700 underline hover:text-blue-900">
              {lang === 'ar' ? 'العودة لهذا الأسبوع' : 'Jump to this week'}
            </button>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0} aria-label={lang === 'ar' ? 'الأسبوع القادم' : 'Next week'}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Stat Cards — scoped to the selected week */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stats && (
          <>
            <StatCard label={lang === 'ar' ? 'نسبة الحضور' : 'Attendance Rate'} value={`${stats.averageAttendanceRate}%`} icon={BarChart3}
              subtitle={`${stats.completedSessions} ${lang === 'ar' ? 'جلسة مكتملة' : 'sessions held'}`} />
            <StatCard label={lang === 'ar' ? 'طلاب حضروا' : 'Students Attended'} value={stats.distinctStudents ?? '—'} icon={Users}
              subtitle={enrolledStudents != null ? `${lang === 'ar' ? 'من أصل' : 'of'} ${enrolledStudents} ${lang === 'ar' ? 'مسجل' : 'enrolled'}` : undefined} />
            <StatCard label={lang === 'ar' ? 'حاضر' : 'Present'} value={stats.presentCount} icon={UserCheck}
              iconColor="text-green-600" iconBg="bg-green-50"
              subtitle={stats.totalRecords > 0 ? `${Math.round((stats.presentCount / stats.totalRecords) * 100)}%` : '0%'} />
            <StatCard label={lang === 'ar' ? 'متأخر' : 'Late'} value={stats.lateCount} icon={Clock}
              iconColor="text-amber-600" iconBg="bg-amber-50"
              subtitle={stats.totalRecords > 0 ? `${Math.round((stats.lateCount / stats.totalRecords) * 100)}%` : '0%'} />
            <button type="button" onClick={() => setShowAbsentees(v => !v)} className="text-start">
              <StatCard label={lang === 'ar' ? 'غائب' : 'Absent'} value={stats.absentCount} icon={UserX}
                iconColor="text-red-600" iconBg="bg-red-50"
                subtitle={stats.totalRecords > 0 ? `${Math.round((stats.absentCount / stats.totalRecords) * 100)}% · ${lang === 'ar' ? 'عرض التفاصيل' : 'view details'}` : '0%'} />
            </button>
            <StatCard label={lang === 'ar' ? 'جلسات ملغاة' : 'Cancelled Sessions'} value={stats.cancelledSessions ?? 0} icon={Ban}
              iconColor="text-gray-500" iconBg="bg-gray-100" />
          </>
        )}
      </div>

      {/* Absentee drill-down behind the Absent card */}
      {showAbsentees && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-1">{lang === 'ar' ? 'الغائبون هذا الأسبوع' : 'Absent this week'}</h3>
          <p className="text-xs text-gray-500 mb-4">{lang === 'ar' ? 'مرتبون حسب عدد مرات الغياب خلال الفترة المحددة' : 'Sorted by number of absences in the selected range'}</p>
          {absentees.length === 0 ? (
            <p className="text-sm text-gray-400">{lang === 'ar' ? 'لا يوجد غياب مسجل في هذا الأسبوع' : 'No absences recorded this week'}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {absentees.map(a => (
                <div key={a.studentId} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/dashboard/students?studentId=${a.studentId}`} className="font-medium text-gray-900 hover:text-blue-700 hover:underline">
                    {a.name}{a.nameAr ? ` · ${a.nameAr}` : ''}
                  </Link>
                  <div className="flex items-center gap-2 text-gray-500">
                    {a.groupName && <span>{a.groupName}</span>}
                    <Badge variant="danger">{a.absences}×</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance by Level — click a row to see the sessions behind the rate */}
      {levelStats.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{lang === 'ar' ? 'الحضور حسب المستوى' : 'Attendance by Level'}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levelStats.filter(ls => ls.totalSessions > 0).map(ls => {
              const key = `level-${ls.levelId ?? 'none'}`
              return (
                <div key={key}>
                  <button type="button" onClick={() => toggleDrill(key, ls.levelId ? { levelId: ls.levelId } : {})}
                    className="w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-start hover:border-gray-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">{ls.levelNumber != null ? `L${ls.levelNumber}` : '—'}</div>
                      <span className="text-2xl font-bold text-gray-900">{ls.attendanceRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 mb-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${ls.attendanceRate}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{ls.levelName ?? (lang === 'ar' ? 'بدون مستوى' : 'No level')} • {ls.totalSessions} {lang === 'ar' ? 'جلسة مكتملة' : 'sessions held'}</span>
                      {drillKey === key ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                    </div>
                  </button>
                  {drillKey === key && (
                    <DrillPanel loading={drillLoading} sessions={drillSessions} lang={lang} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Attendance by Group — click a row to see the sessions behind the rate */}
      {groupStats.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{lang === 'ar' ? 'الحضور حسب المجموعة' : 'Attendance by Group'}</h3>
          <div className="overflow-x-auto table-to-cards">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-start text-xs text-gray-500">
                  <th className="pb-2 font-medium">{lang === 'ar' ? 'المجموعة' : 'Group'}</th>
                  <th className="pb-2 font-medium">{lang === 'ar' ? 'المستويات' : 'Levels'}</th>
                  <th className="pb-2 font-medium text-end">{lang === 'ar' ? 'الجلسات' : 'Sessions'}</th>
                  <th className="pb-2 font-medium text-end">{lang === 'ar' ? 'السجلات' : 'Records'}</th>
                  <th className="pb-2 font-medium text-end">{lang === 'ar' ? 'النسبة' : 'Rate'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {groupStats.filter(g => g.totalSessions > 0).map(g => (
                  <Fragment key={g.groupId}>
                    <tr className="cursor-pointer hover:bg-gray-50 active:bg-gray-100" onClick={() => toggleDrill(`group-${g.groupId}`, { groupId: g.groupId })}>
                      <td data-label="Group" className="py-2.5 font-medium text-gray-900">{g.groupName}</td>
                      <td data-label="Levels" className="py-2.5 text-gray-500">{g.levels?.length ? g.levels.map(l => `L${l.number}`).join(', ') : '—'}</td>
                      <td data-label="Sessions" className="py-2.5 text-end text-gray-700">{g.totalSessions}</td>
                      <td data-label="Records" className="py-2.5 text-end text-gray-700">{g.totalRecords}</td>
                      <td data-label="Rate" className="py-2.5 text-end">
                        <span className={`font-semibold ${g.attendanceRate >= 75 ? 'text-green-600' : g.attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {g.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                    {drillKey === `group-${g.groupId}` && (
                      <tr>
                        <td colSpan={5} className="pb-3">
                          <DrillPanel loading={drillLoading} sessions={drillSessions} lang={lang} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overall Distribution */}
      {stats && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{lang === 'ar' ? 'التوزيع العام' : 'Overall Distribution'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: lang === 'ar' ? 'حاضر' : 'Present', count: stats.presentCount, color: 'bg-green-500', pct: stats.totalRecords > 0 ? Math.round((stats.presentCount / stats.totalRecords) * 100) : 0 },
              { label: lang === 'ar' ? 'متأخر' : 'Late', count: stats.lateCount, color: 'bg-amber-500', pct: stats.totalRecords > 0 ? Math.round((stats.lateCount / stats.totalRecords) * 100) : 0 },
              { label: lang === 'ar' ? 'غائب' : 'Absent', count: stats.absentCount, color: 'bg-red-500', pct: stats.totalRecords > 0 ? Math.round((stats.absentCount / stats.totalRecords) * 100) : 0 },
              { label: lang === 'ar' ? 'معذور' : 'Excused', count: stats.excusedCount, color: 'bg-gray-400', pct: stats.totalRecords > 0 ? Math.round((stats.excusedCount / stats.totalRecords) * 100) : 0 },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-full h-3 rounded-full bg-gray-100">
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

      {/* By Student */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4" />{lang === 'ar' ? 'سجل حضور الطلاب' : 'Student Attendance History'}</h2>
          <p className="text-xs text-gray-500">{lang === 'ar' ? 'عرض سجلات الحضور للطلاب بشكل فردي' : 'View attendance records for individual students'}</p>
        </div>
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runStudentSearch(searchQuery) }}
              placeholder={lang === 'ar' ? 'بحث بالاسم أو الكود...' : 'Search by name, code...'}
              aria-label={lang === 'ar' ? 'بحث عن طالب' : 'Search student'}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 focus:border-gold-500 focus:outline-none" />
            <Button id="search-student-btn" onClick={() => runStudentSearch(searchQuery)} aria-label={lang === 'ar' ? 'بحث عن طالب' : 'Search student'} className="px-4" disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {studentResults.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
            {studentResults.map(({ student, records }) => (
              <div key={student.id} className="px-5 py-3">
                <div className="text-sm font-medium text-gray-900 mb-2">
                  <Link href={`/dashboard/students?studentId=${student.id}`} className="hover:text-blue-700 hover:underline" title={lang === 'ar' ? 'فتح سجل الطالب' : 'Open student record'}>
                    {student.firstName} {student.lastName}
                  </Link>
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
                          {r.status === 'present' ? (lang === 'ar' ? 'حاضر' : 'Present') : r.status === 'late' ? (lang === 'ar' ? 'متأخر' : 'Late') : r.status === 'absent' ? (lang === 'ar' ? 'غائب' : 'Absent') : r.status === 'excused' ? (lang === 'ar' ? 'معذور' : 'Excused') : r.status === 'cancelled' ? (lang === 'ar' ? 'ملغاة' : 'Cancelled') : r.status}
                        </Badge>
                        <span className="text-gray-600">
                          {r.attendanceSession?.notes === 'liturgy'
                            ? (lang === 'ar' ? 'قداس' : 'Liturgy')
                            : r.attendanceSession?.level?.number != null ? `L${r.attendanceSession.level.number}` : '—'}
                          {' '}&bull; {new Date(r.attendanceSession?.scheduledDate ?? r.recordedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        {r.behavior != null && r.behavior > 0 && (
                          <span className="text-xs text-emerald-600">{lang === 'ar' ? `سلوك:${r.behavior}/5` : `Beh:${r.behavior}/5`}</span>
                        )}
                        {r.participation != null && r.participation > 0 && (
                          <span className="text-xs text-blue-600">{lang === 'ar' ? `مشاركة:${r.participation}/5` : `Part:${r.participation}/5`}</span>
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
        {studentResults.length === 0 && searched && !searching && (
          <EmptyState size="sm" title={lang === 'ar' ? `لا توجد نتائج مطابقة "${searchQuery}"` : `No students found matching "${searchQuery}"`} />
        )}
      </div>
    </div>
  )
}

function DrillPanel({ loading, sessions, lang }: { loading: boolean; sessions: DrillSession[]; lang: 'en' | 'ar' }) {
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
      {loading ? (
        <p className="text-xs text-gray-500">{lang === 'ar' ? 'جارٍ التحميل...' : 'Loading…'}</p>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-gray-500">{lang === 'ar' ? 'لا توجد جلسات مكتملة في هذه الفترة' : 'No completed sessions in this range'}</p>
      ) : (
        <div className="space-y-1.5">
          {sessions.map(s => (
            <Link key={s.id} href={`/dashboard/attendance/mark?sessionId=${s.id}`}
              className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-white">
              <span className="text-gray-700">
                {new Date(s.scheduledDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                {s.servant && ` · ${s.servant.firstName} ${s.servant.lastName}`}
              </span>
              {s.summary && (
                <span className="text-gray-500">
                  {s.summary.present + s.summary.late}/{s.summary.total} {lang === 'ar' ? 'حاضر' : 'present'}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

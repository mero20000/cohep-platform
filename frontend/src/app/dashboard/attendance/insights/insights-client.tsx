'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/use-language'
import {
  Calendar, Clock, Search, Loader2,
  FileText, BarChart3, Users, UserCheck, UserX,
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
  totalSessions: number; completedSessions: number; scheduledSessions: number; inProgressSessions: number;
  totalRecords: number; presentCount: number; lateCount: number; absentCount: number; excusedCount: number;
  averageAttendanceRate: number;
}
interface LevelStat { levelId: string; levelNumber: number; levelName: string; totalSessions: number; attendanceRate: number }
interface GroupStat { groupId: string; groupName: string; levelNumber: number; levelName: string; totalSessions: number; totalRecords: number; attendanceRate: number }
interface StudentResult {
  student: { id: string; studentCode: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string };
  records: { id: string; status: string; recordedAt: string; homeworkStatus?: string; behavior?: number; participation?: number; attendedLiturgy?: boolean; attendanceSession?: { level?: { number?: number } } }[];
}

export function InsightsClient() {
  const { toast } = useToast()
  const lang = useLanguage() as 'en' | 'ar'
  const [stats, setStats] = useState<Stats | null>(null)
  const [levelStats, setLevelStats] = useState<LevelStat[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schoolId = getSchoolId()

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [statsData, levelData, groupData] = await Promise.all([
        http.get<Stats>('/attendance/stats', { schoolId }),
        http.get<LevelStat[]>('/attendance/level-stats', { schoolId }),
        http.get<GroupStat[]>('/attendance/group-stats', { schoolId }),
      ])
      setStats(statsData)
      setLevelStats(levelData || [])
      setGroupStats(groupData || [])
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load statistics')
      toast('error', lang === 'ar' ? 'فشل تحميل الإحصائيات' : 'Failed to load statistics', e?.message || '')
    }
    setLoading(false)
  }, [schoolId, toast, lang])

  useEffect(() => { fetchStats() }, [fetchStats])

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
            action={<Button onClick={fetchStats}>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>}
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
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'إحصائيات الحضور وسجل الطلاب' : 'Attendance statistics and student history'}</p>
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

      {/* Stat Cards */}
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

      {/* Attendance by Level */}
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

      {/* Attendance by Group */}
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
              placeholder={lang === 'ar' ? 'بحث بالاسم أو الكود...' : 'Search by name, code...'} className="rounded-lg border border-gray-300 px-3 py-2 text-sm flex-1 focus:border-gold-500 focus:outline-none" />
            <Button id="search-student-btn" onClick={() => runStudentSearch(searchQuery)} aria-label={lang === 'ar' ? 'بحث عن طالب' : 'Search student'} className="px-4" disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {studentResults.length > 0 && (
          <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
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
        {studentResults.length === 0 && searched && !searching && (
          <EmptyState size="sm" title={lang === 'ar' ? `لا توجد نتائج مطابقة "${searchQuery}"` : `No students found matching "${searchQuery}"`} />
        )}
      </div>
    </div>
  )
}

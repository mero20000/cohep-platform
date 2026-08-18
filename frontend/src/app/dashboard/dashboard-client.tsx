'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLanguage } from '@/lib/use-language'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Users, BookOpen, Calendar, Trophy, Layers, ClipboardCheck,
  TrendingUp, Clock, Loader2, UserCheck,
  Award, ChevronRight, Sparkles, Sun, Target, BarChart3,
  ArrowUpRight, Zap, GraduationCap, Star,
   CalendarPlus, User, Shield, Crown, Heart, CalendarClock, UserCog,
   ListChecks, Flame, Info, XCircle, Baby, ChevronDown, Church,
   BookMarked, AlertTriangle, CheckCircle, Bell, Moon, PlayCircle, Music, ArrowUp, ArrowDown, Minus, Square
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useToast } from '@/components/ui/toast'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { getGreeting, getGreetingAr, getFullDay } from '@/lib/datetime'
import { useActiveRole, roleCategory } from '@/lib/use-active-role'
import DashboardHero from './hero'
import { PhoneLink } from '@/app/dashboard/students/_components/phone-link'
import { ServantJourneyCard } from '@/components/dashboard/servant-journey-card'
import { useAcademicYearsQuery, useAllAllocationsQuery, useLessonsQuery } from '@/components/curriculum/hooks'
import type { Allocation } from '@/components/curriculum/types'
import { parseISO, isSameDay, startOfDay, startOfWeek, addDays, format } from 'date-fns'
import { enGB, ar } from 'date-fns/locale'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie } from 'recharts'

interface GradeDistItem { grade: string; count: number }
interface StudentsPerLevel { levelName: string; count: number }
interface StudentsByStatus { status: string; count: number }
interface AssessmentStatItem { gradedCount: number; passCount: number; passRate: number; avgGradeScore: number }
interface AssessmentsByStatus { status: string; count: number }
interface RecentGrade { id: string; studentName: string; studentPhotoUrl: string | null; assessmentTitle: string; assessmentId: string; score: number; maxScore: number; passed: boolean; gradedAt: string }

interface DashboardData {
 totalStudents: number; totalLevels: number; totalLessons: number; totalAllocations: number;
 totalChurches: number; totalUsers: number; totalBadges: number; activeStudents: number;
 publishedAssessments: number; totalAssessments: number; attendanceRate: number;
 completedSessions: number; gradeDistribution: GradeDistItem[]; studentsPerLevel: StudentsPerLevel[];
 studentsByStatus: StudentsByStatus[]; studentsWithoutGrade: number;
 assessmentsByStatus: AssessmentsByStatus[]; assessmentStats: AssessmentStatItem;
 recentGrades: RecentGrade[]; recentActivity: ActivityItem[];
 upcomingSessions: UpcomingSession[]; topStudents: TopStudent[]; weeklyStats: WeeklyStat[];
 school: { name: string; nameAr: string; logoUrl: string | null } | null
}

interface ActivityItem { id: string; action: string; entityType: string; createdAt: string; user?: { firstName: string; lastName: string } | null }
interface UpcomingSession { id: string; scheduledDate: string; status: string; level: { name: string; number?: number }; servant: { firstName: string; lastName: string } }
interface TopStudent { rank: number; id: string; firstName: string; lastName: string; photoUrl: string | null; level: number; levelName: string; xp: number; badgeCount: number }
interface WeeklyStat { scheduledDate: string; status: string; _count: { attendanceRecords: number } }

interface PrimaryData {
  stats: DashboardData
  churchLogo: string | null
  churchName: string
}

interface ServantCounts {
 total: number
 servants: number
 groupLeaders: number
 levelLeaders: number
}

const EMPTY_STATS: DashboardData = {
 totalStudents: 0, totalLevels: 0, totalLessons: 0, totalAllocations: 0,
 totalChurches: 0, totalUsers: 0, totalBadges: 0, activeStudents: 0,
 publishedAssessments: 0, totalAssessments: 0, attendanceRate: 0,
 completedSessions: 0, gradeDistribution: [], studentsPerLevel: [],
 studentsByStatus: [], studentsWithoutGrade: 0, assessmentsByStatus: [],
 assessmentStats: { gradedCount: 0, passCount: 0, passRate: 0, avgGradeScore: 0 },
 recentGrades: [], recentActivity: [], upcomingSessions: [], topStudents: [],
 weeklyStats: [], school: null,
}

function formatDate(dateStr: string, locale = 'en-GB') { return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) }
function formatTime(dateStr: string, locale = 'en-GB') { return new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) }
function relativeTime(dateStr: string | null | undefined, locale = 'en') {
 if (!dateStr) return locale === 'ar' ? 'غير معروف' : 'Unknown'
 const diff = Date.now() - new Date(dateStr).getTime()
 if (isNaN(diff)) return locale === 'ar' ? 'غير معروف' : 'Unknown'
 const mins = Math.floor(diff / 60000)
 if (locale === 'ar') {
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} د`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} س`
  const days = Math.floor(hrs / 24)
  return `منذ ${days} ي`
 }
 if (mins < 1) return 'Just now'
 if (mins < 60) return `${mins}m ago`
 const hrs = Math.floor(mins / 60)
 if (hrs < 24) return `${hrs}h ago`
 const days = Math.floor(hrs / 24)
 return `${days}d ago`
}
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
 const [display, setDisplay] = useState(0)
 const raf = useRef<number | null>(null)
 useEffect(() => {
  if (raf.current) cancelAnimationFrame(raf.current)
  const start = performance.now()
  const from = display
  const to = value
  const duration = 800
  function tick(now: number) {
   const elapsed = now - start
   const progress = Math.min(elapsed / duration, 1)
   const eased = 1 - Math.pow(1 - progress, 3)
   setDisplay(Math.round(from + (to - from) * eased))
   if (progress < 1) raf.current = requestAnimationFrame(tick)
  }
  raf.current = requestAnimationFrame(tick)
  return () => { if (raf.current) cancelAnimationFrame(raf.current) }
 }, [value])
 return <>{display}{suffix}</>
}

const QUICK_ACTIONS = [
  { label: 'Add Student', labelAr: 'إضافة طالب', icon: Users, href: '/dashboard/students', color: 'from-gold-500 to-gold-600', shadow: 'shadow-gold-200' },
  { label: 'Manage Servants', labelAr: 'إدارة الخدام', icon: UserCheck, href: '/dashboard/servants', color: 'from-gold-500 to-gold-600', shadow: 'shadow-gold-200' },
  { label: 'New Assessment', labelAr: 'تقييم جديد', icon: ClipboardCheck, href: '/dashboard/assessments', color: 'from-gold-500 to-gold-600', shadow: 'shadow-gold-200' },
  { label: 'Schedule Class', labelAr: 'جدولة فصل', icon: CalendarPlus, href: '/dashboard/curriculum', color: 'from-gold-500 to-gold-600', shadow: 'shadow-gold-200' },
  { label: 'Take Attendance', labelAr: 'تسجيل الحضور', icon: UserCheck, href: '/dashboard/attendance', color: 'from-gold-500 to-gold-600', shadow: 'shadow-gold-200' },
  { label: 'Reports', labelAr: 'التقارير', icon: BarChart3, href: '/dashboard/reports', color: 'from-gold-500 to-gold-600', shadow: 'shadow-gold-200' },
]

const ACTIVITY_ICONS: Record<string, typeof Users> = {
 created: Sparkles, updated: TrendingUp, deleted: Target, graded: Award,
 attended: UserCheck, enrolled: GraduationCap, assigned: Calendar,
}
const ACTIVITY_COLORS: Record<string, string> = {
 created: 'bg-gradient-to-br from-green-100 to-green-50 text-green-600',
 updated: 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600',
 deleted: 'bg-gradient-to-br from-red-100 to-red-50 text-red-600',
 graded: 'bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600',
 attended: 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600',
 enrolled: 'bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600',
 assigned: 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600',
}

const fadeUp = {
 initial: { opacity: 0, y: 24 },
 animate: { opacity: 1, y: 0 },
}

const stagger = {
 animate: { transition: { staggerChildren: 0.06 } },
}

// ── Data fetching helpers ──────────────────────────────────────────

 function fetchPrimaryData(): Promise<PrimaryData> {
  return http.get<DashboardData>(`/dashboard/stats?schoolId=${getSchoolId()}`)
   .then(async (stats) => {
    let churchLogo: string | null = null
    let churchName = ''
    try {
     const school = await http.get<any>('/users/schools/me')
     churchName = school?.church?.name || school?.church?.schoolNameEn || ''
      if (school?.church?.logoUrl) {
       churchLogo = school.church.logoUrl.startsWith('http') ? school.church.logoUrl : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '') + school.church.logoUrl
      }
    } catch {}
    return { stats, churchLogo, churchName }
   })
 }

function fetchServantCounts(): Promise<ServantCounts> {
 const SERVANT_ROLES = ['servant', 'group_leader', 'level_leader']
 return http.get<any[]>('/users', { schoolId: getSchoolId() })
  .then(users => {
   const list = Array.isArray(users) ? users : []
   const servants = list.filter((u: any) => u.userRoles?.some((ur: any) => SERVANT_ROLES.includes(ur.role.name)))
   return {
    total: servants.length,
    servants: servants.filter((u: any) => u.userRoles?.some((ur: any) => ur.role.name === 'servant')).length,
    groupLeaders: servants.filter((u: any) => u.userRoles?.some((ur: any) => ur.role.name === 'group_leader')).length,
    levelLeaders: servants.filter((u: any) => u.userRoles?.some((ur: any) => ur.role.name === 'level_leader')).length,
   }
  })
}

function useAsync<T>(fetcher: () => Promise<T>, deps: React.DependencyList): { data: T | null; loading: boolean; error: boolean } {
 const [data, setData] = useState<T | null>(null)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState(false)
 useEffect(() => {
  let cancelled = false
  setLoading(true)
  setError(false)
  fetcher()
   .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
   .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
  return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, deps)
 return { data, loading, error }
}

// ── Fallback components ────────────────────────────────────────────

function HeroFallback() {
 return (
  <div className="rounded-2xl bg-[var(--hymn-navy)] p-6 sm:p-8 animate-pulse">
   <div className="h-4 w-32 bg-white/10 rounded mb-3" />
   <div className="h-8 w-64 bg-white/10 rounded mb-2" />
   <div className="h-4 w-48 bg-white/10 rounded" />
   <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
    {Array.from({ length: 5 }).map((_, i) => (
     <div key={i} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
      <div className="h-3 w-16 bg-white/10 rounded mb-2" />
      <div className="h-6 w-12 bg-white/10 rounded" />
     </div>
    ))}
   </div>
  </div>
 )
}

function SectionFallback({ height = 'h-48' }: { height?: string }) {
  return (
   <div className={`rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] p-5 ${height}`}>
    <div className="h-4 w-32 bg-gray-200 rounded mb-4 animate-pulse" />
    <div className="space-y-3 animate-pulse">
     <div className="h-3 w-full bg-gray-100 rounded" />
     <div className="h-3 w-3/4 bg-gray-100 rounded" />
     <div className="h-3 w-5/6 bg-gray-100 rounded" />
    </div>
   </div>
  )
}

function ServantSectionFallback() {
 return (
  <div className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)]">
   <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--hymn-border)]">
    <div className="h-5 w-24 bg-gray-200 rounded" />
    <div className="h-3 w-12 bg-gray-200 rounded" />
   </div>
   <div className="flex items-center justify-center py-8">
    <Loader2 className="h-5 w-5 animate-spin text-gold-400" />
   </div>
  </div>
 )
}

// ── Section components ─────────────────────────────────────────────

function HeroSection({ stats, churchLogo, churchName, loading }: { stats: DashboardData | null; churchLogo: string | null; churchName: string; loading: boolean }) {
  const lang = useLanguage()
  if (loading && !stats) return <HeroFallback />
  const s = stats ?? EMPTY_STATS
  const greetingText = lang === 'ar' ? getGreetingAr() : getGreeting()
  const title =
    s.school?.name || (lang === 'ar' ? 'منصة تعليم التراتيل الكنسية' : 'Coptic Orthodox Hymn Education Platform')

  const badges = (
    <>
      {churchName && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
          {churchName}
        </span>
      )}
      <p className="text-gray-400 text-sm">{getFullDay(lang)}</p>
    </>
  )

  const logos = (
    <>
      {churchLogo && (
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
          <Image src={churchLogo} alt="Church Logo" width={100} height={100}
            className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
        </div>
      )}
      {s.school?.logoUrl && (
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
          <Image src={s.school.logoUrl.startsWith('http') ? s.school.logoUrl : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '') + s.school.logoUrl}
            alt="School Logo" width={100} height={100}
            className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
        </div>
      )}
    </>
  )

  const statsGrid = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {([
        { label: 'Active Students', labelAr: 'الطلاب النشطون', value: s.activeStudents ?? 0, icon: Users },
        { label: 'Attendance', labelAr: 'الحضور', value: s.attendanceRate ?? 0, suffix: '%', icon: UserCheck },
        { label: 'Levels', labelAr: 'المستويات', value: s.totalLevels ?? 0, icon: Layers },
        { label: 'Assessments', labelAr: 'التقييمات', value: s.publishedAssessments ?? 0, icon: ClipboardCheck },
        { label: 'Pass Rate', labelAr: 'نسبة النجاح', value: s.assessmentStats?.passRate ?? 0, suffix: '%', icon: TrendingUp },
      ] as const).map((item) => (
        <div key={item.label} className="group rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
          <div className="flex items-center gap-2 mb-1">
            <item.icon className="h-3.5 w-3.5 text-gold-400 group-hover:scale-110 group-active:scale-110 transition-transform duration-300" />
            <span className="text-[11px] text-gray-400">{lang === 'ar' ? (item as any).labelAr : item.label}</span>
          </div>
          <div className="text-xl font-bold text-white tracking-wider group-hover:text-gold-300 transition-colors">
            <AnimatedCounter value={item.value} suffix={'suffix' in item ? (item as any).suffix || '' : ''} />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <DashboardHero
      bg="var(--hymn-navy)"
      title={title}
      greeting={
        <>
          <Sun className="h-4 w-4" />
          <span>{greetingText}</span>
        </>
      }
      badges={badges}
      logos={logos}
    >
      {statsGrid}
    </DashboardHero>
  )
}

function ServantSection({ counts, loading }: { counts: ServantCounts | null; loading: boolean }) {
 const lang = useLanguage()
 if (loading && !counts) return <ServantSectionFallback />
 if (!counts || !counts.total) return null
 const items = [
  { label: 'Servants', labelAr: 'خدام', value: counts.servants, color: 'text-blue-600', bg: 'from-blue-50 to-blue-100', icon: User },
  { label: 'Group Leaders', labelAr: 'قادة مجموعات', value: counts.groupLeaders, color: 'text-amber-600', bg: 'from-amber-50 to-amber-100', icon: Shield },
  { label: 'Level Leaders', labelAr: 'قادة مستويات', value: counts.levelLeaders, color: 'text-purple-600', bg: 'from-purple-50 to-purple-100', icon: Crown },
 ]
 return (
  <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4 bg-[var(--hymn-surface-header)] border-b border-[var(--hymn-border)]">
    <div className="flex items-center gap-2">
     <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
      <Shield className="h-4 w-4" />
     </div>
     <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الخدام' : 'Servants'}</h2>
    </div>
    <Link href="/dashboard/servants" className="text-xs text-blue-700 font-medium hover:text-blue-800 flex items-center gap-0.5 group">
     {lang === 'ar' ? 'إدارة' : 'Manage'} <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
    </Link>
   </div>
   <div className="grid grid-cols-3 divide-x divide-gray-100">
    {items.map((r, i) => (
     <motion.div key={i} whileHover={{ y: -2 }} whileTap={{ y: -1 }} className="px-5 py-4 text-center group">
      <div className={`inline-flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br ${r.bg} ${r.color} mb-2 shadow-sm group-hover:shadow-md group-hover:scale-110 group-active:shadow-md group-active:scale-110 transition-transform duration-300`}>
       <r.icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{r.value}</div>
      <div className="text-xs text-gray-500">{lang === 'ar' ? r.labelAr : r.label}</div>
     </motion.div>
    ))}
   </div>
  </div>
 )
}

function StatsSection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
 const lang = useLanguage()
 if (loading && !stats) return <CardSkeleton count={4} />
 const s = stats ?? EMPTY_STATS
 return (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Dashboard statistics">
   <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} whileTap={{ y: -2 }}>
    <StatCard label={lang === 'ar' ? 'إجمالي الطلاب' : 'Total Students'} value={s.totalStudents ?? 0} icon={Users} iconBg="bg-gradient-to-br from-blue-50 to-blue-100" iconColor="text-blue-600"
     subtitle={lang === 'ar' ? `${s.activeStudents ?? 0} نشط · ${s.studentsByStatus?.find(x => x.status === 'inactive')?.count ?? 0} غير نشط` : `${s.activeStudents ?? 0} active · ${s.studentsByStatus?.find(x => x.status === 'inactive')?.count ?? 0} inactive`} />
   </motion.div>
   <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} whileTap={{ y: -2 }}>
    <StatCard label={lang === 'ar' ? 'الحضور' : 'Attendance'} value={`${s.attendanceRate ?? 0}%`} icon={UserCheck} iconBg="bg-gradient-to-br from-emerald-50 to-emerald-100" iconColor="text-emerald-600"
     subtitle={lang === 'ar' ? `${s.completedSessions ?? 0} جلسة مكتملة` : `${s.completedSessions ?? 0} sessions completed`} />
   </motion.div>
   <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} whileTap={{ y: -2 }}>
    <StatCard label={lang === 'ar' ? 'نسبة النجاح' : 'Pass Rate'} value={`${s.assessmentStats?.passRate ?? 0}%`} icon={TrendingUp} iconBg="bg-gradient-to-br from-purple-50 to-purple-100" iconColor="text-purple-600"
     subtitle={lang === 'ar' ? `${s.assessmentStats?.gradedCount ?? 0} مصحح` : `${s.assessmentStats?.gradedCount ?? 0} graded`} />
   </motion.div>
   <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} whileTap={{ y: -2 }}>
    <StatCard label={lang === 'ar' ? 'الشارات المكتسبة' : 'Badges Earned'} value={s.totalBadges ?? 0} icon={Award} iconBg="bg-gradient-to-br from-amber-50 to-amber-100" iconColor="text-amber-600"
     subtitle={lang === 'ar' ? `عبر ${s.totalLevels ?? 0} مستوى` : `Across ${s.totalLevels ?? 0} levels`} />
   </motion.div>
  </div>
 )
}

function AttendanceChartSection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
  const lang = useLanguage()
  if (loading && !stats) return <SectionFallback />
  const s = stats ?? EMPTY_STATS
  if (!s.weeklyStats?.length) return null

const dayLocale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const dayMap = new Map<string, number>()
  s.weeklyStats.forEach(item => {
    const d = new Date(item.scheduledDate).toLocaleDateString(dayLocale, { weekday: 'short' })
    dayMap.set(d, (dayMap.get(d) || 0) + item._count.attendanceRecords)
  })
  const data = Array.from(dayMap.keys()).map(day => ({ day, count: dayMap.get(day) || 0 }))
  const total = s.weeklyStats.reduce((a, item) => a + item._count.attendanceRecords, 0)
  const completed = s.weeklyStats.filter(item => item.status === 'completed').length

  const GOLD = '#c9a030'
  const BLUE = '#3b82f6'

  return (
    <div className="p-5">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(59,130,246,0.08)' }}
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Bar dataKey="count" name={lang === 'ar' ? 'السجلات' : 'records'} radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i % 2 === 0 ? GOLD : BLUE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
        <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-gold-400" />{lang === 'ar' ? 'إجمالي السجلات:' : 'Total records:'} {total}</span>
        <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{completed} {lang === 'ar' ? 'جلسات' : 'sessions'}</span>
      </div>
    </div>
  )
}

function AnalyticsSection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
  const lang = useLanguage()
  if (loading && !stats) return <SectionFallback />
  const s = stats ?? EMPTY_STATS
  const perLevel = (s.studentsPerLevel ?? []).map(p => ({ name: p.levelName, count: p.count }))
  const gradeDist = (s.gradeDistribution ?? []).map(g => ({ name: g.grade, value: g.count }))
  if (!perLevel.length && !gradeDist.length) return null

  const PALETTE = ['#3b82f6', '#c9a030', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899']

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {perLevel.length > 0 && (
        <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--hymn-border)] bg-[var(--hymn-surface-header)]">
            <h3 className="font-semibold text-gray-900">{lang === 'ar' ? 'الطلاب حسب المستوى' : 'Students per Level'}</h3>
          </div>
          <div className="p-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perLevel} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(59,130,246,0.08)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" name={lang === 'ar' ? 'الطلاب' : 'students'} radius={[8, 8, 0, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {gradeDist.length > 0 && (
        <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--hymn-border)] bg-[var(--hymn-surface-header)]">
            <h3 className="font-semibold text-gray-900">{lang === 'ar' ? 'توزيع الدرجات' : 'Grade Distribution'}</h3>
          </div>
          <div className="p-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gradeDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {gradeDist.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
              {gradeDist.map((g, i) => (
                <span key={g.name} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                  {g.name} ({g.value})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeaderboardSection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
 const lang = useLanguage()
 if (loading && !stats) return <SectionFallback />
 const s = stats ?? EMPTY_STATS
 const topStudents = s.topStudents ?? []
 if (!topStudents.length) return null

 const maxXp = Math.max(...topStudents.map(st => st.xp), 1)

 return (
  <div className="divide-y divide-gray-100">
   {topStudents.slice(0, 5).map((student, i) => {
    const pct = (student.xp / maxXp) * 100
    return (
     <motion.div key={student.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
      className="px-5 py-3.5 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent transition-all duration-300 group">
      <div className="flex items-center gap-3">
       <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-transform duration-300 group-hover:scale-110 ${
        i === 0 ? 'bg-gradient-to-br from-gold-400 via-gold-500 to-gold-600 text-white shadow-lg shadow-blue-200' :
        i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-md' :
        i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md' :
        'bg-gray-100 text-gray-600'
       }`}>
        {i === 0 ? <Crown className="h-4 w-4" /> : i + 1}
       </div>
       <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{student.firstName} {student.lastName}</div>
        <div className="text-xs text-gray-500">{student.levelName || (lang === 'ar' ? `المستوى ${student.level}` : `Level ${student.level}`)} · <Star className="h-3 w-3 inline text-gold-400" /> {student.badgeCount} {lang === 'ar' ? 'شارات' : 'badges'}</div>
       </div>
       <div className="text-right">
        <div className="text-sm font-bold text-gray-900">{student.xp.toLocaleString()}</div>
        <div className="text-[10px] text-gray-400 font-medium">{lang === 'ar' ? 'نقاط' : 'XP'}</div>
       </div>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
       <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ delay: 0.2 + i * 0.05, duration: 0.8, ease: 'easeOut' }}
        className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
        style={{ boxShadow: '0 0 6px rgba(201,160,48,0.4)' }} />
      </div>
     </motion.div>
    )
   })}
  </div>
 )
}

function AssessmentSection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
 const lang = useLanguage()
 if (loading && !stats) return <SectionFallback />
 const s = stats ?? EMPTY_STATS
 return (
  <div className="p-5 space-y-4">
   <div className="flex items-center justify-center gap-8">
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
     className="relative flex items-center justify-center">
     <svg width="120" height="120" viewBox="0 0 110 110" className="-rotate-90">
      <circle cx="55" cy="55" r="45" fill="none" stroke="#f3f4f6" strokeWidth="10" />
      {s.assessmentStats && s.assessmentStats.gradedCount > 0 && (
       <motion.circle
        initial={{ strokeDasharray: '0 282.7' }}
        animate={{ strokeDasharray: `${(s.assessmentStats.passRate / 100) * 282.7} 282.7` }}
        transition={{ delay: 0.4, duration: 1, ease: 'easeOut' }}
        cx="55" cy="55" r="45" fill="none" stroke="url(#goldGradient)" strokeWidth="10"
        strokeLinecap="round" className="drop-shadow-lg" />
      )}
      <defs>
       <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
       </linearGradient>
      </defs>
     </svg>
     <div className="absolute text-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
       className="text-2xl font-bold text-gray-900">{s.assessmentStats?.passRate ?? 0}%</motion.div>
      <div className="text-xs text-gray-500">{lang === 'ar' ? 'ناجح' : 'Pass'}</div>
     </div>
    </motion.div>
    <div className="space-y-3">
     {[
      { color: 'bg-green-500', label: 'Passed', labelAr: 'ناجح', value: s.assessmentStats?.passCount ?? 0 },
      { color: 'bg-red-400', label: 'Failed', labelAr: 'راسب', value: (s.assessmentStats?.gradedCount ?? 0) - (s.assessmentStats?.passCount ?? 0) },
      { color: 'bg-blue-400', label: 'Avg Score', labelAr: 'متوسط الدرجات', value: s.assessmentStats?.avgGradeScore ?? 0 },
     ].map((item) => (
      <div key={item.label} className="flex items-center gap-2">
       <div className={`h-3 w-3 rounded-full ${item.color} shadow-sm ${item.color === 'bg-green-500' ? 'animate-[softPulse_2s_ease-in-out_infinite]' : ''}`} />
       <span className="text-sm text-gray-600">{lang === 'ar' ? item.labelAr : item.label}: <strong className="text-gray-900">{item.value}</strong></span>
      </div>
     ))}
    </div>
   </div>
   {s.assessmentsByStatus?.length > 0 && (
    <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-2">
     {s.assessmentsByStatus.map(st => (
      <div key={st.status} className="rounded-lg bg-[var(--hymn-surface-header)] px-3 py-1.5 text-xs border border-gray-100">
       <span className="capitalize text-gray-500">{st.status}: </span>
       <span className="font-semibold text-gray-900">{st.count}</span>
      </div>
     ))}
    </div>
   )}
  </div>
 )
}

const ACTION_LABELS: Record<string, string> = {
 created: 'تم الإنشاء', updated: 'تم التحديث', deleted: 'تم الحذف',
 graded: 'تم التصحيح', attended: 'تم الحضور', enrolled: 'تم التسجيل', assigned: 'تم التعيين',
}
const ACTION_LABELS_EN: Record<string, string> = {
 created: 'created', updated: 'updated', deleted: 'deleted',
 graded: 'graded', attended: 'attended', enrolled: 'enrolled', assigned: 'assigned',
}

function ActivitySection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
 const lang = useLanguage()
 if (loading && !stats) return <SectionFallback />
 const s = stats ?? EMPTY_STATS
 const activity = s.recentActivity ?? []
 if (!activity.length) return <EmptyState icon={Clock} title={lang === 'ar' ? 'لا يوجد نشاط حديث' : 'No recent activity'} description={lang === 'ar' ? 'سيظهر النشاط هنا.' : 'Activity will appear here.'} />
 return (
  <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
   {activity.slice(0, 8).map((a, i) => {
    const IconComp = ACTIVITY_ICONS[a.action] || TrendingUp
    const colorClass = ACTIVITY_COLORS[a.action] || 'bg-gradient-to-br from-gray-100 to-gray-50 text-gray-600'
    return (
     <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
      className="flex items-center gap-3 px-5 py-3 hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent transition-all duration-200">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass} shadow-sm`}>
       <IconComp className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
       <div className="text-sm font-medium text-gray-900 truncate">
        {a.user ? `${a.user.firstName} ${a.user.lastName}` : 'System'}
       </div>
       <div className="text-xs text-gray-500 truncate">{(lang === 'ar' ? ACTION_LABELS[a.action] : ACTION_LABELS_EN[a.action]) || a.action} — {a.entityType}</div>
      </div>
       <time dateTime={a.createdAt ?? undefined} className="text-[11px] text-gray-400 shrink-0 bg-gray-50 px-2 py-0.5 rounded-full">{relativeTime(a.createdAt, lang === 'ar' ? 'ar' : 'en')}</time>
     </motion.div>
    )
   })}
  </div>
 )
}

function UpcomingSection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
 const lang = useLanguage()
 if (loading && !stats) return <SectionFallback />
 const s = stats ?? EMPTY_STATS
 const sessions = s.upcomingSessions ?? []
 if (!sessions.length) return <EmptyState icon={Calendar} title={lang === 'ar' ? 'لا توجد جلسات قادمة' : 'No upcoming sessions'} description={lang === 'ar' ? 'قم بجدولة الفصول من المنهج.' : 'Schedule classes from Curriculum.'} />
 return (
  <div className="divide-y divide-gray-100">
   {sessions.slice(0, 5).map((sess, i) => (
    <motion.div key={sess.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
     className="flex items-center gap-3 px-5 py-3.5 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent transition-all duration-200 group">
     <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 shadow-sm group-hover:shadow-md group-hover:scale-110 group-active:shadow-md group-active:scale-110 transition-transform duration-300">
      <Calendar className="h-5 w-5" />
     </div>
     <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
       <span className="text-sm font-semibold text-gray-900">{sess.level.name}</span>
       <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase border border-emerald-200">{sess.status}</span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
       <User className="h-3 w-3 inline" /> {sess.servant.firstName} {sess.servant.lastName} · {formatDate(sess.scheduledDate, lang === 'ar' ? 'ar-EG' : 'en-GB')} <span className="text-gold-500 font-medium">{formatTime(sess.scheduledDate, lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
      </div>
     </div>
     <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gold-500 group-hover:translate-x-0.5 transition-all" />
    </motion.div>
   ))}
  </div>
 )
}

function RecentGradesSection({ stats, loading }: { stats: DashboardData | null; loading: boolean }) {
 const lang = useLanguage()
 if (loading && !stats) return <SectionFallback />
 const s = stats ?? EMPTY_STATS
 const grades = s.recentGrades ?? []
 if (!grades.length) return null
 return (
  <>
   <div className="hidden sm:block overflow-x-auto">
    <table className="min-w-full text-sm">
     <thead className="bg-gray-50/50 border-b border-[var(--hymn-border)]">
      <tr>
       <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الطالب' : 'Student'}</th>
       <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'التقييم' : 'Assessment'}</th>
       <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الدرجة' : 'Score'}</th>
       <th className="px-5 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
       <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-gray-100">
      {grades.slice(0, 5).map((g, i) => (
       <motion.tr key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
        className="hover:bg-gradient-to-r hover:from-blue-50/20 hover:to-transparent transition-all duration-200">
        <td className="px-5 py-3">
         <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-xs font-bold text-blue-700 shadow-sm">
           {g.studentName.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="font-medium text-gray-900">{g.studentName}</span>
         </div>
        </td>
        <td className="px-5 py-3 text-gray-600">{g.assessmentTitle}</td>
        <td className="px-5 py-3 text-center">
         <span className="font-semibold text-gray-900">{g.score}</span>
         <span className="text-gray-400">/{g.maxScore}</span>
        </td>
        <td className="px-5 py-3 text-center">
         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
          g.passed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
         }`}>
          {lang === 'ar' ? (g.passed ? 'ناجح' : 'راسب') : (g.passed ? 'Passed' : 'Failed')}
         </span>
        </td>
        <td className="px-5 py-3 text-right text-xs text-gray-500">{formatDate(g.gradedAt, lang === 'ar' ? 'ar-EG' : 'en-GB')}</td>
       </motion.tr>
      ))}
     </tbody>
    </table>
   </div>
   <div className="block sm:hidden divide-y divide-[var(--hymn-border)]">
    {grades.slice(0, 5).map((g, i) => (
     <div key={g.id} className="px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between">
       <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-[10px] font-bold text-blue-700">
         {g.studentName.split(' ').map(n => n[0]).join('')}
        </div>
        <span className="text-sm font-medium text-gray-900 truncate">{g.studentName}</span>
       </div>
       <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
        g.passed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
       }`}>
        {g.score}/{g.maxScore} · {lang === 'ar' ? (g.passed ? 'ناجح' : 'راسب') : (g.passed ? 'Passed' : 'Failed')}
       </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
       <span className="truncate">{g.assessmentTitle}</span>
       <span className="shrink-0">{formatDate(g.gradedAt, lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
      </div>
     </div>
    ))}
   </div>
  </>
 )
}

// ── Main dashboard page ────────────────────────────────────────────

function MineFallback() {
 return (
  <div className="space-y-6">
   <div className="rounded-2xl bg-[var(--hymn-navy)] p-6 sm:p-8 animate-pulse h-44" />
   <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
   </div>
   <div className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] h-48 flex items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-gold-400" />
   </div>
  </div>
 )
}

function RetryCard({ onRetry, lang }: { onRetry: () => void; lang: string }) {
 return (
  <div className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] p-8 text-center">
   <p className="text-sm text-gray-500 mb-3">{lang === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to load data'}</p>
    <Button onClick={onRetry}>
     {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
    </Button>
  </div>
 )
}

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
 servant: { en: 'Servant', ar: 'خادم' },
 group_leader: { en: 'Group Leader', ar: 'رئيس مجموعة' },
 level_leader: { en: 'Level Leader', ar: 'رئيس مرحلة' },
 assistant_servant: { en: 'Assistant Servant', ar: 'خادم مساعد' },
}
function RoleBadge({ role, lang }: { role: string; lang: string }) {
 const l = ROLE_LABELS[role] || { en: role, ar: role }
 return (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
   <Heart className="h-3.5 w-3.5 text-rose-300" />
   {lang === 'ar' ? l.ar : l.en}
  </span>
 )
}

function StartClassCard({ lang }: { lang: string }) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await http.post('/attendance/start-class') as any
      if (res.requiresGroupPick) {
        toast('info', lang === 'ar' ? 'اختر المجموعة من صفحة الحضور' : 'Pick your group from the attendance page')
        router.push('/dashboard/attendance')
        return
      }
      toast('success', lang === 'ar' ? 'تم بدء الفصل!' : 'Class started!')
      router.push(`/dashboard/attendance?sessionId=${res.session.id}&mode=exceptions`)
    } catch {
      setError(lang === 'ar' ? 'فشل بدء الفصل' : 'Failed to start class')
      setTimeout(() => setError(null), 3000)
    }
    setStarting(false)
  }

  return (
    <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{lang === 'ar' ? 'بدء الفصل' : 'Start Class'}</h3>
          <p className="text-sm text-gray-500 mt-1">{lang === 'ar' ? 'اضغط لبدء الفصل — سيتم تسجيل جميع الطلاب كحاضرين مسبقًا' : 'One tap — all students pre-marked present. Fix exceptions only.'}</p>
        </div>
        <button onClick={handleStart} disabled={starting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200">
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {starting ? (lang === 'ar' ? 'جاري البدء...' : 'Starting...') : (lang === 'ar' ? 'بدء الفصل' : 'Start Class')}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

export function TodaysSessionCard({ lang }: { lang: string }) {
  const [session, setSession] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get('/attendance/sessions', { schoolId: getSchoolId(), status: 'in_progress' }) as any
        const todaySession = res.data?.[0]
        if (todaySession) {
          setSession(todaySession)
          // Fetch students for this session
          const studentRes = await http.get(`/attendance/sessions/${todaySession.id}`) as any
          setStudents(studentRes.attendanceRecords || [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await http.post('/attendance/start-class') as any
      if (res.requiresGroupPick) {
        toast('info', lang === 'ar' ? 'اختر المجموعة من صفحة الحضور' : 'Pick your group from the attendance page')
        router.push('/dashboard/attendance')
        return
      }
      toast('success', lang === 'ar' ? 'تم بدء الفصل!' : 'Class started!')
      router.push(`/dashboard/attendance?sessionId=${res.session.id}&mode=exceptions`)
    } catch {
      toast('error', lang === 'ar' ? 'فشل بدء الفصل' : 'Failed to start class')
    }
    setStarting(false)
  }

  const [ending, setEnding] = useState(false)

  const handleEndClass = async () => {
    if (!session) return
    setEnding(true)
    try {
      await http.put(`/attendance/sessions/${session.id}`, { status: 'completed' })
      toast('success', lang === 'ar' ? 'تم إنهاء الفصل' : 'Class ended')
      setSession(null)
      setStudents([])
    } catch {
      toast('error', lang === 'ar' ? 'فشل إنهاء الفصل' : 'Failed to end class')
    }
    setEnding(false)
  }

  const updateAttendance = async (studentId: string, status: string) => {
    try {
      await http.patch(`/attendance/sessions/${session.id}/records`, { studentId, status })
      setStudents(prev => prev.map(s => s.studentId === studentId ? { ...s, status } : s))
      toast('success', lang === 'ar' ? 'تم التحديث' : 'Updated')
    } catch {
      toast('error', lang === 'ar' ? 'فشل التحديث' : 'Failed to update')
    }
  }

  if (loading) return <CardSkeleton count={1} />

  // No active session - show start button
  if (!session) {
    return (
      <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'ابدأ فصل اليوم' : "Today's Session"}</h3>
            <p className="text-sm text-gray-500 mt-1">{lang === 'ar' ? 'اضغط لبدء الفصل — سيتم تسجيل جميع الطلاب كحاضرين مسبقًا' : 'Start your class — students pre-marked present'}</p>
          </div>
          <button onClick={handleStart} disabled={starting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200">
            {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
            {starting ? (lang === 'ar' ? 'جاري...' : 'Starting...') : (lang === 'ar' ? 'بدء الفصل' : 'Start Class')}
          </button>
        </div>
      </div>
    )
  }

  // Active session - show quick attendance
  const presentCount = students.filter(s => s.status === 'present').length
  const absentCount = students.filter(s => s.status === 'absent').length
  const lateCount = students.filter(s => s.status === 'late').length

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'الفصل النشط' : 'Active Session'}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">{session.group?.name} · {session.level?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEndClass}
            disabled={ending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            {lang === 'ar' ? 'إنهاء الفصل' : 'End Class'}
          </button>
          <Link href={`/dashboard/attendance?sessionId=${session.id}&mode=exceptions`}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            {lang === 'ar' ? 'الحضور' : 'Attendance'} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
          <div className="text-2xl font-bold text-emerald-600">{presentCount}</div>
          <div className="text-xs text-gray-500">{lang === 'ar' ? 'حاضرين' : 'Present'}</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
          <div className="text-2xl font-bold text-red-500">{absentCount}</div>
          <div className="text-xs text-gray-500">{lang === 'ar' ? 'غائبين' : 'Absent'}</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
          <div className="text-2xl font-bold text-amber-500">{lateCount}</div>
          <div className="text-xs text-gray-500">{lang === 'ar' ? 'متأخرين' : 'Late'}</div>
        </div>
      </div>

      {/* Quick Attendance Toggles */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {students.slice(0, 6).map((record) => (
          <div key={record.studentId} className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-100">
            <span className="text-sm font-medium text-gray-700 truncate">
              {record.student?.firstName} {record.student?.lastName}
            </span>
            <div className="flex gap-1">
              <button onClick={() => updateAttendance(record.studentId, 'present')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${record.status === 'present' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100'}`}>
                P
              </button>
              <button onClick={() => updateAttendance(record.studentId, 'absent')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${record.status === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'}`}>
                A
              </button>
              <button onClick={() => updateAttendance(record.studentId, 'late')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${record.status === 'late' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-amber-100'}`}>
                L
              </button>
            </div>
          </div>
        ))}
        {students.length > 6 && (
          <p className="text-xs text-gray-400 text-center py-1">
            +{students.length - 6} {lang === 'ar' ? 'طالب' : 'more students'}
          </p>
        )}
      </div>
    </div>
  )
}

function WeekScheduleCard({ lang }: { lang: string }) {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const today = new Date()
        const weekStart = startOfWeek(today, { weekStartsOn: 0 })
        const weekEnd = addDays(weekStart, 6)

        const res = await http.get('/attendance/sessions', {
          schoolId: getSchoolId(),
          from: weekStart.toISOString().split('T')[0],
          to: weekEnd.toISOString().split('T')[0],
        }) as any
        setSessions(res.data || [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  if (loading) return <CardSkeleton count={1} />
  if (sessions.length === 0) return null

  const dayNames = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
            <CalendarClock className="h-4 w-4" />
          </div>
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'جدول هذا الأسبوع' : 'This Week'}</h2>
        </div>
        <Link href="/dashboard/attendance" className="text-xs text-blue-700 font-medium hover:text-blue-800 flex items-center gap-0.5">
          {lang === 'ar' ? 'الحضور' : 'Attendance'} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((day, i) => {
            const daySessions = sessions.filter(s => {
              const sessionDate = new Date(s.scheduledDate)
              return sessionDate.getDay() === i
            })
            const isToday = new Date().getDay() === i
            return (
              <div key={day} className={`text-center p-2 rounded-lg ${isToday ? 'bg-blue-50 border border-blue-200' : ''}`}>
                <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{day}</div>
                <div className={`text-lg font-bold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>{daySessions.length}</div>
                {daySessions.length > 0 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto mt-1"></div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function NextSessionCard({ lang, assigned, groups }: { lang: string; assigned?: any; groups?: any[] }) {
  const levelId =
    assigned?.levelId ||
    groups?.find((g: any) => g.id === assigned?.groupId)?.levelId ||
    null

  const years = useAcademicYearsQuery()
  const currentYear = useMemo(
    () => years.data?.find((y) => y.isCurrent) || years.data?.[0] || null,
    [years.data],
  )

  const allocations = useAllAllocationsQuery(currentYear?.id || '', levelId || undefined)
  const lessons = useLessonsQuery(levelId || undefined)

  const lessonMap = useMemo(() => {
    const m = new Map<string, any>()
    ;(lessons.data || []).forEach((l: any) => m.set(l.id, l))
    return m
  }, [lessons.data])

  // Treat the stored date-only scheduledDate as the calendar day it was picked on
  // (its UTC date parts), avoiding timezone off-by-one drift when comparing to today.
  const toLocalDay = (s: string) => {
    const d = parseISO(s)
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }
  const fmtDate = (d: Date) =>
    format(d, 'd MMM yyyy', { locale: lang === 'ar' ? ar : enGB })

  const { items, dateLabel, scope } = useMemo(() => {
    const all = (allocations.data || []) as Allocation[]
    const dated = all.filter((a) => a.scheduledDate)
    const today = startOfDay(new Date())

    if (dated.length) {
      const todayItems = dated.filter((a) => isSameDay(toLocalDay(a.scheduledDate as string), today))
      if (todayItems.length) {
        return { items: todayItems, dateLabel: fmtDate(today), scope: 'today' }
      }
      const upcoming = dated
        .filter((a) => toLocalDay(a.scheduledDate as string) >= today)
        .sort((a, b) => toLocalDay(a.scheduledDate as string).getTime() - toLocalDay(b.scheduledDate as string).getTime())
      if (upcoming.length) {
        const d = toLocalDay(upcoming[0].scheduledDate as string)
        return {
          items: dated.filter((a) => isSameDay(toLocalDay(a.scheduledDate as string), d)),
          dateLabel: fmtDate(d),
          scope: 'upcoming',
        }
      }
      const past = dated
        .slice()
        .sort((a, b) => toLocalDay(b.scheduledDate as string).getTime() - toLocalDay(a.scheduledDate as string).getTime())
      const d = toLocalDay(past[0].scheduledDate as string)
      return {
        items: dated.filter((a) => isSameDay(toLocalDay(a.scheduledDate as string), d)),
        dateLabel: fmtDate(d),
        scope: 'recent',
      }
    }

    // No scheduled dates — fall back to showing the level's allocated items.
    if (all.length) return { items: all, dateLabel: '', scope: 'plan' }
    return { items: [] as Allocation[], dateLabel: '', scope: 'plan' }
  }, [allocations.data, lang])

  const scopedToLevel = !!levelId

  const loading =
    (years.isLoading || allocations.isLoading || lessons.isLoading) && !(allocations.data || lessons.data)

  if (loading) return <CardSkeleton count={2} />
  if (!items.length)
    return (
      <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
        <NextSessionHeader lang={lang} dateLabel="" scope="plan" />
        <div className="px-5 py-8">
          <EmptyState
            icon={BookOpen}
            title={lang === 'ar' ? 'لا توجد عناصر منهج مجدولة' : 'No curriculum items scheduled'}
            description={
              lang === 'ar'
                ? 'ستظهر عناصر المنهج المخصصة لهذا اليوم هنا.'
                : 'Curriculum items allocated for the day will appear here.'
            }
          />
        </div>
      </div>
    )

  return (
    <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <NextSessionHeader lang={lang} dateLabel={dateLabel} scope={scope} />
      <div className="divide-y divide-gray-100">
        {items.map((a) => {
          const lesson = lessonMap.get(a.lesson?.id || '')
          const item = lesson?.subjectItem
          const label = item
            ? lang === 'ar'
              ? item.nameAr || item.name
              : item.name
            : lang === 'ar'
              ? lesson?.titleAr || lesson?.title
              : lesson?.title
          const lessonLabel = lesson
            ? lang === 'ar'
              ? lesson.titleAr || lesson.title
              : lesson.title
            : ''
          return (
            <div key={a.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">{label}</div>
                {item && lessonLabel && lessonLabel !== label && (
                  <div className="text-xs text-gray-500 truncate">{lessonLabel}</div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {lesson?.subject?.name && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: lesson.subject.color || '#3b82f6' }}
                      />
                      {lesson.subject.name}
                    </span>
                  )}
                  {!scopedToLevel && a.level?.name && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                      {a.level.name}
                    </span>
                  )}
                  {item?.optional && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {lang === 'ar' ? 'اختياري' : 'Optional'}
                    </span>
                  )}
                  {lesson?.estimatedDurationMinutes ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      {lesson.estimatedDurationMinutes} {lang === 'ar' ? 'دقيقة' : 'min'}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NextSessionHeader({ lang, dateLabel, scope }: { lang: string; dateLabel: string; scope: string }) {
  const scopeLabel =
    scope === 'today'
      ? lang === 'ar'
        ? 'اليوم'
        : 'Today'
      : scope === 'upcoming'
        ? lang === 'ar'
          ? 'القادمة'
          : 'Upcoming'
        : scope === 'recent'
          ? lang === 'ar'
            ? 'الأخيرة'
            : 'Recent'
          : ''
  return (
    <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-blue-200/50">
          <BookOpen className="h-4 w-4" />
        </div>
        <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الجلسة القادمة' : 'Next Session'}</h2>
      </div>
      <div className="flex items-center gap-2">
        {dateLabel && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            {scopeLabel ? `${scopeLabel} · ${dateLabel}` : dateLabel}
          </span>
        )}
        <Link
          href="/dashboard/curriculum"
          className="text-xs text-blue-700 font-medium hover:text-blue-800 flex items-center gap-0.5"
        >
          {lang === 'ar' ? 'المنهج' : 'Curriculum'} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

export function WeekSummaryCard({ thisWeek, lang }: { thisWeek?: any; lang: string }) {
  if (!thisWeek) return null
  const total = thisWeek.total ?? 0
  const rate = thisWeek.attendanceRate ?? 0
  const items = [
    { key: 'present', label: lang === 'ar' ? 'حاضر' : 'Present', count: thisWeek.present ?? 0, dot: 'bg-green-500', Icon: UserCheck },
    { key: 'late', label: lang === 'ar' ? 'متأخر' : 'Late', count: thisWeek.late ?? 0, dot: 'bg-amber-500', Icon: Clock },
    { key: 'absent', label: lang === 'ar' ? 'غائب' : 'Absent', count: thisWeek.absent ?? 0, dot: 'bg-red-500', Icon: XCircle },
    { key: 'excused', label: lang === 'ar' ? 'معذور' : 'Excused', count: thisWeek.excused ?? 0, dot: 'bg-gray-400', Icon: AlertTriangle },
  ]
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-emerald-600 ring-1 ring-emerald-200/50">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'ملخص هذا الأسبوع' : 'This Week Summary'}</h2>
        </div>
        <Link href="/dashboard/attendance" className="text-xs text-emerald-600 font-medium hover:text-emerald-700">
          {lang === 'ar' ? 'الحضور' : 'Attendance'}
        </Link>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.key} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`h-2 w-2 rounded-full ${it.dot}`} />
                <span className="text-[11px] text-gray-500">{it.label}</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{it.count}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2.5">
          <span className="text-sm font-medium text-emerald-700">{lang === 'ar' ? `الإجمالي: ${total}` : `Total: ${total}`}</span>
          <span className="text-sm font-bold text-emerald-700">{lang === 'ar' ? `معدل الحضور: ${rate}٪` : `Attendance Rate: ${rate}%`}</span>
        </div>
      </div>
    </div>
  )
}

function SessionSummaryModal({ session, students, lang, onClose }: { session: any; students: any[]; lang: string; onClose: () => void }) {
  const presentCount = students.filter(s => s.status === 'present').length
  const absentCount = students.filter(s => s.status === 'absent').length
  const lateCount = students.filter(s => s.status === 'late').length
  const excusedCount = students.filter(s => s.status === 'excused').length
  const total = students.length
  const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0
  const [notes, setNotes] = useState(session?.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    try {
      await http.put(`/attendance/sessions/${session.id}/notes`, { notes })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    }
    setSavingNotes(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">{lang === 'ar' ? 'ملخص الفصل' : 'Session Summary'}</h3>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          <p className="text-emerald-100 mt-1">{session.group?.name} · {session.level?.name}</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <div className="text-3xl font-bold text-emerald-600">{attendanceRate}%</div>
              <div className="text-sm text-gray-600">{lang === 'ar' ? 'نسبة الحضور' : 'Attendance'}</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-3xl font-bold text-blue-600">{total}</div>
              <div className="text-sm text-gray-600">{lang === 'ar' ? 'إجمالي الطلاب' : 'Total Students'}</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-emerald-600">{presentCount}</div>
              <div className="text-xs text-gray-500">{lang === 'ar' ? 'حاضرين' : 'Present'}</div>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-red-500">{absentCount}</div>
              <div className="text-xs text-gray-500">{lang === 'ar' ? 'غائبين' : 'Absent'}</div>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-amber-500">{lateCount}</div>
              <div className="text-xs text-gray-500">{lang === 'ar' ? 'متأخرين' : 'Late'}</div>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-500">{excusedCount}</div>
              <div className="text-xs text-gray-500">{lang === 'ar' ? 'مستأذنين' : 'Excused'}</div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/dashboard/assessments" className="flex-1 text-center py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">
              {lang === 'ar' ? 'تقييم' : 'Grade'}
            </Link>
            <Link href="/dashboard/announcements" className="flex-1 text-center py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">
              {lang === 'ar' ? 'إعلان' : 'Announce'}
            </Link>
          </div>
          
          {/* Session Notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'ar' ? 'ملاحظات الفصل' : 'Session Notes'}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'أضف ملاحظات حول الفصل...' : 'Add notes about the session...'}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              rows={3}
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes || notes === (session?.notes || '')}
              className="mt-2 px-4 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingNotes ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : saved ? (lang === 'ar' ? 'تم الحفظ ✓' : 'Saved ✓') : (lang === 'ar' ? 'حفظ الملاحظات' : 'Save Notes')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactParentButton({ student, lang }: { student: any; lang: string }) {
  const [showContact, setShowContact] = useState(false)
  const parent = student?.studentParents?.[0]?.parent

  if (!parent) return null

  return (
    <>
      <button onClick={() => setShowContact(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors">
        <User className="h-4 w-4" />
        {lang === 'ar' ? 'تواصل مع الوالد' : 'Contact Parent'}
      </button>
      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'تواصل مع الوالد' : 'Contact Parent'}</h3>
              <button onClick={() => setShowContact(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{parent.firstName} {parent.lastName}</div>
                  <div className="text-sm text-gray-500">{lang === 'ar' ? 'والد' : 'Parent'} {student.firstName}</div>
                </div>
              </div>
              {parent.phone && (
                <a href={`tel:${parent.phone}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600">📞</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{parent.phone}</div>
                    <div className="text-sm text-gray-500">{lang === 'ar' ? 'اتصال' : 'Call'}</div>
                  </div>
                </a>
              )}
              {parent.email && (
                <a href={`mailto:${parent.email}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600">✉️</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{parent.email}</div>
                    <div className="text-sm text-gray-500">{lang === 'ar' ? 'بريد إلكتروني' : 'Email'}</div>
                  </div>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function RecurringSessionsButton({ lang }: { lang: string }) {
  const [showModal, setShowModal] = useState(false)
  const [groups, setGroups] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [time, setTime] = useState('10:00')
  const [weeks, setWeeks] = useState(4)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<number | null>(null)

  useEffect(() => {
    if (showModal) {
      http.get<any[]>('/curriculum/levels', { schoolId: getSchoolId() }).then(d => setLevels(d || [])).catch(console.error)
      http.get<any[]>('/students/groups/all', { schoolId: getSchoolId() }).then(d => setGroups((d || []).filter((g: any) => g.status !== 'inactive'))).catch(console.error)
    }
  }, [showModal])

  const handleCreate = async () => {
    if (!selectedGroup || !selectedLevel) return
    setCreating(true)
    try {
      const res = await http.post('/attendance/sessions/recurring', {
        groupId: selectedGroup,
        levelId: selectedLevel,
        dayOfWeek,
        time,
        weeks,
      }, { schoolId: getSchoolId() }) as any
      setCreated(res.created)
      setTimeout(() => { setCreated(null); setShowModal(false) }, 2000)
    } catch {
      // ignore
    }
    setCreating(false)
  }

  const dayNames = lang === 'ar'
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <>
      <button onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors">
        <CalendarClock className="h-4 w-4" />
        {lang === 'ar' ? 'جلسات متكررة' : 'Recurring Sessions'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'إنشاء جلسات متكررة' : 'Create Recurring Sessions'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'المستوى' : 'Level'}</label>
                <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{lang === 'ar' ? 'اختر المستوى' : 'Select level'}</option>
                  {levels.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'المجموعة' : 'Group'}</label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{lang === 'ar' ? 'اختر المجموعة' : 'Select group'}</option>
                  {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'يوم الأسبوع' : 'Day of Week'}</label>
                <select value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {dayNames.map((day, i) => <option key={i} value={i}>{day}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'الوقت' : 'Time'}</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'عدد الأسابيع' : 'Weeks'}</label>
                  <input type="number" min={1} max={12} value={weeks} onChange={e => setWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors">
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleCreate} disabled={creating || !selectedGroup || !selectedLevel}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {creating ? (lang === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : created ? (lang === 'ar' ? `تم إنشاء ${created} جلسات ✓` : `Created ${created} sessions ✓`) : (lang === 'ar' ? 'إنشاء' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function LiturgyHeatmapCard({ lang }: { lang: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get('/attendance/liturgy-heatmap', { schoolId: getSchoolId() }) as any
        setData(res)
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  if (loading) return null
  if (!data || data.students?.length === 0) return null

  const heatClass = (status: string, liturgy: boolean) => {
    if (status === 'present' && liturgy) return 'bg-green-500'
    if (status === 'present' || status === 'late') return 'bg-amber-400'
    if (status === 'absent') return 'bg-red-300'
    return 'bg-gray-100'
  }

  const regular = data.students.filter((s: any) => s.liturgyCount >= Math.ceil(data.weeks.length * 0.5)).length
  const classOnly = data.students.filter((s: any) => s.liturgyCount === 0 && s.classCount > 0).length

  return (
    <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700"><Church className="h-4 w-4" /></div>
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'خريطة القداسات الحرارية' : 'Liturgy Heatmap'}</h2>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-green-500" />{lang === 'ar' ? 'قداس+حضور' : 'Liturgy+Class'}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-400" />{lang === 'ar' ? 'حضور فقط' : 'Class only'}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-red-300" />{lang === 'ar' ? 'غائب' : 'Absent'}</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex gap-4 mb-4 text-sm">
          <span className="text-green-700 font-medium">🕊 {regular} {lang === 'ar' ? 'يقدس بانتظام' : 'regularly attend liturgy'}</span>
          <span className="text-amber-700 font-medium">📖 {classOnly} {lang === 'ar' ? 'يحضرون الفصل فقط' : 'class only'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-gray-500 font-medium pr-3 pb-2 sticky left-0 bg-white">{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                {data.weeks.map((w: string) => (
                  <th key={w} className="text-center text-gray-400 font-normal pb-2 px-1">{w.slice(-5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((s: any) => (
                <tr key={s.name}>
                  <td className="text-gray-700 pr-3 py-1 sticky left-0 bg-white whitespace-nowrap">{lang === 'ar' && s.nameAr ? s.nameAr : s.name}</td>
                  {data.weeks.map((w: string) => {
                    const cell = s.weeks[w]
                    return (
                      <td key={w} className="px-1 py-1">
                        <div className={`h-4 w-4 rounded ${cell ? heatClass(cell.classStatus, cell.liturgy) : 'bg-gray-100'}`} title={cell ? `${s.name}: ${cell.classStatus}${cell.liturgy ? ' + liturgy' : ''}` : ''} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


// ── Servant Wellbeing Panel ────────────────────────────────────────────────

interface DigestData {
  generatedAt: string
  servant: { id: string; firstName: string; lastName: string }
  studentStory: { studentId: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string; streak?: number; storyEn: string; storyAr: string } | null
  classTrend: { thisWeekRate: number; lastWeekRate: number; improvement: number; trendEn: string; trendAr: string } | null
  milestone: { totalSessions: number; nextMilestone?: number; messageEn: string; messageAr: string; isFresh: boolean; value?: number } | null
  absenceAlerts: Array<{ studentId: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string; consecutiveAbsences: number; messageEn: string; messageAr: string }>
  nextSession: { id: string; scheduledDate: string; levelId: string; levelName?: string; levelNumber?: number; groupId: string; groupName?: string } | null
}

function ServantWellbeingPanel({ lang, schoolId }: { lang: string; schoolId: string }) {
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sabbathMode, setSabbathMode] = useState(false)
  const [startingClass, setStartingClass] = useState(false)
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const router = useRouter()

  useEffect(() => {
    // Load sabbath mode preference from localStorage (client-only preference)
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cohep_sabbath_mode') : null
    if (stored === 'true') setSabbathMode(true)
  }, [])

  useEffect(() => {
    http.get<DigestData>(`/dashboard/servant-digest?schoolId=${schoolId}`)
      .then(d => { setDigest(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [schoolId])

  const toggleSabbath = () => {
    const next = !sabbathMode
    setSabbathMode(next)
    if (typeof window !== 'undefined') localStorage.setItem('cohep_sabbath_mode', String(next))
  }

  const handleStartClass = async () => {
    if (!digest?.nextSession) return
    setStartingClass(true)
    // Navigate to attendance for this session with pre-fill param
    router.push(`/dashboard/attendance?sessionId=${digest.nextSession.id}&prefill=present`)
    setStartingClass(false)
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-50">
            <Bell className="h-4 w-4 text-purple-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t('Servant Digest', 'ملخص الخادم')}</h2>
        </div>
        {/* Sabbath mode toggle */}
        <button
          onClick={toggleSabbath}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
            sabbathMode ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}
          title={t('Sabbath Mode silences notifications Saturday evening to Monday morning', 'وضع السبت يوقف الإشعارات من مساء السبت إلى صباح الإثنين')}
        >
          <Moon className="h-3 w-3" />
          {sabbathMode ? t('Sabbath ON', 'وضع السبت: تشغيل') : t('Sabbath Mode', 'وضع السبت')}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : !digest ? null : (
        <>
          {/* Sabbath mode banner */}
          {sabbathMode && (() => {
            const now = new Date()
            const day = now.getDay() // 0=Sun,6=Sat
            const isSabbath = day === 0 || day === 6 || (day === 5 && now.getHours() >= 18)
            return isSabbath ? (
              <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <Moon className="h-4 w-4 text-indigo-600 shrink-0" />
                <p className="text-sm text-indigo-800">
                  <span className="font-semibold">{t('Sabbath Mode is active.', 'وضع السبت نشط.')}</span>{' '}
                  {t('Notifications are paused until Monday morning. Rest well.', 'الإشعارات متوقفة حتى صباح الإثنين. استرح جيداً.')}
                </p>
              </div>
            ) : null
          })()}

          {/* Arrival Tap */}
          {digest.nextSession && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_white_1px,_transparent_1px)] bg-[length:16px_16px]" />
              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-100 uppercase tracking-wide mb-0.5">
                    {t('Next Session', 'الجلسة القادمة')}
                  </p>
                  <p className="text-base font-bold text-white">
                    {digest.nextSession.groupName || t('Your Group', 'مجموعتك')}
                    {digest.nextSession.levelNumber ? ` · L${digest.nextSession.levelNumber}` : ''}
                  </p>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    {new Date(digest.nextSession.scheduledDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <button
                  onClick={handleStartClass}
                  disabled={startingClass}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 shadow-lg active:scale-95 transition-all hover:bg-emerald-50 disabled:opacity-60"
                >
                  {startingClass ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  {t('Start Class', 'ابدأ الفصل')}
                </button>
              </div>
              <p className="relative mt-2 text-[10px] text-emerald-200">
                {t('Attendance opens pre-filled with all present — fix exceptions only.', 'الحضور يُفتح مع تسجيل الجميع حاضرين — صحّح الغائبين فقط.')}
              </p>
            </div>
          )}

          {/* Three digest cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Student story */}
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Music className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                  {t('Student Story', 'قصة الطالب')}
                </span>
              </div>
              {digest.studentStory ? (
                <>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {lang === 'ar' ? digest.studentStory.storyAr : digest.studentStory.storyEn}
                  </p>
                  {digest.studentStory.streak && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-orange-400" />
                      <span className="text-xs font-semibold text-orange-600">{digest.studentStory.streak} {t('sessions in a row', 'جلسات متتالية')}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">{t('No notable student activity this week yet.', 'لا يوجد نشاط طلابي بارز هذا الأسبوع بعد.')}</p>
              )}
            </div>

            {/* Class trend */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {t('Class Trend', 'اتجاه الفصل')}
                </span>
              </div>
              {digest.classTrend ? (
                <>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {lang === 'ar' ? digest.classTrend.trendAr : digest.classTrend.trendEn}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {digest.classTrend.improvement > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        <ArrowUp className="h-2.5 w-2.5" />+{digest.classTrend.improvement}%
                      </span>
                    ) : digest.classTrend.improvement < 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        <ArrowDown className="h-2.5 w-2.5" />{digest.classTrend.improvement}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                        <Minus className="h-2.5 w-2.5" />0%
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">{t('No session data yet for this week.', 'لا توجد بيانات جلسات لهذا الأسبوع بعد.')}</p>
              )}
            </div>

            {/* Milestone */}
            <div className={`rounded-xl border p-4 ${digest.milestone?.isFresh ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy className={`h-3.5 w-3.5 ${digest.milestone?.isFresh ? 'text-amber-600' : 'text-gray-500'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${digest.milestone?.isFresh ? 'text-amber-600' : 'text-gray-500'}`}>
                  {t('Your Milestone', 'إنجازك')}
                </span>
              </div>
              {digest.milestone ? (
                <>
                  {digest.milestone.isFresh && (
                    <div className="mb-1.5 text-base">🎉</div>
                  )}
                  <p className={`text-sm leading-relaxed ${digest.milestone.isFresh ? 'text-amber-900 font-medium' : 'text-gray-700'}`}>
                    {lang === 'ar' ? digest.milestone.messageAr : digest.milestone.messageEn}
                  </p>
                  {!digest.milestone.isFresh && digest.milestone.nextMilestone && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>{digest.milestone.totalSessions}</span>
                        <span>{digest.milestone.nextMilestone}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gold-400 transition-all duration-700"
                          style={{ width: `${Math.min(100, (digest.milestone.totalSessions / digest.milestone.nextMilestone) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">{t('Start teaching sessions to track your journey.', 'ابدأ الجلسات لتتبع رحلتك.')}</p>
              )}
            </div>
          </div>

          {/* Absence alerts */}
          {digest.absenceAlerts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <h3 className="text-sm font-semibold text-amber-800">
                  {t('Students to check in on', 'طلاب يستحقون متابعة')}
                </h3>
                <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {digest.absenceAlerts.length}
                </span>
              </div>
              <div className="space-y-2">
                {digest.absenceAlerts.map(alert => (
                  <div key={alert.studentId} className="flex items-start gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">
                      {alert.firstName[0]}{alert.lastName[0]}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed flex-1">
                      {lang === 'ar' ? alert.messageAr : alert.messageEn}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-amber-600 italic">
                {t('Parents have been notified automatically. No action required.', 'تم إبلاغ الأهالي تلقائياً. لا حاجة لأي إجراء.')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MinistryDashboard({ data, loading, error, onRetry }: { data: any; loading: boolean; error: boolean; onRetry: () => void }) {
 const lang = useLanguage()
 const [groupMates, setGroupMates] = useState<any[] | null>(null)

 useEffect(() => {
   let cancelled = false
   http.get('/servants/group-mates')
     .then((d: any) => { if (!cancelled) setGroupMates(d || []) })
     .catch(() => { if (!cancelled) setGroupMates([]) })
   return () => { cancelled = true }
 }, [])

 if (loading && !data) return <MineFallback />
 if (error) return <RetryCard onRetry={onRetry} lang={lang} />
 const d = data || {}
 const sessions: any[] = d.sessions || []
 const groups: any[] = d.groups || []
 const recentGrades: any[] = d.recentGrades || []
 const school = d.school || {}
 const assigned = d.assigned || {}
 const churchName = school?.church?.name || ''
 const churchLogo = school?.church?.logoUrl
  ? (school.church.logoUrl.startsWith('http') ? school.church.logoUrl : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '') + school.church.logoUrl)
  : null
 const schoolLogo = school?.logoUrl
  ? (school.logoUrl.startsWith('http') ? school.logoUrl : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '') + school.logoUrl)
  : null

 const ministryBadges = (
  <>
   {churchName && (
    <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
     {churchName}
    </span>
   )}
   <p className="text-white/60 text-sm">{getFullDay(lang)}</p>
   <RoleBadge role={d.role || 'servant'} lang={lang} />
  </>
 )

 const ministryLogos = (
  <>
   {churchLogo && (
    <div className="relative shrink-0">
     <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
     <Image src={churchLogo} alt="Church Logo" width={100} height={100}
      className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
    </div>
   )}
   {schoolLogo && (
    <div className="relative shrink-0">
     <div className="absolute inset-0 rounded-2xl bg-white/10 blur-xl" />
     <Image src={schoolLogo} alt="School Logo" width={100} height={100}
      className="relative h-24 w-24 rounded-2xl border-2 border-white/20 bg-white/10 object-cover shadow-xl" />
    </div>
   )}
  </>
 )

 const ministryStats = (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
   {([
    { label: 'My Students', labelAr: 'طلابي', value: d.studentsCount ?? 0, icon: Users },
    { label: 'My Groups', labelAr: 'مجموعاتي', value: groups.length, icon: UserCog },
    { label: 'Attendance', labelAr: 'الحضور', value: d.attendanceRate ?? 0, suffix: '%', icon: UserCheck },
    { label: 'Sessions to Run', labelAr: 'جلسات للتشغيل', value: sessions.length, icon: CalendarClock },
   ] as const).map((item) => (
    <div key={item.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
     <div className="flex items-center gap-2 mb-1">
      <item.icon className="h-3.5 w-3.5 text-gold-400" />
      <span className="text-[11px] text-white/60">{lang === 'ar' ? (item as any).labelAr : item.label}</span>
     </div>
     <div className="text-xl font-bold text-white tracking-wider">
      <AnimatedCounter value={item.value} suffix={'suffix' in item ? (item as any).suffix || '' : ''} />
     </div>
    </div>
   ))}
  </div>
 )

 return (
  <>
<title>{lang === 'ar' ? 'خدمتي' : 'My Ministry'} — Coptic Orthodox Hymn Education Platform (COHEP)</title>
    <meta name="description" content="Coptic Orthodox Hymn Education Platform (COHEP) ministry dashboard" />
   <motion.div className="space-y-6" initial="initial" animate="animate" variants={stagger}>
     <DashboardHero
      bg="var(--hymn-green)"
      title={
       school?.name || (lang === 'ar' ? 'منصة تعليم التراتيل الكنسية' : 'Coptic Orthodox Hymn Education Platform')
      }
      badges={ministryBadges}
      logos={ministryLogos}
      orbTint="bg-emerald-500/10"
     >
      {ministryStats}
     </DashboardHero>

      {/* Today's Session */}
      <motion.div variants={fadeUp}>
        <TodaysSessionCard lang={lang} />
      </motion.div>

      {/* Next Session — curriculum subject items allocated for the day/week */}
      {['servant', 'group_leader', 'level_leader'].includes(d.role || '') && (
        <motion.div variants={fadeUp}>
          <NextSessionCard lang={lang} assigned={assigned} groups={groups} />
        </motion.div>
      )}

      {/* My Group · Servants */}
      {groupMates !== null && (
        <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">{lang === 'ar' ? 'خدام مجموعتي' : 'My Group · Servants'}</h2>
            <span className="text-xs text-white/60">{groupMates.length}</span>
          </div>
          {groupMates.length === 0 ? (
            <p className="text-sm text-white/60">{lang === 'ar' ? 'لا يوجد خدام آخرون في مجموعتك' : 'No other servants in your group'}</p>
          ) : (
            <ul className="space-y-2">
              {groupMates.map((m: any) => (
                <li key={m.id} className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/30 text-sm font-bold text-white">
                      {(m.firstName || '?')[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {lang === 'ar' && m.firstNameAr ? `${m.firstNameAr} ${m.lastNameAr || ''}` : `${m.firstName} ${m.lastName}`}
                    </p>
                  </div>
                  {m.phone && <PhoneLink phone={m.phone} lang={lang} />}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}

      {/* Servant Journey Card */}
      {['servant', 'group_leader', 'level_leader'].includes(d.role || '') && (
        <motion.div variants={fadeUp}>
          <ServantJourneyCard />
        </motion.div>
      )}

      {/* This Week Schedule */}
      {['servant', 'group_leader', 'level_leader'].includes(d.role || '') && (
        <motion.div variants={fadeUp}>
          <WeekScheduleCard lang={lang} />
        </motion.div>
      )}

      {/* This Week Summary */}
      {['servant', 'group_leader', 'level_leader'].includes(d.role || '') && (
        <motion.div variants={fadeUp}>
          <WeekSummaryCard thisWeek={d.thisWeek} lang={lang} />
        </motion.div>
      )}

      {/* Recurring Sessions Button */}
      {['servant', 'group_leader', 'level_leader'].includes(d.role || '') && (
        <motion.div variants={fadeUp}>
          <RecurringSessionsButton lang={lang} />
        </motion.div>
      )}

      {!d.scoped && (
     <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <Info className="h-4 w-4 shrink-0" />
      <span>{lang === 'ar' ? 'أنت غير معيَّن لمجموعة بعد — يتم عرض نشاط المدرسة كاملاً.' : 'You are not assigned to a group yet — showing school-wide activity.'}</span>
     </div>
    )}

    {d.scoped && (assigned.groupName || assigned.levelName || assigned.gradeName) && (
     <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <Info className="h-4 w-4 shrink-0" />
      <span>
       {lang === 'ar' ? 'أنت معين إلى:' : 'You are assigned to:'}
       {assigned.groupName && <span className="font-semibold"> {assigned.groupName}</span>}
       {assigned.levelName && <span className="font-semibold"> · {assigned.levelName}</span>}
       {assigned.gradeName && <span className="font-semibold"> · {assigned.gradeName}</span>}
      </span>
     </div>
    )}

    <motion.div variants={fadeUp} className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
       <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-emerald-600 ring-1 ring-emerald-200/50"><CalendarClock className="h-4 w-4" /></div>
        <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الجلسات للتشغيل' : 'Sessions to Run'}</h2>
      </div>
      <Link href="/dashboard/attendance" className="text-xs text-emerald-600 font-medium hover:text-emerald-700">{lang === 'ar' ? 'الحضور' : 'Attendance'}</Link>
     </div>
     <div className="divide-y divide-gray-100">
      {sessions.length === 0 ? (
       <div className="px-5 py-8"><EmptyState icon={CalendarClock} title={lang === 'ar' ? 'لا توجد جلسات مجدولة' : 'No scheduled sessions'} description={lang === 'ar' ? 'ستظهر جلساتك هنا.' : 'Your sessions will appear here.'} /></div>
      ) : sessions.map((s) => (
       <Link key={s.id} href="/dashboard/attendance" className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors group">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CalendarClock className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
         <div className="text-sm font-medium text-gray-900 truncate">{s.levelName} · {s.groupName}</div>
         <div className="text-xs text-gray-500">{formatDate(s.scheduledDate, lang === 'ar' ? 'ar-EG' : 'en-GB')}</div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 group-hover:bg-emerald-100">{lang === 'ar' ? 'تسجيل الحضور' : 'Take Attendance'}</span>
       </Link>
      ))}
     </div>
    </motion.div>

    <motion.div variants={fadeUp} className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
       <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50"><UserCog className="h-4 w-4" /></div>
        <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'مجموعاتي' : 'My Groups'}</h2>
      </div>
     </div>
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
      {groups.length === 0 ? (
       <div className="col-span-full px-1 py-6"><EmptyState icon={UserCog} title={lang === 'ar' ? 'لا مجموعات' : 'No groups'} /></div>
      ) : groups.map((g) => (
       <div key={g.id} className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] p-4 hover:border-blue-200 hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
         <h3 className="font-semibold text-gray-900">{g.name}</h3>
         <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{g.levelName}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
         <Users className="h-4 w-4" /><span>{g.studentCount} {lang === 'ar' ? 'طالب' : 'students'}</span>
        </div>
       </div>
      ))}
     </div>
    </motion.div>

    <motion.div variants={fadeUp} className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
       <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-purple-600 ring-1 ring-purple-200/50"><Award className="h-4 w-4" /></div>
        <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'أحدث الدرجات' : 'Recent Grades'}</h2>
      </div>
      <Link href="/dashboard/assessments" className="text-xs text-blue-700 font-medium hover:text-blue-800 flex items-center gap-0.5 group">{lang === 'ar' ? 'عرض الكل' : 'View all'}<ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></Link>
     </div>
     <div className="divide-y divide-gray-100">
      {recentGrades.length === 0 ? (
       <div className="px-5 py-8"><EmptyState icon={Award} title={lang === 'ar' ? 'لا توجد درجات بعد' : 'No grades yet'} /></div>
      ) : recentGrades.map((g) => (
       <div key={g.id} className="flex items-center gap-3 px-5 py-3">
        <div className="min-w-0 flex-1">
         <div className="text-sm font-medium text-gray-900 truncate">{g.studentName}</div>
         <div className="text-xs text-gray-500 truncate">{g.assessmentTitle}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${g.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{g.score}/{g.maxScore}</span>
       </div>
      ))}
     </div>
     </motion.div>

     <motion.div variants={fadeUp}>
       <LiturgyHeatmapCard lang={lang} />
     </motion.div>

     {/* Servant Digest */}
     <motion.div variants={fadeUp}>
       <ServantWellbeingPanel lang={lang} schoolId={getSchoolId()} />
     </motion.div>

     {/* Practice Counters */}
     <motion.div variants={fadeUp}>
       <PracticeCountersSection lang={lang} />
     </motion.div>
    </motion.div>
  </>
 )
}

function ServantDigestCard({ lang }: { lang: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get('/dashboard/servant-digest', { schoolId: getSchoolId() }) as any
        setData(res)
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  if (loading) return null
  if (!data) return null

  return (
    <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700"><BookMarked className="h-4 w-4" /></div>
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'ملخص الخدمة' : 'Servant Digest'}</h2>
        </div>
        <span className="text-[11px] text-gray-400">{lang === 'ar' ? 'نظرة سريعة على خدمتك' : 'Your ministry at a glance'}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {/* Student Story */}
        {data.studentStory && (
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600"><CheckCircle className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {lang === 'ar' ? (data.studentStory.firstNameAr || data.studentStory.firstName) : `${data.studentStory.firstName} ${data.studentStory.lastName}`}
                </p>
                <p className="text-sm text-gray-600 mt-1">{lang === 'ar' ? data.studentStory.storyAr : data.studentStory.storyEn}</p>
              </div>
            </div>
          </div>
        )}

        {/* Class Trend */}
        {data.classTrend && (
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${data.classTrend.improvement >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-600">{lang === 'ar' ? data.classTrend.trendAr : data.classTrend.trendEn}</p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-gray-400">{lang === 'ar' ? 'الأسبوع الماضي' : 'Last week'}: <strong className="text-gray-700">{data.classTrend.lastWeekRate}%</strong></span>
                  <span className="text-gray-400">{lang === 'ar' ? 'هذا الأسبوع' : 'This week'}: <strong className="text-gray-700">{data.classTrend.thisWeekRate}%</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Milestone */}
        {data.milestone && (
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-amber-600"><Award className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-sm text-gray-600">{lang === 'ar' ? data.milestone.messageAr : data.milestone.messageEn}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">{data.milestone.totalSessions} {lang === 'ar' ? 'جلسة' : 'sessions'}</span>
                  {data.milestone.nextMilestone && (
                    <span className="text-gray-400">{lang === 'ar' ? 'التالي:' : 'Next:'} {data.milestone.nextMilestone}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Absence Alerts */}
        {data.absenceAlerts?.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500"><AlertTriangle className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-700">{lang === 'ar' ? 'تنبيهات الغياب' : 'Absence Alerts'}</p>
                <div className="mt-2 space-y-1">
                  {data.absenceAlerts.map((a: any, i: number) => (
                    <p key={i} className="text-xs text-red-600">
                      {lang === 'ar' ? a.messageAr : a.messageEn}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Session */}
        {data.nextSession && (
          <div className="rounded-b-xl bg-gradient-to-r from-blue-50 to-white px-5 py-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-medium text-gray-900">
                {lang === 'ar' ? 'الجلسة القادمة:' : 'Next session:'}
              </span>
              <span className="text-gray-600">
                {data.nextSession.groupName} — {data.nextSession.levelName}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {formatDate(data.nextSession.scheduledDate, lang === 'ar' ? 'ar-EG' : 'en-GB')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PracticeCountersSection({ lang }: { lang: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get('/dashboard/practice-stats', { schoolId: getSchoolId() }) as any
        setData(res)
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [])

  if (loading) return null
  if (!data || !data.students?.length) return null

  const hasPractice = data.students.filter((s: any) => s.practiceCount > 0).length

  return (
    <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><BookOpen className="h-4 w-4" /></div>
          <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الممارسة العائلية هذا الأسبوع' : 'Weekly Practice'}</h2>
        </div>
        <span className="text-[11px] text-gray-400">
          {hasPractice}/{data.students.length} {lang === 'ar' ? 'مارسوا' : 'practiced'}
        </span>
      </div>
      <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {data.students.map((s: any) => (
          <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
              {s.firstName[0]}{s.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {lang === 'ar' && s.firstNameAr ? `${s.firstNameAr} ${s.lastNameAr || ''}` : `${s.firstName} ${s.lastName}`}
              </div>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              s.practiceCount >= 3
                ? 'bg-green-50 text-green-700'
                : s.practiceCount >= 1
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-gray-50 text-gray-400'
            }`}>
              <BookMarked className="h-3 w-3" />
              {s.practiceCount}x
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressRing({ percent, size = 64, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
 const r = (size - stroke) / 2
 const circ = 2 * Math.PI * r
 const offset = circ * (1 - Math.min(100, Math.max(0, percent)) / 100)
 return (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
   <svg width={size} height={size} className="-rotate-90">
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth={stroke} />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d4af37" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-700" />
   </svg>
   <span className="absolute text-[13px] font-bold text-gray-800">{Math.round(percent)}%</span>
  </div>
 )
}

function ChildCard({ child, lang }: { child: any; lang: string }) {
 const [showMore, setShowMore] = useState(false)
 const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')
 const p = child.progress
 const initials = `${child.firstName?.[0] || ''}${child.lastName?.[0] || ''}`
 const gradePill = child.gradeName || ''
 const atRisk = p && (p.attendancePercent < 80 || p.averageScore < 60)
 const streakNudge = p && p.currentStreak >= 3
 const wc = child.weeklyComparison || {}
 const attChange = wc.attendanceThisWeek != null && wc.attendanceLastWeek != null ? wc.attendanceThisWeek - wc.attendanceLastWeek : 0
 const xpChange = wc.xpThisWeek != null && wc.xpLastWeek != null ? wc.xpThisWeek - wc.xpLastWeek : 0
 const curLesson = child.currentLesson
 const primaryTiles = [
  { label: lang === 'ar' ? 'الحضور' : 'Attendance', value: p ? `${p.attendancePercent}%` : '—', icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', bar: p ? p.attendancePercent : null, barColor: 'from-emerald-400 to-emerald-500' },
  { label: lang === 'ar' ? 'متوسط الدرجات' : 'Avg Score', value: p ? `${p.averageScore}%` : '—', icon: Award, color: 'text-purple-600', bg: 'bg-purple-50', bar: p ? p.averageScore : null, barColor: 'from-purple-400 to-purple-500' },
  { label: lang === 'ar' ? 'النقاط' : 'Points', value: child.totalPoints ?? 0, icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50', bar: null, barColor: '' },
 ]
 const secondaryTiles = [
  { label: lang === 'ar' ? 'السلسلة' : 'Streak', value: p ? `${p.currentStreak}` : '—', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50', bar: null, barColor: '' },
  { label: lang === 'ar' ? 'الشارات' : 'Badges', value: child.badges ?? 0, icon: Star, color: 'text-blue-700', bg: 'bg-blue-50', bar: null, barColor: '' },
 ]
 return (
  <motion.div variants={fadeUp} className="rounded-2xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] overflow-hidden hover:shadow-xl hover:shadow-gold-500/10 transition-all duration-300">
   {/* At-risk banner */}
   {atRisk && (
    <div className="flex items-center gap-2 bg-red-50 px-5 py-2 border-b border-red-100">
     <XCircle className="h-4 w-4 text-red-500 shrink-0" />
     <span className="text-xs font-medium text-red-700">
      {lang === 'ar' ? 'بحاجة للدعم — مستوى الحضور أو الدرجات يحتاج لانتباه' : 'Needs support — attendance or grades need attention'}
     </span>
    </div>
   )}
   {/* Header */}
   <div className="relative p-5 bg-[var(--hymn-surface)] border-b border-[var(--hymn-border)]">
    <div className="flex items-center gap-4">
     {child.photoUrl ? (
      <Image src={API + child.photoUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-2xl object-cover border border-white shadow-sm"  />
     ) : (
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-blue-500 text-white font-bold text-lg shadow-sm">{initials}</div>
     )}
     <div className="min-w-0">
      <h3 className="text-lg font-bold text-[#1A2744] truncate">{child.firstName} {child.lastName}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
       {gradePill && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{gradePill}</span>}
       {child.levelName && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{child.levelName}</span>}
       {child.groupName && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{child.groupName}</span>}
       {streakNudge && (
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
         🔥 {lang === 'ar' ? 'سلسلة {p.currentStreak}' : `Streak ${p.currentStreak}`}
        </span>
       )}
      </div>
     </div>
     {p && (
      <div className="ml-auto">
       <ProgressRing percent={p.progressPercent} />
      </div>
     )}
    </div>
    {p && (
     <div className="mt-4">
      <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-gray-500">
       <span>{lang === 'ar' ? 'التقدم العام' : 'Overall Progress'}</span>
       <span>{p.completedLessons}/{p.totalLessons} {lang === 'ar' ? 'درس' : 'lessons'}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
       <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-blue-500 transition-all duration-700" style={{ width: `${Math.min(100, p.progressPercent)}%` }} />
      </div>
     </div>
    )}
    {/* Current lesson */}
    {curLesson && (
     <div className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
      <BookOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
      <span className="text-[11px] font-medium text-indigo-700 truncate">
       {lang === 'ar' ? 'يتعلم الآن:' : 'Now learning:'} {lang === 'ar' && curLesson.titleAr ? curLesson.titleAr : curLesson.title}
      </span>
     </div>
    )}
   </div>
   {/* Tiles */}
   <div className="grid grid-cols-3 gap-3 p-5">
    {primaryTiles.map((t) => (
     <div key={t.label} className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-gray-50 p-3 text-center">
      <div className={`mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl ${t.bg} ${t.color}`}><t.icon className="h-4 w-4" /></div>
      <div className="text-base font-bold text-gray-900">{t.value}</div>
      <div className="text-[11px] text-gray-400">{t.label}</div>
      {t.bar != null && (
       <div className="mt-1.5 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${t.barColor}`} style={{ width: `${Math.min(100, t.bar)}%` }} />
       </div>
      )}
     </div>
    ))}
   </div>
   {/* Secondary tiles (collapsible) */}
   {showMore && (
    <div className="grid grid-cols-2 gap-3 px-5 pb-3">
     {secondaryTiles.map((t) => (
      <div key={t.label} className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-gray-50 p-3 text-center">
       <div className={`mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl ${t.bg} ${t.color}`}><t.icon className="h-4 w-4" /></div>
       <div className="text-base font-bold text-gray-900">{t.value}</div>
       <div className="text-[11px] text-gray-400">{t.label}</div>
      </div>
     ))}
    </div>
   )}
    <Button variant="ghost" size="sm" onClick={() => setShowMore(!showMore)}
     className="w-full justify-center gap-1 py-4 text-[11px] font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50/30 transition-colors border-t border-gray-100 rounded-none">
     {showMore ? (lang === 'ar' ? 'عرض أقل' : 'Show less') : (lang === 'ar' ? 'عرض المزيد' : `Show more (${secondaryTiles.length} more)`)}
     <ChevronDown className={`h-3 w-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
    </Button>
   {/* Weekly comparison + recent badges */}
   <div className="px-5 pb-3 flex flex-wrap items-center gap-3">
    {wc.xpThisWeek != null && (
     <div className={`flex items-center gap-1 text-[11px] font-medium ${xpChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      <Zap className="h-3 w-3" />
      <span>{lang === 'ar' ? 'نقاط هذا الأسبوع:' : 'XP this week:'} {wc.xpThisWeek}</span>
      {xpChange > 0 && <ArrowUpRight className="h-3 w-3" />}
      {xpChange < 0 && <ArrowUpRight className="h-3 w-3 rotate-90" />}
     </div>
    )}
    {wc.attendanceThisWeek != null && (
     <div className={`flex items-center gap-1 text-[11px] font-medium ${attChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      <UserCheck className="h-3 w-3" />
      <span>{lang === 'ar' ? 'حضور هذا الأسبوع:' : 'Att this week:'} {wc.attendanceThisWeek}%</span>
      {attChange > 0 && <ArrowUpRight className="h-3 w-3" />}
      {attChange < 0 && <ArrowUpRight className="h-3 w-3 rotate-90" />}
     </div>
    )}
    {/* Recent badges */}
    {child.recentBadges?.length > 0 && (
     <div className="flex flex-wrap items-center gap-1.5">
      {child.recentBadges.map((b: any) => (
       <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-gold-100">
        <span className="text-xs">{b.iconUrl || '🏅'}</span>
        {b.name}
       </span>
      ))}
     </div>
    )}
   </div>
   {/* Upcoming sessions */}
   {child.upcomingSessions?.length > 0 && (
    <div className="px-5 pb-3">
     <h5 className="text-[11px] font-semibold text-gray-500 mb-1.5">{lang === 'ar' ? 'الجلسات القادمة' : 'Upcoming Sessions'}</h5>
     <div className="flex flex-wrap gap-2">
      {child.upcomingSessions.map((sess: any) => (
       <div key={sess.id} className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600 border border-gray-100">
        <Calendar className="h-3 w-3 text-gray-400" />
        <span>{new Date(sess.scheduledDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
        {sess.title && <span className="text-gray-400">· {sess.title}</span>}
       </div>
      ))}
     </div>
    </div>
   )}
   {/* Recent Grades */}
   <div className="px-5 pb-5">
    <div className="flex items-center justify-between mb-2">
     <h4 className="text-sm font-semibold text-gray-700">{lang === 'ar' ? 'أحدث الدرجات' : 'Recent Grades'}</h4>
     <Link href="/dashboard/assessments" className="text-xs text-blue-700 font-medium hover:underline">{lang === 'ar' ? 'عرض الكل' : 'View all'}</Link>
    </div>
    {child.recentGrades?.length ? (
     <div className="flex flex-wrap gap-2">
      {child.recentGrades.map((g: any) => (
       <div key={g.id} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${g.passed ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
        <span className="truncate max-w-[160px] sm:max-w-[120px]">{g.assessmentTitle}</span>
        <span className="font-bold">{g.score}/{g.maxScore}</span>
       </div>
      ))}
     </div>
    ) : (
     <p className="text-xs text-gray-400">{lang === 'ar' ? 'لا توجد درجات بعد' : 'No grades yet'}</p>
    )}
   </div>
  </motion.div>
 )
}

function ParentDashboard({ data, loading, error, onRetry }: { data: any; loading: boolean; error: boolean; onRetry: () => void }) {
 const lang = useLanguage()
 const schoolId = getSchoolId()
 const [leaderboard, setLeaderboard] = useState<any[]>([])
 const [lbLoading, setLbLoading] = useState(false)

 useEffect(() => {
  if (!schoolId) return
  setLbLoading(true)
  http.get<any>(`/dashboard/leaderboard?schoolId=${schoolId}&limit=10`)
   .then((res) => setLeaderboard(res?.leaderboard || []))
   .catch(() => {})
   .finally(() => setLbLoading(false))
 }, [schoolId])

 if (loading && !data) return <MineFallback />
 if (error) return <RetryCard onRetry={onRetry} lang={lang} />
 const d = data || {}
 const children: any[] = d.children || []

 const withP = children.filter((c: any) => c.progress)
 const avgAtt = withP.length ? Math.round(withP.reduce((s: number, c: any) => s + (c.progress.attendancePercent || 0), 0) / withP.length) : 0
 const totalXp = children.reduce((s: number, c: any) => s + (c.progress?.totalXp || 0), 0)
 const totalBadges = children.reduce((s: number, c: any) => s + (c.badges || 0), 0)
 // This week aggregates
 const xpThisWeek = children.reduce((s: number, c: any) => s + (c.weeklyComparison?.xpThisWeek || 0), 0)
 const attThisWeek = withP.length ? Math.round(withP.reduce((s: number, c: any) => s + (c.weeklyComparison?.attendanceThisWeek || 0), 0) / withP.length) : 0
 const attLastWeek = withP.length ? Math.round(withP.reduce((s: number, c: any) => s + (c.weeklyComparison?.attendanceLastWeek || 0), 0) / withP.length) : 0
 const attTrendUp = attThisWeek >= attLastWeek
 const xpMilestoneNext = 2000
 const xpProgress = Math.min(100, Math.round((totalXp / xpMilestoneNext) * 100))

 const topStreak = Math.max(...withP.map((c: any) => c.progress.currentStreak || 0), 0)

 const parentGreeting = (
  <>
   <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
    <Baby className="h-5 w-5 text-gold-300" />
   </div>
   <span>{lang === 'ar' ? getGreetingAr() : getGreeting()}</span>
  </>
 )

 const parentBadges = <p className="text-white/60 text-sm">{getFullDay(lang)}</p>

 return (
  <>
<title>{lang === 'ar' ? 'أولادي' : 'My Children'} — Coptic Orthodox Hymn Education Platform (COHEP)</title>
    <meta name="description" content="Coptic Orthodox Hymn Education Platform (COHEP) parent dashboard" />
   <motion.div className="space-y-6" initial="initial" animate="animate" variants={stagger}>
    {/* Hero */}
    <DashboardHero
      bg="var(--hymn-indigo)"
      title={lang === 'ar' ? 'أولادي' : 'My Children'}
      greeting={parentGreeting}
      badges={parentBadges}
      orbTint="bg-indigo-500/10"
    />

    {/* Aggregate summary */}
    {children.length > 0 && (
     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
       { label: lang === 'ar' ? 'الأبناء' : 'Children', value: children.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
       { label: lang === 'ar' ? 'متوسط الحضور' : 'Avg Attendance', value: `${avgAtt}%`, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
       { label: lang === 'ar' ? 'إجمالي النقاط' : 'Total XP', value: totalXp, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
       { label: lang === 'ar' ? 'إجمالي الشارات' : 'Total Badges', value: totalBadges, icon: Star, color: 'text-blue-700', bg: 'bg-blue-50' },
      ].map((s) => (
       <motion.div key={s.label} variants={fadeUp} className="flex items-center gap-3 border-t border-[var(--hymn-border)] p-3.5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} ${s.color}`}><s.icon className="h-5 w-5" /></div>
        <div>
         <h3 className="text-lg font-bold text-gray-900 leading-none">{s.value}</h3>
         <div className="text-[11px] text-gray-400 mt-1">{s.label}</div>
        </div>
       </motion.div>
      ))}
     </div>
    )}

    {/* This Week at a Glance */}
    {children.length > 0 && (
     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <motion.div variants={fadeUp} className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] p-4 flex items-center gap-4">
       <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600">
        <TrendingUp className="h-6 w-6" />
       </div>
       <div>
        <div className="text-xs text-gray-400 mb-0.5">{lang === 'ar' ? 'نقاط هذا الأسبوع' : 'XP This Week'}</div>
        <div className="text-xl font-bold text-gray-900">{xpThisWeek}</div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
         <div className={`h-2 w-full max-w-[80px] rounded-full bg-gray-100 overflow-hidden`}>
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500" style={{ width: `${xpProgress}%` }} />
         </div>
         <span>{totalXp}/{xpMilestoneNext}</span>
        </div>
       </div>
      </motion.div>
      <motion.div variants={fadeUp} className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] p-4 flex items-center gap-4">
       <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600">
        <UserCheck className="h-6 w-6" />
       </div>
       <div>
        <div className="text-xs text-gray-400 mb-0.5">{lang === 'ar' ? 'الحضور هذا الأسبوع' : 'Attendance Trend'}</div>
        <div className="text-xl font-bold text-gray-900">{attThisWeek}%</div>
        <div className="flex items-center gap-1 text-xs mt-0.5">
         {attTrendUp ? (
          <span className="text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{lang === 'ar' ? 'تحسن عن الأسبوع الماضي' : 'Up from last week'}</span>
         ) : (
          <span className="text-red-500 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3 rotate-90" />{lang === 'ar' ? 'انخفاض عن الأسبوع الماضي' : 'Down from last week'}</span>
         )}
        </div>
       </div>
      </motion.div>
      <motion.div variants={fadeUp} className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] p-4 flex items-center gap-4">
       <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600">
        <Flame className="h-6 w-6" />
       </div>
       <div>
        <div className="text-xs text-gray-400 mb-0.5">{lang === 'ar' ? 'أفضل سلسلة حضور' : 'Best Streak'}</div>
        <div className="text-xl font-bold text-gray-900">{topStreak} {lang === 'ar' ? 'أسابيع' : 'weeks'}</div>
        <div className="text-xs mt-0.5">
         {topStreak >= 3 ? (
          <span className="text-orange-600 font-medium">{lang === 'ar' ? '🔥 استمر في السلسلة!' : '🔥 Keep the chain going!'}</span>
         ) : (
          <span className="text-gray-400">{lang === 'ar' ? 'ابنِ سلسلة حضور الآن' : 'Build your streak now'}</span>
         )}
        </div>
       </div>
      </motion.div>
     </div>
    )}

    {/* Leaderboard */}
    {leaderboard.length > 0 && (
     <motion.div variants={fadeUp} className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
       <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--hymn-border)] bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
         <Trophy className="h-5 w-5 text-blue-700" />
         <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'لوحة الشرف' : 'Leaderboard'}</h2>
       </div>
       <span className="text-[11px] text-gray-400">{lang === 'ar' ? 'أفضل الطلاب' : 'Top Students'}</span>
      </div>
      <div className="divide-y divide-gray-50">
       {leaderboard.map((s: any, i: number) => (
        <div key={s.studentId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${i < 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s.rank}</div>
         <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</div>
          <div className="text-[10px] text-gray-400">{s.gradeName || s.levelName || ''}</div>
         </div>
         <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">
          <Zap className="h-3.5 w-3.5" />{s.totalXp}
         </div>
        </div>
       ))}
      </div>
     </motion.div>
    )}

    {d.isDemo && (
     <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
      <Info className="h-4 w-4 shrink-0" />
      <span>{lang === 'ar' ? 'معاينة: لا يوجد أبناء مرتبطون بحسابك — يتم عرض طلاب نموذجيين.' : 'Preview: no children are linked to your account — showing sample students.'}</span>
     </div>
    )}

    {children.length === 0 ? (
     <div className="rounded-xl border border-[var(--hymn-border)] bg-[var(--hymn-surface)] p-10"><EmptyState icon={Baby} title={lang === 'ar' ? 'لا يوجد أبناء مرتبطون' : 'No children linked'} description={lang === 'ar' ? 'اربط أبناءك من إعدادات الحساب.' : 'Link your children from account settings.'} /></div>
    ) : (
     <div className="grid gap-6 lg:grid-cols-2">
      {children.map((c) => <ChildCard key={c.id} child={c} lang={lang} />)}
     </div>
    )}
   </motion.div>
  </>
 )
}

export default function DashboardPage() {
 const { toast } = useToast()
 const [refreshKey, setRefreshKey] = useState(0)
 const lang = useLanguage()

 const { effectiveRole, ready } = useActiveRole()
 const category = roleCategory(effectiveRole)
 const [mine, setMine] = useState<any>(null)
 const [mineLoading, setMineLoading] = useState(false)
 const [mineError, setMineError] = useState(false)

 const primary = useAsync<PrimaryData>(
  () => (ready && category === 'management'
   ? fetchPrimaryData()
    : Promise.resolve({ stats: EMPTY_STATS, churchLogo: null, churchName: '' })),
  [refreshKey, category, ready],
 )
 const servants = useAsync<ServantCounts>(
  () => (ready && category === 'management'
   ? fetchServantCounts()
   : Promise.resolve({ total: 0, servants: 0, groupLeaders: 0, levelLeaders: 0 })),
  [refreshKey, category, ready],
 )

 useEffect(() => {
  if (category === 'management') return
  let cancelled = false
  setMineLoading(true)
  setMineError(false)
  http.get(`/dashboard/mine?schoolId=${getSchoolId()}&viewRole=${effectiveRole}`)
   .then((d: any) => { if (!cancelled) { setMine(d); setMineLoading(false) } })
   .catch(() => { if (!cancelled) { setMineError(true); setMineLoading(false) } })
  return () => { cancelled = true }
 }, [category, effectiveRole, refreshKey])

 const poll = useCallback(() => setRefreshKey(k => k + 1), [])

 useEffect(() => {
  const interval = setInterval(poll, 120000)
  return () => clearInterval(interval)
 }, [poll])

 const handleRetry = useCallback(() => setRefreshKey(k => k + 1), [])

 if (category === 'parent') {
  return <ParentDashboard data={mine} loading={mineLoading} error={mineError} onRetry={handleRetry} />
 }
 if (category === 'ministry') {
  return <MinistryDashboard data={mine} loading={mineLoading} error={mineError} onRetry={handleRetry} />
 }

 return (
  <>
<title>Dashboard — Coptic Orthodox Hymn Education Platform (COHEP)</title>
    <meta name="description" content="Coptic Orthodox Hymn Education Platform (COHEP) management dashboard — students, servants, attendance, assessments, and more." />

   <motion.div className="space-y-6" initial="initial" animate="animate" variants={stagger}>
    {/* Hero */}
    <ErrorBoundary onRetry={handleRetry}>
     <HeroSection stats={primary.data?.stats ?? null} churchLogo={primary.data?.churchLogo ?? null} churchName={primary.data?.churchName ?? ''} loading={primary.loading} />
    </ErrorBoundary>

    {/* Next Session — curriculum subject items allocated for the day (all levels for admin) */}
    <ErrorBoundary onRetry={handleRetry}>
     <motion.div variants={fadeUp}>
      <NextSessionCard lang={lang} />
     </motion.div>
    </ErrorBoundary>

    {/* Quick Actions */}
    <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-5 gap-3">
     {QUICK_ACTIONS.map((a) => (
      <motion.div key={a.label} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Link href={a.href}
         className="group flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-300 hover:bg-gray-50 hover:-translate-y-0.5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${a.color} text-white shadow-lg ${a.shadow} group-hover:shadow-xl group-hover:scale-110 group-active:scale-110 transition-transform duration-300`}
         style={{ transformStyle: 'preserve-3d', perspective: '400px' }}>
         <a.icon className="h-5 w-5" />
        </div>
        <div className="relative">
         <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{lang === 'ar' ? a.labelAr : a.label}</div>
         <div className="text-[11px] text-gray-400 flex items-center gap-0.5">
          {lang === 'ar' ? 'فتح' : 'Open'} <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
         </div>
        </div>
       </Link>
      </motion.div>
     ))}
    </motion.div>

    {/* Stats Cards */}
    <ErrorBoundary onRetry={handleRetry}>
     <StatsSection stats={primary.data?.stats ?? null} loading={primary.loading} />
    </ErrorBoundary>

    {/* Servants */}
    <ErrorBoundary onRetry={handleRetry}>
     <ServantSection counts={servants.data} loading={servants.loading} />
    </ErrorBoundary>

    {/* Analytics — recharts */}
    <ErrorBoundary onRetry={handleRetry}>
     <motion.div variants={fadeUp}>
      <AnalyticsSection stats={primary.data?.stats ?? null} loading={primary.loading} />
     </motion.div>
    </ErrorBoundary>

    {/* Main Grid: Charts + Leaderboard */}
    <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-3">
     {/* Weekly Attendance Chart */}
      <div className="lg:col-span-2 rounded-xl border border-gray-200/60 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
       <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
         <BarChart3 className="h-4 w-4" />
        </div>
        <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الحضور هذا الأسبوع' : 'Weekly Attendance'}</h2>
       </div>
       <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">{lang === 'ar' ? 'نظرة عامة على 7 أيام' : '7-day overview'}</span>
      </div>
      <ErrorBoundary onRetry={handleRetry}>
       <AttendanceChartSection stats={primary.data?.stats ?? null} loading={primary.loading} />
      </ErrorBoundary>
     </div>

     {/* Top Students Leaderboard */}
      <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
       <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
         <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
          <Trophy className="h-4 w-4" />
         </div>
         <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'أفضل الطلاب' : 'Top Students'}</h2>
       </div>
       <Link href="/dashboard/gamification" className="text-xs text-blue-700 font-medium hover:text-blue-800 flex items-center gap-0.5 group">
        {lang === 'ar' ? 'عرض الكل' : 'View all'} <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
       </Link>
      </div>
      <ErrorBoundary onRetry={handleRetry}>
       <LeaderboardSection stats={primary.data?.stats ?? null} loading={primary.loading} />
      </ErrorBoundary>
     </div>
    </motion.div>

    {/* Bottom Row: Assessments, Activity, Upcoming */}
    <motion.div variants={fadeUp} className="grid gap-6 lg:grid-cols-3">
     {/* Assessment Performance */}
      <div className="rounded-xl border border-gray-200/60 bg-white">
       <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
         <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
          <ClipboardCheck className="h-4 w-4" />
         </div>
         <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'أداء التقييمات' : 'Assessment Performance'}</h2>
       </div>
      </div>
      <ErrorBoundary onRetry={handleRetry}>
       <AssessmentSection stats={primary.data?.stats ?? null} loading={primary.loading} />
      </ErrorBoundary>
     </div>

     {/* Recent Activity */}
      <div className="rounded-xl border border-gray-200/60 bg-white">
       <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
         <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
          <Clock className="h-4 w-4" />
         </div>
         <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}</h2>
       </div>
      </div>
      <ErrorBoundary onRetry={handleRetry}>
       <ActivitySection stats={primary.data?.stats ?? null} loading={primary.loading} />
      </ErrorBoundary>
     </div>

     {/* Upcoming Sessions */}
      <div className="rounded-xl border border-gray-200/60 bg-white">
       <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
         <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
          <Calendar className="h-4 w-4" />
         </div>
         <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الفصول القادمة' : 'Upcoming Classes'}</h2>
       </div>
       <span className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded-full">{/* count handled inside */}</span>
      </div>
      <ErrorBoundary onRetry={handleRetry}>
       <UpcomingSection stats={primary.data?.stats ?? null} loading={primary.loading} />
      </ErrorBoundary>
     </div>
    </motion.div>

    {/* Recent Grades */}
    <ErrorBoundary onRetry={handleRetry}>
      <div className="rounded-xl border border-gray-200/60 bg-white overflow-hidden">
       <div className="flex items-center justify-between border-b border-[var(--hymn-border)] px-5 py-4 bg-[var(--hymn-surface-header)]">
        <div className="flex items-center gap-2">
         <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hymn-surface-header)] text-blue-700 ring-1 ring-gold-200/50">
          <Award className="h-4 w-4" />
         </div>
         <h2 className="font-semibold text-gray-900">{lang === 'ar' ? 'الدرجات الأخيرة' : 'Recent Grades'}</h2>
       </div>
       <Link href="/dashboard/assessments" className="text-xs text-blue-700 font-medium hover:text-blue-800 flex items-center gap-0.5 group">
        {lang === 'ar' ? 'عرض الكل' : 'View all'} <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
       </Link>
      </div>
      <RecentGradesSection stats={primary.data?.stats ?? null} loading={primary.loading} />
     </div>
    </ErrorBoundary>
   </motion.div>
  </>
 )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Trophy, Star, Flame, Medal, Award, Target, TrendingUp, Loader2, Plus, Pencil, Trash2, Search, Eye, Info,
  CheckCheck, Mic, Church, Calendar, Zap, Gem, Crown, BookOpen, Music, Shield, Bell, Cross, Feather, Sparkles,
  CircleDollarSign, Dumbbell, Baby,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'
import { Badge as UIBadge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { Tabs } from '@/components/ui/tabs'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { CardSkeleton } from '@/components/ui/skeleton'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'

interface LeaderboardEntry {
  id: string
  firstName: string
  lastName: string
  xp: number
  level: number
  streak: number
  rank: number
  badgeCount: number
}

interface BadgeItem {
  id: string
  name: string
  description: string | null
  category: string
  iconUrl: string
  points: number
  isActive: boolean
}

interface StatsResponse {
  totalXp: number
  totalBadges: number
  totalStreaks: number
  avgEngagement: number
}

const RANK_ICONS: Record<number, typeof Medal> = { 1: Medal, 2: Medal, 3: Medal }

const TX_ICONS: Record<string, typeof Award> = {
  badge_award: Award,
  attendance_xp: Calendar,
  behavior_bonus: Star,
  participation_bonus: Mic,
  liturgy_bonus: Church,
  assessment: CheckCheck,
}

const TX_LABELS: Record<string, string> = {
  badge_award: 'Badge earned',
  attendance_xp: 'Attendance XP',
  behavior_bonus: 'Behavior bonus',
  participation_bonus: 'Participation bonus',
  liturgy_bonus: 'Liturgy attendance',
  assessment: 'Assessment score',
}

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, Star, Mic, Church, Calendar, Gem, CircleDollarSign, Zap, CheckCheck,
  Sparkles, TrendingUp, Award, Flame, Dumbbell, Target, Crown, BookOpen, Music,
  Cross, Feather, Shield, Bell, Medal, Baby,
}

const ICON_OPTIONS = Object.keys(ICON_MAP)

const CATEGORY_COLORS: Record<string, string> = {
  attendance: 'bg-green-50 border-green-200',
  assessment: 'bg-blue-50 border-blue-200',
  participation: 'bg-purple-50 border-purple-200',
  streak: 'bg-orange-50 border-orange-200',
  mastery: 'bg-blue-50 border-blue-200',
  behavior: 'bg-amber-50 border-amber-200',
  liturgy: 'bg-indigo-50 border-indigo-200',
  points: 'bg-cyan-50 border-cyan-200',
  xp: 'bg-pink-50 border-pink-200',
  improvement: 'bg-lime-50 border-lime-200',
  academic: 'bg-blue-50 border-blue-200',
  default: 'bg-gray-50 border-gray-200',
}

const BADGE_CATEGORY_OPTIONS = [
  'attendance', 'assessment', 'participation', 'streak', 'mastery',
  'behavior', 'liturgy', 'points', 'xp', 'improvement', 'academic', 'other',
]

const emptyBadgeForm = {
  name: '',
  description: '',
  category: 'participation',
  iconUrl: '',
  points: '',
}

function friendlyError(err: any, lang: string): string {
  if (!err) return lang === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred'
  const msg = err?.message || ''
  if (msg.includes('401') || msg.includes('Unauthorized')) return lang === 'ar' ? 'انتهت الجلسة — يرجى تسجيل الدخول مرة أخرى' : 'Session expired — please sign in again'
  if (msg.includes('403') || msg.includes('Forbidden')) return lang === 'ar' ? 'ليس لديك صلاحية للقيام بهذا الإجراء' : 'You don\'t have permission to do that'
  if (msg.includes('404') || msg.includes('Not found')) return lang === 'ar' ? 'العنصر غير موجود' : 'Item not found'
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('Network')) return lang === 'ar' ? 'تعذر الاتصال بالخادم — تحقق من اتصالك بالإنترنت' : 'Cannot reach server — check your connection'
  if (msg.includes('429') || msg.includes('Too Many Requests')) return lang === 'ar' ? 'طلبات كثيرة جداً — انتظر لحظة ثم حاول مرة أخرى' : 'Too many requests — wait a moment and try again'
  return lang === 'ar' ? 'حدث خطأ — يرجى المحاولة مرة أخرى' : 'Something went wrong — please try again'
}

export default function GamificationPage() {
  const { toast } = useToast()
  const lang = useLanguage()
  const pageRef = useRef<HTMLDivElement>(null)

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardSearch, setLeaderboardSearch] = useState('')

  const [badges, setBadges] = useState<BadgeItem[]>([])
  const [badgesLoading, setBadgesLoading] = useState(true)
  const [badgeSearch, setBadgeSearch] = useState('')

  const [activeTab, setActiveTab] = useState('leaderboard')

  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [showBadgeForm, setShowBadgeForm] = useState(false)
  const [badgeForm, setBadgeForm] = useState(emptyBadgeForm)
  const [badgeFormError, setBadgeFormError] = useState('')
  const [savingBadge, setSavingBadge] = useState(false)

  const [showEditBadge, setShowEditBadge] = useState(false)
  const [badgeToEdit, setBadgeToEdit] = useState<BadgeItem | null>(null)
  const [editBadgeForm, setEditBadgeForm] = useState(emptyBadgeForm)
  const [editBadgeFormError, setEditBadgeFormError] = useState('')
  const [savingEditBadge, setSavingEditBadge] = useState(false)

  const [showDeleteBadge, setShowDeleteBadge] = useState(false)
  const [badgeToDelete, setBadgeToDelete] = useState<BadgeItem | null>(null)
  const [deletingBadge, setDeletingBadge] = useState(false)

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resettingLeaderboard, setResettingLeaderboard] = useState(false)

  const [drillDownStudent, setDrillDownStudent] = useState<LeaderboardEntry | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [transactionsSkip, setTransactionsSkip] = useState(0)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsLoadingMore, setTransactionsLoadingMore] = useState(false)

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true)
    try {
      const data = await http.get<LeaderboardEntry[]>('/gamification/leaderboard', { schoolId: getSchoolId() })
      setLeaderboard(data)
    } catch (e: any) {
      toast('error', friendlyError(e, lang))
    }
    setLeaderboardLoading(false)
  }, [toast, lang])

  const fetchBadges = useCallback(async () => {
    setBadgesLoading(true)
    try {
      const data = await http.get<BadgeItem[]>('/gamification/badges', { schoolId: getSchoolId() })
      setBadges(data.map((b: any) => ({ ...b, points: b.xpReward ?? b.points ?? 0 })))
    } catch (e: any) {
      toast('error', lang === 'ar' ? 'فشل تحميل الشارات' : 'Failed to load badges')
    }
    setBadgesLoading(false)
  }, [toast, lang])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data: LeaderboardEntry[] = await http.get<LeaderboardEntry[]>('/gamification/leaderboard', { schoolId: getSchoolId() })
      const activeWithXp = data.filter(e => e.xp > 0).length
      setStats({
        totalXp: data.reduce((sum, e) => sum + e.xp, 0),
        totalBadges: data.reduce((sum, e) => sum + e.badgeCount, 0),
        totalStreaks: data.filter(e => e.streak > 0).length,
        avgEngagement: data.length ? Math.round((activeWithXp / data.length) * 100) : 0,
      })
    } catch (e: any) {
      toast('error', friendlyError(e, lang))
    }
    setStatsLoading(false)
  }, [toast, lang])

  useEffect(() => {
    fetchLeaderboard()
    fetchBadges()
    fetchStats()
  }, [fetchLeaderboard, fetchBadges, fetchStats])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'l' || e.key === 'L') { setActiveTab('leaderboard') }
      if (e.key === 'b' || e.key === 'B') { setActiveTab('badges') }
      if (e.key === 'n' || e.key === 'N') { if (activeTab === 'badges') openBadgeForm() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab])

  // Badge CRUD

  const openBadgeForm = () => {
    setBadgeForm(emptyBadgeForm)
    setBadgeFormError('')
    setShowBadgeForm(true)
  }

  const handleCreateBadge = async () => {
    setBadgeFormError('')
    if (!badgeForm.name.trim()) {
      setBadgeFormError(lang === 'ar' ? 'الاسم مطلوب' : 'Name is required')
      return
    }
    const pts = Number(badgeForm.points)
    if (!pts || pts <= 0 || !Number.isInteger(pts)) {
      setBadgeFormError(lang === 'ar' ? 'يجب أن تكون النقاط رقماً صحيحاً موجباً' : 'Points must be a positive whole number')
      return
    }
    setSavingBadge(true)
    try {
      await http.post('/gamification/badges', {
        name: badgeForm.name.trim(),
        description: badgeForm.description.trim(),
        category: badgeForm.category,
        iconUrl: badgeForm.iconUrl || undefined,
        points: pts,
      })
      setShowBadgeForm(false)
      fetchBadges()
      fetchStats()
      toast('success', lang === 'ar' ? 'تم إنشاء الشارة' : 'Badge created')
    } catch (e: any) {
      setBadgeFormError(friendlyError(e, lang))
      toast('error', friendlyError(e, lang))
    }
    setSavingBadge(false)
  }

  const openEditBadge = (badge: BadgeItem) => {
    setBadgeToEdit(badge)
    setEditBadgeForm({
      name: badge.name,
      description: badge.description || '',
      category: badge.category,
      iconUrl: badge.iconUrl || '',
      points: String(badge.points),
    })
    setEditBadgeFormError('')
    setShowEditBadge(true)
  }

  const handleEditBadge = async () => {
    if (!badgeToEdit) return
    setEditBadgeFormError('')
    if (!editBadgeForm.name.trim()) { setEditBadgeFormError(lang === 'ar' ? 'الاسم مطلوب' : 'Name is required'); return }
    const pts = Number(editBadgeForm.points)
    if (!pts || pts <= 0 || !Number.isInteger(pts)) { setEditBadgeFormError(lang === 'ar' ? 'يجب أن تكون النقاط رقماً صحيحاً موجباً' : 'Points must be a positive whole number'); return }
    setSavingEditBadge(true)
    try {
      await http.put(`/gamification/badges/${badgeToEdit.id}`, {
        name: editBadgeForm.name.trim(),
        description: editBadgeForm.description.trim() || undefined,
        category: editBadgeForm.category,
        iconUrl: editBadgeForm.iconUrl || undefined,
        points: pts,
      })
      setShowEditBadge(false)
      fetchBadges()
      fetchStats()
      toast('success', lang === 'ar' ? 'تم تحديث الشارة' : 'Badge updated')
    } catch (e: any) {
      setEditBadgeFormError(friendlyError(e, lang))
      toast('error', friendlyError(e, lang))
    }
    setSavingEditBadge(false)
  }

  const openDeleteBadge = (badge: BadgeItem) => {
    setBadgeToDelete(badge)
    setShowDeleteBadge(true)
  }

  const handleDeleteBadge = async () => {
    if (!badgeToDelete) return
    setDeletingBadge(true)
    try {
      await http.delete(`/gamification/badges/${badgeToDelete.id}`)
      setShowDeleteBadge(false)
      fetchBadges()
      fetchStats()
      toast('success', lang === 'ar' ? 'تم حذف الشارة' : 'Badge deleted')
    } catch (e: any) {
      toast('error', friendlyError(e, lang))
    }
    setDeletingBadge(false)
  }

  // Drill-down

  const openDrillDown = async (entry: LeaderboardEntry) => {
    setDrillDownStudent(entry)
    setTransactions([])
    setTransactionsTotal(0)
    setTransactionsSkip(0)
    setTransactionsLoading(true)
    try {
      const data = await http.get<any>(`/gamification/students/${entry.id}/transactions`)
      setTransactions(data.items || [])
      setTransactionsTotal(data.total || 0)
      setTransactionsSkip(data.skip || 0)
    } catch { /* ignore */ }
    setTransactionsLoading(false)
  }

  const loadMoreTransactions = async () => {
    if (!drillDownStudent) return
    setTransactionsLoadingMore(true)
    const nextSkip = transactionsSkip + (transactions.length || 0)
    try {
      const data = await http.get<any>(`/gamification/students/${drillDownStudent.id}/transactions?skip=${nextSkip}&take=50`)
      setTransactions(prev => [...prev, ...(data.items || [])])
      setTransactionsTotal(data.total || 0)
    } catch { /* ignore */ }
    setTransactionsLoadingMore(false)
  }

  // Reset

  const handleResetLeaderboard = async () => {
    setResettingLeaderboard(true)
    try {
      await http.delete('/gamification/leaderboard', { schoolId: getSchoolId() })
      setShowResetConfirm(false)
      setResetConfirmText('')
      fetchLeaderboard()
      fetchStats()
      toast('success', lang === 'ar' ? 'تم إعادة تعيين لوحة المتصدرين' : 'Leaderboard reset')
    } catch (e: any) {
      toast('error', friendlyError(e, lang))
    }
    setResettingLeaderboard(false)
  }

  // Derived

  const top3 = leaderboard.slice(0, 3)
  const filteredLeaderboard = leaderboardSearch.trim()
    ? leaderboard.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(leaderboardSearch.toLowerCase()))
    : leaderboard
  const filteredBadges = badgeSearch.trim()
    ? badges.filter(b => b.name.toLowerCase().includes(badgeSearch.toLowerCase()))
    : badges

  const hasMoreTransactions = transactions.length < transactionsTotal

  return (
    <div className="space-y-6" ref={pageRef}>
      <title>{lang === 'ar' ? 'التلعيب — Coptic Orthodox Hymn Education Platform (COHEP)' : 'Gamification — Coptic Orthodox Hymn Education Platform (COHEP)'}</title>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'التلعيب' : 'Gamification'}</h1>
          <p className="text-sm text-gray-500">{lang === 'ar' ? 'الشارات، نقاط الخبرة، وتتبع مشاركة الطلاب' : 'Badges, XP, and student engagement tracking'}</p>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">L</span><span>{lang === 'ar' ? 'المتصدرين' : 'Leaderboard'}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono ml-2">B</span><span>{lang === 'ar' ? 'الشارات' : 'Badges'}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono ml-2">N</span><span>{lang === 'ar' ? 'شارة جديدة' : 'New badge'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <CardSkeleton count={4} />
        ) : (
          <>
            <StatCard label={lang === 'ar' ? 'إجمالي نقاط الخبرة الممنوحة' : 'Total XP Awarded'} value={stats?.totalXp?.toLocaleString() ?? '0'} icon={Star} iconBg="bg-blue-50" iconColor="text-blue-700" />
            <StatCard label={lang === 'ar' ? 'الشارات المكتسبة' : 'Badges Earned'} value={stats?.totalBadges?.toLocaleString() ?? '0'} icon={Trophy} iconBg="bg-green-50" iconColor="text-green-600" />
            <StatCard label={lang === 'ar' ? 'التتابعات النشطة' : 'Active Streaks'} value={stats?.totalStreaks?.toLocaleString() ?? '0'} icon={Flame} iconBg="bg-orange-50" iconColor="text-orange-600" />
            <div className="relative group rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="text-lg font-bold text-gray-900">{stats?.avgEngagement ?? 0}%</div>
                  <Info className="h-3.5 w-3.5 text-gray-300 cursor-help" />
                </div>
                <div className="text-xs text-gray-500">{lang === 'ar' ? 'الطلاب النشطون' : 'Active Students'}</div>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                {lang === 'ar' ? 'نسبة الطلاب الذين حصلوا على نقاط خبرة على الإطلاق' : '% of students who have ever earned XP'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top 3 Podium */}
      {!statsLoading && top3.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {top3.map((s) => (
            <div key={s.id} className={`rounded-xl border bg-white p-5 text-center transition-all hover:shadow-md ${
              s.rank === 1 ? 'border-blue-300 ring-1 ring-gold-200' : 'border-gray-200'
            }`}>
              <div className="flex justify-center">
                {s.rank <= 3 ? <Medal className={`h-8 w-8 ${s.rank === 1 ? 'text-yellow-500' : s.rank === 2 ? 'text-gray-400' : 'text-amber-700'}`} /> : <span className="text-3xl font-bold text-gray-400">#{s.rank}</span>}
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900">{s.firstName} {s.lastName}</div>
              <div className="text-sm text-gray-500">{lang === 'ar' ? 'المستوى' : 'Level'} {s.level}</div>
              <div className="mt-2 text-xl font-bold text-blue-700">{s.xp.toLocaleString()} {lang === 'ar' ? 'ن.خ' : 'XP'}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500">
                <Award className="h-3 w-3" /> {s.badgeCount} {lang === 'ar' ? 'شارات' : 'badges'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How XP Works */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2.5">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          {lang === 'ar'
            ? 'نقاط الخبرة (XP) تُكتسب من: الحضور المنتظم، السلوك الممتاز، المشاركة الفعالة، حضور القداس، والشارات. يتقدم الطالب إلى المستوى التالي كل 100 نقطة خبرة.'
            : 'XP is earned through: consistent attendance, excellent behavior, active participation, liturgy attendance, and earning badges. Students level up every 100 XP.'}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'leaderboard', label: lang === 'ar' ? 'لوحة المتصدرين' : 'Leaderboard', icon: Trophy, count: leaderboard.length },
          { id: 'badges', label: lang === 'ar' ? 'الشارات' : 'Badges', icon: Award, count: badges.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div role="tabpanel" id="panel-leaderboard" aria-labelledby="tab-leaderboard">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {leaderboardLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
              </div>
            ) : leaderboard.length === 0 ? (
              <EmptyState icon={Trophy} title={lang === 'ar' ? 'لا يوجد طلاب بعد' : 'No students yet'} description={lang === 'ar' ? 'سيظهر الطلاب هنا بمجرد حصولهم على نقاط الخبرة.' : 'Students will appear here once they earn XP.'} />
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      value={leaderboardSearch}
                      onChange={e => setLeaderboardSearch(e.target.value)}
                      placeholder={lang === 'ar' ? 'ابحث باسم طالب...' : 'Search by name...'}
                      className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-1.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label={lang === 'ar' ? 'بحث في لوحة المتصدرين' : 'Search leaderboard'}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)}
                    className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                    aria-describedby="reset-desc">
                    {lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
                  </Button>
                </div>
                <p id="reset-desc" className="sr-only">{lang === 'ar' ? 'إعادة تعيين لوحة المتصدرين — هذا الإجراء نهائي' : 'Reset leaderboard — this action is permanent'}</p>
                <div className="overflow-x-auto table-to-cards">
                  <table className="w-full" role="table">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-20">{lang === 'ar' ? 'الترتيب' : 'Rank'}</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'ن.خ' : 'XP'}</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الشارات' : 'Badges'}</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'المستوى' : 'Level'}</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 w-16">{lang === 'ar' ? 'التفاصيل' : 'Details'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredLeaderboard.map((s) => (
                        <tr key={s.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 py-3" data-label="Rank">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                              s.rank <= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {s.rank <= 3 ? <Medal className={`h-4 w-4 ${s.rank === 1 ? 'text-yellow-500' : s.rank === 2 ? 'text-gray-400' : 'text-amber-700'}`} /> : s.rank}
                            </div>
                          </td>
                          <td className="px-4 py-3" data-label="Student">
                            <div className="text-sm font-medium text-gray-900">{s.firstName} {s.lastName}</div>
                          </td>
                          <td className="px-4 py-3 text-right" data-label="XP">
                            <div className="text-sm font-semibold text-gray-900">{s.xp.toLocaleString()}</div>
                          </td>
                          <td className="px-4 py-3 text-right" data-label="Badges">
                            <div className="inline-flex items-center gap-1 text-sm text-gray-600">
                              <Award className="h-3.5 w-3.5" /> {s.badgeCount}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right" data-label="Level">
                            <UIBadge variant="info">{lang === 'ar' ? 'مستوى' : 'Lv'} {s.level}</UIBadge>
                          </td>
                          <td className="px-4 py-3 text-right" data-label="Details">
                            <Button variant="outline" size="sm"
                              onClick={() => openDrillDown(s)}
                              className="text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 shrink-0"
                              aria-label={lang === 'ar' ? `عرض تفاصيل ${s.firstName} ${s.lastName}` : `View details for ${s.firstName} ${s.lastName}`}
                            >
                              <Eye className="h-3 w-3" />
                              {lang === 'ar' ? 'عرض' : 'View'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredLeaderboard.length === 0 && leaderboardSearch.trim() && (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    {lang === 'ar' ? `لا توجد نتائج لـ "${leaderboardSearch}"` : `No results for "${leaderboardSearch}"`}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Badges Tab */}
      {activeTab === 'badges' && (
        <div role="tabpanel" id="panel-badges" aria-labelledby="tab-badges">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={badgeSearch}
                onChange={e => setBadgeSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث عن شارة...' : 'Search badges...'}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                aria-label={lang === 'ar' ? 'بحث في الشارات' : 'Search badges'}
              />
            </div>
            <Button
              onClick={openBadgeForm}
              className="shrink-0"
              aria-label={lang === 'ar' ? 'إضافة شارة جديدة' : 'Add new badge'}
            >
              <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة شارة' : 'Add Badge'}
            </Button>
          </div>

          {badgesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <CardSkeleton count={8} />
            </div>
          ) : badges.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white">
              <EmptyState
                icon={Award}
                title={lang === 'ar' ? 'لا توجد شارات بعد' : 'No badges yet'}
                description={lang === 'ar' ? 'أنشئ شارات لمكافأة إنجازات الطلاب.' : 'Create badges to reward student achievements.'}
                action={
                  <Button onClick={openBadgeForm}>
                    <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إنشاء أول شارة' : 'Create First Badge'}
                  </Button>
                }
              />
            </div>
          ) : filteredBadges.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
              {lang === 'ar' ? `لا توجد شارات تطابق "${badgeSearch}"` : `No badges match "${badgeSearch}"`}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`rounded-xl border p-4 transition-all hover:shadow-sm ${CATEGORY_COLORS[badge.category] || CATEGORY_COLORS.default}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-2xl">{(() => { const Icon = ICON_MAP[badge.iconUrl]; return Icon ? <Icon className="h-7 w-7" /> : (badge.iconUrl || '🏅') })()}</div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => openEditBadge(badge)}
                        aria-label={lang === 'ar' ? `تحرير ${badge.name}` : `Edit ${badge.name}`}
                        className="text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => openDeleteBadge(badge)}
                        aria-label={lang === 'ar' ? `حذف ${badge.name}` : `Delete ${badge.name}`}
                        className="text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">{badge.name}</h3>
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{badge.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <UIBadge variant="outline" size="sm">{lang === 'ar'
                      ? ({ attendance: 'حضور', assessment: 'تقييم', participation: 'مشاركة', streak: 'تتابع', mastery: 'إتقان', behavior: 'سلوك', liturgy: 'قداس', points: 'نقاط', xp: 'خبرة', improvement: 'تحسن', academic: 'أكاديمي', other: 'أخرى' } as Record<string, string>)[badge.category] || badge.category
                      : badge.category}</UIBadge>
                    <span className="text-xs font-semibold text-gray-600">{badge.points} {lang === 'ar' ? 'نقطة' : 'pts'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Badge Modal */}
      <Modal
        open={showBadgeForm}
        onClose={() => setShowBadgeForm(false)}
        title={lang === 'ar' ? 'إنشاء شارة جديدة' : 'Create New Badge'}
        description={lang === 'ar' ? 'تعريف شارة جديدة لإنجازات الطلاب.' : 'Define a new badge for student achievements.'}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBadgeForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleCreateBadge} disabled={savingBadge}
              >
              {savingBadge && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === 'ar' ? 'إنشاء شارة' : 'Create Badge'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {badgeFormError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{badgeFormError}</div>
          )}
          <FormField
            label={lang === 'ar' ? 'الاسم' : 'Name'}
            required
            value={badgeForm.name}
            onChange={e => setBadgeForm({ ...badgeForm, name: e.target.value })}
            placeholder={lang === 'ar' ? 'مثال: ترنيمة' : 'e.g. Hymn Master'}
          />
          <FormField
            label={lang === 'ar' ? 'الوصف' : 'Description'}
            as="textarea"
            value={badgeForm.description}
            onChange={e => setBadgeForm({ ...badgeForm, description: e.target.value })}
            placeholder={lang === 'ar' ? 'صف ما تكافئه هذه الشارة' : 'Describe what this badge rewards'}
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{lang === 'ar' ? 'الأيقونة' : 'Icon'}</label>
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {ICON_OPTIONS.map(name => {
                const Icon = ICON_MAP[name]
                return (
                  <button key={name} type="button"
                    onClick={() => setBadgeForm({ ...badgeForm, iconUrl: name })}
                    className={`flex items-center justify-center p-2 rounded-lg border ${badgeForm.iconUrl === name ? 'border-gold-500 bg-blue-50 ring-1 ring-gold-200' : 'border-gray-200 hover:border-gray-300'}`}
                    aria-label={name}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              })}
            </div>
            <input
              value={badgeForm.iconUrl}
              onChange={e => setBadgeForm({ ...badgeForm, iconUrl: e.target.value })}
              placeholder={lang === 'ar' ? 'أو اكتب اسم الأيقونة' : 'Or type an icon name'}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={lang === 'ar' ? 'التصنيف' : 'Category'}
              as="select"
              value={badgeForm.category}
              onChange={e => setBadgeForm({ ...badgeForm, category: e.target.value })}
            >
              {BADGE_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{lang === 'ar'
                ? ({ attendance: 'حضور', assessment: 'تقييم', participation: 'مشاركة', streak: 'تتابع', mastery: 'إتقان', behavior: 'سلوك', liturgy: 'قداس', points: 'نقاط', xp: 'خبرة', improvement: 'تحسن', academic: 'أكاديمي', other: 'أخرى' } as Record<string, string>)[c] || c
                : c}</option>)}
            </FormField>
            <FormField
              label={lang === 'ar' ? 'النقاط' : 'Points'}
              required
              type="number"
              min={1}
              step={1}
              value={badgeForm.points}
              onChange={e => setBadgeForm({ ...badgeForm, points: e.target.value })}
              placeholder={lang === 'ar' ? 'مثال: 100' : 'e.g. 100'}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Badge Modal */}
      <Modal
        open={showEditBadge}
        onClose={() => setShowEditBadge(false)}
        title={lang === 'ar' ? 'تحرير الشارة' : 'Edit Badge'}
        description={lang === 'ar' ? `تحديث "${badgeToEdit?.name}"` : `Update "${badgeToEdit?.name}"`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditBadge(false)}
              >{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleEditBadge} disabled={savingEditBadge}
              >
              {savingEditBadge && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editBadgeFormError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{editBadgeFormError}</div>
          )}
          <FormField
            label={lang === 'ar' ? 'الاسم' : 'Name'}
            required
            value={editBadgeForm.name}
            onChange={e => setEditBadgeForm({ ...editBadgeForm, name: e.target.value })}
            placeholder={lang === 'ar' ? 'مثال: ترنيمة' : 'e.g. Hymn Master'}
          />
          <FormField
            label={lang === 'ar' ? 'الوصف' : 'Description'}
            as="textarea"
            value={editBadgeForm.description}
            onChange={e => setEditBadgeForm({ ...editBadgeForm, description: e.target.value })}
            placeholder={lang === 'ar' ? 'صف ما تكافئه هذه الشارة' : 'Describe what this badge rewards'}
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{lang === 'ar' ? 'الأيقونة' : 'Icon'}</label>
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {ICON_OPTIONS.map(name => {
                const Icon = ICON_MAP[name]
                return (
                  <button key={name} type="button"
                    onClick={() => setEditBadgeForm({ ...editBadgeForm, iconUrl: name })}
                    className={`flex items-center justify-center p-2 rounded-lg border ${editBadgeForm.iconUrl === name ? 'border-gold-500 bg-blue-50 ring-1 ring-gold-200' : 'border-gray-200 hover:border-gray-300'}`}
                    aria-label={name}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              })}
            </div>
            <input
              value={editBadgeForm.iconUrl}
              onChange={e => setEditBadgeForm({ ...editBadgeForm, iconUrl: e.target.value })}
              placeholder={lang === 'ar' ? 'أو اكتب اسم الأيقونة' : 'Or type an icon name'}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={lang === 'ar' ? 'التصنيف' : 'Category'}
              as="select"
              value={editBadgeForm.category}
              onChange={e => setEditBadgeForm({ ...editBadgeForm, category: e.target.value })}
            >
              {BADGE_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{lang === 'ar'
                ? ({ attendance: 'حضور', assessment: 'تقييم', participation: 'مشاركة', streak: 'تتابع', mastery: 'إتقان', behavior: 'سلوك', liturgy: 'قداس', points: 'نقاط', xp: 'خبرة', improvement: 'تحسن', academic: 'أكاديمي', other: 'أخرى' } as Record<string, string>)[c] || c
                : c}</option>)}
            </FormField>
            <FormField
              label={lang === 'ar' ? 'النقاط' : 'Points'}
              required
              type="number"
              min={1}
              step={1}
              value={editBadgeForm.points}
              onChange={e => setEditBadgeForm({ ...editBadgeForm, points: e.target.value })}
              placeholder={lang === 'ar' ? 'مثال: 100' : 'e.g. 100'}
            />
          </div>
        </div>
      </Modal>

      {/* Drill-down: XP Sources */}
      <Modal
        open={!!drillDownStudent}
        onClose={() => setDrillDownStudent(null)}
        title={drillDownStudent ? `${drillDownStudent.firstName} ${drillDownStudent.lastName}` : ''}
        description={drillDownStudent
          ? (lang === 'ar'
            ? `${drillDownStudent.xp.toLocaleString()} إجمالي نقاط الخبرة · المستوى ${drillDownStudent.level} · ${drillDownStudent.badgeCount} شارات`
            : `${drillDownStudent.xp.toLocaleString()} total XP · Level ${drillDownStudent.level} · ${drillDownStudent.badgeCount} badges`)
          : ''}
        size="lg"
      >
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">{lang === 'ar' ? 'لم يتم العثور على معاملات نقاط خبرة.' : 'No XP transactions found.'}</p>
        ) : (
          <>
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {(() => { const Icon = TX_ICONS[tx.type]; return Icon ? <><Icon className="h-4 w-4 inline mr-1 text-gold-500" />{TX_LABELS[tx.type]}</> : null })() || tx.description || (lang === 'ar' ? 'نقاط خبرة' : 'XP')}
                    </div>
                    <div className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-blue-700">+{tx.amount} {lang === 'ar' ? 'ن.خ' : 'XP'}</span>
                    <span className="text-xs text-gray-400">{lang === 'ar' ? 'الرصيد:' : 'Bal:'} {tx.balanceAfter}</span>
                  </div>
                </div>
              ))}
            </div>
            {hasMoreTransactions && (
              <div className="pt-3 text-center">
                <Button variant="outline"
                  onClick={loadMoreTransactions}
                  disabled={transactionsLoadingMore}
                >
                  {transactionsLoadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {lang === 'ar'
                    ? `عرض المزيد (${transactions.length} من ${transactionsTotal})`
                    : `Load more (${transactions.length} of ${transactionsTotal})`}
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Reset Leaderboard Confirmation */}
      <ConfirmDialog
        open={showResetConfirm}
        onClose={() => { setShowResetConfirm(false); setResetConfirmText('') }}
        onConfirm={handleResetLeaderboard}
        title={lang === 'ar' ? 'إعادة تعيين لوحة المتصدرين' : 'Reset Leaderboard'}
        message={
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {lang === 'ar'
                ? 'سيؤدي هذا إلى حذف جميع معاملات نقاط الخبرة لجميع الطلاب في هذه المدرسة نهائيًا. لا يمكن التراجع عن هذا الإجراء.'
                : 'This will permanently delete all XP transactions for all students in this school. This action cannot be undone.'}
            </p>
            <div>
              <label className="block text-sm font-semibold text-red-700 mb-1">
                {lang === 'ar' ? `اكتب "إعادة تعيين" لتأكيد الحذف` : `Type "RESET" to confirm`}
              </label>
              <input
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                className="block w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                autoFocus
              />
            </div>
          </div>
        }
        confirmLabel={lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
        confirmDisabled={resetConfirmText !== 'RESET'}
        loading={resettingLeaderboard}
        variant="danger"
      />

      {/* Delete Badge Confirmation */}
      <ConfirmDialog
        open={showDeleteBadge}
        onClose={() => setShowDeleteBadge(false)}
        onConfirm={handleDeleteBadge}
        title={lang === 'ar' ? 'حذف الشارة' : 'Delete Badge'}
        message={lang === 'ar' ? `هل أنت متأكد أنك تريد حذف "${badgeToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete "${badgeToDelete?.name}"? This action cannot be undone.`}
        confirmLabel={lang === 'ar' ? 'حذف' : 'Delete'}
        loading={deletingBadge}
      />
    </div>
  )
}

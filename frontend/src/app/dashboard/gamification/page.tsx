'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Trophy, Star, Flame, Medal, Award, Target, TrendingUp, Loader2, Plus, Pencil, Trash2,
  Search, Eye, Info, CheckCheck, Mic, Church, Calendar, Zap, Gem, Crown, BookOpen,
  Music, Shield, Bell, Cross, Feather, Sparkles, CircleDollarSign, Dumbbell, Baby,
  Users, Heart, ChevronRight, CheckCircle2, TrendingDown, BarChart3, UserCheck,
  ArrowUp, ArrowDown, Minus,
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
import { CardSkeleton, TableSkeleton, Skeleton } from '@/components/ui/skeleton'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'

// ── Types ───────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  id: string; firstName: string; lastName: string
  xp: number; level: number; streak: number; rank: number; badgeCount: number
}

interface BadgeItem {
  id: string; name: string; description: string | null
  category: string; iconUrl: string; points: number; isActive: boolean
}

interface GrowthMirror {
  studentId: string; levelNumber?: number; levelName?: string
  totalXp: number; xpOneMonthAgo: number; xpGainedThisMonth: number; growthPercent: number
  monthlyXp: { month: string; xp: number }[]
  attendance: { thisMonth: number; lastMonth: number; improvement: number }
  assessments: { passedThisMonth: number; passedLastMonth: number; improvement: number }
  badgeTimeline: { badgeName: string; category: string; icon: string; earnedAt: string }[]
  totalBadges: number
}

interface GroupTrophy {
  groupId: string; groupName: string; levelNumber?: number; levelName?: string
  totalStudents: number; totalXp: number
  achievedMilestones: number; totalMilestones: number; allMilestonesComplete: boolean
  milestones: { id: string; title: string; titleAr: string; description: string; descriptionAr: string; icon: string; achieved: boolean; progress: number; current: number; target: number; suffix?: string }[]
  students: { id: string; name: string; attendedThisMonth: boolean; hasBadge: boolean; passedAssessment: boolean }[]
}

interface SeasonalInfo {
  activeSeason: string | null; activeSeasonAr?: string
  startDate?: string; endDate?: string; daysRemaining?: number
  badge?: { name: string; nameAr: string; description: string; descriptionAr: string; icon: string; category: string; alreadyCreated: boolean; existingBadgeId: string | null }
  message?: string
}

interface ServantMilestones {
  servant: { id: string; name: string; yearsActive: number }
  stats: { sessionsTaught: number; studentsAssessed: number; lessonsPlanned: number; yearsActive: number }
  milestones: { id: string; threshold: number; current: number; unit: string; label: string; labelAr: string; achieved: boolean }[]
  achievedCount: number
  latestAchieved: any
}

// ── Constants ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, Star, Mic, Church, Calendar, Gem, CircleDollarSign, Zap, CheckCheck,
  Sparkles, TrendingUp, Award, Flame, Dumbbell, Target, Crown, BookOpen, Music,
  Cross, Feather, Shield, Bell, Medal, Baby, Users, Heart, UserCheck,
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

const emptyBadgeForm = { name: '', description: '', category: 'participation', iconUrl: '', points: '' }

const TX_LABELS: Record<string, string> = {
  badge_award: 'Badge earned', attendance_xp: 'Attendance XP', behavior_bonus: 'Behavior bonus',
  participation_bonus: 'Participation bonus', liturgy_bonus: 'Liturgy attendance', assessment: 'Assessment score',
}

function friendlyError(err: any, lang: string): string {
  const msg = err?.message || ''
  if (msg.includes('401') || msg.includes('Unauthorized')) return lang === 'ar' ? 'انتهت الجلسة' : 'Session expired'
  if (msg.includes('403') || msg.includes('Forbidden')) return lang === 'ar' ? 'ليس لديك صلاحية' : 'No permission'
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) return lang === 'ar' ? 'تعذر الاتصال بالخادم' : 'Cannot reach server'
  return lang === 'ar' ? 'حدث خطأ' : 'Something went wrong'
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ImprovementPill({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
      <ArrowUp className="h-3 w-3" />+{value}{suffix}
    </span>
  )
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
      <ArrowDown className="h-3 w-3" />{value}{suffix}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
      <Minus className="h-3 w-3" />0{suffix}
    </span>
  )
}

function MiniBar({ value, max, color = 'bg-gold-400' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Growth Mirror Panel ──────────────────────────────────────────────────────

function GrowthMirrorPanel({ entry, lang }: { entry: LeaderboardEntry; lang: string }) {
  const [data, setData] = useState<GrowthMirror | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    http.get<GrowthMirror>(`/gamification/students/${entry.id}/growth`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [entry.id])

  if (loading) return <div className="py-8 space-y-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-52" /><Skeleton className="h-24 w-full" /></div>
  if (!data) return <EmptyState size="sm" title={lang === 'ar' ? 'لا توجد بيانات' : 'No data available'} />

  const maxMonthlyXp = Math.max(...data.monthlyXp.map(m => m.xp), 1)

  return (
    <div className="space-y-5">
      {/* XP trajectory */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-gold-700" />
            {lang === 'ar' ? 'مسار نقاط الخبرة' : 'XP Trajectory'}
          </h4>
          <ImprovementPill value={data.growthPercent} suffix="%" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-lg font-bold text-gray-900">{data.xpOneMonthAgo.toLocaleString()}</div>
            <div className="text-xs text-gray-500">{lang === 'ar' ? 'منذ شهر' : 'A month ago'}</div>
          </div>
          <div className="rounded-lg bg-gold-50 p-3 text-center border border-gold-100">
            <div className="text-lg font-bold text-gold-700">{data.totalXp.toLocaleString()}</div>
            <div className="text-xs text-gold-600">{lang === 'ar' ? 'الآن' : 'Now'}</div>
          </div>
        </div>
        {/* Monthly bars */}
        {data.monthlyXp.length > 0 && (
          <div className="space-y-1.5">
            {data.monthlyXp.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-12 shrink-0">{m.month.slice(5)}</span>
                <div className="flex-1 h-5 rounded-md bg-gray-100 overflow-hidden relative">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-gold-400 to-blue-500 transition-all duration-700"
                    style={{ width: `${Math.max(4, m.xp / maxMonthlyXp * 100)}%` }}
                  />
                  <span className="absolute right-1.5 top-0.5 text-[10px] font-semibold text-gray-600">{m.xp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance & Assessments */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">{lang === 'ar' ? 'الحضور' : 'Attendance'}</span>
            <ImprovementPill value={data.attendance.improvement} suffix="%" />
          </div>
          <div className="text-2xl font-black text-gray-900">{data.attendance.thisMonth}%</div>
          <div className="text-[10px] text-gray-500">{lang === 'ar' ? 'الشهر الماضي:' : 'Last month:'} {data.attendance.lastMonth}%</div>
          <MiniBar value={data.attendance.thisMonth} max={100} color="bg-green-400" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">{lang === 'ar' ? 'التقييمات' : 'Assessments'}</span>
            <ImprovementPill value={data.assessments.improvement} />
          </div>
          <div className="text-2xl font-black text-gray-900">{data.assessments.passedThisMonth}</div>
          <div className="text-[10px] text-gray-500">{lang === 'ar' ? 'الشهر الماضي:' : 'Last month:'} {data.assessments.passedLastMonth}</div>
          <MiniBar value={data.assessments.passedThisMonth} max={Math.max(data.assessments.passedLastMonth + 2, data.assessments.passedThisMonth + 1)} color="bg-blue-400" />
        </div>
      </div>

      {/* Badge timeline */}
      {data.badgeTimeline.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-gold-700" />
            {lang === 'ar' ? 'رحلة الشارات' : 'Badge Journey'}
            <span className="text-gray-500 font-normal">({data.totalBadges})</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.badgeTimeline.map((b, i) => {
              const Icon = ICON_MAP[b.icon]
              return (
                <div key={i} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${CATEGORY_COLORS[b.category] || CATEGORY_COLORS.default}`}>
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : <Award className="h-3.5 w-3.5" />}
                  <span className="font-medium">{b.badgeName}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-500 text-center italic">
        {lang === 'ar'
          ? '✨ هذا تقدمك الخاص — لا مقارنة مع زملائك'
          : '✨ This is your own journey — no comparison with peers'}
      </p>
    </div>
  )
}

// ── Seasonal Badge Panel ─────────────────────────────────────────────────────

function SeasonalBadgePanel({ lang, schoolId, onToast }: { lang: string; schoolId: string; onToast: (t: 'success'|'error', m: string) => void }) {
  const [data, setData] = useState<SeasonalInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    http.get<SeasonalInfo>('/gamification/seasonal', { schoolId })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [schoolId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await http.post(`/gamification/seasonal/create?schoolId=${schoolId}`, {})
      onToast('success', lang === 'ar' ? 'تم إنشاء شارة الموسم' : 'Seasonal badge created!')
      load()
    } catch (e: any) {
      onToast('error', e.message || 'Failed')
    }
    setCreating(false)
  }

  if (loading) return <div className="py-12"><CardSkeleton count={4} /></div>

  if (!data?.activeSeason) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
        <Church className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          {lang === 'ar' ? 'لا يوجد موسم ليتورجي نشط' : 'No Active Liturgical Season'}
        </h3>
        <p className="text-xs text-gray-500 max-w-xs mx-auto">
          {lang === 'ar'
            ? 'الشارات الموسمية تظهر خلال المواسم الكنسية: كيهك، الصوم الكبير، أسبوع الآلام، الخمسين المقدسة، وصوم الرسل.'
            : 'Seasonal badges appear during liturgical seasons: Kiahk, Great Lent, Holy Week, Great 50 Days, and the Fast of the Apostles.'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {['⭐ Kiahk Lantern', '✝ Fasting Lamp', '🕊 Holy Week Witness', '🌟 Resurrection Crown', '📜 Apostles Scroll'].map(s => (
            <span key={s} className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs text-indigo-700">{s}</span>
          ))}
        </div>
      </div>
    )
  }

  const badge = data.badge!
  const Icon = ICON_MAP[badge.icon] || Star

  return (
    <div className="space-y-5">
      {/* Active season banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 p-6 text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl" />
        </div>
        <div className="relative flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
            <Icon className="h-8 w-8 text-amber-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white/80 uppercase tracking-wider">
                {lang === 'ar' ? 'موسم نشط' : 'Active Season'}
              </span>
              {data.daysRemaining !== undefined && (
                <span className="text-[11px] text-white/50">{data.daysRemaining} {lang === 'ar' ? 'يوم متبقي' : 'days left'}</span>
              )}
            </div>
            <h3 className="text-xl font-black text-white">{lang === 'ar' ? data.activeSeasonAr : data.activeSeason?.replace(/_/g, ' ')}</h3>
            <p className="text-sm text-white/70 mt-0.5">{lang === 'ar' ? badge.descriptionAr : badge.description}</p>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between rounded-xl bg-white/10 border border-white/15 px-4 py-3">
          <div>
            <div className="text-xs text-white/50 mb-0.5">{lang === 'ar' ? 'الشارة الموسمية' : 'Seasonal Badge'}</div>
            <div className="font-bold text-white">{lang === 'ar' ? badge.nameAr : badge.name}</div>
          </div>
          {badge.alreadyCreated ? (
            <UIBadge variant="success">{lang === 'ar' ? '✓ موجودة' : '✓ Created'}</UIBadge>
          ) : (
            <Button onClick={handleCreate} disabled={creating} size="sm" className="bg-amber-400 hover:bg-amber-500 text-gray-900 font-bold">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {lang === 'ar' ? 'أنشئ الشارة' : 'Create Badge'}
            </Button>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">
          {lang === 'ar' ? '🎵 كيف تعمل الشارات الموسمية؟' : '🎵 How do seasonal badges work?'}
        </p>
        <p className="text-amber-700 text-xs leading-relaxed">
          {lang === 'ar'
            ? 'الشارات الموسمية لا تُكسب إلا خلال نافذة زمنية محددة مرتبطة بالتقويم الليتورجي. بمجرد انتهاء الموسم، تُغلق الشارة ولا يمكن لأي طالب كسبها مستقبلاً — مما يجعلها نادرة ومعبّرة روحياً.'
            : 'Seasonal badges can only be earned during a specific window tied to the liturgical calendar. Once the season ends, the badge closes — no future student can earn it, making each one rare and spiritually meaningful.'}
        </p>
      </div>
    </div>
  )
}

// ── Group Trophy Panel ───────────────────────────────────────────────────────

function GroupTrophyPanel({ lang, schoolId }: { lang: string; schoolId: string }) {
  const [groups, setGroups] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [trophy, setTrophy] = useState<GroupTrophy | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(true)

  useEffect(() => {
    http.get<any[]>('/students/groups/all', { schoolId })
      .then(d => { setGroups(Array.isArray(d) ? d : []); setLoadingGroups(false) })
      .catch(() => setLoadingGroups(false))
  }, [schoolId])

  const loadTrophy = async (groupId: string) => {
    setSelected(groupId)
    setLoading(true)
    setTrophy(null)
    try {
      const d = await http.get<GroupTrophy>(`/gamification/groups/${groupId}/trophy`, { schoolId })
      setTrophy(d)
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">{lang === 'ar' ? '🏆 كأسات المجموعة' : '🏆 Group Trophies'}</p>
        <p className="text-blue-700 text-xs mt-0.5 leading-relaxed">
          {lang === 'ar'
            ? 'عندما تحقق المجموعة بأكملها هدفاً مشتركاً، يحصل كل عضو على مكافأة. هذا يحوّل الإنجاز الفردي إلى احتفال جماعي.'
            : 'When an entire group achieves a shared milestone, every member is rewarded. This turns individual achievement into community celebration.'}
        </p>
      </div>

      {/* Group selector */}
      {loadingGroups ? (
        <div className="flex flex-wrap gap-2 py-6"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-20" /></div>
      ) : groups.length === 0 ? (
        <EmptyState icon={Users} title={lang === 'ar' ? 'لا توجد مجموعات' : 'No groups found'} description={lang === 'ar' ? 'أنشئ مجموعات في قسم الطلاب أولاً' : 'Create groups in the Students section first'} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {groups.map((g: any) => (
            <button
              key={g.id}
              onClick={() => loadTrophy(g.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${selected === g.id ? 'bg-gold-500 border-gold-500 text-gray-950 shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:border-gold-300'}`}
            >
              {g.name} {g.level?.number ? `(L${g.level.number})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Trophy display */}
      {loading && <div className="py-8 space-y-3"><Skeleton className="h-6 w-56" /><Skeleton className="h-28 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>}

      {trophy && !loading && (
        <div className="space-y-4">
          {/* Header */}
          <div className={`rounded-2xl border p-5 ${trophy.allMilestonesComplete ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className={`h-5 w-5 ${trophy.allMilestonesComplete ? 'text-amber-500' : 'text-gray-500'}`} />
                  <h3 className="text-base font-bold text-gray-900">{trophy.groupName}</h3>
                  {trophy.levelName && <UIBadge variant="info">Level {trophy.levelNumber}</UIBadge>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {trophy.totalStudents} {lang === 'ar' ? 'طالب' : 'students'} · {trophy.totalXp.toLocaleString()} XP {lang === 'ar' ? 'مجمّعة' : 'combined'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-gray-900">{trophy.achievedMilestones}/{trophy.totalMilestones}</div>
                <div className="text-[10px] text-gray-500">{lang === 'ar' ? 'إنجازات' : 'milestones'}</div>
              </div>
            </div>
            {trophy.allMilestonesComplete && (
              <div className="rounded-xl bg-amber-400/10 border border-amber-300/30 px-4 py-2.5 text-center">
                <p className="text-sm font-bold text-amber-700">
                  🎉 {lang === 'ar' ? 'المجموعة حققت جميع الأهداف! جهّز شهادة الكأس.' : 'Group achieved all milestones! Prepare the trophy certificate.'}
                </p>
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="space-y-3">
            {trophy.milestones.map(m => {
              const Icon = ICON_MAP[m.icon] || Target
              return (
                <div key={m.id} className={`rounded-xl border p-4 ${m.achieved ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${m.achieved ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {m.achieved ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Icon className="h-5 w-5 text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-sm font-semibold ${m.achieved ? 'text-green-800' : 'text-gray-900'}`}>
                          {lang === 'ar' ? m.titleAr : m.title}
                        </h4>
                        <span className={`text-xs font-bold ${m.achieved ? 'text-green-600' : 'text-gray-500'}`}>
                          {m.current}{m.suffix || ''}/{m.target}{m.suffix || ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{lang === 'ar' ? m.descriptionAr : m.description}</p>
                      <div className="mt-2">
                        <MiniBar value={m.current} max={m.target} color={m.achieved ? 'bg-green-400' : 'bg-gold-400'} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Student breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h4 className="text-xs font-bold text-gray-700 mb-3">{lang === 'ar' ? 'تفاصيل الطلاب' : 'Student Breakdown'}</h4>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {trophy.students.map(s => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-sm font-medium text-gray-700 flex-1 truncate">{s.name}</span>
                  <div className="flex items-center gap-1">
                    <span title="Attended this month" className={`h-2 w-2 rounded-full ${s.attendedThisMonth ? 'bg-green-400' : 'bg-gray-200'}`} />
                    <span title="Has a badge" className={`h-2 w-2 rounded-full ${s.hasBadge ? 'bg-amber-400' : 'bg-gray-200'}`} />
                    <span title="Passed assessment" className={`h-2 w-2 rounded-full ${s.passedAssessment ? 'bg-blue-400' : 'bg-gray-200'}`} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              🟢 {lang === 'ar' ? 'حضر' : 'Attended'} · 🟡 {lang === 'ar' ? 'شارة' : 'Badge'} · 🔵 {lang === 'ar' ? 'اجتاز تقييماً' : 'Passed assessment'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Servant Recognition Panel ────────────────────────────────────────────────

function ServantRecognitionPanel({ lang, schoolId }: { lang: string; schoolId: string }) {
  const [servants, setServants] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [data, setData] = useState<ServantMilestones | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingServants, setLoadingServants] = useState(true)

  useEffect(() => {
    http.get<any>(`/users?schoolId=${schoolId}&role=servant`)
      .then(d => { setServants(Array.isArray(d) ? d : d?.users || d?.data || []); setLoadingServants(false) })
      .catch(() => setLoadingServants(false))
  }, [schoolId])

  const load = async (userId: string) => {
    setSelected(userId)
    setLoading(true)
    setData(null)
    try {
      const d = await http.get<ServantMilestones>(`/gamification/servant/milestones?schoolId=${schoolId}&userId=${userId}`)
      setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 text-sm text-purple-800">
        <p className="font-semibold">{lang === 'ar' ? '✨ تقدير الخدام' : '✨ Servant Recognition'}</p>
        <p className="text-purple-700 text-xs mt-0.5 leading-relaxed">
          {lang === 'ar'
            ? 'الخادم الذي علّم 100 طالب يستحق أن يُرى. هذه الإنجازات تُولَّد تلقائياً ويمكن طباعتها وتسليمها في الكنيسة.'
            : 'A servant who has taught 100 students deserves to be seen. These milestones are auto-generated and can be printed for presentation in church.'}
        </p>
      </div>

      {loadingServants ? (
        <div className="flex flex-wrap gap-2 py-6"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-32" /><Skeleton className="h-9 w-20" /></div>
      ) : servants.length === 0 ? (
        <EmptyState icon={UserCheck} title={lang === 'ar' ? 'لا يوجد خدام' : 'No servants found'} description="" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {servants.map((s: any) => (
            <button
              key={s.id}
              onClick={() => load(s.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${selected === s.id ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'}`}
            >
              {s.firstName} {s.lastName}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="py-8 space-y-3"><Skeleton className="h-6 w-56" /><Skeleton className="h-28 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>}

      {data && !loading && (
        <div className="space-y-4">
          {/* Stats summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: lang === 'ar' ? 'جلسات التعليم' : 'Sessions Taught', value: data.stats.sessionsTaught, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
              { label: lang === 'ar' ? 'طلاب تم تقييمهم' : 'Students Assessed', value: data.stats.studentsAssessed, icon: Users, color: 'text-green-600 bg-green-50' },
              { label: lang === 'ar' ? 'دروس مخططة' : 'Lessons Planned', value: data.stats.lessonsPlanned, icon: BookOpen, color: 'text-amber-600 bg-amber-50' },
              { label: lang === 'ar' ? 'سنوات الخدمة' : 'Years Active', value: data.stats.yearsActive, icon: Star, color: 'text-purple-600 bg-purple-50' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-3 text-center">
                  <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-xl font-black text-gray-900">{stat.value.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500">{stat.label}</div>
                </div>
              )
            })}
          </div>

          {/* Milestones */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
              <Medal className="h-4 w-4 text-gold-700" />
              {lang === 'ar' ? 'الإنجازات' : 'Milestones'}
              <span className="text-gray-500 font-normal text-xs">({data.achievedCount}/{data.milestones.length})</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {data.milestones.map(m => (
                <div key={m.id} className={`flex items-center gap-3 rounded-xl border p-3 ${m.achieved ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${m.achieved ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'}`}>
                    {m.achieved ? '✓' : m.threshold.toLocaleString().slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${m.achieved ? 'text-purple-800' : 'text-gray-500'}`}>
                      {lang === 'ar' ? m.labelAr : m.label}
                    </p>
                    {!m.achieved && (
                      <p className="text-[10px] text-gray-500">{m.current}/{m.threshold} {m.unit}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Print certificate */}
          {data.achievedCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {lang === 'ar' ? '🖨 جاهز للطباعة' : '🖨 Ready to Print'}
                </p>
                <p className="text-xs text-amber-700">
                  {lang === 'ar'
                    ? `${data.servant.name} حقق ${data.achievedCount} إنجازات — يمكن طباعة شهادة للتسليم في الكنيسة`
                    : `${data.servant.name} has earned ${data.achievedCount} milestones — print a certificate for church presentation`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                {lang === 'ar' ? 'طباعة' : 'Print'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function GamificationPage() {
  const { toast } = useToast()
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardSearch, setLeaderboardSearch] = useState('')

  const [badges, setBadges] = useState<BadgeItem[]>([])
  const [badgesLoading, setBadgesLoading] = useState(true)
  const [badgeSearch, setBadgeSearch] = useState('')

  const [activeTab, setActiveTab] = useState('growth')

  const [stats, setStats] = useState<{ totalXp: number; totalBadges: number; totalStreaks: number; avgEngagement: number } | null>(null)
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

  const [growthStudent, setGrowthStudent] = useState<LeaderboardEntry | null>(null)

  // Transactions drill-down (kept for detailed view)
  const [drillDownStudent, setDrillDownStudent] = useState<LeaderboardEntry | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionsTotal, setTransactionsTotal] = useState(0)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsLoadingMore, setTransactionsLoadingMore] = useState(false)

  const schoolId = getSchoolId()

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true)
    try {
      const data = await http.get<LeaderboardEntry[]>('/gamification/leaderboard', { schoolId })
      setLeaderboard(data)
    } catch (e: any) { toast('error', friendlyError(e, lang)) }
    setLeaderboardLoading(false)
  }, [schoolId, toast, lang])

  const fetchBadges = useCallback(async () => {
    setBadgesLoading(true)
    try {
      const data = await http.get<BadgeItem[]>('/gamification/badges', { schoolId })
      setBadges(data.map((b: any) => ({ ...b, points: b.xpReward ?? b.points ?? 0 })))
    } catch { /* ignore */ }
    setBadgesLoading(false)
  }, [schoolId])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await http.get<LeaderboardEntry[]>('/gamification/leaderboard', { schoolId })
      const activeWithXp = data.filter(e => e.xp > 0).length
      setStats({
        totalXp: data.reduce((sum, e) => sum + e.xp, 0),
        totalBadges: data.reduce((sum, e) => sum + e.badgeCount, 0),
        totalStreaks: data.filter(e => e.streak > 0).length,
        avgEngagement: data.length ? Math.round((activeWithXp / data.length) * 100) : 0,
      })
    } catch { /* ignore */ }
    setStatsLoading(false)
  }, [schoolId])

  useEffect(() => { fetchLeaderboard(); fetchBadges(); fetchStats() }, [fetchLeaderboard, fetchBadges, fetchStats])

  const openDrillDown = async (entry: LeaderboardEntry) => {
    setDrillDownStudent(entry)
    setTransactions([]); setTransactionsTotal(0); setTransactionsLoading(true)
    try {
      const data = await http.get<any>(`/gamification/students/${entry.id}/transactions`)
      setTransactions(data.items || []); setTransactionsTotal(data.total || 0)
    } catch { /* ignore */ }
    setTransactionsLoading(false)
  }

  const loadMoreTransactions = async () => {
    if (!drillDownStudent) return
    setTransactionsLoadingMore(true)
    try {
      const data = await http.get<any>(`/gamification/students/${drillDownStudent.id}/transactions?skip=${transactions.length}&take=50`)
      setTransactions(prev => [...prev, ...(data.items || [])])
      setTransactionsTotal(data.total || 0)
    } catch { /* ignore */ }
    setTransactionsLoadingMore(false)
  }

  const handleCreateBadge = async () => {
    setBadgeFormError('')
    if (!badgeForm.name.trim()) { setBadgeFormError(t('Name is required', 'الاسم مطلوب')); return }
    const pts = Number(badgeForm.points)
    if (!pts || pts <= 0 || !Number.isInteger(pts)) { setBadgeFormError(t('Points must be a positive whole number', 'يجب أن تكون النقاط رقماً صحيحاً موجباً')); return }
    setSavingBadge(true)
    try {
      await http.post('/gamification/badges', { name: badgeForm.name.trim(), description: badgeForm.description.trim(), category: badgeForm.category, iconUrl: badgeForm.iconUrl || undefined, points: pts })
      setShowBadgeForm(false); fetchBadges(); fetchStats()
      toast('success', t('Badge created', 'تم إنشاء الشارة'))
    } catch (e: any) { setBadgeFormError(friendlyError(e, lang)) }
    setSavingBadge(false)
  }

  const handleEditBadge = async () => {
    if (!badgeToEdit) return
    setEditBadgeFormError('')
    if (!editBadgeForm.name.trim()) { setEditBadgeFormError(t('Name is required', 'الاسم مطلوب')); return }
    const pts = Number(editBadgeForm.points)
    if (!pts || pts <= 0 || !Number.isInteger(pts)) { setEditBadgeFormError(t('Points must be positive', 'يجب أن تكون النقاط موجبة')); return }
    setSavingEditBadge(true)
    try {
      await http.put(`/gamification/badges/${badgeToEdit.id}`, { name: editBadgeForm.name.trim(), description: editBadgeForm.description.trim() || undefined, category: editBadgeForm.category, iconUrl: editBadgeForm.iconUrl || undefined, points: pts })
      setShowEditBadge(false); fetchBadges(); fetchStats()
      toast('success', t('Badge updated', 'تم تحديث الشارة'))
    } catch (e: any) { setEditBadgeFormError(friendlyError(e, lang)) }
    setSavingEditBadge(false)
  }

  const handleDeleteBadge = async () => {
    if (!badgeToDelete) return
    setDeletingBadge(true)
    try {
      await http.delete(`/gamification/badges/${badgeToDelete.id}`)
      setShowDeleteBadge(false); fetchBadges(); fetchStats()
      toast('success', t('Badge deleted', 'تم حذف الشارة'))
    } catch (e: any) { toast('error', friendlyError(e, lang)) }
    setDeletingBadge(false)
  }

  const handleResetLeaderboard = async () => {
    setResettingLeaderboard(true)
    try {
      await http.delete('/gamification/leaderboard', { schoolId })
      setShowResetConfirm(false); setResetConfirmText('')
      fetchLeaderboard(); fetchStats()
      toast('success', t('Leaderboard reset', 'تم إعادة تعيين لوحة المتصدرين'))
    } catch (e: any) { toast('error', friendlyError(e, lang)) }
    setResettingLeaderboard(false)
  }

  const filteredLeaderboard = leaderboardSearch.trim()
    ? leaderboard.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(leaderboardSearch.toLowerCase()))
    : leaderboard

  const filteredBadges = badgeSearch.trim()
    ? badges.filter(b => b.name.toLowerCase().includes(badgeSearch.toLowerCase()))
    : badges

  const categoryLabel = (cat: string) => lang === 'ar'
    ? ({ attendance:'حضور',assessment:'تقييم',participation:'مشاركة',streak:'تتابع',mastery:'إتقان',behavior:'سلوك',liturgy:'قداس',points:'نقاط',xp:'خبرة',improvement:'تحسن',academic:'أكاديمي',other:'أخرى' } as Record<string,string>)[cat] || cat
    : cat

  return (
    <div className="space-y-6">
      <title>{t('Gamification — COHEP', 'التلعيب — كوهيب')}</title>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Gamification', 'التلعيب')}</h1>
          <p className="text-sm text-gray-500">{t('Personal growth, group milestones, seasonal badges, and servant recognition', 'النمو الشخصي، إنجازات المجموعة، الشارات الموسمية، وتقدير الخدام')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? <CardSkeleton count={4} /> : (
          <>
            <StatCard label={t('Total XP Awarded', 'إجمالي نقاط الخبرة')} value={stats?.totalXp?.toLocaleString() ?? '0'} icon={Star} iconBg="bg-blue-50" iconColor="text-blue-700" />
            <StatCard label={t('Badges Earned', 'الشارات المكتسبة')} value={stats?.totalBadges?.toLocaleString() ?? '0'} icon={Trophy} iconBg="bg-green-50" iconColor="text-green-600" />
            <StatCard label={t('Active Streaks', 'التتابعات النشطة')} value={stats?.totalStreaks?.toLocaleString() ?? '0'} icon={Flame} iconBg="bg-orange-50" iconColor="text-orange-600" />
            <StatCard label={t('Active Students %', 'نسبة الطلاب النشطين')} value={`${stats?.avgEngagement ?? 0}%`} icon={Target} iconBg="bg-blue-50" iconColor="text-blue-600" />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'growth',    label: t('Growth Mirror', 'مرآة النمو'),      icon: TrendingUp,  count: leaderboard.length },
          { id: 'group',     label: t('Group Trophy', 'كأس المجموعة'),     icon: Trophy },
          { id: 'seasonal',  label: t('Seasonal Badges', 'الشارات الموسمية'), icon: Star },
          { id: 'servants',  label: t('Servant Awards', 'جوائز الخدام'),    icon: Medal },
          { id: 'badges',    label: t('Badges', 'الشارات'),                icon: Award,       count: badges.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Growth Mirror Tab ── */}
      {activeTab === 'growth' && (
        <div id="panel-growth" role="tabpanel" aria-labelledby="tab-growth" className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              <span className="font-semibold">{t('No rankings here.', 'لا تصنيفات هنا.')}</span>{' '}
              {t('Select a student to see their personal growth trajectory — their journey compared only to themselves, never to peers.',
                 'اختر طالباً لعرض مسار نموه الشخصي — رحلته مقارنةً بنفسه فقط، لا بأقرانه.')}
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            {/* Student list */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                  <Search className="h-4 w-4 text-gray-500" />
                  <input
                    value={leaderboardSearch}
                    onChange={e => setLeaderboardSearch(e.target.value)}
                    placeholder={t('Search student...', 'ابحث عن طالب...')}
                    className="flex-1 text-sm bg-transparent focus:outline-none"
                  />
                </div>
                {leaderboardLoading ? (
                  <div className="px-4 py-8"><TableSkeleton rows={6} cols={3} /></div>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto divide-y divide-gray-50">
                    {filteredLeaderboard.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setGrowthStudent(s)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors ${growthStudent?.id === s.id ? 'bg-blue-50 border-r-2 border-gold-500' : ''}`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</div>
                          <div className="text-xs text-gray-500">{s.xp} XP · {s.badgeCount} {t('badges', 'شارات')}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 rtl:rotate-180" />
                      </button>
                    ))}
                    {filteredLeaderboard.length === 0 && (
                      <EmptyState size="sm" title={t('No students yet', 'لا يوجد طلاب بعد')} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Growth detail */}
            <div className="flex-1">
              {growthStudent ? (
                <div>
                  <div className="flex items-center gap-3 mb-4 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-100 text-gold-700 font-bold">
                      {growthStudent.firstName[0]}{growthStudent.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{growthStudent.firstName} {growthStudent.lastName}</h3>
                      <p className="text-xs text-gray-500">{growthStudent.xp.toLocaleString()} XP · Level {growthStudent.level} · {growthStudent.badgeCount} {t('badges', 'شارات')}</p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDrillDown(growthStudent)}>
                        <Eye className="h-3.5 w-3.5" /> {t('XP Log', 'سجل XP')}
                      </Button>
                    </div>
                  </div>
                  <GrowthMirrorPanel entry={growthStudent} lang={lang} />
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                  <div className="text-center">
                    <TrendingUp className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">{t('Select a student to view their growth', 'اختر طالباً لعرض نموه')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Group Trophy Tab ── */}
      {activeTab === 'group' && <div id="panel-group" role="tabpanel" aria-labelledby="tab-group"><GroupTrophyPanel lang={lang} schoolId={schoolId} /></div>}

      {/* ── Seasonal Badges Tab ── */}
      {activeTab === 'seasonal' && <div id="panel-seasonal" role="tabpanel" aria-labelledby="tab-seasonal"><SeasonalBadgePanel lang={lang} schoolId={schoolId} onToast={(t, m) => toast(t, m)} /></div>}

      {/* ── Servant Awards Tab ── */}
      {activeTab === 'servants' && <div id="panel-servants" role="tabpanel" aria-labelledby="tab-servants"><ServantRecognitionPanel lang={lang} schoolId={schoolId} /></div>}

      {/* ── Badges Tab ── */}
      {activeTab === 'badges' && (
        <div id="panel-badges" role="tabpanel" aria-labelledby="tab-badges">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input value={badgeSearch} onChange={e => setBadgeSearch(e.target.value)} placeholder={t('Search badges...', 'ابحث عن شارة...')}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <Button onClick={() => { setBadgeForm(emptyBadgeForm); setBadgeFormError(''); setShowBadgeForm(true) }}>
              <Plus className="h-4 w-4" /> {t('Add Badge', 'إضافة شارة')}
            </Button>
          </div>

          {badgesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"><CardSkeleton count={8} /></div>
          ) : filteredBadges.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white">
              <EmptyState icon={Award} title={t('No badges yet', 'لا توجد شارات بعد')}
                description={t('Create badges to reward student achievements.', 'أنشئ شارات لمكافأة إنجازات الطلاب.')}
                action={<Button onClick={() => setShowBadgeForm(true)}><Plus className="h-4 w-4" /> {t('Create First Badge', 'إنشاء أول شارة')}</Button>} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredBadges.map(badge => {
                const Icon = ICON_MAP[badge.iconUrl]
                return (
                  <div key={badge.id} className={`rounded-xl border p-4 transition-all hover:shadow-sm ${CATEGORY_COLORS[badge.category] || CATEGORY_COLORS.default}`}>
                    <div className="flex items-start justify-between">
                      <div className="text-2xl">{Icon ? <Icon className="h-7 w-7" /> : (badge.iconUrl || '🏅')}</div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setBadgeToEdit(badge); setEditBadgeForm({ name: badge.name, description: badge.description || '', category: badge.category, iconUrl: badge.iconUrl || '', points: String(badge.points) }); setEditBadgeFormError(''); setShowEditBadge(true) }} className="text-gray-500 hover:bg-amber-50 hover:text-amber-600"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { setBadgeToDelete(badge); setShowDeleteBadge(true) }} className="text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">{badge.name}</h3>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{badge.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <UIBadge variant="outline" size="sm">{categoryLabel(badge.category)}</UIBadge>
                      <span className="text-xs font-semibold text-gray-600">{badge.points} pts</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Badge Modals ── */}
      <Modal open={showBadgeForm} onClose={() => setShowBadgeForm(false)} title={t('Create New Badge', 'إنشاء شارة جديدة')}
        footer={<><Button variant="outline" onClick={() => setShowBadgeForm(false)}>{t('Cancel', 'إلغاء')}</Button><Button onClick={handleCreateBadge} disabled={savingBadge}>{savingBadge && <Loader2 className="h-4 w-4 animate-spin" />}{t('Create Badge', 'إنشاء')}</Button></>}>
        <div className="space-y-4">
          {badgeFormError && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{badgeFormError}</div>}
          <FormField label={t('Name', 'الاسم')} required value={badgeForm.name} onChange={e => setBadgeForm({ ...badgeForm, name: e.target.value })} placeholder={t('e.g. Hymn Master', 'مثال: ترنيمة')} />
          <FormField label={t('Description', 'الوصف')} as="textarea" value={badgeForm.description} onChange={e => setBadgeForm({ ...badgeForm, description: e.target.value })} />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Icon', 'الأيقونة')}</label>
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {ICON_OPTIONS.map(name => { const Icon = ICON_MAP[name]; return <button key={name} type="button" onClick={() => setBadgeForm({ ...badgeForm, iconUrl: name })} className={`flex items-center justify-center p-2 rounded-lg border ${badgeForm.iconUrl === name ? 'border-gold-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}><Icon className="h-5 w-5" /></button> })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('Category', 'التصنيف')} as="select" value={badgeForm.category} onChange={e => setBadgeForm({ ...badgeForm, category: e.target.value })}>
              {BADGE_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </FormField>
            <FormField label={t('Points (XP)', 'النقاط')} required type="number" min={1} step={1} value={badgeForm.points} onChange={e => setBadgeForm({ ...badgeForm, points: e.target.value })} placeholder="100" />
          </div>
        </div>
      </Modal>

      <Modal open={showEditBadge} onClose={() => setShowEditBadge(false)} title={t('Edit Badge', 'تحرير الشارة')}
        footer={<><Button variant="outline" onClick={() => setShowEditBadge(false)}>{t('Cancel', 'إلغاء')}</Button><Button onClick={handleEditBadge} disabled={savingEditBadge}>{savingEditBadge && <Loader2 className="h-4 w-4 animate-spin" />}{t('Save', 'حفظ')}</Button></>}>
        <div className="space-y-4">
          {editBadgeFormError && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{editBadgeFormError}</div>}
          <FormField label={t('Name', 'الاسم')} required value={editBadgeForm.name} onChange={e => setEditBadgeForm({ ...editBadgeForm, name: e.target.value })} />
          <FormField label={t('Description', 'الوصف')} as="textarea" value={editBadgeForm.description} onChange={e => setEditBadgeForm({ ...editBadgeForm, description: e.target.value })} />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Icon', 'الأيقونة')}</label>
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {ICON_OPTIONS.map(name => { const Icon = ICON_MAP[name]; return <button key={name} type="button" onClick={() => setEditBadgeForm({ ...editBadgeForm, iconUrl: name })} className={`flex items-center justify-center p-2 rounded-lg border ${editBadgeForm.iconUrl === name ? 'border-gold-500 bg-blue-50' : 'border-gray-200'}`}><Icon className="h-5 w-5" /></button> })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('Category', 'التصنيف')} as="select" value={editBadgeForm.category} onChange={e => setEditBadgeForm({ ...editBadgeForm, category: e.target.value })}>
              {BADGE_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </FormField>
            <FormField label={t('Points', 'النقاط')} required type="number" min={1} step={1} value={editBadgeForm.points} onChange={e => setEditBadgeForm({ ...editBadgeForm, points: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* XP drill-down */}
      <Modal open={!!drillDownStudent} onClose={() => setDrillDownStudent(null)} size="lg"
        title={drillDownStudent ? `${drillDownStudent.firstName} ${drillDownStudent.lastName}` : ''}
        description={drillDownStudent ? `${drillDownStudent.xp.toLocaleString()} XP · Level ${drillDownStudent.level} · ${drillDownStudent.badgeCount} ${t('badges', 'شارات')}` : ''}>
        {transactionsLoading ? <div className="py-10"><TableSkeleton rows={5} cols={3} /></div>
          : transactions.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">{t('No XP transactions found.', 'لا توجد معاملات نقاط خبرة.')}</p>
          : <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{TX_LABELS[tx.type] || tx.description || 'XP'}</div>
                    <div className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-700">+{tx.amount} XP</span>
                    <span className="text-xs text-gray-500">{t('Bal:', 'الرصيد:')} {tx.balanceAfter}</span>
                  </div>
                </div>
              ))}
              {transactions.length < transactionsTotal && (
                <div className="pt-3 text-center">
                  <Button variant="outline" onClick={loadMoreTransactions} disabled={transactionsLoadingMore}>
                    {transactionsLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t(`Load more (${transactions.length}/${transactionsTotal})`, `تحميل المزيد (${transactions.length}/${transactionsTotal})`)}
                  </Button>
                </div>
              )}
            </div>
        }
      </Modal>

      {/* Reset confirm */}
      <ConfirmDialog open={showResetConfirm} onClose={() => { setShowResetConfirm(false); setResetConfirmText('') }}
        onConfirm={handleResetLeaderboard} title={t('Reset Leaderboard', 'إعادة تعيين')}
        message={<div className="space-y-3"><p className="text-sm text-gray-600">{t('This permanently deletes all XP transactions for all students. Cannot be undone.', 'سيحذف جميع معاملات نقاط الخبرة نهائياً.')}</p><input value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)} placeholder="RESET" className="block w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:outline-none" autoFocus /></div>}
        confirmLabel={t('Reset', 'إعادة تعيين')} confirmDisabled={resetConfirmText !== 'RESET'} loading={resettingLeaderboard} variant="danger" />

      <ConfirmDialog open={showDeleteBadge} onClose={() => setShowDeleteBadge(false)} onConfirm={handleDeleteBadge}
        title={t('Delete Badge', 'حذف الشارة')} message={t(`Delete "${badgeToDelete?.name}"? Cannot be undone.`, `حذف "${badgeToDelete?.name}"؟ لا يمكن التراجع.`)}
        confirmLabel={t('Delete', 'حذف')} loading={deletingBadge} />
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  BarChart3, TrendingUp, TrendingDown, Users, AlertTriangle,
  CheckCircle2, Star, Heart, Calendar, Award, Flame, BookOpen,
  ArrowUp, ArrowDown, Minus, RefreshCw, ChevronRight,
  Church, Shield, Zap, Crown, Cross, Music,
} from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { getSchoolId } from '@/lib/school'

// ── Types ────────────────────────────────────────────────────────────────────

interface PriestPulse {
  generatedAt: string
  pulse: {
    attendanceThisWeek: number; attendanceLastWeek: number; attendanceTrend: number
    studentsAtRisk: number; pendingGrading: number; xpEarnedThisWeek: number
    familyPracticeThisWeek: number; totalStudents: number; activeStudentsThisWeek: number; healthScore: number
  }
  signals: Array<{ type: 'warning' | 'info' | 'success'; messageEn: string; messageAr: string }>
}

interface LiturgicalSeason {
  key: string; labelEn: string; labelAr: string; color: string
  start: string; end: string; sessions: number; totalRecords: number
  present: number; attendanceRate: number; liturgyCount: number
  xpEarned: number; inPast: boolean; isCurrent: boolean
}

interface LiturgicalReport { seasons: LiturgicalSeason[]; monthly: { month: string; rate: number; sessions: number }[] }

interface ServantEntry {
  id: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string
  roles: string[]; yearsActive: number; totalSessions: number; sessionsThisMonth: number
  sessionsLastMonth: number; trend: number; studentsReached: number
  appreciationEn: string; appreciationAr: string
}

interface ServantReport {
  servants: ServantEntry[]
  summary: { totalServants: number; totalSessionsAllTime: number; mostActiveThisMonth: { name: string; nameAr?: string; sessions: number } | null }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useReport<T>(url: string, schoolId: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true); setError(false)
    http.get<T>(`${url}?schoolId=${schoolId}`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [url, schoolId, refreshKey])

  return { data, loading, error, refresh: () => setRefreshKey(k => k + 1) }
}

function TrendPill({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[11px] font-bold text-green-700">
      <ArrowUp className="h-2.5 w-2.5" />+{value}{suffix}
    </span>
  )
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-bold text-red-600">
      <ArrowDown className="h-2.5 w-2.5" />{value}{suffix}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-500">
      <Minus className="h-2.5 w-2.5" />0{suffix}
    </span>
  )
}

function MiniBar({ value, max, color = 'bg-gold-400' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Priest Pulse Section ──────────────────────────────────────────────────────

function PriestPulseSection({ schoolId, lang }: { schoolId: string; lang: string }) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const { data, loading, error, refresh } = useReport<PriestPulse>('/reports/priest-pulse', schoolId)

  if (loading) return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />)}
    </div>
  )

  if (error || !data) return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-600">{t('Failed to load pulse data.', 'فشل تحميل بيانات النبض.')}</p>
      <button onClick={refresh} className="mt-2 text-xs text-red-500 underline">{t('Retry', 'إعادة المحاولة')}</button>
    </div>
  )

  const { pulse, signals } = data
  const healthColor = pulse.healthScore >= 80 ? 'text-green-600' : pulse.healthScore >= 60 ? 'text-amber-600' : 'text-red-500'
  const healthBg = pulse.healthScore >= 80 ? 'from-green-50 to-emerald-50 border-green-200' : pulse.healthScore >= 60 ? 'from-amber-50 to-yellow-50 border-amber-200' : 'from-red-50 to-rose-50 border-red-200'

  const cards = [
    {
      label: t('Attendance', 'الحضور'),
      value: pulse.attendanceThisWeek + '%',
      sub: t('This week', 'هذا الأسبوع'),
      trend: pulse.attendanceTrend,
      suffix: '%',
      icon: Users,
      iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
      alert: pulse.attendanceThisWeek < 60,
    },
    {
      label: t('Students At Risk', 'طلاب في خطر'),
      value: String(pulse.studentsAtRisk),
      sub: t('Missed 3+ sessions', 'غابوا عن 3+ جلسات'),
      icon: AlertTriangle,
      iconBg: pulse.studentsAtRisk > 0 ? 'bg-red-50' : 'bg-green-50',
      iconColor: pulse.studentsAtRisk > 0 ? 'text-red-500' : 'text-green-600',
      alert: pulse.studentsAtRisk > 0,
    },
    {
      label: t('Pending Grading', 'تقييمات معلقة'),
      value: String(pulse.pendingGrading),
      sub: t('Awaiting review', 'تنتظر التصحيح'),
      icon: BookOpen,
      iconBg: pulse.pendingGrading > 0 ? 'bg-amber-50' : 'bg-green-50',
      iconColor: pulse.pendingGrading > 0 ? 'text-amber-600' : 'text-green-600',
      alert: pulse.pendingGrading > 5,
    },
    {
      label: t('XP This Week', 'نقاط هذا الأسبوع'),
      value: pulse.xpEarnedThisWeek.toLocaleString(),
      sub: t('Experience earned', 'خبرة مكتسبة'),
      icon: Star,
      iconBg: 'bg-yellow-50', iconColor: 'text-yellow-600',
    },
    {
      label: t('Family Practice', 'ممارسة عائلية'),
      value: String(pulse.familyPracticeThisWeek),
      sub: t('Families practiced at home', 'عائلات مارست في المنزل'),
      icon: Heart,
      iconBg: 'bg-pink-50', iconColor: 'text-pink-600',
    },
    {
      label: t('Active Students', 'طلاب نشطون'),
      value: pulse.activeStudentsThisWeek + '/' + pulse.totalStudents,
      sub: t('Attended this week', 'حضروا هذا الأسبوع'),
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Health score hero */}
      <div className={`rounded-2xl border bg-gradient-to-br ${healthBg} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              {t('School Health Score', 'نقاط صحة المدرسة')}
            </p>
            <div className="flex items-end gap-3">
              <span className={`text-5xl font-black ${healthColor}`}>{pulse.healthScore}</span>
              <span className="text-xl text-gray-500 mb-1">/100</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {pulse.healthScore >= 80
                ? t('The school is in excellent health this week.', 'المدرسة في صحة ممتازة هذا الأسبوع.')
                : pulse.healthScore >= 60
                ? t('Good overall — a few areas to watch.', 'جيد بشكل عام — بعض المجالات تحتاج انتباهاً.')
                : t('Some areas need attention this week.', 'بعض المجالات تحتاج اهتماماً هذا الأسبوع.')}
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/60 border border-white/80 shadow-sm">
            <Church className={`h-8 w-8 ${healthColor}`} />
          </div>
        </div>
        <div className="mt-3 text-[11px] text-gray-500">
          {t('Generated', 'تم التوليد')} {new Date(data.generatedAt).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
          <button onClick={refresh} className="ml-3 inline-flex items-center gap-1 text-gray-500 hover:text-gray-600 transition-colors">
            <RefreshCw className="h-3 w-3" /> {t('Refresh', 'تحديث')}
          </button>
        </div>
      </div>

      {/* Signal banners */}
      {signals.length > 0 && (
        <div className="space-y-2">
          {signals.map((signal, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              signal.type === 'warning' ? 'border-amber-200 bg-amber-50' :
              signal.type === 'success' ? 'border-green-200 bg-green-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              {signal.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" /> :
               signal.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> :
               <Zap className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />}
              <p className={`text-sm ${signal.type === 'warning' ? 'text-amber-800' : signal.type === 'success' ? 'text-green-800' : 'text-blue-800'}`}>
                {lang === 'ar' ? signal.messageAr : signal.messageEn}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 5-metric grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`rounded-xl border bg-white p-4 ${card.alert ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                  <Icon className={`h-4.5 w-4.5 ${card.iconColor}`} />
                </div>
                {card.trend !== undefined && <TrendPill value={card.trend} suffix={card.suffix} />}
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-gray-900">{card.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{card.sub}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Liturgical Engagement Section ─────────────────────────────────────────────

function LiturgicalEngagementSection({ schoolId, lang }: { schoolId: string; lang: string }) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const { data, loading, error } = useReport<LiturgicalReport>('/reports/liturgical-engagement', schoolId)

  if (loading) return <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
  if (error || !data) return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
      <p className="text-sm text-gray-500">{t('No liturgical engagement data yet.', 'لا توجد بيانات مشاركة ليتورجية بعد.')}</p>
    </div>
  )

  const maxRate = Math.max(...data.seasons.map(s => s.attendanceRate), 1)
  const maxXp = Math.max(...data.seasons.map(s => s.xpEarned), 1)
  const maxMonthly = Math.max(...data.monthly.map(m => m.rate), 1)

  return (
    <div className="space-y-6">
      {/* Monthly attendance trend */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          {t('12-Month Attendance Trend', 'اتجاه الحضور خلال 12 شهراً')}
        </h3>
        <div className="flex items-end gap-1.5 h-24">
          {data.monthly.map((m, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-full rounded-t-md bg-blue-400 transition-all duration-500 hover:bg-blue-500 min-h-[2px]"
                style={{ height: `${Math.max(4, (m.rate / maxMonthly) * 80)}px` }}
                title={`${m.rate}%`}
              />
              <span className="text-[9px] text-gray-500 truncate w-full text-center">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-500">
          <span>{t('Hover bars for rate', 'مرر على الأعمدة للنسبة')}</span>
          <span className="ml-auto">{t('Sessions: ' + data.monthly.reduce((s, m) => s + m.sessions, 0), 'الجلسات: ' + data.monthly.reduce((s, m) => s + m.sessions, 0))}</span>
        </div>
      </div>

      {/* Season cards */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-500" />
          {t('Engagement by Liturgical Season', 'المشاركة حسب الموسم الليتورجي')}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.seasons.map(season => (
            <div
              key={season.key}
              className={`rounded-xl border p-4 transition-all ${
                season.isCurrent ? 'ring-2 ring-offset-1' : ''
              } ${season.inPast && !season.isCurrent ? 'opacity-75' : ''}`}
              style={{ borderColor: season.color + '40', backgroundColor: season.color + '08', ...(season.isCurrent ? { outlineColor: season.color } : {}) }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs font-bold" style={{ color: season.color }}>
                    {lang === 'ar' ? season.labelAr : season.labelEn}
                  </p>
                  {season.isCurrent && (
                    <span className="inline-block mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: season.color }}>
                      {t('Current', 'حالي')}
                    </span>
                  )}
                </div>
                <span className="text-xl font-black text-gray-900">{season.attendanceRate}%</span>
              </div>

              {season.sessions > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>{t('Attendance', 'الحضور')}</span>
                    <span>{season.present}/{season.totalRecords}</span>
                  </div>
                  <MiniBar value={season.attendanceRate} max={100} color="bg-blue-400" />

                  <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
                    <span>{t('XP Earned', 'نقاط مكتسبة')}</span>
                    <span className="font-semibold text-amber-600">{season.xpEarned.toLocaleString()} XP</span>
                  </div>
                  <MiniBar value={season.xpEarned} max={maxXp} color="bg-amber-400" />

                  {season.liturgyCount > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: season.color }}>
                      <Church className="h-3 w-3" />
                      <span>{season.liturgyCount} {t('attended liturgy', 'حضروا القداس')}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500">
                  {season.inPast ? t('No sessions recorded for this season.', 'لا جلسات مسجلة لهذا الموسم.') : t('Season not started yet.', 'لم يبدأ الموسم بعد.')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Servant Contributions Section ─────────────────────────────────────────────

function ServantContributionsSection({ schoolId, lang }: { schoolId: string; lang: string }) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const { data, loading, error } = useReport<ServantReport>('/reports/servant-contributions', schoolId)

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
    </div>
  )
  if (error || !data) return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
      <p className="text-sm text-gray-500">{t('No servant data yet.', 'لا توجد بيانات خدام بعد.')}</p>
    </div>
  )

  const maxSessions = Math.max(...data.servants.map(s => s.totalSessions), 1)

  return (
    <div className="space-y-4">
      {/* Summary */}
      {data.summary.mostActiveThisMonth && (
        <div className="rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 p-4">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-purple-500 shrink-0" />
            <div>
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">{t('Most Active This Month', 'الأكثر نشاطاً هذا الشهر')}</p>
              <p className="text-sm font-bold text-purple-900 mt-0.5">
                {lang === 'ar' ? (data.summary.mostActiveThisMonth.nameAr || data.summary.mostActiveThisMonth.name) : data.summary.mostActiveThisMonth.name}
                <span className="font-normal text-purple-600"> · {data.summary.mostActiveThisMonth.sessions} {t('sessions', 'جلسات')}</span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-gray-500">{t('Total servants', 'إجمالي الخدام')}</p>
              <p className="text-base font-bold text-gray-700">{data.summary.totalServants}</p>
            </div>
          </div>
        </div>
      )}

      {/* Servant list */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Award className="h-4 w-4 text-gold-500" />
            {t('Servant Contributions', 'مساهمات الخدام')}
          </h3>
          <span className="text-[11px] text-gray-500">
            {data.summary.totalSessionsAllTime.toLocaleString()} {t('sessions total', 'جلسة إجمالاً')}
          </span>
        </div>
        {data.servants.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-500">{t('No servants found.', 'لا يوجد خدام.')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.servants.map((servant, i) => {
              const name = lang === 'ar' && servant.firstNameAr
                ? (servant.firstNameAr + ' ' + (servant.lastNameAr || ''))
                : (servant.firstName + ' ' + servant.lastName)
              return (
                <div key={servant.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Rank */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-50 text-orange-600' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {servant.roles.join(', ')} · {servant.yearsActive > 0 ? servant.yearsActive + ' ' + t('yr', 'سنة') : t('New', 'جديد')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900">{servant.totalSessions.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-500">{t('sessions', 'جلسة')}</p>
                        </div>
                      </div>
                      {/* Appreciation message */}
                      <p className="mt-1.5 text-[11px] text-indigo-600 italic leading-relaxed">
                        &ldquo;{lang === 'ar' ? servant.appreciationAr : servant.appreciationEn}&rdquo;
                      </p>
                      {/* Bar + this month */}
                      <div className="mt-2 space-y-1">
                        <MiniBar value={servant.totalSessions} max={maxSessions} color="bg-indigo-300" />
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>{t('This month:', 'هذا الشهر:')} <strong className="text-gray-600">{servant.sessionsThisMonth}</strong></span>
                          <TrendPill value={servant.trend} />
                          <span>{t('Students reached:', 'طلاب وصلوا:')} <strong className="text-gray-600">{servant.studentsReached}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500 text-center italic">
        {t('This report is for appreciation, not performance review. Every session taught is a gift to the Church.', 'هذا التقرير للتقدير، ليس لتقييم الأداء. كل جلسة علّمتها هي هدية للكنيسة.')}
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const schoolId = getSchoolId()
  const [activeTab, setActiveTab] = useState<'pulse' | 'liturgical' | 'servants'>('pulse')

  const tabs = [
    { id: 'pulse' as const,      label: t('Priest Pulse', 'نبض الكاهن'),      icon: Church,    description: t('30-second school health overview', 'نظرة سريعة على صحة المدرسة') },
    { id: 'liturgical' as const, label: t('Liturgical Seasons', 'المواسم الليتورجية'), icon: Calendar,  description: t('Engagement overlaid on the Coptic calendar', 'المشاركة على التقويم القبطي') },
    { id: 'servants' as const,   label: t('Servant Report', 'تقرير الخدام'),   icon: Award,     description: t('Appreciation-framed contributions', 'مساهمات معروضة بتقدير') },
  ]

  return (
    <div className="space-y-6">
      <title>{t('Reports & Analytics — COHEP', 'التقارير والتحليلات — كوهيب')}</title>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Reports & Analytics', 'التقارير والتحليلات')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('Turning your data into wisdom — for priests, principals, and the ministry.', 'تحويل بياناتك إلى حكمة — للكهنة والمديرين والخدمة.')}
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left flex-1 transition-all ${
                activeTab === tab.id
                  ? 'border-gold-400 bg-gold-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activeTab === tab.id ? 'bg-gold-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${activeTab === tab.id ? 'text-gold-800' : 'text-gray-900'}`}>{tab.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{tab.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'pulse' && <PriestPulseSection schoolId={schoolId} lang={lang} />}
      {activeTab === 'liturgical' && <LiturgicalEngagementSection schoolId={schoolId} lang={lang} />}
      {activeTab === 'servants' && <ServantContributionsSection schoolId={schoolId} lang={lang} />}
    </div>
  )
}

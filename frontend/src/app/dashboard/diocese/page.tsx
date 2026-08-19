'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Church, Users, Award, AlertTriangle, CheckCircle2, TrendingUp,
  TrendingDown, Minus, ArrowUp, ArrowDown, RefreshCw,
  Globe, Heart, Star, BookOpen, Shield, Zap, BarChart3, Crown,
} from 'lucide-react'
import { CardSkeleton } from '@/components/ui/skeleton'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolStat {
  churchId: string; churchName: string; churchNameAr?: string
  schoolId: string; schoolName: string; schoolNameAr?: string; slug: string
  isActive: boolean; totalStudents: number; totalServants: number
  attendanceThisWeek: number; attendanceLastWeek: number; trend: number
  pendingGrading: number; studentsAtRisk: number; badgesThisWeek: number
  healthScore: number; signals: string[]
}

interface DioceseReport {
  generatedAt: string
  summary: {
    totalChurches: number; totalSchools: number; totalStudents: number
    totalServants: number; avgAttendance: number; totalAtRisk: number
    dioceseHealthScore: number
  }
  healthiest: { schoolName: string; churchName: string; score: number } | null
  needsAttention: Array<{ schoolName: string; churchName: string; score: number; signals: string[] }>
  schools: SchoolStat[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TrendPill({ value }: { value: number }) {
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">
      <ArrowUp className="h-2.5 w-2.5" />+{value}%
    </span>
  )
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-600">
      <ArrowDown className="h-2.5 w-2.5" />{value}%
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-400">
      <Minus className="h-2.5 w-2.5" />—
    </span>
  )
}

function HealthRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444'

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={radius} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text
        x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="rotate-90" transform={`rotate(90, ${size/2}, ${size/2})`}
        fontSize="12" fontWeight="800" fill={color}
      >
        {score}
      </text>
    </svg>
  )
}

function MiniBar({ value, max = 100, color = '#6366F1' }: { value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

// ── Diocese Summary Bar ───────────────────────────────────────────────────────

function SummaryBar({ data, lang }: { data: DioceseReport; lang: string }) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const s = data.summary
  const hColor = s.dioceseHealthScore >= 80 ? 'text-green-600' : s.dioceseHealthScore >= 60 ? 'text-amber-600' : 'text-red-500'
  const hBg = s.dioceseHealthScore >= 80 ? 'from-green-50 to-emerald-50 border-green-200' : s.dioceseHealthScore >= 60 ? 'from-amber-50 to-yellow-50 border-amber-200' : 'from-red-50 to-rose-50 border-red-200'

  return (
    <div className="space-y-4">
      {/* Diocese health hero */}
      <div className={`rounded-2xl border bg-gradient-to-br ${hBg} p-5`}>
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <HealthRing score={s.dioceseHealthScore} size={72} />
            <span className="text-[10px] text-gray-400">{t('Diocese Health', 'صحة الأبرشية')}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              {t('Diocese-Wide Overview', 'نظرة عامة على الأبرشية')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t('Churches', 'كنائس'), value: s.totalChurches, icon: Church, color: 'text-indigo-600' },
                { label: t('Students', 'طلاب'), value: s.totalStudents.toLocaleString(), icon: Users, color: 'text-blue-600' },
                { label: t('Servants', 'خدام'), value: s.totalServants.toLocaleString(), icon: Heart, color: 'text-purple-600' },
                { label: t('Avg Attendance', 'معدل الحضور'), value: s.avgAttendance + '%', icon: TrendingUp, color: 'text-green-600' },
                { label: t('At Risk', 'في خطر'), value: s.totalAtRisk, icon: AlertTriangle, color: s.totalAtRisk > 0 ? 'text-red-500' : 'text-green-600' },
                { label: t('Schools', 'مدارس'), value: s.totalSchools, icon: BookOpen, color: 'text-amber-600' },
              ].map(stat => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${stat.color}`} />
                    <div>
                      <div className="text-base font-black text-gray-900">{stat.value}</div>
                      <div className="text-[10px] text-gray-400">{stat.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Needs attention */}
      {data.needsAttention.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800">{t('Needs Attention', 'تحتاج اهتماماً')}</h3>
          </div>
          <div className="space-y-2">
            {data.needsAttention.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2">
                <HealthRing score={s.score} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900">{s.schoolName}</p>
                  <p className="text-[10px] text-gray-400">{s.churchName}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.signals.map((sig, j) => (
                    <span key={j} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">{sig}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Healthiest school */}
      {data.healthiest && data.needsAttention.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <Crown className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-green-800">{t('Top performing school this week', 'أفضل مدرسة هذا الأسبوع')}</p>
            <p className="text-sm text-green-700">{data.healthiest.schoolName} · {data.healthiest.churchName} · {data.healthiest.score}/100</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── School Card ───────────────────────────────────────────────────────────────

function SchoolCard({ school, lang }: { school: SchoolStat; lang: string }) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const name = lang === 'ar' && school.schoolNameAr ? school.schoolNameAr : school.schoolName
  const churchName = lang === 'ar' && school.churchNameAr ? school.churchNameAr : school.churchName
  const healthColor = school.healthScore >= 80 ? 'border-green-200 bg-green-50/30' : school.healthScore >= 60 ? 'border-amber-200 bg-amber-50/30' : 'border-red-200 bg-red-50/30'

  return (
    <div className={`rounded-2xl border ${healthColor} bg-white p-5 transition-all hover:shadow-md`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <HealthRing score={school.healthScore} size={52} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">{name}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{churchName}</p>
          {school.signals.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {school.signals.map((sig, i) => (
                <span key={i} className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">{sig}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {/* Attendance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500">{t('Attendance', 'الحضور')}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-gray-900">{school.attendanceThisWeek}%</span>
              <TrendPill value={school.trend} />
            </div>
          </div>
          <MiniBar value={school.attendanceThisWeek} color={school.attendanceThisWeek >= 80 ? '#10B981' : school.attendanceThisWeek >= 60 ? '#F59E0B' : '#EF4444'} />
        </div>

        {/* Students */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Users className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{school.totalStudents}</div>
            <div className="text-[10px] text-gray-400">{t('students', 'طالب')}</div>
          </div>
        </div>

        {/* Servants */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50">
            <Heart className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{school.totalServants}</div>
            <div className="text-[10px] text-gray-400">{t('servants', 'خادم')}</div>
          </div>
        </div>

        {/* At risk */}
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${school.studentsAtRisk > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            {school.studentsAtRisk > 0
              ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
          </div>
          <div>
            <div className={`text-sm font-bold ${school.studentsAtRisk > 0 ? 'text-red-600' : 'text-green-600'}`}>{school.studentsAtRisk}</div>
            <div className="text-[10px] text-gray-400">{t('at risk', 'في خطر')}</div>
          </div>
        </div>

        {/* Pending grading */}
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${school.pendingGrading > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <BookOpen className={`h-3.5 w-3.5 ${school.pendingGrading > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <div className={`text-sm font-bold ${school.pendingGrading > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{school.pendingGrading}</div>
            <div className="text-[10px] text-gray-400">{t('pending', 'معلق')}</div>
          </div>
        </div>

        {/* Badges this week */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50">
            <Star className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{school.badgesThisWeek}</div>
            <div className="text-[10px] text-gray-400">{t('badges', 'شارات')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DiocesePage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [data, setData] = useState<DioceseReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [sortBy, setSortBy] = useState<'health' | 'students' | 'attendance'>('health')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(() => {
    setLoading(true); setError(false)
    http.get<DioceseReport>('/reports/diocese')
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const filtered = data?.schools
    .filter(s => !searchQ || s.schoolName.toLowerCase().includes(searchQ.toLowerCase()) || s.churchName.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'health') return b.healthScore - a.healthScore
      if (sortBy === 'students') return b.totalStudents - a.totalStudents
      return b.attendanceThisWeek - a.attendanceThisWeek
    }) ?? []

  return (
    <div className="space-y-6">
      <title>{t('Diocese Dashboard — COHEP', 'لوحة الأبرشية — كوهيب')}</title>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-6 w-6 text-indigo-500" />
            {t('Diocese Dashboard', 'لوحة الأبرشية')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("A bishop's-eye view of every church and school in the diocese.", 'نظرة الأسقف على كل كنيسة ومدرسة في الأبرشية.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[11px] text-gray-400">
              {t('Updated', 'تم التحديث')} {new Date(data.generatedAt).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('Refresh', 'تحديث')}
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-20">
          <p className="text-sm text-gray-400 mb-4">{t('Gathering diocese data...', 'جمع بيانات الأبرشية...')}</p>
          <CardSkeleton count={4} />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-3" />
          <p className="text-sm text-red-600 mb-3">{t('Failed to load diocese data.', 'فشل تحميل بيانات الأبرشية.')}</p>
          <button onClick={load} className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors">
            {t('Try Again', 'حاول مجدداً')}
          </button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <SummaryBar data={data} lang={lang} />

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={t('Search school or church...', 'ابحث عن مدرسة أو كنيسة...')}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
            <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
              {([
                { id: 'health',     label: t('Health', 'الصحة') },
                { id: 'students',   label: t('Students', 'الطلاب') },
                { id: 'attendance', label: t('Attendance', 'الحضور') },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    sortBy === opt.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 shrink-0">
              {filtered.length} {t('schools', 'مدرسة')}
            </span>
          </div>

          {/* School cards grid */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <Church className="mx-auto h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">
                {searchQ ? t('No schools match your search.', 'لا توجد مدارس تطابق بحثك.') : t('No schools registered yet.', 'لا توجد مدارس مسجلة بعد.')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(school => (
                <SchoolCard key={school.schoolId} school={school} lang={lang} />
              ))}
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-[11px] text-gray-400 italic pb-4">
            {t(
              'Health scores are calculated from attendance rate, pending grading, at-risk students, and family engagement.',
              'تُحسب نقاط الصحة من معدل الحضور والتقييمات المعلقة والطلاب في خطر ومشاركة الأسرة.'
            )}
          </p>
        </>
      )}
    </div>
  )
}

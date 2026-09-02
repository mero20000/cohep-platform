'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, TrendingUp, CheckCircle2, AlertTriangle, BarChart3 } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { getSchoolId } from '@/lib/school'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

interface GroupStats {
  groupName: string
  groupNameAr: string
  totalStudents: number
  attendanceRate: number
  assessmentCompletionRate: number
  masteryDistribution: {
    excellent: number
    good: number
    satisfactory: number
    needsImprovement: number
  }
  topPerformers: Array<{ name: string; score: number }>
  lowPerformers: Array<{ name: string; score: number }>
  recentActivity: Array<{ type: string; count: number; date: string }>
}

export default function GroupReportPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [stats, setStats] = useState<GroupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const schoolId = getSchoolId()
      if (!schoolId) throw new Error('No school ID')
      const data = await http.get<GroupStats>('/dashboard/group-report', { schoolId })
      setStats(data)
    } catch (err) {
      console.error('Failed to load group report:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 h-24 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2 w-1/2" />
              <div className="h-6 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">
          {t('Group Report', 'تقرير المجموعة')}
        </h1>
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title={t("Couldn't load report", 'تعذر تحميل التقرير')}
            description={t('Something went wrong. Please try again.', 'حدث خطأ ما. حاول مرة أخرى.')}
            action={
              <Button onClick={load} className="bg-gold-500 hover:bg-gold-600 text-gray-950">
                {t('Retry', 'إعادة المحاولة')}
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {lang === 'ar' ? stats.groupNameAr : stats.groupName} - {t('Report', 'التقرير')}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('Group performance overview', 'نظرة عامة على أداء المجموعة')}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase">{t('Total Students', 'إجمالي الطلاب')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase">{t('Attendance', 'الحضور')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{Math.round(stats.attendanceRate)}%</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-20" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase">{t('Assessments', 'التقييمات')}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{Math.round(stats.assessmentCompletionRate)}%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Mastery Distribution */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('Mastery Distribution', 'توزيع الإتقان')}</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('Excellent', 'ممتاز')}</span>
              <span className="text-xs font-bold text-emerald-700">{stats.masteryDistribution.excellent}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${stats.masteryDistribution.excellent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('Good', 'جيد')}</span>
              <span className="text-xs font-bold text-blue-700">{stats.masteryDistribution.good}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${stats.masteryDistribution.good}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('Satisfactory', 'مقبول')}</span>
              <span className="text-xs font-bold text-amber-700">{stats.masteryDistribution.satisfactory}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${stats.masteryDistribution.satisfactory}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('Needs Work', 'يحتاج مراجعة')}</span>
              <span className="text-xs font-bold text-red-700">{stats.masteryDistribution.needsImprovement}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-red-500"
                style={{ width: `${stats.masteryDistribution.needsImprovement}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top and Low Performers */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            {t('Top Performers', 'أفضل الأداء')}
          </h2>
          <div className="space-y-3">
            {stats.topPerformers.slice(0, 5).map((performer, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{performer.name}</span>
                <span className="text-sm font-semibold text-emerald-700">{Math.round(performer.score)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {t('Need Support', 'يحتاجون الدعم')}
          </h2>
          <div className="space-y-3">
            {stats.lowPerformers.slice(0, 5).map((performer, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{performer.name}</span>
                <span className="text-sm font-semibold text-red-700">{Math.round(performer.score)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

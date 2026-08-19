'use client'
import { User, UserCheck, Award, X } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { Button } from '@/components/ui/button'
import type { StudentStats as Stats } from './student-types'

interface Props { stats: Stats | null; loading: boolean; lang: 'en' | 'ar'; onGradeClick?: (grade: string) => void; onStatusClick?: (status: string) => void }

export function StudentStats({ stats, loading, lang, onGradeClick, onStatusClick }: Props) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 animate-pulse">
            <div className="h-3 w-16 bg-gray-200 rounded" /><div className="mt-2 h-6 w-10 bg-gray-200 rounded" />
          </div>
        )) : (
          <>
            <StatCard compact label={t('Total Students','إجمالي الطلاب')} value={stats?.total ?? 0} icon={User} iconBg="bg-blue-50" iconColor="text-blue-700" />
            <StatCard compact label={t('Active','نشط')} value={stats?.active ?? 0} icon={UserCheck} iconBg="bg-green-50" iconColor="text-green-600"
              subtitle={`${stats?.active && stats?.total ? Math.round((stats.active/stats.total)*100) : 0}%`} onClick={() => onStatusClick?.('active')} />
            <StatCard compact label={t('Inactive','غير نشط')} value={stats?.inactive ?? 0} icon={X} iconBg="bg-red-50" iconColor="text-red-600"
              onClick={() => onStatusClick?.('inactive')} />
            <StatCard compact label={t('Graduated','متخرج')} value={stats?.graduated ?? 0} icon={Award} iconBg="bg-amber-50" iconColor="text-amber-600"
              onClick={() => onStatusClick?.('graduated')} />
            <StatCard compact label={t('Male','ذكر')} value={stats?.male ?? 0} icon={User} iconBg="bg-blue-50" iconColor="text-blue-600" />
            <StatCard compact label={t('Female','أنثى')} value={stats?.female ?? 0} icon={User} iconBg="bg-pink-50" iconColor="text-pink-600" />
          </>
        )}
      </div>
      {stats?.gradeDistribution && stats.gradeDistribution.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{t('Grades:','المراحل الدراسية:')}</span>
          {stats.gradeDistribution.map(g => (
            <Button key={g.grade} variant="ghost" size="sm" onClick={() => onGradeClick?.(g.grade)} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 hover:text-blue-800">
              {g.grade} <span className="text-gold-700">({g.count})</span>
            </Button>
          ))}
          {(stats.active ?? 0) < (stats.total ?? 0) && (
            <span className="text-xs text-amber-600">· {stats.total - stats.active} {t('non-active','غير نشط')}</span>
          )}
        </div>
      )}
    </>
  )
}

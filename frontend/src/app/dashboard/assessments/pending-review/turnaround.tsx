'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/use-language'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { formatHours, waitingDays, type ReviewStats } from './types'

export function Turnaround() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      setStats(await http.get<ReviewStats>('/assessments/review-stats', { schoolId: getSchoolId() }))
    } catch (err) {
      console.error('Failed to load review stats', err)
      setError(true)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <TableSkeleton rows={4} cols={4} />
  if (error || !stats) {
    return (
      <EmptyState
        icon={Clock}
        title={t('Could not load turnaround stats', 'تعذر تحميل إحصائيات الإنجاز')}
        action={<Button size="sm" variant="outline" onClick={load}>{t('Retry', 'إعادة المحاولة')}</Button>}
      />
    )
  }

  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500'
  const td = 'px-3 py-2.5 text-sm text-gray-800'

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        {t(`Turnaround = time from submission to mark, over the last ${stats.days} days.`, `الإنجاز = الوقت من التسليم إلى الدرجة خلال آخر ${stats.days} يوماً.`)}
      </p>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('By group', 'حسب المجموعة')}</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/50">
              <tr>
                <th className={th}>{t('Group', 'المجموعة')}</th>
                <th className={th}>{t('Pending', 'معلّق')}</th>
                <th className={th}>{t('Oldest waiting', 'الأقدم انتظاراً')}</th>
                <th className={th}>{t('Marked', 'تم تقييمه')}</th>
                <th className={th}>{t('Avg turnaround', 'متوسط الإنجاز')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.groups.length === 0 && (
                <tr><td className={td} colSpan={5}>{t('No data yet.', 'لا توجد بيانات بعد.')}</td></tr>
              )}
              {stats.groups.map(g => (
                <tr key={g.groupId}>
                  <td className={td}>{g.groupName}</td>
                  <td className={`${td} font-semibold`}>{g.pending}</td>
                  <td className={td}>{g.oldestPendingAt ? `${waitingDays(g.oldestPendingAt)} ${t('days', 'يوم')}` : '—'}</td>
                  <td className={td}>{g.completed}</td>
                  <td className={td}>{formatHours(g.avgTurnaroundHours, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('By marker', 'حسب المُقيِّم')}</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/50">
              <tr>
                <th className={th}>{t('Marker', 'المُقيِّم')}</th>
                <th className={th}>{t('Marked', 'تم تقييمه')}</th>
                <th className={th}>{t('Avg turnaround', 'متوسط الإنجاز')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.markers.length === 0 && (
                <tr><td className={td} colSpan={3}>{t('No marked submissions in this period.', 'لا توجد تقييمات في هذه الفترة.')}</td></tr>
              )}
              {stats.markers.map(m => (
                <tr key={m.userId}>
                  <td className={td}>{m.name}</td>
                  <td className={td}>{m.completed}</td>
                  <td className={td}>{formatHours(m.avgTurnaroundHours, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

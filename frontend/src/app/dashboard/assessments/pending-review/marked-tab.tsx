'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, ClipboardCheck, Download, Mic } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { exportMarkedXlsx } from '@/lib/export-pending-review'
import type { MarkedItem, MarkedResponse } from './types'

/** Everything already marked, with who marked it (admin or servant). Read-only. */
export function MarkedTab({ onCount }: { onCount?: (n: number) => void }) {
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [data, setData] = useState<MarkedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [assessmentFilter, setAssessmentFilter] = useState('')
  const [markerFilter, setMarkerFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | 'admin' | 'servant'>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await http.get<MarkedResponse>('/assessments/marked', { schoolId: getSchoolId() })
      setData(res)
      onCount?.(res.items.length)
    } catch (err) {
      console.error('Failed to load marked submissions', err)
      setError(true)
    }
    setLoading(false)
  }, [onCount])

  useEffect(() => { load() }, [load])

  const items = data?.items ?? []

  const groups = useMemo(() => Array.from(new Set(items.map(i => i.student.groupName).filter(Boolean))) as string[], [items])
  const assessments = useMemo(() => {
    const m = new Map<string, string>()
    items.forEach(i => m.set(i.assessment.id, i.assessment.title))
    return Array.from(m.entries())
  }, [items])
  const markers = useMemo(() => {
    const m = new Map<string, string>()
    items.forEach(i => { if (i.markedBy) m.set(i.markedBy.id, i.markedBy.name) })
    return Array.from(m.entries())
  }, [items])

  const q = search.trim().toLowerCase()
  const visible = items.filter(i =>
    (!q || `${i.student.firstName} ${i.student.lastName}`.toLowerCase().includes(q) || (i.student.studentCode || '').toLowerCase().includes(q)) &&
    (!groupFilter || i.student.groupName === groupFilter) &&
    (!assessmentFilter || i.assessment.id === assessmentFilter) &&
    (!markerFilter || i.markedBy?.id === markerFilter) &&
    (!roleFilter || (roleFilter === 'admin' ? i.markedBy?.isAdmin === true : i.markedBy?.isAdmin === false)),
  )

  const select = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm'

  if (loading) return <TableSkeleton rows={5} cols={4} />
  if (error) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t('Could not load marked submissions', 'تعذر تحميل التسليمات المقيّمة')}
        action={<Button size="sm" variant="outline" onClick={load}>{t('Retry', 'إعادة المحاولة')}</Button>}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search student or code', 'ابحث عن طالب أو كود')}
          aria-label={t('Search student', 'بحث عن طالب')}
          className={`${select} w-56`}
        />
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className={select} aria-label={t('Filter by group', 'تصفية حسب المجموعة')}>
          <option value="">{t('All groups', 'كل المجموعات')}</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={assessmentFilter} onChange={e => setAssessmentFilter(e.target.value)} className={select} aria-label={t('Filter by assessment', 'تصفية حسب التقييم')}>
          <option value="">{t('All assessments', 'كل التقييمات')}</option>
          {assessments.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <select value={markerFilter} onChange={e => setMarkerFilter(e.target.value)} className={select} aria-label={t('Filter by marker', 'تصفية حسب المُقيِّم')}>
          <option value="">{t('Anyone', 'أي شخص')}</option>
          {markers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as '' | 'admin' | 'servant')} className={select} aria-label={t('Filter by marker role', 'تصفية حسب دور المُقيِّم')}>
          <option value="">{t('Admin or servant', 'مسؤول أو خادم')}</option>
          <option value="admin">{t('Marked by admin', 'قيّمه مسؤول')}</option>
          <option value="servant">{t('Marked by servant', 'قيّمه خادم')}</option>
        </select>
        <Button size="sm" variant="outline" className="ml-auto" disabled={visible.length === 0} onClick={() => exportMarkedXlsx(visible, lang)}>
          <Download className="h-4 w-4" />{t('Export', 'تصدير')}
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        {t(`Marked in the last ${data?.days ?? 90} days — newest first.`, `تم تقييمها خلال آخر ${data?.days ?? 90} يوماً — الأحدث أولاً.`)}
        {data?.truncated && ` ${t('Showing the latest 500; narrow the filters to see older ones.', 'يتم عرض أحدث 500؛ ضيّق عوامل التصفية لرؤية الأقدم.')}`}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={items.length === 0 ? t('Nothing has been marked yet', 'لم يتم تقييم أي شيء بعد') : t('No results match these filters', 'لا توجد نتائج مطابقة')}
        />
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {visible.map((i: MarkedItem) => {
            const title = lang === 'ar' && i.assessment.titleAr ? i.assessment.titleAr : i.assessment.title
            const pass = i.percentage !== null && i.percentage >= 60
            return (
              <div key={i.submissionId} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {i.student.firstName} {i.student.lastName}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {[i.student.groupName, i.student.gradeName].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{title}</span>
                    <span>·</span>
                    <span>
                      {i.markedBy ? `${t('Marked by', 'قيّمه')} ${i.markedBy.name}` : t('Marked by (removed user)', 'قيّمه (مستخدم محذوف)')}
                      {' · '}
                      {new Date(i.markedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                    </span>
                    {i.markedBy && (
                      <Badge variant={i.markedBy.isAdmin ? 'info' : 'default'}>
                        {i.markedBy.isAdmin ? t('Admin', 'مسؤول') : t('Servant', 'خادم')}
                      </Badge>
                    )}
                    {i.isLate && <Badge variant="danger">{t('Late', 'متأخر')}</Badge>}
                    {i.hasRecording && (
                      <Badge variant="info"><span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" />{t('Recording', 'تسجيل')}</span></Badge>
                    )}
                  </div>
                  {i.feedback && <p className="mt-1 text-xs italic text-gray-600">“{i.feedback}”</p>}
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${pass ? 'text-green-700' : 'text-red-700'}`}>
                    {i.score} / {i.maxScore}
                  </div>
                  {i.percentage !== null && <div className="text-xs text-gray-500">{i.percentage}%</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

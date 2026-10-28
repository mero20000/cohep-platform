'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, ClipboardCheck, Download, StickyNote, Undo2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AudioPlayer } from '@/components/audio-player'
import { assetUrl } from '@/lib/asset-url'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { exportMarkedXlsx } from '@/lib/export-pending-review'
import type { MarkedItem, MarkedResponse } from './types'

/** Everything already handled: marked work and work returned to the student, with who did it. Read-only. */
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
  const [statusFilter, setStatusFilter] = useState<'' | 'marked' | 'returned'>('')

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
    items.forEach(i => { if (i.by) m.set(i.by.id, i.by.name) })
    return Array.from(m.entries())
  }, [items])

  const q = search.trim().toLowerCase()
  const visible = items.filter(i =>
    (!q || `${i.student.firstName} ${i.student.lastName}`.toLowerCase().includes(q) || (i.student.studentCode || '').toLowerCase().includes(q)) &&
    (!groupFilter || i.student.groupName === groupFilter) &&
    (!assessmentFilter || i.assessment.id === assessmentFilter) &&
    (!markerFilter || i.by?.id === markerFilter) &&
    (!statusFilter || i.status === statusFilter) &&
    (!roleFilter || (roleFilter === 'admin' ? i.by?.isAdmin === true : i.by?.isAdmin === false)),
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
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | 'marked' | 'returned')} className={select} aria-label={t('Filter by status', 'تصفية حسب الحالة')}>
          <option value="">{t('Marked and returned', 'المقيّمة والمُعادة')}</option>
          <option value="marked">{t('Marked', 'تم تقييمها')}</option>
          <option value="returned">{t('Returned to student', 'أُعيدت إلى الطالب')}</option>
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
        {t(`Marked in the last ${data?.days ?? 90} days — newest first.`, `تم تقييمها أو إعادتها خلال آخر ${data?.days ?? 90} يوماً — الأحدث أولاً.`)}
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
            const returned = i.status === 'returned'
            const pass = i.percentage !== null && i.percentage >= 60
            const verb = returned ? t('Returned by', 'أعادها') : t('Marked by', 'قيّمه')
            return (
              <div key={i.submissionId} className="flex flex-wrap items-start gap-3 p-4">
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
                      {i.by ? `${verb} ${i.by.name}` : `${verb} (${t('removed user', 'مستخدم محذوف')})`}
                      {' · '}
                      {new Date(i.at).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                    </span>
                    {returned && (
                      <Badge variant="warning">
                        <span className="inline-flex items-center gap-1"><Undo2 className="h-3 w-3" />{t('Returned', 'مُعادة')}</span>
                      </Badge>
                    )}
                    {i.by && (
                      <Badge variant={i.by.isAdmin ? 'info' : 'default'}>
                        {i.by.isAdmin ? t('Admin', 'مسؤول') : t('Servant', 'خادم')}
                      </Badge>
                    )}
                    {i.isLate && <Badge variant="danger">{t('Late', 'متأخر')}</Badge>}
                  </div>
                  {i.feedback && (
                    <p className={`mt-1 text-xs ${returned ? 'font-medium text-amber-800' : 'italic text-gray-600'}`}>
                      {returned ? `${t('Reason', 'السبب')}: ${i.feedback}` : `“${i.feedback}”`}
                    </p>
                  )}
                  {i.notes && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                      <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="whitespace-pre-wrap">{i.notes}</span>
                    </p>
                  )}
                  {i.recording && (
                    <div className="mt-2 max-w-sm">
                      <AudioPlayer src={assetUrl(i.recording.url)} duration={i.recording.durationSeconds ?? undefined} compact />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {returned ? (
                    <div className="text-sm font-semibold text-amber-700">{t('With student', 'مع الطالب')}</div>
                  ) : (
                    <>
                      <div className={`text-sm font-semibold ${pass ? 'text-green-700' : 'text-red-700'}`}>
                        {i.score} / {i.maxScore}
                      </div>
                      {i.percentage !== null && <div className="text-xs text-gray-500">{i.percentage}%</div>}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

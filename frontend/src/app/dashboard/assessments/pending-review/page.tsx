'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, ChevronDown, ChevronUp, ClipboardCheck, Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { usePermission } from '@/lib/use-permission'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'

interface PendingAnswer {
  questionId: string
  questionText: string
  type: string
  points: number
  correctAnswer: string | null
  answer: string | null
  awarded: number | null
}

interface PendingItem {
  submissionId: string
  submittedAt: string
  isLate: boolean
  attemptNumber: number
  student: {
    id: string
    firstName: string
    lastName: string
    studentCode: string | null
    levelName: string | null
    groupName: string | null
    gradeName: string | null
  }
  assessment: { id: string; title: string; titleAr: string | null; type: string; dueDate: string | null; totalPoints: number }
  hasEssay: boolean
  autoScore: number
  answers: PendingAnswer[]
}

const ADMIN_ROLES = ['super_admin', 'admin', 'principal']

export default function PendingReviewPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const { role } = usePermission()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [groupFilter, setGroupFilter] = useState('')
  const [assessmentFilter, setAssessmentFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await http.get<PendingItem[]>('/assessments/pending-review', { schoolId: getSchoolId() })
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load pending reviews', err)
      setError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo(
    () => Array.from(new Set(items.map(i => i.student.groupName).filter(Boolean))) as string[],
    [items],
  )
  const assessments = useMemo(() => {
    const seen = new Map<string, string>()
    items.forEach(i => seen.set(i.assessment.id, i.assessment.title))
    return Array.from(seen.entries())
  }, [items])

  const visible = items.filter(i =>
    (!groupFilter || i.student.groupName === groupFilter) &&
    (!assessmentFilter || i.assessment.id === assessmentFilter),
  )

  const mark = async (item: PendingItem, score: number) => {
    const max = item.assessment.totalPoints
    if (Number.isNaN(score) || score < 0 || score > max) {
      toast('error', t(`Score must be between 0 and ${max}`, `يجب أن تكون الدرجة بين 0 و ${max}`))
      return
    }
    setSaving(s => ({ ...s, [item.submissionId]: true }))
    try {
      await http.post(`/assessments/${item.assessment.id}/students/${item.student.id}/mark`, {
        score,
        maxScore: max,
        feedback: feedback[item.submissionId] || '',
      })
      setItems(list => list.filter(i => i.submissionId !== item.submissionId))
      toast('success', t(
        `Marked ${item.student.firstName} ${item.student.lastName}: ${score}/${max}`,
        `تم تقييم ${item.student.firstName} ${item.student.lastName}: ${score}/${max}`,
      ))
    } catch {
      toast('error', t('Failed to record mark', 'فشل تسجيل الدرجة'))
    }
    setSaving(s => ({ ...s, [item.submissionId]: false }))
  }

  if (role !== 'guest' && !ADMIN_ROLES.includes(role)) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ClipboardCheck}
          title={t('Not available for your role', 'غير متاح لدورك')}
          description={t('Only administrators can see the school-wide review queue.', 'يمكن للمسؤولين فقط رؤية قائمة المراجعة.')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/assessments" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" />
            {t('Assessments', 'التقييمات')}
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">{t('Pending review', 'بانتظار المراجعة')}</h1>
          <p className="text-sm text-gray-500">
            {t('Submissions waiting for a mark. Marking here acts on behalf of the servant.', 'تسليمات بانتظار الدرجة. التقييم هنا يتم نيابةً عن الخادم.')}
          </p>
        </div>
        <Badge variant={items.length ? 'warning' : 'success'} size="md">
          {items.length} {t('pending', 'معلّق')}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          aria-label={t('Filter by group', 'تصفية حسب المجموعة')}
        >
          <option value="">{t('All groups', 'كل المجموعات')}</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={assessmentFilter}
          onChange={e => setAssessmentFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          aria-label={t('Filter by assessment', 'تصفية حسب التقييم')}
        >
          <option value="">{t('All assessments', 'كل التقييمات')}</option>
          {assessments.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : error ? (
        <EmptyState
          icon={ClipboardCheck}
          title={t('Could not load the review queue', 'تعذر تحميل قائمة المراجعة')}
          action={<Button size="sm" variant="outline" onClick={load}>{t('Retry', 'إعادة المحاولة')}</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={t('Nothing waiting for review', 'لا شيء بانتظار المراجعة')}
          description={t('Every submission has been marked.', 'تم تقييم كل التسليمات.')}
        />
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {visible.map(item => {
            const id = item.submissionId
            const max = item.assessment.totalPoints
            const isOpen = expanded === id
            const busy = !!saving[id]
            const title = lang === 'ar' && item.assessment.titleAr ? item.assessment.titleAr : item.assessment.title
            return (
              <div key={id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {item.student.firstName} {item.student.lastName}
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {[item.student.groupName, item.student.gradeName].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{title}</span>
                      <span>·</span>
                      <span>{new Date(item.submittedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
                      {item.isLate && <Badge variant="danger">{t('Late', 'متأخر')}</Badge>}
                      {item.hasEssay && <Badge variant="info">{t('Has essay', 'يتضمن مقالاً')}</Badge>}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    {t('Auto score', 'الدرجة التلقائية')}: <span className="font-semibold text-gray-900">{item.autoScore}</span> / {max}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={max}
                      step="any"
                      inputMode="decimal"
                      value={scores[id] ?? ''}
                      onChange={e => setScores(s => ({ ...s, [id]: e.target.value }))}
                      placeholder={t('Score', 'الدرجة')}
                      aria-label={t('Score', 'الدرجة')}
                      className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-gray-500">/ {max}</span>
                    <Button
                      size="sm"
                      disabled={busy || scores[id] === undefined || scores[id] === ''}
                      onClick={() => mark(item, Number(scores[id]))}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('Mark', 'تقييم')}
                    </Button>
                    {!item.hasEssay && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => mark(item, item.autoScore)}>
                        {t('Accept auto score', 'اعتماد التلقائية')}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('Show answers', 'عرض الإجابات')}
                      onClick={() => setExpanded(isOpen ? null : id)}
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
                    {item.answers.length === 0 ? (
                      <p className="text-sm text-gray-500">{t('No answers recorded.', 'لا توجد إجابات مسجلة.')}</p>
                    ) : item.answers.map((a, n) => (
                      <div key={a.questionId} className="text-sm">
                        <div className="font-medium text-gray-900">{n + 1}. {a.questionText}</div>
                        <div className="mt-0.5 whitespace-pre-wrap text-gray-700">
                          {a.answer ?? <span className="text-gray-400">{t('No answer', 'لا توجد إجابة')}</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {a.correctAnswer ? `${t('Expected', 'المتوقع')}: ${a.correctAnswer} · ` : ''}
                          {a.awarded !== null ? `${a.awarded}/${a.points}` : `${t('Not graded', 'غير مقيّم')} (${a.points})`}
                        </div>
                      </div>
                    ))}
                    <textarea
                      value={feedback[id] ?? ''}
                      onChange={e => setFeedback(f => ({ ...f, [id]: e.target.value }))}
                      placeholder={t('Feedback for the student (optional)', 'ملاحظات للطالب (اختياري)')}
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle, ChevronDown, ChevronUp, ClipboardCheck, Clock, Download, Loader2, Mic, Undo2, Zap,
} from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { usePermission } from '@/lib/use-permission'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AudioPlayer } from '@/components/audio-player'
import { assetUrl } from '@/lib/asset-url'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { exportPendingReviewXlsx } from '@/lib/export-pending-review'
import { ADMIN_ROLES, needsManualMarking, waitingDays, type PendingItem } from './types'
import { ReviewMode } from './review-mode'
import { ReturnModal } from './return-modal'
import { Turnaround } from './turnaround'
import { EvidencePanel } from './evidence-panel'

interface AcceptAutoResult {
  accepted: number
  failed: number
  results: { submissionId: string; ok: boolean; error?: string }[]
}

export default function PendingReviewPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const { role, can } = usePermission()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const isAdmin = ADMIN_ROLES.includes(role)

  const [tab, setTab] = useState<'queue' | 'turnaround'>('queue')
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [groupFilter, setGroupFilter] = useState('')
  const [assessmentFilter, setAssessmentFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)
  const [returning, setReturning] = useState<PendingItem | null>(null)

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

  const removeItems = (ids: string[]) => {
    setItems(list => list.filter(i => !ids.includes(i.submissionId)))
    setSelected(sel => new Set(Array.from(sel).filter(id => !ids.includes(id))))
  }

  // Only submissions the auto score can fully stand for (no essay, no recording) go in bulk.
  const bulkEligible = visible.filter(i => !needsManualMarking(i))
  const selectedEligible = bulkEligible.filter(i => selected.has(i.submissionId))
  const allEligibleSelected = bulkEligible.length > 0 && selectedEligible.length === bulkEligible.length

  const toggle = (id: string) => setSelected(sel => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(allEligibleSelected ? new Set() : new Set(bulkEligible.map(i => i.submissionId)))

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
      removeItems([item.submissionId])
      toast('success', t(
        `Marked ${item.student.firstName} ${item.student.lastName}: ${score}/${max}`,
        `تم تقييم ${item.student.firstName} ${item.student.lastName}: ${score}/${max}`,
      ))
    } catch {
      toast('error', t('Failed to record mark', 'فشل تسجيل الدرجة'))
    }
    setSaving(s => ({ ...s, [item.submissionId]: false }))
  }

  const acceptSelected = async () => {
    setBulkBusy(true)
    try {
      const res = await http.post<AcceptAutoResult>(
        '/assessments/pending-review/accept-auto',
        { submissionIds: selectedEligible.map(i => i.submissionId) },
        { schoolId: getSchoolId() },
      )
      removeItems(res.results.filter(r => r.ok).map(r => r.submissionId))
      if (res.failed === 0) {
        toast('success', t(`Accepted ${res.accepted} auto scores`, `تم اعتماد ${res.accepted} درجة تلقائية`))
      } else {
        toast('error', t(
          `Accepted ${res.accepted}, ${res.failed} could not be accepted`,
          `تم اعتماد ${res.accepted}، وتعذر اعتماد ${res.failed}`,
        ))
      }
    } catch {
      toast('error', t('Bulk accept failed', 'فشل الاعتماد الجماعي'))
    }
    setBulkBusy(false)
    setConfirmBulk(false)
  }

  if (role !== 'guest' && !can('assessment:grade') && !isAdmin) {
    return (
      <div className="p-6">
        <EmptyState
          icon={ClipboardCheck}
          title={t('Not available for your role', 'غير متاح لدورك')}
          description={t('You do not have permission to mark assessments.', 'ليس لديك صلاحية تقييم التقييمات.')}
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
            {isAdmin
              ? t('Submissions waiting for a mark, school-wide. Marking here acts on behalf of the servant.', 'تسليمات بانتظار الدرجة في كل المدرسة. التقييم هنا يتم نيابةً عن الخادم.')
              : t('Submissions from your group waiting for a mark.', 'تسليمات من مجموعتك بانتظار الدرجة.')}
          </p>
        </div>
        <Badge variant={items.length ? 'warning' : 'success'} size="md">
          {items.length} {t('pending', 'معلّق')}
        </Badge>
      </div>

      {isAdmin && (
        <Tabs
          activeTab={tab}
          onChange={id => setTab(id as 'queue' | 'turnaround')}
          tabs={[
            { id: 'queue', label: t('Queue', 'القائمة'), icon: ClipboardCheck },
            { id: 'turnaround', label: t('Turnaround', 'الإنجاز'), icon: Clock },
          ]}
        />
      )}

      {tab === 'turnaround' && isAdmin ? (
        <Turnaround />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={visible.length === 0} onClick={() => exportPendingReviewXlsx(visible, lang)}>
                <Download className="h-4 w-4" />{t('Export', 'تصدير')}
              </Button>
              <Button size="sm" disabled={visible.length === 0} onClick={() => setReviewIndex(0)} className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />{t('Review mode', 'وضع المراجعة')}
              </Button>
            </div>
          </div>

          {isAdmin && bulkEligible.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={allEligibleSelected} onChange={toggleAll} />
                {t('Select all that can be auto-accepted', 'تحديد كل ما يمكن اعتماده تلقائياً')} ({bulkEligible.length})
              </label>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedEligible.length === 0 || bulkBusy}
                onClick={() => setConfirmBulk(true)}
              >
                {t('Accept auto scores', 'اعتماد الدرجات التلقائية')} ({selectedEligible.length})
              </Button>
            </div>
          )}

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
              {visible.map((item, idx) => {
                const id = item.submissionId
                const max = item.assessment.totalPoints
                const isOpen = expanded === id
                const busy = !!saving[id]
                const days = waitingDays(item.submittedAt)
                const title = lang === 'ar' && item.assessment.titleAr ? item.assessment.titleAr : item.assessment.title
                return (
                  <div key={id} className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          disabled={needsManualMarking(item)}
                          checked={selected.has(id)}
                          onChange={() => toggle(id)}
                          aria-label={t('Select for bulk accept', 'تحديد للاعتماد الجماعي')}
                          title={needsManualMarking(item) ? t('Needs manual marking', 'يحتاج تقييماً يدوياً') : undefined}
                        />
                      )}
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
                          <Badge variant={days >= 7 ? 'danger' : days >= 3 ? 'warning' : 'default'}>
                            {days === 0 ? t('Today', 'اليوم') : `${days} ${t('d waiting', 'يوم انتظار')}`}
                          </Badge>
                          {item.isLate && <Badge variant="danger">{t('Late', 'متأخر')}</Badge>}
                          {item.hasEssay && <Badge variant="info">{t('Has essay', 'يتضمن مقالاً')}</Badge>}
                          {item.recording && (
                            <Badge variant="info"><span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" />{t('Recording', 'تسجيل')}</span></Badge>
                          )}
                        </div>
                        {item.recording && (
                          <div className="mt-2 max-w-sm">
                            <AudioPlayer src={assetUrl(item.recording.url)} duration={item.recording.durationSeconds ?? undefined} compact />
                          </div>
                        )}
                      </div>

                      {item.answers.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {t('Auto score', 'الدرجة التلقائية')}: <span className="font-semibold text-gray-900">{item.autoScore}</span> / {max}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
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
                        {!needsManualMarking(item) && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => mark(item, item.autoScore)}>
                            {t('Accept auto score', 'اعتماد التلقائية')}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReviewIndex(idx)}>
                          {t('Review', 'مراجعة')}
                        </Button>
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
                        <EvidencePanel item={item} />
                        {item.answers.length === 0 ? (
                          !item.recording && !item.notes && item.extraAnswers.length === 0 && (
                            <p className="text-sm text-gray-500">{t('Nothing was submitted besides the attempt itself.', 'لم يتم تسليم شيء سوى المحاولة نفسها.')}</p>
                          )
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
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setReturning(item)} className="gap-1.5">
                          <Undo2 className="h-3.5 w-3.5" />{t('Return to student', 'إعادة إلى الطالب')}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <ReviewMode
        open={reviewIndex !== null}
        items={visible}
        startIndex={reviewIndex ?? 0}
        onClose={() => setReviewIndex(null)}
        onMarked={id => removeItems([id])}
        onReturn={item => setReturning(item)}
      />

      <ReturnModal
        item={returning}
        onClose={() => setReturning(null)}
        onReturned={id => { removeItems([id]); setReturning(null) }}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={acceptSelected}
        loading={bulkBusy}
        variant="warning"
        title={t('Accept auto scores?', 'اعتماد الدرجات التلقائية؟')}
        message={t(
          `${selectedEligible.length} submissions will be marked with their automatic score and the students notified. Anything that needs manual marking is skipped.`,
          `سيتم تقييم ${selectedEligible.length} تسليم بدرجته التلقائية وإشعار الطلاب. يتم تخطي ما يحتاج تقييماً يدوياً.`,
        )}
        confirmLabel={t('Accept', 'اعتماد')}
        cancelLabel={t('Cancel', 'إلغاء')}
      />
    </div>
  )
}

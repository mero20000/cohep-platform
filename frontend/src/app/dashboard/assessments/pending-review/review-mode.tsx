'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Undo2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { http } from '@/lib/http-client'
import { FEEDBACK_SNIPPETS, type PendingItem } from './types'
import { EvidencePanel } from './evidence-panel'

interface Props {
  open: boolean
  items: PendingItem[]
  startIndex: number
  onClose: () => void
  onMarked: (submissionId: string) => void
  onReturn: (item: PendingItem) => void
}

/**
 * One submission at a time: read the answers, score each question, add feedback and move on.
 * Ctrl/Cmd+Enter saves and advances; Alt+←/→ steps without saving.
 */
export function ReviewMode({ open, items, startIndex, onClose, onMarked, onReturn }: Props) {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [index, setIndex] = useState(startIndex)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [extra, setExtra] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  const item = items[index] ?? null

  useEffect(() => { if (open) setIndex(startIndex) }, [open, startIndex])

  // When the list shrinks past the cursor (last item marked) there is nothing left to review.
  useEffect(() => {
    if (open && items.length === 0) onClose()
    else if (open && index >= items.length && items.length > 0) setIndex(items.length - 1)
  }, [open, items.length, index, onClose])

  // Start each submission from what is already awarded (auto-graded questions) or zero.
  useEffect(() => {
    if (!item) return
    const next: Record<string, string> = {}
    item.answers.forEach(a => { next[a.questionId] = String(a.awarded ?? 0) })
    setScores(next)
    setExtra('0')
    setFeedback('')
  }, [item?.submissionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Points the questions cannot account for: a recording, an oral, or an assessment with no
  // questions at all. The marker awards these directly.
  const questionPoints = useMemo(() => (item ? item.answers.reduce((n, a) => n + a.points, 0) : 0), [item])
  const extraMax = item ? Math.max(0, item.assessment.totalPoints - questionPoints) : 0
  const showExtra = !!item && extraMax > 0 && (!!item.recording || item.answers.length === 0)
  const extraValue = showExtra ? Number(extra) || 0 : 0

  const total = useMemo(
    () => Object.values(scores).reduce((sum, v) => sum + (Number(v) || 0), 0) + extraValue,
    [scores, extraValue],
  )

  const invalid = useMemo(() => {
    if (!item) return false
    const badQuestion = item.answers.some(a => {
      const n = Number(scores[a.questionId])
      return Number.isNaN(n) || n < 0 || n > a.points
    })
    const badExtra = showExtra && (Number.isNaN(Number(extra)) || Number(extra) < 0 || Number(extra) > extraMax)
    return badQuestion || badExtra || total > item.assessment.totalPoints
  }, [item, scores, extra, showExtra, extraMax, total])

  const step = (delta: number) => setIndex(i => Math.min(Math.max(0, i + delta), Math.max(0, items.length - 1)))

  const save = async () => {
    if (!item || busy || invalid) return
    setBusy(true)
    try {
      await http.post(`/assessments/${item.assessment.id}/students/${item.student.id}/mark`, {
        score: total,
        maxScore: item.assessment.totalPoints,
        feedback: feedback.trim(),
        ...(item.answers.length > 0
          ? { questionScores: item.answers.map(a => ({ questionId: a.questionId, score: Number(scores[a.questionId]) || 0 })) }
          : {}),
        ...(showExtra || item.answers.length === 0 ? { extraScore: extraValue } : {}),
      })
      toast('success', t(
        `Marked ${item.student.firstName} ${item.student.lastName}: ${total}/${item.assessment.totalPoints}`,
        `تم تقييم ${item.student.firstName} ${item.student.lastName}: ${total}/${item.assessment.totalPoints}`,
      ))
      onMarked(item.submissionId)
    } catch {
      toast('error', t('Failed to record mark', 'فشل تسجيل الدرجة'))
    }
    setBusy(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save() }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); step(1) }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // re-bound each render so save() always sees current state

  if (!item) return null
  const title = lang === 'ar' && item.assessment.titleAr ? item.assessment.titleAr : item.assessment.title

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`${item.student.firstName} ${item.student.lastName}`}
      description={`${title} · ${[item.student.groupName, item.student.gradeName].filter(Boolean).join(' · ')}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Button size="icon" variant="ghost" onClick={() => step(-1)} disabled={index === 0} aria-label={t('Previous', 'السابق')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{index + 1} / {items.length}</span>
            <Button size="icon" variant="ghost" onClick={() => step(1)} disabled={index >= items.length - 1} aria-label={t('Next', 'التالي')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${invalid ? 'text-red-600' : 'text-gray-900'}`}>
              {total} / {item.assessment.totalPoints}
            </span>
            <Button size="sm" variant="outline" onClick={() => onReturn(item)} disabled={busy} className="gap-1.5">
              <Undo2 className="h-3.5 w-3.5" />{t('Return', 'إعادة')}
            </Button>
            <Button size="sm" onClick={save} disabled={busy || invalid} title={t('Ctrl/Cmd + Enter', 'Ctrl/Cmd + Enter')}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('Save & next', 'حفظ والتالي')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {item.isLate && <Badge variant="danger">{t('Late', 'متأخر')}</Badge>}
          {item.hasEssay && <Badge variant="info">{t('Has essay', 'يتضمن مقالاً')}</Badge>}
          {item.recording && <Badge variant="info">{t('Recording', 'تسجيل')}</Badge>}
          <span className="text-xs text-gray-500">{new Date(item.submittedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
        </div>

        <EvidencePanel item={item} />

        {item.answers.length === 0 && !item.recording && !item.notes && (
          <p className="text-sm text-gray-500">{t('Nothing was submitted besides the attempt itself.', 'لم يتم تسليم شيء سوى المحاولة نفسها.')}</p>
        )}

        {item.answers.map((a, n) => (
          <div key={a.questionId} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm font-medium text-gray-900">{n + 1}. {a.questionText}</div>
              <div className="flex shrink-0 items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={a.points}
                  step="any"
                  inputMode="decimal"
                  value={scores[a.questionId] ?? ''}
                  onChange={e => setScores(s => ({ ...s, [a.questionId]: e.target.value }))}
                  aria-label={t(`Score for question ${n + 1}`, `درجة السؤال ${n + 1}`)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-500">/ {a.points}</span>
              </div>
            </div>
            <div className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm text-gray-800">
              {a.answer ?? <span className="text-gray-400">{t('No answer', 'لا توجد إجابة')}</span>}
            </div>
            {a.correctAnswer && (
              <div className="mt-1 text-xs text-gray-500">{t('Expected', 'المتوقع')}: {a.correctAnswer}</div>
            )}
          </div>
        ))}

        {showExtra && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
            <div className="text-sm font-medium text-gray-900">
              {item.recording ? t('Recording / other points', 'نقاط التسجيل / أخرى') : t('Overall score', 'الدرجة الكلية')}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={extraMax}
                step="any"
                inputMode="decimal"
                value={extra}
                onChange={e => setExtra(e.target.value)}
                aria-label={t('Recording or overall score', 'درجة التسجيل أو الكلية')}
                className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-500">/ {extraMax}</span>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {FEEDBACK_SNIPPETS.map(s => (
              <button
                key={s.en}
                type="button"
                onClick={() => setFeedback(f => (f ? `${f} ` : '') + (lang === 'ar' ? s.ar : s.en))}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                {lang === 'ar' ? s.ar : s.en}
              </button>
            ))}
          </div>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={2}
            placeholder={t('Feedback for the student (optional)', 'ملاحظات للطالب (اختياري)')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </Modal>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { http } from '@/lib/http-client'
import { computeResult, formatCountdown, type TakeQuestion } from '../../app/dashboard/assessments/take-helpers'
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, ClipboardCheck } from 'lucide-react'

interface TakePayload {
  assessment: {
    id: string
    title: string
    titleAr?: string
    type: string
    totalPoints: number
    passingScore: number
    durationMinutes: number | null
  }
  questions: TakeQuestion[]
}

interface TakeProps {
  assessmentId: string
  mode: 'portal' | 'dashboard'
  accessKey?: string
  studentId?: string
  lang?: 'en' | 'ar'
}

type AnswerMap = Record<string, string>

export default function TakeAssessment({ assessmentId, mode, accessKey, studentId, lang = 'en' }: TakeProps) {
  const [payload, setPayload] = useState<TakePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<any>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const submittedRef = useRef(false)
  const answersRef = useRef<AnswerMap>({})

  const qp = mode === 'portal'
    ? { accessKey }
    : { studentId }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fetchUrl = mode === 'portal'
          ? `/student-portal/${accessKey}/assessments/${assessmentId}`
          : `/assessments/${assessmentId}/questions`
        const data = await http.get<TakePayload>(fetchUrl, mode === 'portal' ? undefined : (qp as any))
        if (cancelled) return
        setPayload(data)
        if (data.assessment.durationMinutes) setSecondsLeft(data.assessment.durationMinutes * 60)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load assessment')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [assessmentId, mode, qp.accessKey, qp.studentId])

  const durationSec = payload?.assessment.durationMinutes
    ? payload.assessment.durationMinutes * 60
    : null

  const setAnswer = (qid: string, value: string) => {
    setAnswers((a) => {
      const n = { ...a, [qid]: value }
      answersRef.current = n
      return n
    })
  }

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const current = answersRef.current
      const answerList = payload!.questions.map((q) => ({ questionId: q.id, answer: current[q.id] ?? '' }))
      const url = mode === 'portal'
        ? `/student-portal/${accessKey}/assessments/${assessmentId}/submit`
        : `/assessments/${assessmentId}/submit`
      const body = { answers: answerList }
      const res = await http.post(url, body, mode === 'portal' ? undefined : (qp as any))
      setSubmission(res)
    } catch (e: any) {
      setError(e?.message || 'Submit failed')
      submittedRef.current = false
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (durationSec == null || submittedRef.current) return
    setSecondsLeft(durationSec)
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev == null) return prev
        if (prev <= 1) {
          clearInterval(id)
          if (!submittedRef.current) submit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [durationSec])

  const answeredCount = useMemo(
    () => payload?.questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length ?? 0,
    [payload, answers],
  )

  const confirmSubmit = () => {
    const unanswered = payload?.questions.filter((q) => (answers[q.id] ?? '').trim().length === 0).length ?? 0
    if (unanswered > 0 && !window.confirm(`${lang === 'ar' ? 'لديك' : 'You have'} ${unanswered} ${lang === 'ar' ? 'سؤال بدون إجابة. تأكيد التسليم؟' : 'unanswered question(s). Submit anyway?'}`)) {
      return
    }
    submit()
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }
  if (!payload) return null

  if (submission) {
    const res = computeResult(submission.grades ?? [], payload.questions)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
          <h2 className="mt-2 text-lg font-semibold text-gray-900">
            {lang === 'ar' ? 'تم التسليم' : 'Submitted'}
          </h2>
          <p className="mt-1 text-3xl font-bold text-gray-900">{res.earned} / {payload.assessment.totalPoints}</p>
          <p className="text-sm text-gray-500">
            {lang === 'ar' ? 'النتيجة تعتمد على الأسئلة المُصححة تلقائيًا' : 'Score from auto-graded questions'}
          </p>
        </div>
        <div className="mt-6 space-y-4">
          {payload.questions.map((q, i) => {
            const r = res.items[i]
            return (
              <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">{q.text}</p>
                  {r.status === 'correct' && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />}
                  {r.status === 'incorrect' && <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />}
                  {r.status === 'pending' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{lang === 'ar' ? 'بانتظار التصحيح' : 'Awaiting grading'}</span>}
                </div>
                {r.status !== 'pending' && (
                  <p className="mt-1 text-xs text-gray-500">{lang === 'ar' ? 'إجابتك' : 'Your answer'}: {answers[q.id]}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="sticky top-0 z-10 -mx-4 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{payload.assessment.titleAr || payload.assessment.title}</h1>
            <p className="text-xs text-gray-500">{payload.assessment.type} · {payload.assessment.totalPoints} pts</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{answeredCount}/{payload.questions.length}</span>
            {secondsLeft != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
                <Clock className="h-4 w-4" /> {formatCountdown(secondsLeft)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {payload.questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-900">{i + 1}. {q.text} <span className="text-xs font-normal text-gray-400">({q.points} pts)</span></p>
            {q.type === 'multiple_choice' && (
              <div className="mt-3 space-y-2">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={(e) => setAnswer(q.id, e.target.value)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'true_false' && (
              <div className="mt-3 flex gap-3">
                {['true', 'false'].map((v) => (
                  <label key={v} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    <input type="radio" name={q.id} value={v} checked={answers[q.id] === v} onChange={(e) => setAnswer(q.id, e.target.value)} />
                    {lang === 'ar' ? (v === 'true' ? 'صح' : 'خطأ') : v === 'true' ? 'True' : 'False'}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'short_answer' && (
              <input
                className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب إجابتك' : 'Type your answer'}
              />
            )}
            {q.type === 'essay' && (
              <textarea
                className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
                rows={4}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب إجابتك' : 'Type your answer'}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={confirmSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <ClipboardCheck className="h-4 w-4" />
          {submitting ? (lang === 'ar' ? 'جارٍ التسليم…' : 'Submitting…') : (lang === 'ar' ? 'تسليم' : 'Submit')}
        </button>
      </div>
    </div>
  )
}
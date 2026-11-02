'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { http } from '@/lib/http-client'
import { assetUrl } from '@/lib/asset-url'
import { attemptLabel, computeResult, formatCountdown, recordingBlocksSubmit, type TakeQuestion } from '../../app/dashboard/assessments/take-helpers'
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, ClipboardCheck, Music, FileText, Presentation, StickyNote, Mic, Square, Trash2, ArrowLeft } from 'lucide-react'
import { AudioPlayer } from '@/components/audio-player'

interface TakePayload {
  assessment: {
    id: string
    title: string
    titleAr?: string
    type: string
    totalPoints: number
    passingScore: number
    durationMinutes: number | null
    referenceRecordingUrl?: string | null
    referenceRecordingName?: string | null
    hazzat?: string | null
    presentationUrl?: string | null
    requireRecording?: boolean
    attemptNumber?: number
    maxAttempts?: number
  }
  questions: TakeQuestion[]
}

interface SubmitResultInfo {
  gradingComplete: boolean
  earned: number | null
  max: number
  passed: boolean | null
  attemptNumber: number
  maxAttempts: number
  attemptsRemaining: number
  canRetry: boolean
  revealDetail: boolean
}

interface TakeProps {
  assessmentId: string
  mode: 'portal' | 'dashboard'
  accessKey?: string
  studentId?: string
  lang?: 'en' | 'ar'
}

type AnswerMap = Record<string, string>

// A retake keeps the same route, so router.push would not remount anything. The wrapper
// remounts the body with a new key instead, which refetches the take payload (fresh
// attempt number) and clears answers, notes, recording, timer and submit state.
export default function TakeAssessment(props: TakeProps) {
  const [run, setRun] = useState(0)
  return <TakeAssessmentBody key={run} {...props} onRetry={() => setRun((r) => r + 1)} />
}

function TakeAssessmentBody({ assessmentId, mode, accessKey, studentId, lang = 'en', onRetry }: TakeProps & { onRetry: () => void }) {
  const router = useRouter()
  const [payload, setPayload] = useState<TakePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<any>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const submittedRef = useRef(false)
  const answersRef = useRef<AnswerMap>({})

  // Pre-submission extras: notes + voice recording
  const [notes, setNotes] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  // The timer callback closes over stale state, so it reads the blob from a ref.
  const recordedBlobRef = useRef<Blob | null>(null)
  const [timeExpired, setTimeExpired] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [retaking, setRetaking] = useState(false)
  const [retakeError, setRetakeError] = useState<string | null>(null)

  // Pick a MIME the device actually supports (iOS Safari: audio/mp4; others: webm/ogg)
  const pickRecorderMime = (): string | undefined => {
    if (typeof MediaRecorder === 'undefined') return undefined
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
    return candidates.find(c => { try { return MediaRecorder.isTypeSupported(c) } catch { return false } })
  }

  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(lang === 'ar' ? 'التسجيل الصوتي غير مدعوم على هذا الجهاز' : 'Voice recording is not supported on this device')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickRecorderMime()
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const type = mr.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        recordedBlobRef.current = blob
        setRecordedBlob(blob)
        setRecordedUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      setError(lang === 'ar' ? 'تعذر الوصول إلى المايكروفون' : 'Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const discardRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedUrl(null)
    recordedBlobRef.current = null
    setRecordedBlob(null)
  }

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

  const requireRecording = payload?.assessment.requireRecording ?? false
  // True when a recording is required for this submit (portal only), whether or not one exists yet.
  const recordingRequired = recordingBlocksSubmit(mode, requireRecording, false)
  const submitBlocked = recordingBlocksSubmit(mode, requireRecording, recordedBlob != null)

  const submit = async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    setUploadError(null)
    try {
      const current = answersRef.current
      const answerList = payload!.questions.map((q) => ({ questionId: q.id, answer: current[q.id] ?? '' }))
      const url = mode === 'portal'
        ? `/student-portal/${accessKey}/assessments/${assessmentId}/submit`
        : `/assessments/${assessmentId}/submit`

      let fileUrl: string | undefined
      let fileType: string | undefined
      const blob = recordedBlobRef.current
      if (blob) {
        setUploadingAudio(true)
        try {
          const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
          const fd = new FormData()
          fd.append('file', blob, `assessment-recording.${ext}`)
          const up = await http.upload<{ url: string }>(
            `/student-portal/${accessKey}/recordings`,
            fd,
            mode === 'portal' ? undefined : (qp as any),
          )
          fileUrl = up.url
          fileType = blob.type
        } catch (e: any) {
          if (recordingRequired) {
            // A required recording cannot be skipped, so abort instead of offering to submit without it.
            setUploadError(lang === 'ar' ? 'فشل رفع التسجيل الصوتي. التسجيل مطلوب، حاول مرة أخرى.' : 'Voice upload failed. A recording is required, so please try again.')
            submittedRef.current = false
            setUploadingAudio(false)
            setSubmitting(false)
            return
          }
          if (!window.confirm(lang === 'ar' ? 'فشل رفع التسجيل الصوتي. التسليم بدونه؟' : 'Voice upload failed. Submit without it?')) {
            submittedRef.current = false
            setUploadingAudio(false)
            setSubmitting(false)
            return
          }
        }
        setUploadingAudio(false)
      }

      const body = { answers: answerList, notes: notes.trim() || undefined, fileUrl, fileType }
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
          if (!submittedRef.current) {
            // Never auto-submit without a required recording: keep the page open and explain.
            if (recordingBlocksSubmit(mode, requireRecording, recordedBlobRef.current != null)) setTimeExpired(true)
            else submit()
          }
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
    if (submitBlocked) return
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
    // A bare red line was a dead end: the most common way to land here is an
    // already-submitted assessment, where the student needs a way back, not a diagnosis.
    const backHref = mode === 'portal' && accessKey
      ? `/student-portal/${accessKey}`
      : '/dashboard/assessments'
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="max-w-sm text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-4 py-2 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === 'ar' ? 'رجوع إلى تقييماتي' : 'Back to my assessments'}
        </button>
      </div>
    )
  }
  if (!payload) return null

  if (submission) {
    const res = computeResult(submission.grades ?? [], payload.questions)
    const result: SubmitResultInfo | undefined = submission.result
    const gradingComplete = result?.gradingComplete === true
    // With retry on, a submission still awaiting marking has no meaningful score yet.
    const awaitingMarking = result != null && !result.gradingComplete && result.maxAttempts > 1
    const showDetail = result == null || result.revealDetail
    const shownEarned = gradingComplete && result.earned != null ? result.earned : res.earned
    const shownMax = gradingComplete ? result.max : payload.assessment.totalPoints
    const isPassing = gradingComplete && result.passed != null
      ? result.passed
      : res.earned >= payload.assessment.passingScore
    const resultAttemptLabel = result ? attemptLabel(result.attemptNumber, result.maxAttempts, lang) : null
    const canTryAgain = mode === 'portal' && gradingComplete && result.canRetry

    const tryAgain = async () => {
      setRetaking(true)
      setRetakeError(null)
      try {
        await http.post(`/student-portal/${accessKey}/assessments/${assessmentId}/retake`, {})
        onRetry()
      } catch (e: any) {
        setRetakeError(e?.message || (lang === 'ar' ? 'تعذر بدء محاولة جديدة' : 'Could not start a new attempt'))
        setRetaking(false)
      }
    }

    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Success Card */}
        <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-green-200 opacity-75 blur"></div>
              <CheckCircle2 className="relative h-12 w-12 text-green-600" />
            </div>
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            {lang === 'ar' ? '✓ تم التسليم بنجاح' : '✓ Assessment Submitted'}
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            {isPassing
              ? (lang === 'ar' ? 'ممتاز! لقد أكملت التقييم.' : 'Great job! You\'ve completed the assessment.')
              : (lang === 'ar' ? 'شكراً لتسليمك. تحقق من النتائج أدناه.' : 'Thank you for your submission. Check your results below.')}
          </p>

          {awaitingMarking ? (
            <p className="mt-6 text-sm font-medium text-amber-700">
              {lang === 'ar'
                ? 'تسليمك بانتظار التصحيح. ستظهر النتيجة بعد التصحيح.'
                : 'Your submission is awaiting marking. Your score will appear once it is marked.'}
            </p>
          ) : (
            <>
              {/* Score Display */}
              <div className="mt-6 flex items-center justify-center gap-4">
                <div>
                  <p className="text-4xl font-bold text-gray-900">{shownEarned}</p>
                  <p className="text-sm text-gray-500">{lang === 'ar' ? 'نقاط' : 'points'}</p>
                </div>
                <div className="text-2xl text-gray-400">/</div>
                <div>
                  <p className="text-4xl font-bold text-gray-400">{shownMax}</p>
                  <p className="text-sm text-gray-500">{lang === 'ar' ? 'من' : 'total'}</p>
                </div>
              </div>

              {gradingComplete ? (
                result.passed != null && (
                  <p className={`mt-3 text-sm font-semibold ${result.passed ? 'text-green-700' : 'text-red-600'}`}>
                    {result.passed
                      ? (lang === 'ar' ? 'ناجح' : 'Passed')
                      : (lang === 'ar' ? 'لم تنجح' : 'Not passed')}
                  </p>
                )
              ) : (
                <p className="mt-3 text-xs text-gray-500">
                  {lang === 'ar' ? 'بناءً على الأسئلة المصححة تلقائيًا' : 'Based on auto-graded questions'}
                </p>
              )}
            </>
          )}

          {resultAttemptLabel && (
            <p className="mt-2 text-xs font-medium text-gray-500">{resultAttemptLabel}</p>
          )}

          {canTryAgain && (
            <div className="mt-5">
              <button
                type="button"
                onClick={tryAgain}
                disabled={retaking}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {retaking && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === 'ar'
                  ? `حاول مرة أخرى — المحاولة ${result.attemptNumber + 1} من ${result.maxAttempts}`
                  : `Try again — attempt ${result.attemptNumber + 1} of ${result.maxAttempts}`}
              </button>
              {retakeError && <p role="alert" className="mt-2 text-xs text-red-600">{retakeError}</p>}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {lang === 'ar' ? '← العودة للتقييم' : '← Back to Assessment'}
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            {lang === 'ar' ? 'الرئيسية' : 'Home'}
          </button>
        </div>

        {/* Detailed Results (hidden when they would reveal the answer key) */}
        {showDetail && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {lang === 'ar' ? 'تفاصيل الإجابات' : 'Your Answers'}
          </h3>
          <div className="space-y-3">
            {payload.questions.map((q, i) => {
              const r = res.items[i]
              return (
                <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">{q.text}</p>
                    <div className="flex-shrink-0">
                      {r.status === 'correct' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      {r.status === 'incorrect' && <XCircle className="h-5 w-5 text-red-500" />}
                      {r.status === 'pending' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{lang === 'ar' ? 'بانتظار' : 'Pending'}</span>}
                    </div>
                  </div>
                  {r.status !== 'pending' && (
                    <p className="mt-2 text-xs text-gray-600">{lang === 'ar' ? 'إجابتك:' : 'Your answer:'} <span className="font-medium text-gray-900">{answers[q.id]}</span></p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )}
      </div>
    )
  }

  const headerAttempt = attemptLabel(payload.assessment.attemptNumber ?? 1, payload.assessment.maxAttempts ?? 1, lang)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="sticky top-0 z-10 -mx-4 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {lang === 'ar' ? 'رجوع' : 'Back'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{payload.assessment.titleAr || payload.assessment.title}</h1>
            <p className="text-xs text-gray-500">
              {payload.assessment.type} · {payload.assessment.totalPoints} pts
              {headerAttempt && ` · ${headerAttempt}`}
            </p>
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
        {/* Reference materials */}
        {(payload.assessment.referenceRecordingUrl || payload.assessment.hazzat || payload.assessment.presentationUrl) && (
          <div className="rounded-xl border border-gold-200 bg-gold-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <Music className="h-4 w-4" /> {lang === 'ar' ? 'مراجع للمراجعة قبل التسليم' : 'Reference materials'}
            </div>
            <div className="mt-3 space-y-3">
              {payload.assessment.referenceRecordingUrl && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-600">
                    {payload.assessment.referenceRecordingName || (lang === 'ar' ? 'التسجيل المرجعي' : 'Reference recording')}
                  </p>
                  <AudioPlayer src={assetUrl(payload.assessment.referenceRecordingUrl)} compact />
                </div>
              )}
              {(payload.assessment.hazzat || payload.assessment.presentationUrl) && (
                <div className="flex flex-wrap gap-2">
                  {payload.assessment.hazzat && (
                    <a href={assetUrl(payload.assessment.hazzat)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      <FileText className="h-4 w-4" /> {lang === 'ar' ? 'الحزّات' : 'Hazzat'}
                    </a>
                  )}
                  {payload.assessment.presentationUrl && (
                    <a href={assetUrl(payload.assessment.presentationUrl)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      <Presentation className="h-4 w-4" /> {lang === 'ar' ? 'العرض / المادة' : 'Material / Presentation'}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Voice recording */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <Mic className="h-4 w-4" />
            {recordingRequired
              ? (lang === 'ar' ? 'تسجيل صوتي (مطلوب)' : 'Voice recording (required)')
              : (lang === 'ar' ? 'تسجيل صوتي (اختياري)' : 'Voice recording (optional)')}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!recording && !recordedBlob && (
              <button type="button" onClick={startRecording}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
                <Mic className="h-4 w-4" /> {lang === 'ar' ? 'بدء التسجيل' : 'Start recording'}
              </button>
            )}
            {recording && (
              <button type="button" onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white animate-pulse">
                <Square className="h-4 w-4" /> {lang === 'ar' ? 'إيقاف' : 'Stop'}
              </button>
            )}
            {recordedBlob && !recording && (
              <>
                <audio controls src={recordedUrl!} className="h-9 max-w-full flex-1" />
                <button type="button" onClick={discardRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> {lang === 'ar' ? 'إعادة' : 'Re-record'}
                </button>
              </>
            )}
          </div>
          {uploadError && <p role="alert" className="mt-2 text-xs text-red-600">{uploadError}</p>}
          {uploadingAudio && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {lang === 'ar' ? 'جارٍ رفع التسجيل…' : 'Uploading recording…'}
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <label htmlFor="assessment-notes" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <StickyNote className="h-4 w-4" /> {lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
          </label>
          <textarea
            id="assessment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={lang === 'ar' ? 'أي ملاحظات تريد إرفاقها بتسليمك؟' : 'Anything you want to attach with your submission?'}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
          />
        </div>

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

      {timeExpired && submitBlocked && (
        <p role="alert" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {lang === 'ar'
            ? 'انتهى الوقت. التسجيل الصوتي مطلوب للتسليم، سجّل إجابتك ثم اضغط تسليم.'
            : 'Time is up. A voice recording is required to submit. Record your answer, then press Submit.'}
        </p>
      )}

      <div className="mt-8 flex flex-col items-end gap-2">
        {submitBlocked && !timeExpired && (
          <p className="text-xs text-gray-500">
            {lang === 'ar' ? 'سجّل إجابتك الصوتية لتفعيل زر التسليم.' : 'Add your voice recording to enable Submit.'}
          </p>
        )}
        <button
          onClick={confirmSubmit}
          disabled={submitting || submitBlocked}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <ClipboardCheck className="h-4 w-4" />
          {submitting ? (lang === 'ar' ? 'جارٍ التسليم…' : 'Submitting…') : (lang === 'ar' ? 'تسليم' : 'Submit')}
        </button>
      </div>
    </div>
  )
}
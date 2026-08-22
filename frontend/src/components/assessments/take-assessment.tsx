'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { http } from '@/lib/http-client'
import { assetUrl } from '@/lib/asset-url'
import { computeResult, formatCountdown, type TakeQuestion } from '../../app/dashboard/assessments/take-helpers'
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, ClipboardCheck, Music, FileText, Presentation, StickyNote, Mic, Square, Trash2 } from 'lucide-react'
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

  // Pre-submission extras: notes + voice recording
  const [notes, setNotes] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [uploadingAudio, setUploadingAudio] = useState(false)

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

      let fileUrl: string | undefined
      let fileType: string | undefined
      if (recordedBlob) {
        setUploadingAudio(true)
        try {
          const ext = recordedBlob.type.includes('mp4') ? 'm4a' : recordedBlob.type.includes('ogg') ? 'ogg' : 'webm'
          const fd = new FormData()
          fd.append('file', recordedBlob, `assessment-recording.${ext}`)
          const up = await http.upload<{ url: string }>(
            `/student-portal/${accessKey}/recordings`,
            fd,
            mode === 'portal' ? undefined : (qp as any),
          )
          fileUrl = up.url
          fileType = recordedBlob.type
        } catch (e: any) {
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
            <Mic className="h-4 w-4" /> {lang === 'ar' ? 'تسجيل صوتي (اختياري)' : 'Voice recording (optional)'}
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
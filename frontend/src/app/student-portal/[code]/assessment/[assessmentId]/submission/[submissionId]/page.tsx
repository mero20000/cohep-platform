'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { http } from '@/lib/http-client'
import { portalGet, ensurePortalSession } from '@/lib/portal-session'
import { useLanguage } from '@/lib/use-language'
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'

interface SubmissionData {
  submission: {
    id: string
    submittedAt: string
    status: string
    fileUrl?: string
    durationSeconds?: number
  }
  assessment: {
    id: string
    title: string
    titleAr?: string
    type: string
    totalPoints: number
    passingScore: number
  }
  grade: {
    earned: number
    max: number
    percentage: number
    passed: boolean
  }
  questions: Array<{
    id: string
    text: string
    type: string
    options?: string[]
    points: number
    studentAnswer?: string
    correctAnswer?: string
    isCorrect?: boolean
    score?: number
    maxScore?: number
    feedback?: string
    feedbackAr?: string
  }>
}

export default function SubmissionReview() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code as string
  const submissionId = params?.submissionId as string
  const assessmentId = params?.assessmentId as string
  const lang = useLanguage() as 'en' | 'ar'
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  const [data, setData] = useState<SubmissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [playingAudio, setPlayingAudio] = useState(false)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [retaking, setRetaking] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        await ensurePortalSession(code)
        const result = await http.get<SubmissionData>(
          `/student-portal/${code}/assessments/${assessmentId}/submission/${submissionId}`
        )
        setData(result)
      } catch (err: any) {
        setError(err.message || 'Failed to load submission')
        console.error('Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    if (code && submissionId && assessmentId) load()
  }, [code, submissionId, assessmentId])

  const handleRetake = async () => {
    if (!window.confirm(t('Start a new attempt? Your previous submission will still be saved.', 'هل تريد محاولة جديدة؟ سيبقى إرسالك السابق محفوظاً.'))) return
    setRetaking(true)
    try {
      await ensurePortalSession(code)
      await http.post(`/student-portal/${code}/assessments/${assessmentId}/retake`, {})
      toast('success', t('New attempt started. Redirecting...', 'تم بدء محاولة جديدة. جاري الانتقال...'))
      setTimeout(() => router.push(`/student-portal/${code}/assessment/${assessmentId}/take`), 1500)
    } catch (err: any) {
      toast('error', err.message || t('Cannot retake this assessment', 'لا يمكن إعادة هذا التقييم'))
    } finally {
      setRetaking(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (error) return <div className="text-center py-20"><p className="text-red-600">{error}</p></div>
  if (!data) return null

  const { submission, assessment, grade, questions } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{assessment.titleAr || assessment.title}</h1>
            <p className="text-sm text-gray-500">{t('Assessment Review', 'مراجعة التقييم')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Grade Card */}
        <div className={`rounded-2xl border-2 p-6 ${grade.passed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('Your Score', 'درجتك')}</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${grade.passed ? 'text-green-600' : 'text-amber-600'}`}>
                  {grade.earned}/{grade.max}
                </span>
                <span className="text-xl font-semibold text-gray-600">{grade.percentage}%</span>
              </div>
            </div>
            <div className={`rounded-full px-4 py-2 text-sm font-bold ${grade.passed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {grade.passed ? t('Passed ✓', 'نجحت ✓') : t('Review Needed', 'تحتاج مراجعة')}
            </div>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${grade.percentage}%`,
                background: grade.passed ? '#16a34a' : '#f59e0b'
              }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('Passing Score', 'الحد الأدنى للنجاح')}: {assessment.passingScore} pts</span>
            <span className="text-gray-500 text-xs">{t('Submitted', 'تم الإرسال')}: {new Date(submission.submittedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
          </div>
        </div>

        {/* Recording if exists */}
        {submission.fileUrl && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Volume2 className="h-4 w-4" /> {t('Your Recording', 'تسجيلك')}
            </h2>
            <div className="space-y-3">
              <audio
                ref={setAudioRef}
                src={submission.fileUrl}
                onEnded={() => setPlayingAudio(false)}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (audioRef) {
                      if (playingAudio) audioRef.pause()
                      else audioRef.play()
                      setPlayingAudio(!playingAudio)
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200">
                  {playingAudio ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {playingAudio ? t('Pause', 'إيقاف') : t('Play', 'تشغيل')}
                </button>
                {submission.durationSeconds && (
                  <span className="text-sm text-gray-600">
                    {Math.floor(submission.durationSeconds / 60)}:{(submission.durationSeconds % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Questions Review */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-900">{t('Question Review', 'مراجعة الأسئلة')}</h2>
          {questions.map((q, idx) => (
            <div key={q.id} className={`rounded-2xl border-2 p-5 ${q.isCorrect === null ? 'border-gray-200' : q.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-sm font-bold text-gray-500">Q{idx + 1}</span>
                    <p className="text-sm font-medium text-gray-900">{q.text}</p>
                  </div>
                  {q.score !== null && (
                    <div className="text-xs text-gray-600">
                      {t('Score:', 'النقاط:')} {q.score}/{q.maxScore}
                    </div>
                  )}
                </div>
                {q.isCorrect !== null && (
                  <div className={`px-2 py-1 rounded text-xs font-bold ${q.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {q.isCorrect ? t('Correct', 'صحيح') : t('Incorrect', 'خطأ')}
                  </div>
                )}
              </div>

              {/* Multiple Choice */}
              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2 mb-4">
                  {q.options.map((opt, i) => {
                    const isStudentAnswer = opt === q.studentAnswer
                    const isCorrectAnswer = opt === q.correctAnswer
                    let bgColor = 'bg-gray-50'
                    let borderColor = 'border-gray-200'
                    if (isStudentAnswer && isCorrectAnswer) {
                      bgColor = 'bg-green-100'
                      borderColor = 'border-green-300'
                    } else if (isStudentAnswer) {
                      bgColor = 'bg-red-100'
                      borderColor = 'border-red-300'
                    } else if (isCorrectAnswer && q.studentAnswer) {
                      bgColor = 'bg-green-50'
                      borderColor = 'border-green-200'
                    }
                    return (
                      <div key={i} className={`rounded-lg border-2 p-3 ${borderColor} ${bgColor} text-sm`}>
                        {isStudentAnswer && <span className="font-bold text-gray-900">{lang === 'ar' ? 'إجابتك: ' : 'Your answer: '}</span>}
                        {isCorrectAnswer && <span className="font-bold text-green-700">{lang === 'ar' ? 'الإجابة الصحيحة: ' : 'Correct answer: '}</span>}
                        <span className="text-gray-900">{opt}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Essay */}
              {q.type === 'essay' && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">{t('Your Response', 'إجابتك')}</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-900 border border-gray-200 max-h-40 overflow-y-auto">
                    {q.studentAnswer || t('(No response)', '(لا توجد إجابة)')}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {(q.feedback || q.feedbackAr) && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs font-bold text-blue-700 mb-1">{t('Feedback from your servant', 'تعليق من خادمك')}</p>
                  <p className="text-sm text-blue-900">{lang === 'ar' ? q.feedbackAr || q.feedback : q.feedback || q.feedbackAr}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Retake Button */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleRetake}
            disabled={retaking}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            {retaking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {retaking ? t('Starting...', 'جاري البدء...') : t('Retake Assessment', 'أعد محاولتك')}
          </button>
          <Link href={`/student-portal/${code}`} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50">
            {t('Back to Dashboard', 'العودة للوحة التحكم')}
          </Link>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { Loader2, Play, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface Submission {
  id: string
  studentId: string
  studentName: string
  lessonId: string
  recordingUrl?: string
  submittedAt: string
  selfRating?: number
  masteryStatus: string
  servantFeedback?: string
  servantFeedbackAt?: string
  awaitingFeedback: boolean
}

interface FeedbackResponse {
  submissions: Submission[]
  total: number
  awaitingFeedback: number
}

export default function ServantFeedbackDashboard() {
  const lang = useLanguage() as 'en' | 'ar'
  const { toast } = useToast()
  const qc = useQueryClient()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  // Get selected lesson for filtering
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [feedbackingId, setFeedbackingId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  // Fetch submissions (requires lessonId)
  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ['servant-feedback', selectedLessonId],
    queryFn: async () => {
      if (!selectedLessonId) return { submissions: [], total: 0, awaitingFeedback: 0 }
      const res = await http.get<FeedbackResponse>(`/curriculum/lessons/${selectedLessonId}/submissions`)
      return res
    },
    enabled: !!selectedLessonId,
  })

  // Add feedback mutation
  const addFeedbackMutation = useMutation({
    mutationFn: async ({ submissionId, text }: { submissionId: string; text: string }) => {
      return http.post(`/curriculum/lessons/${selectedLessonId}/submissions/${submissionId}/feedback`, {
        feedbackText: text,
      })
    },
    onSuccess: () => {
      toast('success', t('Feedback saved', 'تم حفظ التعليقات'))
      setFeedbackingId(null)
      setFeedbackText('')
      qc.invalidateQueries({ queryKey: ['servant-feedback', selectedLessonId] })
    },
    onError: (err: any) => {
      toast('error', t('Failed to save feedback', 'فشل حفظ التعليقات'))
    },
  })

  const handleSubmitFeedback = () => {
    if (!feedbackingId || !feedbackText.trim()) return
    addFeedbackMutation.mutate({ submissionId: feedbackingId, text: feedbackText })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('Feedback & Review', 'التعليقات والمراجعة')}
          </h1>
          <p className="text-gray-500 mt-2">
            {t('Review student recordings and provide feedback', 'راجع تسجيلات الطلاب وقدم تعليقات')}
          </p>
        </div>

        {/* Lesson selector */}
        <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('Select a hymn to review', 'اختر تسبيحة للمراجعة')}
          </label>
          <input
            type="text"
            placeholder={t('Enter lesson ID or name', 'أدخل معرف الدرس أو الاسم')}
            value={selectedLessonId || ''}
            onChange={(e) => setSelectedLessonId(e.target.value || null)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{t('Failed to load submissions', 'فشل تحميل الملفات')}</p>
          </div>
        )}

        {/* Submissions list */}
        {submissions && submissions.submissions.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-600">{t('Total submissions', 'إجمالي الملفات')}</div>
                <div className="text-2xl font-bold text-gray-900">{submissions.total}</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm text-amber-700">{t('Awaiting feedback', 'في انتظار التعليقات')}</div>
                <div className="text-2xl font-bold text-amber-900">{submissions.awaitingFeedback}</div>
              </div>
            </div>

            {/* Submissions table */}
            {submissions.submissions.map((sub) => (
              <div key={sub.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{sub.studentName}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(sub.submittedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          sub.awaitingFeedback
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {sub.awaitingFeedback
                          ? t('Awaiting feedback', 'في انتظار التعليقات')
                          : t('Reviewed', 'تم المراجعة')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-4 space-y-3">
                  {/* Recording player */}
                  {sub.recordingUrl && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">{t('Recording', 'التسجيل')}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setPlayingUrl(playingUrl === sub.recordingUrl ? null : sub.recordingUrl ?? null)
                          }
                          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <Play className="h-4 w-4" />
                          {t('Play', 'تشغيل')}
                        </button>
                        <span className="text-xs text-gray-500">{sub.selfRating}★ rating</span>
                      </div>
                      {playingUrl === sub.recordingUrl && (
                        <audio src={sub.recordingUrl} controls className="w-full mt-2" />
                      )}
                    </div>
                  )}

                  {/* Student mastery */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">{t('Mastery:', 'الإتقان:')}</span>
                    <span className="font-medium text-gray-900">{sub.masteryStatus}</span>
                  </div>

                  {/* Existing feedback */}
                  {sub.servantFeedback && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                      <p className="text-sm text-gray-700">{sub.servantFeedback}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(sub.servantFeedbackAt || '').toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  )}

                  {/* Feedback form */}
                  {!sub.servantFeedback && feedbackingId === sub.id && (
                    <div className="space-y-2">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value.slice(0, 200))}
                        placeholder={t(
                          'Enter your feedback (max 200 chars)',
                          'أدخل تعليقاتك (200 حرف كحد أقصى)',
                        )}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                        rows={3}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {feedbackText.length}/200
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setFeedbackingId(null)
                              setFeedbackText('')
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {t('Cancel', 'إلغاء')}
                          </button>
                          <button
                            onClick={handleSubmitFeedback}
                            disabled={!feedbackText.trim() || addFeedbackMutation.isPending}
                            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" />
                            {addFeedbackMutation.isPending ? t('Saving...', 'جارٍ الحفظ...') : t('Send', 'إرسال')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add feedback button */}
                  {!sub.servantFeedback && feedbackingId !== sub.id && (
                    <button
                      onClick={() => setFeedbackingId(sub.id)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('Add feedback', 'إضافة تعليق')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {submissions && submissions.submissions.length === 0 && selectedLessonId && (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-500">{t('No submissions yet', 'لا توجد ملفات بعد')}</p>
          </div>
        )}

        {/* Select lesson prompt */}
        {!selectedLessonId && (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-500">{t('Select a hymn to review student submissions', 'اختر تسبيحة لمراجعة ملفات الطلاب')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

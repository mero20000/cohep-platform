'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import { Loader2, Play, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface PendingVerification {
  id: string
  studentId: string
  studentName: string
  lessonId: string
  lessonTitle: string
  masteryStatus: string
  selfRating?: number
  servantFeedback?: string
  recordingUrl?: string
  recordingDuration?: number
  lastPracticedAt?: string
}

interface VerificationsResponse {
  verifications: PendingVerification[]
  total: number
  pending: number
}

export default function LiturgyVerificationDashboard() {
  const lang = useLanguage() as 'en' | 'ar'
  const { toast } = useToast()
  const qc = useQueryClient()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifyNotes, setVerifyNotes] = useState('')
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  // Fetch pending verifications
  const { data: verifications, isLoading, error } = useQuery({
    queryKey: ['liturgy-pending'],
    queryFn: () => http.get<VerificationsResponse>('/hymn-learning/liturgy/pending-verifications'),
  })

  // Mark ready mutation
  const markReadyMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return http.post(`/hymn-learning/liturgy/verify/${id}`, { notes })
    },
    onSuccess: () => {
      toast('success', t('Student marked ready for liturgy', 'تم وضع علامة على الطالب كمستعد للقداس'))
      setVerifyingId(null)
      setVerifyNotes('')
      qc.invalidateQueries({ queryKey: ['liturgy-pending'] })
    },
    onError: () => {
      toast('error', t('Failed to mark student ready', 'فشل وضع العلامة'))
    },
  })

  const handleMarkReady = () => {
    if (!verifyingId) return
    markReadyMutation.mutate({ id: verifyingId, notes: verifyNotes || undefined })
  }

  const getMasteryColor = (status: string) => {
    const colors: Record<string, string> = {
      mastered: 'bg-emerald-100 text-emerald-700',
      known: 'bg-blue-100 text-blue-700',
      practicing: 'bg-amber-100 text-amber-700',
      introduced: 'bg-gray-100 text-gray-700',
      not_started: 'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('Liturgy Verification', 'التحقق من القداس')}
          </h1>
          <p className="text-gray-500 mt-2">
            {t('Verify students ready for this Sundays liturgy', 'تحقق من استعداد الطلاب لقداس الأحد')}
          </p>
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
            <p className="text-sm text-red-700">{t('Failed to load verifications', 'فشل تحميل التحقق')}</p>
          </div>
        )}

        {/* Verifications list */}
        {verifications && verifications.verifications.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-sm text-gray-600">
                  {t('Pending verification', 'في انتظار التحقق')}
                </div>
                <div className="text-2xl font-bold text-gray-900">{verifications.pending}</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm text-emerald-700">{t('Total submissions', 'إجمالي الملفات')}</div>
                <div className="text-2xl font-bold text-emerald-900">{verifications.total}</div>
              </div>
            </div>

            {/* Verifications */}
            {verifications.verifications.map((v) => (
              <div key={v.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{v.studentName}</h3>
                      <p className="text-sm text-gray-600 mt-1">{v.lessonTitle}</p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${getMasteryColor(
                        v.masteryStatus,
                      )}`}
                    >
                      {v.masteryStatus === 'mastered'
                        ? t('Mastered', 'متقن')
                        : v.masteryStatus === 'known'
                          ? t('Known', 'معروف')
                          : v.masteryStatus === 'practicing'
                            ? t('Practicing', 'يمارس')
                            : t('Introduced', 'تم التعريف')}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-4 space-y-3">
                  {/* Performance summary */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-600">{t('Self-rating', 'تقييم ذاتي')}</p>
                      <p className="font-medium text-gray-900">{v.selfRating ?? '—'}★</p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('Duration', 'المدة')}</p>
                      <p className="font-medium text-gray-900">
                        {v.recordingDuration ? `${Math.round(v.recordingDuration / 60)}s` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">{t('Last practiced', 'آخر ممارسة')}</p>
                      <p className="font-medium text-gray-900">
                        {v.lastPracticedAt
                          ? new Date(v.lastPracticedAt).toLocaleDateString(
                              lang === 'ar' ? 'ar-EG' : 'en-GB',
                            )
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Recording player */}
                  {v.recordingUrl && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setPlayingUrl(playingUrl === v.recordingUrl ? null : v.recordingUrl)
                        }
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <Play className="h-4 w-4" />
                        {t('Play recording', 'تشغيل التسجيل')}
                      </button>
                    </div>
                  )}
                  {playingUrl === v.recordingUrl && (
                    <audio src={v.recordingUrl} controls className="w-full" />
                  )}

                  {/* Servant feedback */}
                  {v.servantFeedback && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">
                        {t('Servant feedback', 'تعليقات الخادم')}
                      </p>
                      <p className="text-sm text-blue-900">{v.servantFeedback}</p>
                    </div>
                  )}

                  {/* Verification form */}
                  {verifyingId === v.id && (
                    <div className="space-y-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                      <textarea
                        value={verifyNotes}
                        onChange={(e) => setVerifyNotes(e.target.value.slice(0, 300))}
                        placeholder={t(
                          'Add verification notes (optional, max 300 chars)',
                          'أضف ملاحظات التحقق (اختياري، 300 حرف كحد أقصى)',
                        )}
                        className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none"
                        rows={2}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {verifyNotes.length}/300
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setVerifyingId(null)
                              setVerifyNotes('')
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {t('Cancel', 'إلغاء')}
                          </button>
                          <button
                            onClick={handleMarkReady}
                            disabled={markReadyMutation.isPending}
                            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {markReadyMutation.isPending
                              ? t('Verifying...', 'جارٍ التحقق...')
                              : t('Mark ready', 'وضع علامة مستعد')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mark ready button */}
                  {verifyingId !== v.id && (
                    <button
                      onClick={() => setVerifyingId(v.id)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t('Verify & mark ready', 'تحقق وضع علامة مستعد')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {verifications && verifications.verifications.length === 0 && !isLoading && (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">{t('All set!', 'كل شيء بخير!')}</p>
            <p className="text-gray-500 text-sm mt-1">
              {t('All students have been verified for this Sundays liturgy', 'تم التحقق من جميع الطلاب لقداس الأحد')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

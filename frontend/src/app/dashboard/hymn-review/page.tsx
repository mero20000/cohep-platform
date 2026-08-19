'use client'

import { useState } from 'react'
import { Mic, Star, Check, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { AudioPlayer } from '@/components/audio-player'
import { useToast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/use-language'
import { assetUrl } from '@/lib/asset-url'
import { useServantReviewQueue, useReviewSession, type ReviewQueueItem } from '@/components/hymn-learning/hooks'

const STARS = [1, 2, 3, 4, 5]

const STAR_LABELS: Record<number, { en: string; ar: string }> = {
  1: { en: 'Needs significant work', ar: 'يحتاج إلى عمل كبير' },
  2: { en: 'Has the basics, needs practice', ar: 'أتقن الأساسيات ويحتاج تدريباً' },
  3: { en: 'Mostly correct', ar: 'أداء صحيح في معظمه' },
  4: { en: 'Very good', ar: 'جيد جداً' },
  5: { en: 'Excellent, ready', ar: 'ممتاز وجاهز' },
}

export default function HymnReviewPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  const { data: queue, isLoading } = useServantReviewQueue()
  const review = useReviewSession()

  const [active, setActive] = useState<ReviewQueueItem | null>(null)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [note, setNote] = useState('')

  const pending = queue ?? []
  const openReview = (item: ReviewQueueItem) => {
    setActive(item)
    setRating(0)
    setNote('')
  }

  const submit = async () => {
    if (!active) return
    if (rating < 1) {
      toast('warning', t('Please choose a rating', 'يرجى اختيار تقييم'))
      return
    }
    await review.mutateAsync({ id: active.id, servantRating: rating, servantNote: note || undefined })
    toast('success', t('Review submitted', 'تم إرسال المراجعة'))
    setActive(null)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('Hymn Practice Review', 'مراجعة تمارين التسابيح')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('Listen to each student recording and give feedback.', 'استمع إلى تسجيلات الطلاب وقدّم ملاحظاتك.')}
        </p>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title={t('No recordings to review', 'لا توجد تسجيلات للمراجعة')}
            description={t('When students submit practice recordings, they will appear here.', 'عندما يرسل الطلاب تسجيلات التمارين ستظهر هنا.')}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((item) => (
            <div key={item.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold-50 text-gold-600">
                {item.student.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(item.student.photoUrl)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {item.student.firstName} {item.student.lastName}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 text-gold-500">
                    {STARS.map((s) => (
                      <Star key={s} className={`h-3 w-3 ${s <= item.selfRating ? 'fill-gold-500' : 'fill-gray-200 text-gray-200'}`} aria-hidden="true" />
                    ))}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm text-gray-600">
                  {item.lesson.title}
                  {item.lesson.titleCoptic ? <span className="text-gray-400 coptic"> · {item.lesson.titleCoptic}</span> : null}
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  {t('Submitted', 'أُرسل')} {new Date(item.submittedAt).toLocaleString()}
                  {item.durationSec ? ` · ${Math.round(item.durationSec)}s` : ''}
                </div>
              </div>
              <Button size="sm" onClick={() => openReview(item)} className="shrink-0">
                {t('Review', 'مراجعة')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `${active.student.firstName} ${active.student.lastName}` : ''}
        description={active ? active.lesson.title : ''}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setActive(null)}>{t('Cancel', 'إلغاء')}</Button>
            <Button onClick={submit} disabled={review.isPending}>
              <Check className="h-4 w-4" />
              {review.isPending ? t('Submitting…', 'جارٍ الإرسال…') : t('Submit review', 'إرسال المراجعة')}
            </Button>
          </div>
        }
      >
        {active && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">{t('Student recording', 'تسجيل الطالب')}</p>
              <AudioPlayer src={assetUrl(active.recordingUrl)} />
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
              <span className="font-medium text-gray-900">{t('Self-rated', 'التقييم الذاتي')}: </span>
              {active.selfRating}/5
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">{t('Your rating', 'تقييمك')}</p>
              <div className="flex items-center gap-1">
                {STARS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                    aria-label={`${s} stars`}
                    className="transition-transform hover:scale-110"
                  >
                    <Star className={`h-7 w-7 ${s <= (hovered || rating) ? 'fill-gold-500 text-gold-500' : 'fill-gray-200 text-gray-200'}`} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="mt-1.5 text-xs text-gray-500">{lang === 'ar' ? STAR_LABELS[rating].ar : STAR_LABELS[rating].en}</p>
              )}
            </div>

            <div>
              <label htmlFor="servant-note" className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('Feedback note (optional)', 'ملاحظة (اختياري)')}
              </label>
              <textarea
                id="servant-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={t('e.g. Mina is close, needs help with the opening syllable.', 'مثال: مينا قريب من الإتقان، يحتاج مساعدة في المقطع الأول.')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
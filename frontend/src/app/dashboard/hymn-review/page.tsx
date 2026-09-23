'use client'

import { useState, useMemo } from 'react'
import { Mic, Star, Check, User, Trash2, Search, ClipboardList, CheckCircle2, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { AudioPlayer } from '@/components/audio-player'
import { useToast } from '@/components/ui/toast'
import { useLanguage } from '@/lib/use-language'
import { assetUrl } from '@/lib/asset-url'
import {
  useServantReviewQueue,
  useReviewSession,
  useReviewedSessions,
  useDeleteSession,
  type ReviewQueueItem,
  type ReviewedSessionItem,
} from '@/components/hymn-learning/hooks'

const STARS = [1, 2, 3, 4, 5]

const STAR_LABELS: Record<number, { en: string; ar: string }> = {
  1: { en: 'Needs significant work', ar: 'يحتاج إلى عمل كبير' },
  2: { en: 'Has the basics, needs practice', ar: 'أتقن الأساسيات ويحتاج تدريباً' },
  3: { en: 'Mostly correct', ar: 'أداء صحيح في معظمه' },
  4: { en: 'Very good', ar: 'جيد جداً' },
  5: { en: 'Excellent, ready', ar: 'ممتاز وجاهز' },
}

function isSuperAdmin(): boolean {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return false
    const u = JSON.parse(raw)
    const roles: string[] = Array.isArray(u.roles) ? u.roles : []
    return roles.includes('super_admin')
  } catch { return false }
}

export default function HymnReviewPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const superAdmin = useMemo(() => isSuperAdmin(), [])

  const { data: queue, isLoading: loadingQueue } = useServantReviewQueue()
  const { data: reviewed, isLoading: loadingReviewed } = useReviewedSessions()
  const review = useReviewSession()
  const deleteMut = useDeleteSession()

  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<ReviewQueueItem | null>(null)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [note, setNote] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const pending = queue ?? []
  const reviewedList = reviewed ?? []

  const filteredPending = useMemo(() => {
    if (!search) return pending
    const q = search.toLowerCase()
    return pending.filter(i =>
      `${i.student.firstName} ${i.student.lastName}`.toLowerCase().includes(q) ||
      i.lesson.title.toLowerCase().includes(q)
    )
  }, [pending, search])

  const filteredReviewed = useMemo(() => {
    if (!search) return reviewedList
    const q = search.toLowerCase()
    return reviewedList.filter(i =>
      `${i.student.firstName} ${i.student.lastName}`.toLowerCase().includes(q) ||
      i.lesson.title.toLowerCase().includes(q)
    )
  }, [reviewedList, search])

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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteMut.mutateAsync(deleteTarget.id)
    toast('success', t('Session deleted', 'تم حذف الجلسة'))
    setDeleteTarget(null)
  }

  const avgRating = reviewedList.length > 0
    ? (reviewedList.reduce((s, r) => s + r.servantRating, 0) / reviewedList.length).toFixed(1)
    : '—'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{t('Hymn Practice Review', 'مراجعة تمارين التسابيح')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('Listen to each student recording and give feedback.', 'استمع إلى تسجيلات الطلاب وقدّم ملاحظاتك.')}
        </p>
      </div>

      {/* Stats summary */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
          <div className="text-2xl font-bold text-amber-700">{pending.length}</div>
          <div className="text-xs text-amber-600">{t('Pending', 'في الانتظار')}</div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{reviewedList.length}</div>
          <div className="text-xs text-green-600">{t('Reviewed', 'تمت المراجعة')}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center col-span-2 sm:col-span-1">
          <div className="flex items-center justify-center gap-1">
            <Star className="h-4 w-4 fill-blue-500 text-blue-700" />
            <span className="text-2xl font-bold text-blue-700">{avgRating}</span>
          </div>
          <div className="text-xs text-blue-600">{t('Avg Rating', 'متوسط التقييم')}</div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab('pending')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            {t('Pending', 'في الانتظار')}
            {pending.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-xs font-medium">{pending.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('reviewed')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'reviewed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('Reviewed', 'تمت المراجعة')}
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('Search by student or hymn...', 'البحث بالطالب أو الترنيمة...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white ps-10 pe-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
        </div>
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        loadingQueue ? (
          <TableSkeleton rows={6} cols={3} />
        ) : filteredPending.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white">
            <EmptyState
              title={t('No recordings to review', 'لا توجد تسجيلات للمراجعة')}
              description={search
                ? t('No results match your search.', 'لا توجد نتائج تطابق بحثك.')
                : t('When students submit practice recordings, they will appear here.', 'عندما يرسل الطلاب تسجيلات التمارين ستظهر هنا.')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPending.map(item => (
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
                    <span className="flex shrink-0 items-center gap-0.5 text-gold-700">
                      {STARS.map(s => (
                        <Star key={s} className={`h-3 w-3 ${s <= item.selfRating ? 'fill-gold-500' : 'fill-gray-200 text-gray-200'}`} aria-hidden="true" />
                      ))}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-gray-600">
                    {item.lesson.title}
                    {item.lesson.titleCoptic ? <span className="text-gray-400 coptic"> · {item.lesson.titleCoptic}</span> : null}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {t('Submitted', 'أُرسل')} {new Date(item.submittedAt).toLocaleString('en-GB')}
                    {item.durationSec ? ` · ${Math.round(item.durationSec)}s` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {superAdmin && (
                    <Button size="sm" variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteTarget({ id: item.id, name: `${item.student.firstName} ${item.student.lastName}` })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openReview(item)}>
                    {t('Review', 'مراجعة')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Reviewed tab */}
      {tab === 'reviewed' && (
        loadingReviewed ? (
          <TableSkeleton rows={6} cols={4} />
        ) : filteredReviewed.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white">
            <EmptyState
              title={t('No reviewed sessions yet', 'لا توجد جلسات تمت مراجعتها')}
              description={search
                ? t('No results match your search.', 'لا توجد نتائج تطابق بحثك.')
                : t('Reviewed practice sessions will appear here.', 'ستظهر هنا الجلسات التي تمت مراجعتها.')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReviewed.map(item => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-50 text-green-600">
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
                      <span className="flex shrink-0 items-center gap-0.5">
                        {STARS.map(s => (
                          <Star key={s} className={`h-3 w-3 ${s <= item.servantRating ? 'fill-green-500 text-green-700' : 'fill-gray-200 text-gray-200'}`} aria-hidden="true" />
                        ))}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-gray-600">
                      {item.lesson.title}
                      {item.lesson.titleCoptic ? <span className="text-gray-400 coptic"> · {item.lesson.titleCoptic}</span> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-400">
                      <span>{t('Self', 'ذاتي')}: {item.selfRating}/5</span>
                      <span>{t('Reviewed', 'مُراجع')}: {new Date(item.servantReviewedAt).toLocaleString('en-GB')}</span>
                      {item.reviewer && <span>{t('By', 'بواسطة')}: {item.reviewer.firstName} {item.reviewer.lastName}</span>}
                    </div>
                  </div>
                  {superAdmin && (
                    <Button size="sm" variant="outline"
                      className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteTarget({ id: item.id, name: `${item.student.firstName} ${item.student.lastName}` })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {item.servantNote && (
                  <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm text-gray-600">
                    {item.servantNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Review modal */}
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
                {STARS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                    aria-label={`${s} stars`}
                    className="transition-transform hover:scale-110"
                  >
                    <Star className={`h-7 w-7 ${s <= (hovered || rating) ? 'fill-gold-500 text-gold-700' : 'fill-gray-200 text-gray-200'}`} />
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
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder={t('e.g. Mina is close, needs help with the opening syllable.', 'مثال: مينا قريب من الإتقان، يحتاج مساعدة في المقطع الأول.')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('Delete Session', 'حذف الجلسة')}
        description={deleteTarget
          ? t(`Are you sure you want to delete this practice session for ${deleteTarget.name}? This will recalculate their progress.`,
              `هل أنت متأكد من حذف جلسة التمرين لـ ${deleteTarget.name}؟ سيتم إعادة حساب تقدمهم.`)
          : ''}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('Cancel', 'إلغاء')}</Button>
            <Button onClick={confirmDelete} disabled={deleteMut.isPending}
              className="bg-red-600 text-white hover:bg-red-700">
              <Trash2 className="h-4 w-4" />
              {deleteMut.isPending ? t('Deleting…', 'جارٍ الحذف…') : t('Delete', 'حذف')}
            </Button>
          </div>
        }
      >
        <></>
      </Modal>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import DashboardHero from '../../../../dashboard/hero'
import { http } from '@/lib/http-client'
import { AudioPlayer } from '@/components/audio-player'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Check, Loader2, ArrowLeft } from 'lucide-react'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

export default function PracticeGuidePage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const params = useParams()
  const [lesson, setLesson] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [practiced, setPracticed] = useState(false)
  const [practicing, setPracticing] = useState(false)

  useEffect(() => {
    http.get<any>(`/parents/me/children/${params.id}/current-lesson`).then(res => {
      setLesson(res?.lesson || res)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [params.id])

  async function markPracticed() {
    if (!lesson) return
    setPracticing(true)
    try {
      await http.post(`/parents/me/children/${params.id}/practice`, { lessonId: lesson.id })
      setPracticed(true)
      toast('success', t('Practice logged!', 'تم تسجيل الممارسة!'))
    } catch {
      toast('error', t('Failed to log practice', 'فشل تسجيل الممارسة'))
    } finally {
      setPracticing(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )

  if (!lesson) return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-lg mx-auto text-center text-gray-500">
        {t('No active lesson found for this child.', 'لا توجد تسبيحة حالية لهذا الطالب.')}
        <Link href={`/portal/children/${params.id}`} className="block mt-4 text-sm text-blue-500 hover:underline">
          {t('Back to child profile', 'العودة لملف الطالب')}
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-4">
        <Link href={`/portal/children/${params.id}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('Back', 'رجوع')}
        </Link>

        <DashboardHero
          bg="var(--hymn-indigo)"
          orbTint="bg-indigo-500/10"
          title={lang === 'ar' ? lesson.titleAr : lesson.title}
          description={t('Practice this hymn with your child at home.', 'تدرب على هذه التسبيحة مع طفلك في المنزل.')}
        />

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {lesson.audioUrl && (
            <div className="mt-4">
              <AudioPlayer src={`${API_ORIGIN}${lesson.audioUrl}`} duration={lesson.audioDuration || undefined} />
            </div>
          )}

          {(lesson.content || lesson.contentAr) && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-gray-700 mb-2">{t('Lyrics', 'الكلمات')}</h2>
              <div className={`text-sm text-gray-600 whitespace-pre-line bg-gray-50 rounded-lg p-4 ${lang === 'ar' ? 'text-right arabic-text' : ''}`}>
                {lang === 'ar' ? (lesson.contentAr || lesson.content) : lesson.content}
              </div>
            </div>
          )}

          <button
            onClick={markPracticed}
            disabled={practiced || practicing}
            className={`mt-6 w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
              practiced
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
            }`}
          >
            {practiced ? (
              <><Check className="w-4 h-4 inline mr-2" />{t('Practiced this week!', 'تمت الممارسة هذا الأسبوع!')}</>
            ) : practicing ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            ) : (
              t('Mark as practiced', 'تسجيل الممارسة')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

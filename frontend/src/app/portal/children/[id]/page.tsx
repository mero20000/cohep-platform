'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import DashboardHero from '../../../dashboard/hero'
import {
  Calendar, ClipboardCheck, TrendingUp, Loader2, ArrowLeft, User,
  CheckCircle2, Clock, XCircle, AlertCircle, Award, FileText,
  Star, Crown, Cross, Music, CheckCircle, Church, Plus, Sprout, X,
  Play, Headphones, BookOpen, Home
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TermReportModal } from '@/components/term-report-modal'
import { FormationArchiveModal } from '@/components/formation-archive-modal'
import { PhotoLightbox } from '@/components/photo-lightbox'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

interface AttendanceRecord {
  id: string; date: string; status: string; homeworkStatus: string; note?: string;
  levelNumber?: number; levelName?: string;
}

interface AssessmentResult {
  id: string; assessmentId: string; title: string; titleAr?: string;
  subject?: string; subjectAr?: string; status: string;
  score: number; maxScore: number; percentage: number; passed: boolean; gradedAt?: string;
  referenceRecordingUrl?: string | null; referenceRecordingName?: string | null;
}

interface ProgressData {
  sessions: { id: string; scheduledDate: string; levelId: string }[];
  assessments: { id: string; createdAt: string; grades: { score: number; maxScore: number }[] }[];
}

interface GamificationData {
  rank?: number; totalStudents?: number; totalPoints?: number; badges?: number; xpToNextLevel?: number;
}

type TabType = 'attendance' | 'assessments' | 'progress' | 'practice'

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700', late: 'bg-amber-100 text-amber-700',
  absent: 'bg-red-100 text-red-700', excused: 'bg-gray-100 text-gray-600',
}

function LiturgySection({ childId, language }: { childId: string; language: string }) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const fetchRecords = useCallback(async () => {
    try {
      const res = await http.get(`/parents/me/children/${childId}/liturgy`) as any[]
      setRecords(res || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [childId])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleLogLiturgy = async () => {
    setLogging(true)
    try {
      await http.post(`/parents/me/children/${childId}/liturgy`, { date: selectedDate })
      setFeedback(t('Logged! Awaiting verification.', 'تم التسجيل! في انتظار التحقق.'))
      fetchRecords()
      setTimeout(() => setFeedback(null), 3000)
    } catch (err: any) {
      if (err.status === 409) {
        setFeedback(t('Already logged for this date', 'تم التسجيل مسبقًا لهذا التاريخ'))
      } else {
        setFeedback(t('Error logging liturgy', 'حدث خطأ في التسجيل'))
      }
      setTimeout(() => setFeedback(null), 3000)
    }
    setLogging(false)
  }

  const verifiedCount = records.filter(r => r.status === 'verified').length
  const threshold = 10

  return (
    <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Church className="w-5 h-5 text-amber-700" />
        <h3 className="font-semibold text-lg text-gray-900">{t('Liturgy Attendance', 'حضور القداسات')}</h3>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="liturgy-date" className="sr-only">{t('Liturgy date', 'تاريخ القداس')}</label>
        <input
          id="liturgy-date"
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          onClick={handleLogLiturgy}
          disabled={logging}
          className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {logging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {t('Log Liturgy', 'تسجيل القداس')}
        </button>
      </div>

      {feedback && (
        <p className="text-sm font-medium text-amber-700 mb-3 animate-pulse">{feedback}</p>
      )}

      <p className="text-sm text-gray-500 mb-3">
        {verifiedCount} {t('verified liturgies', 'قداس معتمد')}
        {verifiedCount < threshold && ` — ${threshold - verifiedCount} ${t('more for Faithful Worshipper badge', 'متبقي لشارة المُصلّي الأمين')}`}
      </p>

      {!loading && records.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {records.map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100">
              <span className="text-sm text-gray-700">{new Date(r.date).toLocaleDateString()}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                r.status === 'verified' ? 'bg-green-100 text-green-700' :
                r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {r.status === 'verified' ? t('Verified', 'معتمد') :
                 r.status === 'rejected' ? t('Rejected', 'مرفوض') :
                 t('Pending', 'قيد الانتظار')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MilestonesSection({ childId, language }: { childId: string; language: string }) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en
  const [milestones, setMilestones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [lightboxCaption, setLightboxCaption] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get(`/parents/me/children/${childId}/milestones`) as { milestones: any[] }
        setMilestones(res?.milestones || [])
      } catch { /* ignore */ }
      setLoading(false)
    })()
  }, [childId])

  const iconMap: Record<string, string> = { book: '📖', church: '⛪', award: '🏅' }

  const photoUrl = (m: any) => {
    if (m.milestonePhotoUrl) return m.milestonePhotoUrl
    if (m.photoUrl) return m.photoUrl
    return null
  }

  const photoCaption = (m: any) => {
    if (m.milestoneCaption) return m.milestoneCaption
    if (m.servantNote) return m.servantNote
    return ''
  }

  return (
    <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Sprout className="w-5 h-5 text-purple-700" />
        <h3 className="font-semibold text-lg text-gray-900">{t('Spiritual Milestones', 'محطات النمو الروحي')}</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : milestones.length === 0 ? (
        <p className="text-sm text-gray-500">{t('No milestones yet. Keep learning!', 'لا توجد محطات بعد. استمر في التعلم!')}</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {milestones.map((m: any, i: number) => {
            const img = photoUrl(m)
            const cap = photoCaption(m)
            return (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/60 transition-colors">
                <span className="text-lg mt-0.5 shrink-0">{iconMap[m.icon] || '⭐'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{language === 'ar' ? m.label.ar : m.label.en}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(m.date).toLocaleDateString()}</p>
                  {img && (
                    <Image
                      src={img}
                      alt={cap}
                      width={128}
                      height={96}
                      className="mt-2 w-32 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 border border-gray-200"
                      onClick={() => { setLightboxSrc(img); setLightboxCaption(cap) }}
                    />
                  )}
                  {cap && <p className="text-sm text-gray-600 mt-1 italic">&ldquo;{cap}&rdquo;</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {lightboxSrc && (
        <PhotoLightbox src={lightboxSrc} caption={lightboxCaption} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}

function PracticeTogetherCard({ childId, language }: { childId: string; language: string }) {
  const t = (en: string, ar: string) => language === 'ar' ? ar : en
  const [lesson, setLesson] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [practicing, setPracticing] = useState(false)
  const [xpFeedback, setXpFeedback] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [lessonRes, summaryRes] = await Promise.all([
        http.get(`/parents/me/children/${childId}/current-lesson`),
        http.get(`/parents/me/children/${childId}/practice-summary`),
      ])
      setLesson(lessonRes)
      setSummary(summaryRes)
    } catch { /* no current lesson */ }
    setLoading(false)
  }, [childId])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePractice = async () => {
    if (!lesson?.lesson || practicing) return
    setPracticing(true)
    try {
      const res = await http.post(`/parents/me/children/${childId}/practice`, { lessonId: lesson.lesson.id }) as any
      setXpFeedback(`+${res.xpAwarded} XP`)
      setSummary({ weeklyCount: res.weeklyCount, weeklyLimit: res.weeklyLimit, lastPracticedAt: new Date().toISOString(), totalPractices: (summary?.totalPractices || 0) + 1 })
      setTimeout(() => setXpFeedback(null), 3000)
    } catch (err: any) {
      if (err.status === 429) {
        setXpFeedback(t('Weekly limit reached!', 'تم الوصول للحد الأسبوعي!'))
        setTimeout(() => setXpFeedback(null), 3000)
      }
    }
    setPracticing(false)
  }

  if (loading) return null
  if (!lesson?.lesson) return null

  const limitReached = summary && summary.weeklyCount >= summary.weeklyLimit

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-lg text-gray-900">{t('Practice Together', 'تدرب معًا')}</h3>
      </div>

      <p className="text-sm text-gray-600 mb-3">
        {t('Current Lesson:', 'الدرس الحالي:')} <span className="font-medium text-gray-900">{language === 'ar' ? (lesson.lesson.titleAr || lesson.lesson.title) : lesson.lesson.title}</span>
      </p>

      {lesson.lesson.sessions?.map((s: any) => (
        <details key={s.id} className="mb-2 group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 hover:text-indigo-600">
            <Music className="w-4 h-4 text-indigo-400" />
            {language === 'ar' ? (s.titleAr || s.title) : s.title}
          </summary>
          <div className="mt-2 ml-6 p-3 bg-white rounded-lg border border-gray-100 text-sm space-y-2">
            {s.contentCoptic && <p className="font-coptic text-lg text-gray-800" dir="ltr">{s.contentCoptic}</p>}
            {s.contentEn && <p className="text-gray-600">{s.contentEn}</p>}
            {s.contentAr && <p className="text-gray-600 text-right" dir="rtl">{s.contentAr}</p>}
            <div className="mt-2 h-12 bg-gray-50 rounded flex items-center justify-center text-xs text-gray-400">
              {t('Audio coming soon', 'التسجيل الصوتي قريبًا')} 🎧
            </div>
          </div>
        </details>
      ))}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handlePractice}
          disabled={limitReached || practicing}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all ${
            limitReached
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {practicing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {limitReached ? t('Weekly limit reached', 'تم الوصول للحد الأسبوعي') : t("We practiced together!", 'تدربنا معًا!')}
        </button>
        {xpFeedback && (
          <span className={`text-sm font-bold animate-pulse ${xpFeedback.includes('+') ? 'text-green-600' : 'text-amber-600'}`}>
            {xpFeedback}
          </span>
        )}
      </div>

      {summary && (
        <p className="mt-2 text-sm text-gray-500">
          {t('Practiced', 'تم التدرب')} {summary.weeklyCount}x {t('this week', 'هذا الأسبوع')}
          {summary.weeklyLimit > 0 && ` · ${t('Limit', 'الحد الأقصى')}: ${summary.weeklyLimit}`}
        </p>
      )}
    </div>
  )
}

function PracticePanel({ childId, lang }: { childId: string; lang: string }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [lesson, setLesson] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [practicing, setPracticing] = useState(false)
  const [practiceResult, setPracticeResult] = useState<any>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportAssessmentId, setReportAssessmentId] = useState('')
  const [reportScore, setReportScore] = useState('')
  const [reportNotes, setReportNotes] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportResult, setReportResult] = useState<any>(null)
  const [assessments, setAssessments] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [lessonRes, asmRes] = await Promise.all([
          http.get<any>(`/parents/me/children/${childId}/current-lesson`),
          http.get<any[]>(`/parents/me/children/${childId}/assessments`),
        ])
        setLesson(lessonRes)
        setAssessments(asmRes)
      } catch {}
      setLoading(false)
    }
    load()
  }, [childId])

  const handlePractice = async () => {
    if (!lesson?.lesson?.id) return
    setPracticing(true)
    try {
      const res = await http.post<any>(`/parents/me/children/${childId}/practice`, { lessonId: lesson.lesson.id })
      setPracticeResult(res)
    } catch {}
    setPracticing(false)
  }

  const handleReport = async () => {
    if (!reportAssessmentId || !reportScore) return
    setReporting(true)
    try {
      const res = await http.post<any>(`/parents/me/children/${childId}/report-assessment`, {
        assessmentId: reportAssessmentId,
        score: Number(reportScore),
        notes: reportNotes || undefined,
      })
      setReportResult(res)
      setReportOpen(false)
      setReportScore('')
      setReportNotes('')
    } catch {}
    setReporting(false)
  }

  const assetUrl = (url: string) => url?.startsWith('http') ? url : `${API_ORIGIN}${url}`

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-gold-600" />
    </div>
  )

  if (!lesson?.lesson) return (
    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <BookOpen className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-500 text-sm">{t('No current lesson available', 'لا يوجد درس حالي')}</p>
    </div>
  )

  const isFallback = lesson.source === 'subject_item_level'
  const subjectItems: any[] = isFallback ? (lesson.subjectItems || []) : (lesson.subjectItem ? [lesson.subjectItem] : [])

  const renderItemCard = (item: any) => {
    const hasRecording = !!item.recordingUrl
    const hasHazzat = !!item.hazzat
    const hasPresentation = !!item.presentationUrl
    return (
      <div key={item.id} className="rounded-lg bg-white/70 border border-blue-100 p-4 space-y-2">
        <div>
          <h4 className="font-bold text-gray-900">
            {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
          </h4>
          {item.nameCoptic && <p className="text-xs text-gray-400">{item.nameCoptic}</p>}
        </div>
        {hasRecording && (
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
              <Play className="h-4 w-4 text-blue-600" />
              {t('Listening Recording', 'تسجيل الاستماع')}
            </div>
            <audio controls className="w-full h-8" src={assetUrl(item.recordingUrl)}>
              {t('Your browser does not support audio', 'متصفحك لا يدعم الصوت')}
            </audio>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {hasHazzat && (
            <a href={assetUrl(item.hazzat)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
              <FileText className="h-3.5 w-3.5" />
              {t('Hazzat', 'الحزّات')}
            </a>
          )}
          {hasPresentation && (
            <a href={assetUrl(item.presentationUrl)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
              <BookOpen className="h-3.5 w-3.5" />
              {t('Presentation', 'العرض')}
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-amber-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Headphones className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-800">
            {t('Practice Together', 'تمرن مع بعض')}
          </h3>
        </div>

        {isFallback ? (
          <>
            <div className="rounded-lg bg-white/70 border border-blue-100 p-4 mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                {t('Subject Items for Your Level', 'عناصر المنهج لمستوى طفلك')}
                {lesson.level && <span className="ml-2">· {t('Level', 'المستوى')} {lesson.level.number}</span>}
              </p>
              <p className="text-sm text-gray-600">
                {t(
                  'These are the hymns and liturgical items allocated for your child\'s level. Practice them together at home!',
                  'هذه التراتيل والعناصر الكنسية المخصصة لمستوى طفلك. تمرنوا معاً في المنزل!'
                )}
              </p>
            </div>
            <div className="space-y-3">
              {subjectItems.map(renderItemCard)}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-white/70 border border-blue-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                {lesson.subject?.nameAr && lang === 'ar' ? lesson.subject.nameAr : lesson.subject?.name}
                {lesson.level && <span className="ml-2">· {t('Level', 'المستوى')} {lesson.level.number}</span>}
              </p>
              <h4 className="font-bold text-gray-900 text-lg">
                {lang === 'ar' && lesson.lesson.titleAr ? lesson.lesson.titleAr : lesson.lesson.title}
              </h4>
              {lesson.lesson.titleCoptic && (
                <p className="text-sm text-gray-400 mt-0.5">{lesson.lesson.titleCoptic}</p>
              )}
              {lesson.lesson.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {lang === 'ar' && lesson.lesson.descriptionAr ? lesson.lesson.descriptionAr : lesson.lesson.description}
                </p>
              )}
            </div>
            {subjectItems.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t('Reference Materials', 'المراجع')}
                </p>
                {subjectItems.map(renderItemCard)}
              </div>
            )}
            {lesson.lesson.sessions?.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t('Sessions', 'الحصص')}
                </p>
                {lesson.lesson.sessions.map((s: any) => (
                  <div key={s.id} className="rounded-lg bg-white/50 border border-blue-50 p-2 text-sm">
                    <span className="font-medium text-gray-700">{lang === 'ar' && s.titleAr ? s.titleAr : s.title}</span>
                    {s.contentCoptic && <span className="ml-2 text-gray-400 text-xs">({s.contentCoptic})</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Practice button (only when a lesson exists for logging) */}
        {lesson.lesson?.id && (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handlePractice} disabled={practicing || !!practiceResult}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                practiceResult
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}>
              {practiceResult ? <CheckCircle className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {practiceResult
                ? t(`Practiced! +${practiceResult.xpAwarded} XP`, `تم التمرين! +${practiceResult.xpAwarded} نقطة`)
                : practicing ? t('Logging...', 'جاري التسجيل...') : t('Log Practice Session', 'تسجيل جلسة تمرين')
              }
            </button>
          </div>
        )}
      </div>

      {/* Assessment reporting */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-gray-800">
              {t('Report Assessment', 'تقييم الواجب المنزلي')}
            </h3>
          </div>
          <button onClick={() => setReportOpen(!reportOpen)}
            className="text-sm text-blue-600 hover:text-blue-800">
            {reportOpen ? t('Cancel', 'إلغاء') : t('Report Result', 'إبلاغ النتيجة')}
          </button>
        </div>

        {reportOpen && (
          <div className="space-y-3 mt-3">
            <select value={reportAssessmentId} onChange={e => setReportAssessmentId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">{t('Select assessment...', 'اختر التقييم...')}</option>
              {assessments.map(a => (
                <option key={a.assessmentId} value={a.assessmentId}>
                  {lang === 'ar' && a.titleAr ? a.titleAr : a.title} ({a.subject})
                </option>
              ))}
            </select>
            <input type="number" min="0" placeholder={t('Score', 'الدرجة')}
              value={reportScore} onChange={e => setReportScore(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <textarea placeholder={t('Notes (optional)', 'ملاحظات (اختياري)')}
              value={reportNotes} onChange={e => setReportNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} />
            <button onClick={handleReport} disabled={reporting || !reportAssessmentId || !reportScore}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {reporting ? t('Submitting...', 'جاري الإرسال...') : t('Submit Report', 'إرسال التقرير')}
            </button>
          </div>
        )}

        {reportResult && (
          <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            {t('Reported', 'تم الإبلاغ')}: {reportResult.title} — {reportResult.score}/{reportResult.maxScore} ({reportResult.percentage}%)
            {reportResult.passed ? ' ✅' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChildDetailPage() {
  const { id } = useParams()
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', lang)
  }, [lang])

  const [tab, setTab] = useState<TabType>('attendance')
  const [drill, setDrill] = useState<null | 'xp' | 'badges'>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [xpItems, setXpItems] = useState<Array<{ id: string; amount: number; type: string; description?: string; createdAt: string }>>([])
  const [badgeItems, setBadgeItems] = useState<Array<{ id: string; awardedAt: string; badge: { id: string; name: string; nameAr?: string; description?: string; iconUrl?: string } }>>([])

  const openDrill = async (kind: 'xp' | 'badges') => {
    setDrill(kind)
    setDrillLoading(true)
    try {
      if (kind === 'xp') {
        const res = await http.get<{ items: typeof xpItems }>(`/gamification/students/${id}/transactions`)
        setXpItems(res.items || [])
      } else {
        const res = await http.get<typeof badgeItems>(`/gamification/students/${id}/badges`)
        setBadgeItems(res || [])
      }
    } catch { /* keep panel empty on failure */ }
    setDrillLoading(false)
  }
  const [student, setStudent] = useState<{ firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string; photoUrl?: string; studentCode: string; levelNumber: number; levelName: string; groupName: string } | null>(null)
  const [gamification, setGamification] = useState<GamificationData | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [assessments, setAssessments] = useState<AssessmentResult[]>([])
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  useEffect(() => {
    if (!id) return
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [stuRes, attRes, asmRes, proRes] = await Promise.all([
          http.get<any>(`/parents/me/children/${id}`),
          http.get<any[]>(`/parents/me/children/${id}/attendance`),
          http.get<any[]>(`/parents/me/children/${id}/assessments`),
          http.get<any>(`/parents/me/children/${id}/progress`),
        ])
        if (stuRes) {
          const s = stuRes
          setStudent({ firstName: s.firstName, lastName: s.lastName, firstNameAr: s.firstNameAr, lastNameAr: s.lastNameAr, photoUrl: s.photoUrl, studentCode: s.studentCode, levelNumber: s.levelNumber ?? s.level?.number, levelName: s.levelName ?? s.level?.name, groupName: s.groupName ?? s.group?.name })
          if (s.rank || s.totalPoints || s.badges) {
            setGamification({ rank: s.rank, totalStudents: s.totalStudents, totalPoints: s.totalPoints, badges: s.badges, xpToNextLevel: s.xpToNextLevel })
          }
        }
        if (attRes) setAttendance(attRes)
        if (asmRes) setAssessments(asmRes)
        if (proRes) setProgress(proRes)
      } catch { /* ignore */ }
      setLoading(false)
    }
    fetchAll()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-gold-700" />
    </div>
  )

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'attendance', label: t('Attendance', 'الحضور'), icon: Calendar },
    { id: 'assessments', label: t('Assessments', 'التقييمات'), icon: ClipboardCheck },
    { id: 'practice', label: t('Practice', 'التمرين'), icon: Headphones },
    { id: 'progress', label: t('Progress', 'التقدم'), icon: TrendingUp },
  ]

  return (
    <div className={`space-y-6 ${lang === 'ar' ? 'rtl' : 'ltr'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('Back to Children', 'العودة للأبناء')}
      </Link>

      {student && (
        <DashboardHero
          bg="var(--hymn-navy)"
          orbTint="bg-blue-500/10"
          avatar={
            student.photoUrl ? (
              <Image src={student.photoUrl.startsWith('http') ? student.photoUrl : API_ORIGIN + student.photoUrl} alt="" width={64} height={64} className="h-16 w-16 object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center bg-white/10 text-xl font-bold text-white">
                {student.firstName[0]}{student.lastName[0]}
              </div>
            )
          }
          title={
            <span>
              {(lang === 'ar' && student.firstNameAr) ? `${student.firstNameAr} ${student.lastNameAr}` : `${student.firstName} ${student.lastName}`}
              {student.firstNameAr && <span className="opacity-60 text-sm font-normal"> {lang === 'ar' ? `${student.firstName} ${student.lastName}` : `${student.firstNameAr} ${student.lastNameAr}`}</span>}
            </span>
          }
          badges={
            <span className="text-white/60 text-sm">
              {t('Level', 'المستوى')} {student.levelNumber} — {student.groupName} · {t('Code', 'الكود')}: {student.studentCode}
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowReportModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200">
              <FileText className="w-3.5 h-3.5" />
              {t('Term Report', 'تقرير الفصل')}
            </button>
            <button onClick={() => setShowArchive(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200">
              <FileText className="w-3.5 h-3.5" />
              {t('Formation Archive', 'أرشيف التكوين')}
            </button>
          </div>
        </DashboardHero>
      )}

      {/* Gamification bar */}
      {gamification && (gamification.rank != null || gamification.totalPoints != null || gamification.badges != null) && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-800">{t('Gamification', 'الألعاب التحفيزية')}</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {gamification.rank != null && gamification.totalStudents != null && (
              <div className="rounded-lg bg-white/70 border border-gold-100 p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">#{gamification.rank}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('Rank', 'الترتيب')} / {gamification.totalStudents}</div>
              </div>
            )}
            {gamification.totalPoints != null && (
              <button type="button" onClick={() => openDrill('xp')}
                className="rounded-lg bg-white/70 border border-gold-100 p-3 text-center transition-colors hover:bg-white"
                title={t('View XP details', '\u0639\u0631\u0636 \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0646\u0642\u0627\u0637')}>
                <div className="text-2xl font-bold text-amber-600">{gamification.totalPoints}</div>
                <div className="text-xs text-gray-500 mt-0.5">XP</div>
                {gamification.xpToNextLevel != null && (
                  <div className="mt-1 h-1.5 rounded-full bg-gold-200/50 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-blue-500" style={{ width: `${Math.min(100, ((gamification.totalPoints || 0) % 1000) / 10)}%` }} />
                  </div>
                )}
              </button>
            )}
            {gamification.badges != null && (
              <button type="button" onClick={() => openDrill('badges')}
                className="rounded-lg bg-white/70 border border-gold-100 p-3 text-center transition-colors hover:bg-white"
                title={t('View badges', '\u0639\u0631\u0636 \u0627\u0644\u0634\u0627\u0631\u0627\u062a')}>
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-purple-700">
                  <Crown className="h-5 w-5" /> {gamification.badges}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{t('Badges', 'الشارات')}</div>
              </button>
            )}
          </div>
        </div>
      )}

      {drill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDrill(null)}>
          <div role="dialog" aria-modal="true" className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h3 className="font-semibold text-gray-900">
                {drill === 'xp' ? t('XP History', 'سجل النقاط') : t('Earned Badges', 'الشارات المكتسبة')}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setDrill(null)} aria-label={t('Close', 'إغلاق')}><X className="h-4 w-4" /></Button>
            </div>
            <div className="max-h-[60vh] divide-y divide-gray-50 overflow-y-auto">
              {drillLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('Loading…', 'جاري التحميل…')}
                </div>
              )}
              {!drillLoading && drill === 'xp' && xpItems.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">{t('No XP activity yet.', 'لا يوجد نشاط نقاط بعد.')}</p>
              )}
              {!drillLoading && drill === 'xp' && xpItems.map(x => (
                <div key={x.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{x.description || x.type}</div>
                    <div className="text-xs text-gray-500">{new Date(x.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${x.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {x.amount >= 0 ? '+' : ''}{x.amount}
                  </span>
                </div>
              ))}
              {!drillLoading && drill === 'badges' && badgeItems.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">{t('No badges earned yet.', 'لم يتم كسب شارات بعد.')}</p>
              )}
              {!drillLoading && drill === 'badges' && badgeItems.map(b => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-100 text-lg">
                    {b.badge.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.badge.iconUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Crown className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {lang === 'ar' && b.badge.nameAr ? b.badge.nameAr : b.badge.name}
                    </div>
                    {b.badge.description && <div className="truncate text-xs text-gray-500">{b.badge.description}</div>}
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{new Date(b.awardedAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PracticeTogetherCard childId={id as string} language={lang} />
      <LiturgySection childId={id as string} language={lang} />
      <MilestonesSection childId={id as string} language={lang} />

      <nav className="flex gap-6 overflow-x-auto border-b border-gray-200">
        {tabs.map(t => {
          const isActive = tab === t.id
          return (
            <Button key={t.id} onClick={() => setTab(t.id)}
              aria-current={isActive ? 'page' : undefined}
              variant="ghost"
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 ${
                isActive ? 'border-gold-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon className={`h-4 w-4 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
              {t.label}
              {t.id === 'attendance' && <span className="text-xs text-gray-400">({attendance.length})</span>}
              {t.id === 'assessments' && <span className="text-xs text-gray-400">({assessments.length})</span>}
            </Button>
          )
        })}
      </nav>

      {/* Attendance Tab */}
      {tab === 'attendance' && (
        <div className="space-y-3">
          {attendance.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <Calendar className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">{t('No attendance records yet', 'لا توجد سجلات حضور بعد')}</p>
            </div>
          ) : (
            attendance.map(r => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                    {r.levelNumber && <span className="text-xs text-gray-400">Level {r.levelNumber}</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {r.date ? new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                     {r.homeworkStatus && r.homeworkStatus !== 'not_assigned' && <span className="ml-2">• {t('HW', 'واجب')}: {r.homeworkStatus}</span>}
                  </p>
                  {r.note && <p className="text-sm text-gray-400 mt-0.5 italic">{r.note}</p>}
                </div>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  r.status === 'present' ? 'bg-green-100 text-green-600' :
                  r.status === 'late' ? 'bg-amber-100 text-amber-600' :
                  r.status === 'absent' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {r.status === 'present' ? <CheckCircle2 className="h-4 w-4" /> :
                   r.status === 'late' ? <Clock className="h-4 w-4" /> :
                   r.status === 'absent' ? <XCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Assessments Tab */}
      {tab === 'assessments' && (
        <div className="space-y-3">
          {assessments.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <ClipboardCheck className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">{t('No assessment results yet', 'لا توجد نتائج تقييم بعد')}</p>
            </div>
          ) : (
            assessments.map(a => (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900">{lang === 'ar' && a.titleAr ? a.titleAr : a.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                      {a.subject && <span>{a.subject}</span>}
                      <span className={`font-medium ${a.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {a.passed ? t('Passed', 'ناجح') : t('Not passed', 'غير ناجح')}
                      </span>
                      <span>{t('Score', 'الدرجة')}: {a.score}/{a.maxScore} ({a.percentage}%)</span>
                    </div>
                  </div>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                    a.percentage >= 80 ? 'bg-green-100 text-green-700' :
                    a.percentage >= 50 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {a.percentage}%
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${
                    a.percentage >= 80 ? 'bg-green-500' :
                    a.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`} style={{ width: `${a.percentage}%` }} />
                </div>
                {a.referenceRecordingUrl && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">
                      {a.referenceRecordingName || t('Reference recording', 'تسجيل المرجع')}
                    </div>
                    <audio controls className="w-full h-8"
                      src={a.referenceRecordingUrl.startsWith('http') ? a.referenceRecordingUrl : `${API_ORIGIN}${a.referenceRecordingUrl}`} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Practice Tab */}
      {tab === 'practice' && (
        <PracticePanel childId={id as string} lang={lang} />
      )}

      {/* Progress Tab */}
      {tab === 'progress' && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gold-700" /> {t('Recent Sessions', 'الجلسات الأخيرة')}
            </h3>
            {!progress || progress.sessions.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t('No completed sessions', 'لا توجد جلسات مكتملة')}</p>
            ) : (
              <div className="space-y-2">
                {progress.sessions.slice(0, 10).map(s => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-gray-600">
                      {new Date(s.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                     <span className="text-gray-400 text-xs">{t('Session completed', 'تمت الجلسة')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-gold-700" /> {t('Assessment Progress', 'تقدم التقييمات')}
            </h3>
            {!progress || progress.assessments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t('No graded assessments', 'لا توجد تقييمات مصححة')}</p>
            ) : (
              <div className="space-y-2">
                {progress.assessments.map(a => {
                  const totalScore = a.grades.reduce((s, g) => s + Number(g.score), 0)
                  const maxScore = a.grades.reduce((s, g) => s + Number(g.maxScore), 0)
                  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
                  return (
                    <div key={a.id} className="flex items-center gap-3 text-sm">
                      <div className={`h-2 w-2 rounded-full ${pct >= 50 ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-gray-600">Score: {pct}%</span>
                      <span className="text-gray-400 text-xs">
                        {new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  )
                  })}
              </div>
            )}
          </div>
        </div>
      )}
      <TermReportModal childId={id as string} language={lang} open={showReportModal} onClose={() => setShowReportModal(false)} />
      <FormationArchiveModal childId={id as string} childName={student ? (lang === 'ar' && student.firstNameAr ? `${student.firstNameAr} ${student.lastNameAr}` : `${student.firstName} ${student.lastName}`) : ''} open={showArchive} onClose={() => setShowArchive(false)} />
    </div>
  )
}

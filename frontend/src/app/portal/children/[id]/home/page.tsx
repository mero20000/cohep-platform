'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'
import {
  ArrowLeft, Loader2, Star, Flame, Trophy, Music, CheckCircle2,
  Circle, ChevronRight, Sparkles, Crown, Calendar, Zap,
  BookOpen, Award, Music2, Cross, Heart, Clock
} from 'lucide-react'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')

// Icon map matching the backend badge icon names
const ICON_COMPONENTS: Record<string, React.ElementType> = {
  Trophy, Star, Flame, Music, Award, Crown, Zap, Sparkles,
  Calendar, BookOpen, Heart, Cross, Music2, CheckCircle2,
}

function BadgeIcon({ icon, className = '' }: { icon?: string; className?: string }) {
  if (icon && ICON_COMPONENTS[icon]) {
    const Icon = ICON_COMPONENTS[icon]
    return <Icon className={className} />
  }
  return <Trophy className={className} />
}

interface HomeData {
  student: {
    id: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string
    photoUrl?: string; studentCode: string; levelNumber?: number; levelName?: string; groupName?: string
  }
  xp: { total: number; level: number; inCurrentLevel: number; toNextLevel: number }
  streak: number
  badges: Array<{ id: string; badgeId: string; name: string; description?: string; category: string; icon?: string; xpReward: number; earnedAt: string }>
  attendance: { present: number; total: number; rate: number }
  journey: Array<{ id: string; name: string; nameAr?: string; nameCoptic?: string; subject?: string; subjectAr?: string; status: 'completed' | 'current' | 'upcoming' }>
  challenge: { title: string; titleAr: string; description: string; descriptionAr: string; icon: string }
  recentActivity: Array<{ amount: number; type: string; description?: string; date: string }>
  /* Phase A de-silo: same mastery model the student portal uses */
  mastery?: {
    stats: { totalHymns?: number; masteredHymns?: number; dueForReview?: number } | null
    dueReviewCount: number
    bySubject: Array<{ subjectId: string; subjectName: string; total: number; learned: number; inProgress: number; notStarted: number }>
  }
  /* Listening Loop: recent servant reviews of practice recordings */
  recentFeedback?: Array<{
    hymnTitle: string
    servantRating: number | null
    servantNote: string | null
    reviewedAt: string
  }>
}

// ── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return }
    const start = Date.now()
    const step = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration])
  return <>{display.toLocaleString('en-GB')}</>
}

// ── XP Bar ───────────────────────────────────────────────────────────────────
function XpBar({ inLevel, toNext, level }: { inLevel: number; toNext: number; level: number }) {
  const pct = Math.min(100, Math.max(0, Math.round((inLevel / Math.max(toNext + inLevel, 100)) * 100)))
  const [width, setWidth] = useState(0)
  useEffect(() => { setTimeout(() => setWidth(pct), 100) }, [pct])
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-white/90">Level {level}</span>
        <span className="text-white/60">{toNext} XP to Level {level + 1}</span>
      </div>
      <div className="h-3 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 transition-all duration-1000 ease-out shadow-inner"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="text-right text-xs text-white/50">{inLevel}/100 XP this level</div>
    </div>
  )
}

// ── Weekly rhythm badge (grace-mode) ─────────────────────────────────────────
// Module 1 decision: rhythm invites, never shames. A zero week is a fresh
// start, not a broken flame.
function StreakBadge({ streak, lang = 'en' }: { streak: number; lang?: 'en' | 'ar' }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  if (streak === 0) return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 px-5 py-4 text-center max-w-[9rem]">
      <Flame className="h-8 w-8 text-gold-300/70" aria-hidden="true" />
      <div className="text-sm font-semibold text-white/90 leading-snug">{t('A fresh week', 'أسبوع جديد')}</div>
      <div className="text-[11px] text-white/50 leading-snug">{t('Sing one hymn to begin your rhythm.', 'رنّم ترنيمة واحدة لتبدأ إيقاعك.')}</div>
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-b from-orange-400/30 to-red-500/20 border border-orange-300/20 px-5 py-4 text-center animate-pulse-slow">
      <Flame className={`h-8 w-8 ${streak >= 7 ? 'text-orange-300' : 'text-orange-400/80'} drop-shadow`} aria-hidden="true" />
      <div className="text-2xl font-black text-white">{streak}</div>
      <div className="text-xs text-orange-200 font-medium">{t('day rhythm', 'يوم إيقاع')}</div>
    </div>
  )
}

// ── Journey node ─────────────────────────────────────────────────────────────
function JourneyNode({ item, index, isLast }: { item: HomeData['journey'][0]; index: number; isLast: boolean }) {
  const isCompleted = item.status === 'completed'
  const isCurrent = item.status === 'current'

  return (
    <div className="flex gap-4 group">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-lg transition-all ${
          isCompleted ? 'bg-green-400 border-green-300 shadow-green-400/40' :
          isCurrent   ? 'bg-gradient-to-br from-amber-400 to-orange-400 border-amber-300 shadow-amber-400/40 ring-4 ring-amber-300/30 animate-bounce-slow' :
                        'bg-white/10 border-white/20'
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-white" />
          ) : isCurrent ? (
            <Music className="h-5 w-5 text-white" />
          ) : (
            <Circle className="h-5 w-5 text-white/30" />
          )}
          {isCurrent && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 border border-white text-[8px] font-black text-white">▶</span>
          )}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[24px] ${isCompleted ? 'bg-green-400/50' : 'bg-white/10'}`} />
        )}
      </div>

      {/* Content */}
      <div className={`pb-5 flex-1 min-w-0 ${isCurrent ? 'mb-2' : ''}`}>
        <div className={`rounded-xl p-3.5 transition-all ${
          isCompleted ? 'bg-green-500/10 border border-green-400/20' :
          isCurrent   ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-400/30 shadow-lg shadow-amber-500/10' :
                        'bg-white/5 border border-white/10'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {item.subject && (
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-0.5">{item.subject}</p>
              )}
              <h3 className={`text-sm font-bold leading-tight ${
                isCompleted ? 'text-green-300' : isCurrent ? 'text-amber-200' : 'text-white/40'
              }`}>
                {item.name}
              </h3>
              {item.nameCoptic && (
                <p className="text-xs text-white/30 mt-0.5">{item.nameCoptic}</p>
              )}
            </div>
            {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />}
            {isCurrent && <ChevronRight className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />}
          </div>
          {isCurrent && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                ▶ Currently learning
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StudentHomePage() {
  const { id } = useParams()
  const lang = useLanguage()
  const t = useCallback((en: string, ar: string) => lang === 'ar' ? ar : en, [lang])
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'journey' | 'badges' | 'activity'>('journey')
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    http.get<HomeData>(`/parents/me/children/${id}/home`)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message || 'Failed to load'); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-950 to-purple-950">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 animate-pulse">
          <Music className="h-8 w-8 text-amber-300" />
        </div>
        <p className="text-white/60 text-sm">{t('Loading...', 'جاري التحميل...')}</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-950 to-purple-950">
      <div className="text-center">
        <p className="text-red-300 text-sm mb-4">{error || 'No data'}</p>
        <Link href={`/portal/children/${id}`} className="text-white/60 text-sm underline">
          {t('Go back', 'العودة')}
        </Link>
      </div>
    </div>
  )

  const { student, xp, streak, badges, attendance, journey, challenge, recentActivity } = data
  const name = lang === 'ar' && student.firstNameAr ? student.firstNameAr : student.firstName
  const completedHymns = journey.filter(j => j.status === 'completed').length
  const currentHymn = journey.find(j => j.status === 'current')

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-indigo-950" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <div ref={headerRef} className="relative overflow-hidden px-4 pt-6 pb-8">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-400/10 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-xl mx-auto">
          {/* Back + school micro-pill */}
          <div className="flex items-center justify-between gap-2 mb-6">
            <Link href={`/portal/children/${id}`}
              className="inline-flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-full px-2 py-1 -ml-2">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t('Back', 'رجوع')}
            </Link>
            {data?.student?.groupName && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-xs font-medium text-white/60">
                {student.groupName ?? ''}
              </span>
            )}
          </div>

          {/* Student identity */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xl font-black shadow-lg shadow-amber-500/30 overflow-hidden flex-shrink-0">
                {student.photoUrl ? (
                  <Image src={student.photoUrl.startsWith('http') ? student.photoUrl : API_ORIGIN + student.photoUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
                ) : (
                  <span>{name[0]}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 border-2 border-indigo-950 text-[10px] font-black text-white">
                {xp.level}
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white leading-tight">
                {t(`Hey, ${name}!`, `أهلاً، ${name}!`)} <span aria-hidden="true">👋</span>
              </h1>
              <p className="text-white/50 text-sm mt-0.5">
                {t(`Level ${student.levelNumber || xp.level} · ${student.groupName || 'Hymn School'}`,
                   `المستوى ${student.levelNumber || xp.level} · ${student.groupName || 'مدرسة التراتيل'}`)}
              </p>
            </div>
          </div>

          {/* XP bar */}
          <XpBar inLevel={xp.inCurrentLevel} toNext={xp.toNextLevel} level={xp.level} />
        </div>
      </div>

      {/* ── STATS ROW ───────────────────────────────────────────────── */}
      <div className="px-4 -mt-2 mb-6">
        <div className="max-w-xl mx-auto grid grid-cols-3 gap-3">
          {/* Total XP */}
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/8 border border-white/10 px-3 py-4 text-center">
            <Star className="h-6 w-6 text-yellow-400" />
            <div className="text-xl font-black text-white"><AnimatedNumber value={xp.total} /></div>
            <div className="text-xs text-white/40 font-medium">Total XP</div>
          </div>
          {/* Streak */}
          <StreakBadge streak={streak} lang={lang === 'ar' ? 'ar' : 'en'} />
          {/* Badges */}
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/8 border border-white/10 px-3 py-4 text-center">
            <Trophy className="h-6 w-6 text-amber-400" />
            <div className="text-xl font-black text-white"><AnimatedNumber value={badges.length} /></div>
            <div className="text-xs text-white/40 font-medium">{t('Badges', 'شارات')}</div>
          </div>
        </div>
      </div>

      {/* ── SEASONAL CHALLENGE ──────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <div className="max-w-xl mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-400/20 p-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">{challenge.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {t('Current Challenge', 'التحدي الحالي')}
                </span>
              </div>
              <h3 className="text-sm font-bold text-amber-200">
                {lang === 'ar' ? challenge.titleAr : challenge.title}
              </h3>
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                {lang === 'ar' ? challenge.descriptionAr : challenge.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── CURRENT HYMN CARD ────────────────────────────────────────── */}
      {currentHymn && (
        <div className="px-4 mb-6">
          <div className="max-w-xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-white/30 mb-2 px-1">
              {t('Now Learning', 'تتعلم الآن')}
            </p>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/20 border border-purple-400/20 p-5">
              <div className="absolute top-0 right-0 h-32 w-32 bg-purple-400/10 rounded-full blur-2xl" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-400/20">
                  <Music className="h-7 w-7 text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-purple-300/70 mb-0.5">{currentHymn.subject}</p>
                  <h3 className="text-base font-bold text-white leading-tight">{currentHymn.name}</h3>
                  {currentHymn.nameCoptic && (
                    <p className="text-sm text-purple-300/60 mt-0.5">{currentHymn.nameCoptic}</p>
                  )}
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all cursor-pointer">
                  <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                </div>
              </div>
              {/* Progress of hymns completed */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
                  <span>{completedHymns} of {journey.length} hymns learned</span>
                  <span>{Math.round((completedHymns / Math.max(journey.length, 1)) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 transition-all duration-1000"
                    style={{ width: `${(completedHymns / Math.max(journey.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ────────────────────────────────────────────────────── */}
      <div className="px-4 mb-4">
        <div className="max-w-xl mx-auto flex gap-2">
          {([
            { id: 'journey', label: t('My Journey', 'رحلتي'), icon: BookOpen },
            { id: 'badges', label: t('Badges', 'شاراتي'), icon: Trophy },
            { id: 'activity', label: t('Activity', 'النشاط'), icon: Zap },
          ] as const).map(tab => (
              <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 flex-1 justify-center rounded-xl px-3 py-2.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                activeTab === tab.id
                  ? 'bg-white/15 text-white border border-white/20 shadow-inner'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────────── */}
      <div className="px-4 pb-16">
        <div className="max-w-xl mx-auto">

          {/* Journey Tab */}
          {activeTab === 'journey' && (
            <div>
              {/* Mastery by subject — one progress story shared with the student portal */}
              {data.mastery?.bySubject?.length ? (
                <div className="mb-5 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">{t('Mastery Progress', 'تقدم الإتقان')}</h3>
                  <div className="space-y-3">
                    {data.mastery.bySubject.map(sub => {
                      const pct = sub.total ? Math.round(((sub.learned + sub.inProgress * 0.5) / sub.total) * 100) : 0
                      return (
                        <div key={sub.subjectId}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-white/70">{sub.subjectName}</span>
                            <span className="text-white/50 tabular-nums">{sub.learned}/{sub.total} {t('mastered', 'متقن')}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {!!data.mastery.dueReviewCount && data.mastery.dueReviewCount > 0 && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-gold-300">
                      <Clock className="h-3.5 w-3.5" />
                      {t(`${data.mastery.dueReviewCount} hymns ready for review today`, `${data.mastery.dueReviewCount} ترنيمة جاهزة للمراجعة اليوم`)}
                    </p>
                  )}
                 </div>
               ) : null}
               {/* Listening Loop: servant feedback on practice recordings */}
               {!!data.recentFeedback?.length && (
                 <div className="mb-5 rounded-2xl bg-white/5 border border-white/10 p-4">
                   <h3 className="text-sm font-semibold text-white mb-3">{t('Notes from Your Servant', 'رسائل من خادمك')}</h3>
                   <ul className="space-y-3">
                     {data.recentFeedback.map((fb, i) => (
                       <li key={i} className="rounded-xl bg-white/5 border border-white/10 p-3">
                         <div className="flex items-center justify-between gap-2 mb-1">
                           <span className="text-sm font-medium text-white truncate">{fb.hymnTitle}</span>
                           <span className="inline-flex shrink-0" aria-label={`${fb.servantRating ?? 0} of 5 stars`}>
                             {Array.from({ length: 5 }).map((_, si) => (
                               <Star key={si} aria-hidden="true"
                                 className={`h-3.5 w-3.5 ${si < (fb.servantRating ?? 0) ? 'text-gold-400 fill-gold-400' : 'text-white/20'}`} />
                             ))}
                           </span>
                         </div>
                         {fb.servantNote && (
                           <p className="text-sm text-white/80 leading-relaxed">“{fb.servantNote}”</p>
                         )}
                         <p className="mt-1 text-[11px] text-white/40">
                           {new Date(fb.reviewedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long' })}
                         </p>
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
               {journey.length === 0 ? (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                  <Music className="mx-auto h-10 w-10 text-white/20 mb-3" />
                  <p className="text-white/40 text-sm">{t('Your hymn journey will appear here once your teacher sets up the curriculum.', 'رحلة التراتيل ستظهر هنا بمجرد إعداد المنهج.')}</p>
                </div>
              ) : (
                <div className="pt-2">
                  {/* Summary pill */}
                  <div className="mb-5 flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-4 py-2 w-fit">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-white/70">
                      <span className="font-bold text-white">{completedHymns}</span> {t('of', 'من')} <span className="font-bold text-white">{journey.length}</span> {t('hymns completed', 'ترنيمة مكتملة')}
                    </span>
                  </div>
                  {journey.map((item, i) => (
                    <JourneyNode key={item.id} item={item} index={i} isLast={i === journey.length - 1} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Badges Tab */}
          {activeTab === 'badges' && (
            <div>
              {badges.length === 0 ? (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                  <Trophy className="mx-auto h-10 w-10 text-white/20 mb-3" />
                  <p className="text-white/40 text-sm">{t('Your badges will appear here. Keep attending and practicing to earn them!', 'شاراتك ستظهر هنا. استمر في الحضور والتدريب لكسبها!')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {badges.map(badge => (
                    <div key={badge.id} className="rounded-2xl bg-white/8 border border-white/10 p-4 flex flex-col items-center gap-2 text-center hover:bg-white/12 transition-all">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-lg ${
                        badge.category === 'attendance' ? 'bg-green-500/20 shadow-green-500/20' :
                        badge.category === 'assessment' ? 'bg-blue-500/20 shadow-blue-500/20' :
                        badge.category === 'streak' ? 'bg-orange-500/20 shadow-orange-500/20' :
                        badge.category === 'liturgy' ? 'bg-purple-500/20 shadow-purple-500/20' :
                        'bg-amber-500/20 shadow-amber-500/20'
                      }`}>
                        <BadgeIcon icon={badge.icon} className={`h-6 w-6 ${
                          badge.category === 'attendance' ? 'text-green-300' :
                          badge.category === 'assessment' ? 'text-blue-300' :
                          badge.category === 'streak' ? 'text-orange-300' :
                          badge.category === 'liturgy' ? 'text-purple-300' :
                          'text-amber-300'
                        }`} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white leading-tight">{badge.name}</h3>
                        {badge.description && (
                          <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{badge.description}</p>
                        )}
                        <div className="mt-1.5 flex items-center justify-center gap-1 text-xs text-amber-400/80 font-semibold">
                          <Star className="h-2.5 w-2.5" />
                          +{badge.xpReward} XP
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              {/* Attendance summary */}
              <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-bold text-white">{t('Attendance', 'الحضور')}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xl font-black text-green-400">{attendance.rate}%</div>
                    <div className="text-xs text-white/40">{t('Rate', 'النسبة')}</div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{attendance.present}</div>
                    <div className="text-xs text-white/40">{t('Present', 'حضور')}</div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{attendance.total}</div>
                    <div className="text-xs text-white/40">{t('Total', 'إجمالي')}</div>
                  </div>
                </div>
              </div>

              {/* Recent XP activity */}
              <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">{t('Recent XP', 'آخر نقاط')}</span>
                </div>
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-4">{t('No activity yet — attend class to earn XP!', 'لا نشاط بعد — احضر الدرس لكسب نقاط!')}</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((act, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-white/80">
                            {act.description || act.type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-white/30">
                            {new Date(act.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/20 px-2.5 py-0.5">
                          <Star className="h-3 w-3 text-amber-400" />
                          <span className="text-xs font-bold text-amber-300">+{act.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

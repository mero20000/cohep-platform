'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { http } from '@/lib/http-client'
import { ensurePortalSession, clearPortalSession, portalGet } from '@/lib/portal-session'
import { assetUrl } from '@/lib/asset-url'
import { AudioPlayer } from '@/components/audio-player'
import DashboardHero from '../../dashboard/hero'
import { useLanguage } from '@/lib/use-language'
import { getGreeting, getGreetingAr } from '@/lib/datetime'
import { markLessonCompleted } from '@/lib/use-install-prompt'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')
import {
  Cross, Loader2, Calendar, Church, CheckCircle2, XCircle, Clock, AlertCircle,
  Award, Star, BookOpen, ArrowLeft, Trophy, Play, Music,
  ChevronDown, ChevronRight, Search, Filter, ClipboardCheck, MoreVertical, LogOut, Eye, EyeOff, TrendingUp,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useStudentHymnMap, useStudentThisSunday, useStudentDueReview, useStudentStats, useStudentPractice, useStudentAchievements } from '@/components/hymn-learning/student-hooks'
import { ThisSundayPanel } from '@/components/hymn-learning/this-sunday'
import { PracticeRecorder } from '@/components/hymn-learning/practice-recorder'
import { PracticeHistory } from '@/components/hymn-learning/practice-history'
import { MASTERY_META, type HymnMapItem } from '@/components/hymn-learning/hooks'

interface PortalData {
  student: {
    id: string; firstName: string; lastName: string; firstNameAr?: string; lastNameAr?: string;
    studentCode: string; photoUrl?: string;
    level: { id: string; name: string; number: number; nameAr?: string };
    group: { id: string; name: string; nameAr?: string };
  }
  school: {
    name: string; nameAr?: string; logoUrl?: string;
    churchName?: string; churchNameAr?: string; churchLogoUrl?: string | null;
  } | null
  attendance: { present: number; late: number; absent: number; excused: number; total: number }
  recentAttendance: Array<{ date: string; time?: string; status: string; homeworkStatus?: string }>
  badges: Array<{ id: string; name?: string; nameAr?: string; description?: string; iconUrl?: string; earnedAt: string; awardedBy?: string | null; reason?: string | null }>
  liturgy: { verifiedCount: number; pendingCount: number; recent: Array<{ date: string; status: string; servantNote?: string | null }> }
  totalXp: number
  upcomingSessions: Array<{ id: string; date: string; time?: string; title?: string }>
  recentHomework: Array<{ date: string; status: string }>
  assessments: Array<{
    id: string; title: string; titleAr?: string; type: string;
    totalPoints: number; passingScore: number; dueDate?: string;
    level: { id: string; name: string };
    subject: { id: string; name: string; nameAr?: string };
    submissionStatus: string; submissionId: string; submittedAt: string;
    earnedScore?: number | null;
  }>
}

const STATUS_ICONS: Record<string, any> = { present: CheckCircle2, late: Clock, absent: XCircle, excused: AlertCircle }
const STATUS_COLORS: Record<string, string> = {
  present: 'text-green-600 bg-green-50', late: 'text-amber-600 bg-amber-50',
  absent: 'text-red-600 bg-red-50', excused: 'text-gray-700 bg-gray-100',
}
const HW_COLORS: Record<string, string> = {
  completed: 'text-green-700 bg-green-100', partial: 'text-amber-700 bg-amber-100',
  not_submitted: 'text-red-700 bg-red-100',
}

interface SubjectItemEntry {
  subjectItem: { id: string; name: string; nameAr?: string; nameCoptic?: string }
  status: 'passed' | 'not_started'
  passedAt?: string | null
  history: unknown[]
}

type Tab = 'dashboard' | 'practice' | 'assessments'

export default function StudentDashboard() {
  const params = useParams()
  const code = params?.code as string
  const lang = useLanguage() as string
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showName, setShowName] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [subjectItems, setSubjectItems] = useState<SubjectItemEntry[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  // Practice state
  const [practiceLesson, setPracticeLesson] = useState<HymnMapItem | null>(null)
  const [celebration, setCelebration] = useState<{ title: string; titleCoptic?: string } | null>(null)
  const [drill, setDrill] = useState<null | 'xp' | 'badges' | 'attendance' | 'homework'>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && drill) setDrill(null) }
    if (drill) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [drill])

  const toggleLanguage = () => {
    const newLang = lang === 'en' ? 'ar' : 'en'
    localStorage.setItem('niangelos_language', newLang)
    window.dispatchEvent(new CustomEvent('langchange', { detail: newLang }))
    document.documentElement.lang = newLang
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
  }
  const { data: achievements } = useStudentAchievements(code, drill === 'xp')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMastery, setFilterMastery] = useState('')
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!code) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await portalGet<PortalData>(code, `/student-portal/${encodeURIComponent(code)}`)
        if (!cancelled) setData(data)
      } catch (e: any) {
        // No valid session at all (bad/expired key): send to the login page.
        try { sessionStorage.removeItem('student_portal_token') } catch {}
        if (!cancelled) setError(e?.message || 'Student not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [code])

  useEffect(() => {
    if (!code) return
    let cancelled = false
    portalGet<SubjectItemEntry[]>(code, `/student-portal/${encodeURIComponent(code)}/subject-items`)
      .then(items => { if (!cancelled) setSubjectItems(Array.isArray(items) ? items : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [code])

  // Practice hooks
  const { data: hymnMap, isLoading: hymnMapLoading } = useStudentHymnMap(code)
  const { data: sundayData, isLoading: sundayLoading } = useStudentThisSunday(code)
  const { data: dueReview } = useStudentDueReview(code)
  const { data: stats } = useStudentStats(code)
  const practiceMutation = useStudentPractice(code)

  const handleSelectHymn = (id: string, title: string, audioUrl?: string) => {
    if (!hymnMap) return
    const hymn = hymnMap.find(h => h.id === id)
    if (hymn) setPracticeLesson(hymn)
  }

  // Extract audio URL from resources array
  const getAudioUrl = (hymn: HymnMapItem): string | undefined => {
    return hymn.resources?.find(r => r.type === 'audio')?.fileUrl ?? undefined
  }

  const handleSubmitPractice = async (selfRating: number, recordingUrl?: string, durationSec?: number) => {
    if (!practiceLesson) return
    try {
      const before = practiceLesson.progress?.masteryStatus ?? 'not_started'
      const res: any = await practiceMutation.mutateAsync({
        lessonId: practiceLesson.id,
        selfRating,
        recordingUrl,
        durationSec,
      })
      // Celebration moment: first time a hymn becomes known/mastered
      const after = (res?.mastery ?? res?.progress?.masteryStatus) as string | undefined
      if ((after === 'known' || after === 'mastered') && !['known', 'mastered'].includes(before)) {
        setCelebration({ title: practiceLesson.title, titleCoptic: practiceLesson.titleCoptic })
        setTimeout(() => setCelebration(null), 3000)
      }
      markLessonCompleted()
      setPracticeLesson(null)
    } catch (err: any) {
      console.error('Practice mutation failed:', err)
      throw err
    }
  }

  // Filter and group hymns — curriculum-scoped: own level and below only
  const myLevelNumber = data?.student?.level?.number ?? null
  const filteredHymns = (hymnMap || []).filter(h => {
    if (myLevelNumber != null && h.level.number > myLevelNumber) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match = h.title.toLowerCase().includes(q) ||
        h.titleAr?.toLowerCase().includes(q) ||
        h.titleCoptic?.toLowerCase().includes(q)
      if (!match) return false
    }
    if (filterMastery) {
      const status = h.progress?.masteryStatus ?? 'not_started'
      if (status !== filterMastery) return false
    }
    return true
  })

  const groupedByLevel = filteredHymns.reduce((acc, h) => {
    const key = `${h.level.number} - ${h.level.name}`
    if (!acc[key]) acc[key] = []
    acc[key].push(h)
    return acc
  }, {} as Record<string, HymnMapItem[]>)

  const toggleLevel = (level: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold-700 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Loading your dashboard...</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Could not load dashboard</h2>
        <p className="text-sm text-gray-500 mb-4">{error || 'Check your student code and try again.'}</p>
        <Link href="/student-portal/login" className="text-sm text-blue-600 hover:underline">Go back to login</Link>
      </div>
    </div>
  )

  const { student, school, attendance, recentAttendance, badges, totalXp, upcomingSessions, recentHomework, assessments } = data
  // Tolerate older backend payloads without the liturgy block
  const liturgy = data.liturgy ?? { verifiedCount: 0, pendingCount: 0, recent: [] }
  const attendanceRate = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0

  const photoSrc = student.photoUrl
    ? (student.photoUrl.startsWith('http') ? student.photoUrl : `${API_ORIGIN}${student.photoUrl}`)
    : null

  const displayName = showName ? (lang === 'ar' && student.firstNameAr ? `${student.firstNameAr} ${student.lastNameAr || ''}`.trim() : `${student.firstName} ${student.lastName}`) : null
  const xpPct = totalXp ? Math.min(100, (totalXp % 100)) : 0
  return (
    <div className="min-h-screen bg-gray-50" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header — hymn-navy, DashboardHero language */}
      <header className="relative overflow-hidden rounded-b-[28px] sm:rounded-b-2xl px-5 pt-6 pb-7 sm:px-6 sm:py-8" style={{ backgroundColor: 'var(--hymn-navy)' }}>
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" aria-hidden="true" />
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:18px_18px]" aria-hidden="true" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
        <div className="relative max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/student-portal/login"
              onClick={() => { try { sessionStorage.removeItem('student_portal_token') } catch {} }}
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-full px-2 py-1 -ml-2"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {lang === 'ar' ? 'خروج' : 'Sign Out'}
            </Link>
            <button onClick={toggleLanguage} aria-label={lang === 'ar' ? 'Switch to English' : 'Switch to Arabic'} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 text-xs font-bold">
              {lang === 'ar' ? 'EN' : 'AR'}
            </button>
            <div ref={menuRef} className="relative">
              <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" aria-expanded={menuOpen} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 rtl:left-0 rtl:right-auto top-full mt-2 w-44 rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden z-50">
                  <button onClick={() => { setShowName(v => !v); setMenuOpen(false) }} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                    {showName ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showName ? (lang === 'ar' ? 'إخفاء الاسم' : 'Hide Name') : (lang === 'ar' ? 'إظهار الاسم' : 'Show Name')}
                  </button>
                  <Link href="/student-portal/login" onClick={() => { try { sessionStorage.removeItem('student_portal_token') } catch {} }} className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> {lang === 'ar' ? 'خروج' : 'Sign Out'}
                  </Link>
                </div>
              )}
            </div>
          </div>
          {/* Church & School identity — the anchor of belonging */}
          {school && (
            <div className="mb-5 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-sm px-4 py-3.5">
              <div className="flex items-center gap-3">
                {/* Church logo */}
                <div className="relative shrink-0">
                  <div className="absolute -inset-0.5 rounded-xl bg-gold-400/30 blur-sm" aria-hidden="true" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden bg-white/10 border border-gold-300/40">
                    {school.churchLogoUrl ? (
                      <Image src={school.churchLogoUrl.startsWith('http') ? school.churchLogoUrl : `${API_ORIGIN}${school.churchLogoUrl}`}
                        alt={lang === 'ar' ? 'شعار الكنيسة' : 'Church logo'} width={56} height={56} className="h-full w-full object-contain" />
                    ) : (
                      <Cross className="h-6 w-6 text-gold-300" aria-hidden="true" />
                    )}
                  </div>
                </div>
                {/* Names */}
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-[15px] font-bold text-white leading-tight truncate">
                    {lang === 'ar' && school.churchNameAr ? school.churchNameAr : (school.churchName || school.name)}
                  </p>
                  {(school.name || school.nameAr) && (
                    <p className="text-xs text-gold-200/90 mt-0.5 truncate">
                      {lang === 'ar' && school.nameAr ? school.nameAr : school.name}
                    </p>
                  )}
                  <span className="inline-block mt-1 h-px w-16 bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" aria-hidden="true" />
                </div>
                {/* School logo (falls back to church mark if none) */}
                <div className="relative shrink-0">
                  <div className="absolute -inset-0.5 rounded-xl bg-gold-400/30 blur-sm" aria-hidden="true" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden bg-white/10 border border-white/20">
                    {school.logoUrl ? (
                      <Image src={school.logoUrl.startsWith('http') ? school.logoUrl : `${API_ORIGIN}${school.logoUrl}`}
                        alt={lang === 'ar' ? 'شعار المدرسة' : 'School logo'} width={56} height={56} className="h-full w-full object-contain" />
                    ) : (
                      <Music className="h-6 w-6 text-white/50" aria-hidden="true" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm text-2xl font-bold overflow-hidden shadow-lg shadow-black/20 shrink-0">
              {photoSrc ? (
                <Image src={photoSrc} alt="" width={64} height={64} className="h-full w-full object-cover" />
              ) : (
                <Cross className="h-7 w-7 text-white/80" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {displayName && (
                <h1 lang={lang} className="text-[1.75rem] leading-tight font-bold text-white truncate">
                  {displayName}
                </h1>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                  Level {student.level.number} · {lang === 'ar' && student.group.nameAr ? student.group.nameAr : student.group.name}
                </span>
                <span className="text-white/60 text-xs font-medium">{student.studentCode}</span>
              </div>

            </div>
          </div>
          {/* XP mini + CTA inside hero */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-white/90 flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5 text-gold-300" /> {totalXp} XP</span>
                <span className="text-white/60">{badges.length} {lang === 'ar' ? 'شارات' : 'badges'}</span>
              </div>
              <div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-amber-500 transition-all duration-700" style={{ width: `${xpPct}%` }} /></div>
            </div>
            <button onClick={() => setActiveTab('practice')} className="inline-flex items-center justify-center gap-2 rounded-full bg-gold-500 hover:bg-gold-400 text-white px-6 py-3 text-base font-bold shadow-lg shadow-black/15 active:motion-safe:scale-[0.95] motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
              <Play className="h-4 w-4 fill-white" /> {lang === 'ar' ? 'تدرّب الآن' : 'Practice Now'}
            </button>
          </div>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-0">
            {(['dashboard', 'assessments', 'practice'] as Tab[]).map(tab => {
              const pendingCount = assessments.filter(a => a.submissionStatus !== 'completed').length
              const badge = tab === 'assessments' && pendingCount > 0
                ? <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white align-middle">{pendingCount}</span>
                : null
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'dashboard' ? '📊 Dashboard' : tab === 'assessments' ? <>📋 Assessments{badge}</> : '🎵 Practice'}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ─── DASHBOARD TAB ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <>
            {(() => {
              // Engagement data: mastery readiness across the student's own
              // allocated hymns + next session encouragement.
              const myHymns = filteredHymns
              const known = myHymns.filter(h => ['known', 'mastered'].includes(h.progress?.masteryStatus ?? 'not_started')).length
              const learning = myHymns.filter(h => ['introduced', 'practicing'].includes(h.progress?.masteryStatus ?? '')).length
              const total = myHymns.length
              const masteryPct = total ? Math.round(((known + learning * 0.5) / total) * 100) : 0
              const nextSession = upcomingSessions[0]
              const subjects: Array<{ name: string; color: string; known: number; total: number }> = []
              {
                const bySubject = new Map<string, { name: string; color: string; known: number; total: number }>()
                for (const h of myHymns) {
                  const key = h.subject?.id || 'unknown'
                  if (!bySubject.has(key)) bySubject.set(key, { name: h.subject?.name || 'Hymns', color: h.subject?.color || '#3b82f6', known: 0, total: 0 })
                  const bucket = bySubject.get(key)!
                  bucket.total += 1
                  if (['known', 'mastered'].includes(h.progress?.masteryStatus ?? 'not_started')) bucket.known += 1
                }
                subjects.push(...bySubject.values())
              }
              return (
                <>
                  {/* Continue where you left off — the biggest engagement lever */}
                  {(() => {
                    const last = myHymns
                      .filter(h => h.progress?.lastAccessedAt && !['known', 'mastered'].includes(h.progress?.masteryStatus ?? 'not_started'))
                      .sort((a, b) => new Date(b.progress!.lastAccessedAt!).getTime() - new Date(a.progress!.lastAccessedAt!).getTime())[0]
                    if (!last) return null
                    return (
                      <button onClick={() => setPracticeLesson(last)}
                        className={`w-full text-left rounded-2xl border border-gold-300 bg-gradient-to-r from-gold-neutral-50 to-white p-4 hover:shadow-md active:motion-safe:scale-[0.98] motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500))]`}>
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--gold-500))] text-white shadow-sm">
                            <Play className="h-5 w-5 fill-white" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">
                              {lang === 'ar' ? 'أكمل من حيث توقفت' : 'Continue practicing'}
                            </p>
                            {last.titleCoptic && <p className="font-coptic text-sm text-gray-600 truncate">{last.titleCoptic}</p>}
                            <p className="text-base font-bold text-gray-900 truncate">{lang === 'ar' && last.titleAr ? last.titleAr : last.title}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-300 rtl:rotate-180 shrink-0" aria-hidden="true" />
                        </div>
                      </button>
                    )
                  })()}

                  {/* Next class encouragement — because the subject items are included */}
                  {nextSession && (
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-lg shadow-emerald-900/10">
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_white_1px,_transparent_1px)] bg-[length:16px_16px]" aria-hidden="true" />
                      <div className="relative">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                          <Calendar className="h-3.5 w-3.5" />
                          {lang === 'ar' ? 'الجلسة القادمة' : 'Next Class'}
                        </div>
                        <p className="mt-1 text-base font-bold">
                          {new Date(nextSession.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                          {nextSession.time ? <span className="font-medium text-emerald-100"> · {nextSession.time}</span> : null}
                        </p>
                        <p className="mt-1 text-sm text-emerald-50/90 leading-snug">
                          {total > 0
                            ? (lang === 'ar'
                                ? `ستغطي جلسنتك ترانيمك المخصصة — ${known} من ${total} جاهزة تمامًا. استمر في التدريب!`
                                : `Your class covers your assigned hymns — ${known} of ${total} fully ready${learning ? `, ${learning} almost there` : ''}. Keep practicing!`)
                            : (lang === 'ar' ? 'حضّر نفسك للجلسة القادمة!' : 'Get ready for your next class!')}
                        </p>
                        <button onClick={() => setActiveTab('practice')}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white text-emerald-800 px-5 py-2.5 min-h-12 text-sm font-bold hover:bg-emerald-50 active:motion-safe:scale-[0.96] motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                          <Play className="h-4 w-4 fill-emerald-700" />{lang === 'ar' ? 'تدرّب الآن' : 'Practice now'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Progress — visual, not just numbers */}
                  <section>
                    <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-gold-600" />
                      {lang === 'ar' ? 'تقدمك' : 'Your Progress'}
                    </h2>
                    <div className="rounded-2xl bg-white border border-gray-200 p-4">
                      <div className="flex items-center gap-4">
                        {/* Mastery ring */}
                        <div className="relative shrink-0" role="img" aria-label={`${lang === 'ar' ? 'إتقان' : 'Mastery'}: ${masteryPct}%`}>
                          <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90" aria-hidden="true">
                            <circle cx="42" cy="42" r="36" fill="none" strokeWidth="9" className="stroke-gray-100" />
                            <circle cx="42" cy="42" r="36" fill="none" strokeWidth="9" strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 36}
                              strokeDashoffset={2 * Math.PI * 36 * (1 - masteryPct / 100)}
                              className="stroke-[rgb(var(--gold-500))] motion-safe:transition-all motion-safe:duration-700" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg font-black text-gray-900 tabular-nums">{masteryPct}%</span>
                            <span className="text-[10px] font-medium text-gray-400">{lang === 'ar' ? 'إتقان' : 'mastery'}</span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {lang === 'ar' ? `${known} من ${total} ترنيمة متقنة` : `${known} of ${total} hymns mastered`}
                          </p>
                          <p className="text-xs text-gray-500 mb-2">
                            {learning > 0
                              ? (lang === 'ar' ? `${learning} قيد التعلم — استمر!` : `${learning} in progress — keep going!`)
                              : (lang === 'ar' ? 'ابدأ أول ترنومة اليوم' : 'Start your first hymn today')}
                          </p>
                          {/* Per-subject bars */}
                          <div className="space-y-1.5">
                            {subjects.slice(0, 3).map(s => (
                              <div key={s.name}>
                                <div className="flex justify-between text-[11px] text-gray-500 mb-0.5">
                                  <span className="truncate max-w-[70%]">{s.name}</span>
                                  <span className="tabular-nums">{s.known}/{s.total}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${s.total ? Math.round((s.known / s.total) * 100) : 0}%`, backgroundColor: s.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Liturgy attendance — participation in the sacramental life */}
                  <section>
                    <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Church className="h-4 w-4 text-amber-600" />
                      {lang === 'ar' ? 'حضور القداس' : 'Liturgy Attendance'}
                    </h2>
                    <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-gold-neutral-50 border border-[var(--hymn-border)] p-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center shrink-0">
                          <div className="text-3xl font-black text-amber-700 tabular-nums">{liturgy.verifiedCount}</div>
                          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{lang === 'ar' ? 'قداسات مؤكدة' : 'verified'}</div>
                        </div>
                        <div className="min-w-0 flex-1 text-sm text-gray-700 leading-snug">
                          {liturgy.pendingCount > 0
                            ? (lang === 'ar'
                                ? `${liturgy.pendingCount} قداسات بانتظار التأكيد من خادمك.`
                                : `${liturgy.pendingCount} liturg${liturgy.pendingCount === 1 ? 'y' : 'ies'} awaiting your servant's confirmation.`)
                            : liturgy.verifiedCount === 0
                              ? (lang === 'ar'
                                  ? 'يسوع مشتاق إليك ويريد أن يلقاك في كنيسته. 💛'
                                  : 'Jesus is missing you and would like to meet with you at His Church. 💛')
                              : (lang === 'ar'
                                  ? 'واصل حضور القداس — كل قداس يقربك أكثر.'
                                  : 'Keep attending — every Liturgy counts toward your Faithful Worshipper recognition.')}
                        </div>
                      </div>
                      {liturgy.recent.length > 0 && (
                        <ul className="mt-3 space-y-1.5 border-t border-[var(--hymn-border)] pt-3">
                          {liturgy.recent.slice(0, 3).map((l, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-gray-600">
                                {new Date(l.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {l.servantNote && <span className="truncate text-gray-600 italic flex-1 text-end">{l.servantNote}</span>}
                              <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                                l.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {l.status === 'verified' ? (lang === 'ar' ? 'مؤكد ✓' : 'Verified ✓') : (lang === 'ar' ? 'قيد المراجعة' : 'In review')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>

                  {/* Badges offered by servants — attribution matters */}
                  {badges.some(b => b.awardedBy) && (
                    <section>
                      <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Award className="h-4 w-4 text-blue-500" />
                        {lang === 'ar' ? 'شارات من خدامك' : 'Badges from Your Servants'}
                      </h2>
                      <ul className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                        {badges.filter(b => b.awardedBy).map(b => (
                          <li key={b.id}
                            className="snap-start shrink-0 w-44 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              {b.iconUrl ? (
                                <Image src={b.iconUrl.startsWith('http') ? b.iconUrl : `${API_ORIGIN}${b.iconUrl}`} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
                              ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-blue-100"><Award className="h-4 w-4 text-blue-500" /></span>
                              )}
                              <p className="text-sm font-semibold text-gray-900 truncate">{lang === 'ar' && b.nameAr ? b.nameAr : b.name}</p>
                            </div>
                            {b.reason && <p className="text-xs text-gray-600 line-clamp-2 mb-1">{b.reason}</p>}
                            <p className="text-[11px] text-gray-400">
                              {lang === 'ar' ? 'من' : 'from'} {b.awardedBy}
                              {' · '}
                              {new Date(b.earnedAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Stat tiles — each drills into its details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                      { key: 'xp', icon: Trophy, tint: 'text-gold-700', value: String(totalXp), label: lang === 'ar' ? 'مجموع النقاط' : 'Total XP', ring: xpPct, ringCls: 'from-gold-400 to-amber-500', hover: 'hover:border-gold-300' },
                      { key: 'badges', icon: Award, tint: 'text-blue-500', value: String(badges.length), label: lang === 'ar' ? 'شارات' : 'Badges', hover: 'hover:border-blue-300' },
                      { key: 'attendance', icon: CheckCircle2, tint: 'text-green-500', value: `${attendanceRate}%`, label: lang === 'ar' ? 'الحضور' : 'Attendance', hover: 'hover:border-green-300' },
                      { key: 'homework', icon: BookOpen, tint: 'text-purple-500', value: `${recentHomework.filter(h => h.status === 'completed').length}/${recentHomework.length}`, label: lang === 'ar' ? 'الواجبات' : 'Homework', hover: 'hover:border-purple-300' },
                    ] as const).map(tile => (
                      <button key={tile.key} onClick={() => setDrill(tile.key as any)}
                        aria-label={`${tile.label}`}
                        className={`rounded-xl bg-white border border-gray-200 p-4 text-center min-h-20 active:motion-safe:scale-[0.97] motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500))] ${tile.hover}`}>
                        <tile.icon className={`h-5 w-5 mx-auto mb-1 ${tile.tint}`} />
                        <div className="text-xl font-bold text-gray-900 tabular-nums">{tile.value}</div>
                        <div className="text-xs text-gray-500">{tile.label}</div>
                        {'ring' in tile && (
                          <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${tile.ringCls}`} style={{ width: `${tile.ring}%` }} /></div>
                        )}
                        <div className="mt-1 text-[10px] font-medium text-blue-600">{lang === 'ar' ? 'التفاصيل ←' : 'See all →'}</div>
                      </button>
                    ))}
                  </div>

                  {/* Recent badge / latest achievement */}
                  {(badges[0] || achievements?.transactions?.[0]) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {badges[0] && (
                        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-blue-100">
                            {badges[0].iconUrl
                              ? <Image src={badges[0].iconUrl.startsWith('http') ? badges[0].iconUrl : `${API_ORIGIN}${badges[0].iconUrl}`} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                              : <Award className="h-5 w-5 text-blue-500" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">{lang === 'ar' ? 'أحدث شارة' : 'Latest badge'}</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{lang === 'ar' && badges[0].nameAr ? badges[0].nameAr : badges[0].name}</p>
                            {badges[0].awardedBy && <p className="text-[11px] text-gray-400">{lang === 'ar' ? 'من' : 'from'} {badges[0].awardedBy}</p>}
                          </div>
                        </div>
                      )}
                      {achievements?.transactions?.[0] && (
                        <div className="flex items-center gap-3 rounded-xl border border-gold-200 bg-gold-neutral-50 p-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-gold-200">
                            <TrendingUp className="h-5 w-5 text-gold-600" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">{lang === 'ar' ? 'أحدث إنجاز' : 'Latest achievement'}</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              +{achievements.transactions[0].amount} XP{achievements.transactions[0].description ? ` — ${achievements.transactions[0].description}` : ''}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Absence encouragement — if absent in the last week */}
                  {(() => {
                    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
                    const absentLastWeek = recentAttendance.some(r => r.status === 'absent' && new Date(r.date).getTime() >= weekAgo)
                    if (!absentLastWeek) return null
                    return (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold text-sky-900">{lang === 'ar' ? 'افتقدناك الأحد الماضي!' : 'We missed you last Sunday!'}</p>
                          <p className="text-xs text-sky-800 mt-0.5 leading-snug">
                            {lang === 'ar'
                              ? 'صفك تعلّم شيئًا جديدًا — تدرّب على ترانيمك الآن لتكون جاهزًا الأسبوع القادم.'
                              : "Your class learned something new — practice your hymns now so you're ready for next week."}
                          </p>
                          <button onClick={() => setActiveTab('practice')}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 active:motion-safe:scale-[0.97] motion-safe:transition-all">
                            <Play className="h-3 w-3 fill-white" />{lang === 'ar' ? 'تدرّب الآن' : 'Practice now'}
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </>
              )
            })()}

            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Upcoming Sessions
                </h2>
                <div className="space-y-2">
                  {upcomingSessions.map(s => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        {s.time && <div className="text-xs text-gray-500">{s.time}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Attendance */}
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Recent Attendance
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="rounded-lg bg-green-50 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{attendance.present}</div>
                  <div className="text-xs text-green-600">Present</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 text-center">
                  <div className="text-lg font-bold text-amber-700">{attendance.late}</div>
                  <div className="text-xs text-amber-600">Late</div>
                </div>
                <div className="rounded-lg bg-red-50 p-2 text-center">
                  <div className="text-lg font-bold text-red-700">{attendance.absent}</div>
                  <div className="text-xs text-red-600">Absent</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{attendance.excused}</div>
                  <div className="text-xs text-gray-500">Excused</div>
                </div>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 divide-y divide-gray-100">
                {recentAttendance.slice(0, 5).map((r, i) => {
                  const Icon = STATUS_ICONS[r.status] || AlertCircle
                  const color = STATUS_COLORS[r.status] || 'text-gray-500 bg-gray-50'
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 capitalize">{r.status}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          {r.time ? ` at ${r.time}` : ''}
                        </div>
                      </div>
                      {r.homeworkStatus && r.homeworkStatus !== 'not_assigned' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${HW_COLORS[r.homeworkStatus] || 'bg-gray-100 text-gray-600'}`}>
                          {r.homeworkStatus.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  )
                })}
                {recentAttendance.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">No attendance records yet</div>
                )}
              </div>
            </section>

            {/* Badges */}
            {badges.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Badges Earned
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {badges.slice(0, 8).map(b => (
                    <div key={b.id} className="rounded-xl bg-white border border-gray-200 p-3 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                        <Star className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="text-sm font-medium text-gray-900 truncate" title={b.name || ''}>{b.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(b.earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── My Hymn Journey — progress summary card ── */}
            {(() => {
              const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
              const passed = subjectItems.filter(i => i.status === 'passed')
              const total = subjectItems.length
              const pct = total > 0 ? Math.round((passed.length / total) * 100) : 0
              const recentPass = passed.some(p => p.passedAt && (Date.now() - new Date(p.passedAt).getTime()) < 3 * 86400000)
              const nextUp = subjectItems.find(i => i.status !== 'passed')
              const nextName = nextUp ? (lang === 'ar' && nextUp.subjectItem.nameAr ? nextUp.subjectItem.nameAr : nextUp.subjectItem.name) : ''
              const firstName = lang === 'ar' && student.firstNameAr ? student.firstNameAr : student.firstName
              let msg: string
              if (passed.length === 0) {
                msg = t('Every great cantor started with one hymn — yours is waiting.', 'كل كانون عظيم بدأ بلحن واحد — لحنك في الانتظار.')
              } else if (recentPass) {
                msg = t('A new hymn passed this week — beautiful work!', 'لحن جديد اجتزته هذا الأسبوع — عمل رائع!')
              } else if (passed.length <= 3) {
                msg = t(`Well done, ${firstName}! Keep the flame going.`, `أحسنت ${firstName}! واصل التألق.`)
              } else if (passed.length <= 7) {
                msg = nextName ? t(`Well done! You're on a roll — "${nextName}" is within reach.`, `أحسنت! أنت في أفضل حال — "${nextName}" في متناول يدك.`) : t('Well done! Keep shining.', 'أحسنت! استمر في التألق.')
              } else {
                msg = t('Well done! You are becoming a true cantor of the Church.', 'أحسنت! أصبحت كانونًا حقيقيًا للكنيسة.')
              }
              const mastery = stats ? (['known', 'mastered'] as const).map(k => stats[k] || 0) : null
              return (
                <section aria-label={t('My Hymn Journey', 'رحلتي في الترانيم')} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-950 p-5 text-white">
                  <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-400/10 rounded-full blur-3xl" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h2 className="text-sm font-bold flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
                        {t('My Hymn Journey', 'رحلتي في الترانيم')}
                      </h2>
                      <p className="text-sm font-black tabular-nums" aria-label={t(`${passed.length} of ${total} hymns passed`, `${passed.length} من ${total} ترنيمة مجتازة`)}>
                        <span className="text-amber-300">{passed.length}</span>
                        <span className="text-white/50"> / {total} </span>
                        <span className="text-xs font-medium text-white/60">{t('passed', 'مجتازة')}</span>
                      </p>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-gold-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <span className="flex items-center gap-1 font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{passed.length} {t('passed', 'مجتازة')}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-gold-300">
                        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />{totalXp} XP
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-blue-300">
                        <Award className="h-3.5 w-3.5" aria-hidden="true" />{badges.length} {t('badges', 'شارات')}
                      </span>
                      {mastery && (
                        <span className="flex items-center gap-2 text-white/70" title={t('Known + mastered hymns', 'ترانيم يعرفها وأتقنها')}>
                          {MASTERY_META.known.dot && <span className="h-2 w-2 rounded-full" style={{ background: MASTERY_META.known.dot }} aria-hidden="true" />}
                          {mastery[0] + mastery[1]} {t('known', 'يعرفها')}
                          <span className="h-2 w-2 rounded-full" style={{ background: MASTERY_META.mastered.dot }} aria-hidden="true" />
                          {mastery[1]} {t('mastered', 'أتقنها')}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-amber-200/90" role="status">
                      {msg}
                    </p>
                    {nextUp && passed.length > 0 && (
                      <button
                        onClick={() => setActiveTab('practice')}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        <Music className="h-3.5 w-3.5" aria-hidden="true" />
                        {t(`Next up: ${nextName}`, `التالي: ${nextName}`)}
                        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </section>
              )
            })()}

            {/* Passed Hymns (subject items) */}
            {(() => {
              const passedItems = subjectItems.filter(i => i.status === 'passed')
              const revokedItems = subjectItems.filter(i => i.status !== 'passed' && i.history && i.history.length > 0)
              if (passedItems.length === 0 && revokedItems.length === 0) return null
              return (
                <section>
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Music className="h-4 w-4 text-blue-500" />
                    {lang === 'ar' ? 'الترانيم المجتازة' : 'Passed Hymns'}
                  </h2>
                  <div className="space-y-2">
                    {passedItems.map(i => {
                      const name = lang === 'ar' && i.subjectItem.nameAr ? i.subjectItem.nameAr : i.subjectItem.name
                      return (
                        <div key={i.subjectItem.id} className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 flex-shrink-0">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
                            {i.passedAt && (
                              <div className="text-xs text-gray-500">
                                {lang === 'ar' ? 'اجتاز في' : 'Passed'} {new Date(i.passedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 flex-shrink-0">
                            ✓ {lang === 'ar' ? 'مجتاز' : 'Passed'}
                          </span>
                        </div>
                      )
                    })}
                    {revokedItems.map(i => {
                      const name = lang === 'ar' && i.subjectItem.nameAr ? i.subjectItem.nameAr : i.subjectItem.name
                      const lastPass = i.history && i.history.length > 0 ? i.history[i.history.length - 1] : null
                      const lastDate = (lastPass as any)?.passedAt ?? (lastPass as any)?.date
                      return (
                        <div key={i.subjectItem.id} className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 opacity-70">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400 flex-shrink-0">
                            <Music className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-500 line-through truncate">{name}</div>
                            {lastDate && (
                              <div className="text-xs text-gray-400">
                                {lang === 'ar' ? 'اجتاز سابقاً في' : 'Previously passed'} {new Date(lastDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 flex-shrink-0">
                            {lang === 'ar' ? 'ملغى' : 'Revoked'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })()}

          </>
        )}

        {/* ─── ASSESSMENTS TAB ───────────────────────────────────────── */}
        {activeTab === 'assessments' && (
          <>
            {(() => {
              const pending = assessments.filter(a => a.submissionStatus !== 'completed' && !(a.dueDate && new Date(a.dueDate) < new Date()))
              const overdue = assessments.filter(a => a.submissionStatus !== 'completed' && a.dueDate && new Date(a.dueDate) < new Date())
              const done = assessments.filter(a => a.submissionStatus === 'completed')
              const total = assessments.length
              const pct = total > 0 ? Math.round((done.length / total) * 100) : 0
              const subjectStyle = (name: string) => {
                const n = (name || '').toLowerCase()
                if (n.includes('hymn')) return { accent: 'border-l-amber-400', bg: 'bg-amber-50', chip: 'bg-amber-100 text-amber-700' }
                if (n.includes('rite')) return { accent: 'border-l-purple-400', bg: 'bg-purple-50', chip: 'bg-purple-100 text-purple-700' }
                if (n.includes('language') || n.includes('coptic')) return { accent: 'border-l-sky-400', bg: 'bg-sky-50', chip: 'bg-sky-100 text-sky-700' }
                if (n.includes('bible') || n.includes('study')) return { accent: 'border-l-emerald-400', bg: 'bg-emerald-50', chip: 'bg-emerald-100 text-emerald-700' }
                return { accent: 'border-l-indigo-400', bg: 'bg-indigo-50', chip: 'bg-indigo-100 text-indigo-700' }
              }
              const daysLeft = (d: string) => {
                const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
                return diff
              }

              return (
                <>
                  {/* ── Hero progress ── */}
                  {total > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
                      <div className="flex items-center gap-5">
                        {/* Ring */}
                        <div className="relative shrink-0">
                          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="7" />
                            <circle cx="40" cy="40" r="34" fill="none" stroke={pct === 100 ? '#22c55e' : '#6366f1'} strokeWidth="7"
                              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 34}`}
                              strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                              className="transition-all duration-700" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900 tabular-nums">{pct}%</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base font-bold text-gray-900">
                            {pct === 100
                              ? (lang === 'ar' ? '🌟 أحسنت! أكملت كل التقييمات' : '🌟 Amazing! All assessments completed')
                              : pct >= 50
                                ? (lang === 'ar' ? '💪 نصف الطريق! واصل التقدم' : '💪 Halfway there! Keep going')
                                : (lang === 'ar' ? '📋 تقييماتك المكلفة' : '📋 Your assigned assessments')}
                          </h2>
                          <p className="text-xs text-gray-500 mt-1">
                            {done.length}/{total} {lang === 'ar' ? 'مكتملة' : 'completed'}
                            {overdue.length > 0 && <span className="text-red-600 font-medium"> · {overdue.length} {lang === 'ar' ? 'متأخرة' : 'overdue'}</span>}
                          </p>
                          {/* Progress bar */}
                          <div className="mt-2.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #6366f1, #a78bfa)' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Status tiles ── */}
                  {total > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4" aria-live="polite">
                      {[
                        { label: lang === 'ar' ? '⏳ قيد الانتظار' : '⏳ Pending', count: pending.length, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                        { label: lang === 'ar' ? '🚨 متأخرة' : '🚨 Overdue', count: overdue.length, cls: 'bg-red-50 text-red-700 border-red-200' },
                        { label: lang === 'ar' ? '✅ مكتملة' : '✅ Done', count: done.length, cls: 'bg-green-50 text-green-700 border-green-200' },
                      ].map(tile => (
                        <div key={tile.label} className={`rounded-xl border p-3 text-center ${tile.cls}`}>
                          <div className="text-xl font-bold tabular-nums">{tile.count}</div>
                          <div className="text-[11px] font-medium">{tile.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {assessments.length === 0 ? (
                    /* ── Empty state — encouraging ── */
                    <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-10 text-center mt-4">
                      <div className="flex justify-center mb-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-indigo-100 shadow-sm">
                          <ClipboardCheck className="h-8 w-8 text-indigo-400" />
                        </div>
                      </div>
                      <p className="text-base font-semibold text-gray-900">
                        {lang === 'ar' ? 'لا توجد تقييمات بعد' : 'No assessments yet'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                        {lang === 'ar'
                          ? 'خادمك سيكلّفك بتقييمات لقياس تقدّمك في التسبائح. استمر في التدريب!'
                          : "Your servant will assign assessments to track your hymn progress. Keep practicing — you're doing great!"}
                      </p>
                    </div>
                  ) : (
                    /* ── Assessment cards ── */
                    <section>
                      {/* Overdue — urgent section */}
                      {overdue.length > 0 && (
                        <div className="mb-5">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-red-500 mb-2 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {lang === 'ar' ? 'متأخرة — ت需要 اهتمام فوري' : 'Overdue — needs your attention'}
                          </h3>
                          <div className="space-y-2.5">
                            {overdue.map(a => {
                              const ss = subjectStyle(a.subject.name)
                              const days = a.dueDate ? Math.abs(daysLeft(a.dueDate)) : 0
                              return (
                                <Link key={a.id} href={`/student-portal/${code}/assessment/${a.id}/take`}
                                  className={`block rounded-2xl border-2 border-red-300 bg-white p-4 transition-all hover:shadow-md active:motion-safe:scale-[0.98]`}>
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                                      <AlertCircle className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-gray-900 truncate">{a.titleAr || a.title}</p>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ss.chip}`}>{a.subject.nameAr || a.subject.name}</span>
                                        <span className="text-[11px] text-red-300">·</span>
                                        <span className="text-[11px] text-red-700">{a.totalPoints} pts</span>
                                        <span className="text-[11px] text-red-300">·</span>
                                        <span className="text-[11px] font-medium text-red-700">{days} {lang === 'ar' ? 'أيام متأخرة' : 'days overdue'}</span>
                                      </div>
                                    </div>
                                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                                      {lang === 'ar' ? 'إكمال' : 'Complete →'}
                                    </span>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pending — sorted by urgency */}
                      {pending.length > 0 && (
                        <div className="mb-5">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-blue-500 mb-2 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {lang === 'ar' ? 'قيد الانتظار' : 'Upcoming'}
                          </h3>
                          <div className="space-y-2.5">
                            {[...pending].sort((a, b) => {
                              if (!a.dueDate) return 1
                              if (!b.dueDate) return -1
                              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                            }).map(a => {
                              const ss = subjectStyle(a.subject.name)
                              const days = a.dueDate ? daysLeft(a.dueDate) : null
                              const urgent = days !== null && days <= 3
                              return (
                                <Link key={a.id} href={`/student-portal/${code}/assessment/${a.id}/take`}
                                  className={`block rounded-2xl border-2 bg-white p-4 transition-all hover:shadow-md active:motion-safe:scale-[0.98]`}
                                  style={{ borderColor: ss.accent.replace('border-l-', '').replace('-400', '-300') }}>
                                  <div className="flex items-start gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ss.bg}`}>
                                      <BookOpen className={`h-5 w-5 ${ss.chip.split(' ')[1]}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-gray-900 truncate">{a.titleAr || a.title}</p>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ss.chip}`}>{a.subject.nameAr || a.subject.name}</span>
                                        <span className="text-[11px] text-gray-300">·</span>
                                        <span className="text-[11px] text-gray-700">{a.totalPoints} pts</span>
                                        {a.dueDate && (
                                          <>
                                            <span className="text-[11px] text-gray-300">·</span>
                                            <span className={`text-[11px] font-medium ${urgent ? 'text-amber-700' : 'text-gray-700'}`}>
                                              {days !== null && days <= 0
                                                ? (lang === 'ar' ? 'اليوم!' : 'Due today!')
                                                : days !== null
                                                  ? (lang === 'ar' ? `بعد ${days} يوم` : `in ${days} day${days === 1 ? '' : 's'}`)
                                                  : null}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      {a.dueDate && (
                                        <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
                                          <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all"
                                            style={{ width: `${Math.max(5, 100 - (days !== null ? days * 10 : 50))}%` }} />
                                        </div>
                                      )}
                                    </div>
                                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                      {lang === 'ar' ? 'ابدأ' : 'Start →'}
                                    </span>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Completed — celebrated */}
                      {done.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-green-500 mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {lang === 'ar' ? 'مكتملة 🎉' : 'Completed 🎉'}
                          </h3>
                          <div className="space-y-2">
                            {done.map(a => {
                              const ss = subjectStyle(a.subject.name)
                              const score = a.earnedScore
                              const passed = score !== null && score >= a.passingScore
                              return (
                                <Link key={a.id}
                                  href={`/student-portal/${code}/assessment/${a.id}/submission/${a.submissionId}`}
                                  className="rounded-2xl border-2 border-green-300 bg-white p-4 transition-all hover:shadow-md active:motion-safe:scale-[0.98] cursor-pointer">
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100">
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate line-through decoration-green-300">{a.titleAr || a.title}</p>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ss.chip}`}>{a.subject.nameAr || a.subject.name}</span>
                                        <span className="text-[11px] text-green-300">·</span>
                                        <span className="text-[11px] text-green-700">{a.totalPoints} pts</span>
                                        {score !== null && (
                                          <>
                                            <span className="text-[11px] text-green-300">·</span>
                                            <span className={`text-[11px] font-bold ${passed ? 'text-green-700' : 'text-amber-700'}`}>
                                              {lang === 'ar' ? `${score} / ${a.totalPoints} نقاط` : `${score}/${a.totalPoints}`}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                                      <CheckCircle2 className="h-3 w-3" /> {lang === 'ar' ? 'عرض' : 'View'}
                                    </span>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )
            })()}
          </>
        )}

        {/* ─── PRACTICE TAB ──────────────────────────────────────────── */}
        {/* ─── PRACTICE TAB ──────────────────────────────────────────── */}
        {activeTab === 'practice' && (
          <>
            {/* Learning Stats */}
            {stats && (
              <div className="grid grid-cols-5 gap-2">
                {(['not_started', 'introduced', 'practicing', 'known', 'mastered'] as const).map(s => {
                  const meta = MASTERY_META[s]
                  return (
                    <div key={s} className="rounded-lg bg-white border border-gray-200 p-2 text-center">
                      <div className="h-2 w-2 rounded-full mx-auto mb-1" style={{ background: meta.dot }} />
                      <div className="text-lg font-bold text-gray-900">{stats[s]}</div>
                      <div className="text-[10px] text-gray-500 leading-tight">{meta.label}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* This Sunday */}
            <ThisSundayPanel
              data={sundayData ?? null}
              isLoading={sundayLoading}
              hymnMap={hymnMap}
              onSelect={handleSelectHymn}
              lang="en"
            />

            {/* Due for Review */}
            {dueReview && dueReview.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-200">
                  <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Due for Review ({dueReview.length})
                  </h3>
                </div>
                <div className="divide-y divide-amber-100">
                  {dueReview.map(item => {
                    const meta = MASTERY_META[item.mastery]
                    return (
                      <button key={item.progressId}
                        onClick={() => {
                          const hymn = hymnMap?.find(h => h.id === item.lesson.id)
                          if (hymn) setPracticeLesson(hymn)
                        }}
                        className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-amber-100/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{item.lesson.title}</div>
                          {item.lesson.titleCoptic && <div className="text-xs text-gray-500 mt-0.5">{item.lesson.titleCoptic}</div>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-amber-700 font-medium">{item.overdueDays}d overdue</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* All Hymns */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Music className="h-4 w-4 text-blue-500" />
                  All Hymns
                </h3>
              </div>

              {/* Search & Filter */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search hymns..."
                    className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-base focus:border-gold-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500))]" />
                </div>
                <select value={filterMastery} onChange={e => setFilterMastery(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none">
                  <option value="">All Status</option>
                  {(['not_started', 'introduced', 'practicing', 'known', 'mastered'] as const).map(s => (
                    <option key={s} value={s}>{MASTERY_META[s].label}</option>
                  ))}
                </select>
              </div>

              {hymnMapLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gold-700" /></div>
              ) : Object.keys(groupedByLevel).length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No hymns found</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(groupedByLevel).map(([level, hymns]) => {
                    const isExpanded = expandedLevels.has(level) || (expandedLevels.size === 0 && !searchQuery && !filterMastery)
                    return (
                      <div key={level} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <button onClick={() => toggleLevel(level)}
                          className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-50">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                            <span className="text-sm font-medium text-gray-900">{level}</span>
                            <span className="text-xs text-gray-400">({hymns.length})</span>
                          </div>
                          <div className="flex -space-x-1">
                            {hymns.slice(0, 5).map(h => {
                              const m = MASTERY_META[h.progress?.masteryStatus ?? 'not_started']
                              return <div key={h.id} className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: m.dot }} />
                            })}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3">
                            {hymns.map(hymn => {
                              const mastery = hymn.progress?.masteryStatus ?? 'not_started'
                              const meta = MASTERY_META[mastery]
                              const isKnown = mastery === 'known' || mastery === 'mastered'
                              return (
                                <button key={hymn.id} onClick={() => setPracticeLesson(hymn)}
                                  className={`group text-left rounded-2xl border overflow-hidden bg-white hover:shadow-md active:motion-safe:scale-[0.97] motion-safe:transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500))] ${isKnown ? 'border-gold-300' : 'border-gray-200'}`}>
                                  {/* Color-art header — pickable by color before reading */}
                                  <div className="relative h-16 flex items-end p-2"
                                    style={{ background: `linear-gradient(135deg, ${hymn.subject?.color || '#3b82f6'}22, ${hymn.subject?.color || '#3b82f6'}55)` }}>
                                    <Music className="absolute top-2 right-2 h-4 w-4 opacity-40" style={{ color: hymn.subject?.color || '#3b82f6' }} aria-hidden="true" />
                                    {isKnown && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-gold-700">
                                        <Star className="h-3 w-3 fill-gold-500 text-gold-500" /> {lang === 'ar' ? 'متقن' : 'Mastered'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="p-2.5">
                                    {hymn.titleCoptic && (
                                      <p className="font-coptic text-[13px] text-gray-700 truncate leading-snug" lang="cop">{hymn.titleCoptic}</p>
                                    )}
                                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight mt-0.5">
                                      {lang === 'ar' && hymn.titleAr ? hymn.titleAr : hymn.title}
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.color}`}>
                                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} aria-hidden="true" />
                                        {meta.label}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 group-hover:text-emerald-600">
                                        <Play className="h-3 w-3 fill-emerald-600" />{lang === 'ar' ? 'صلِّ' : 'Pray Hymn'}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ─── STAT DRILL-DOWN ────────────────────────────────────────── */}
      {drill && (
        <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setDrill(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">
                {drill === 'xp' ? (lang === 'ar' ? 'سجل النقاط' : 'XP History')
                  : drill === 'badges' ? (lang === 'ar' ? 'كل الشارات' : 'All Badges')
                  : drill === 'attendance' ? (lang === 'ar' ? 'سجل الحضور' : 'Attendance Records')
                  : (lang === 'ar' ? 'الواجبات' : 'Homework')}
              </h2>
              <button onClick={() => setDrill(null)} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold-500))]">
                ✕
              </button>
            </div>

            {drill === 'xp' && (
              achievements?.transactions?.length
                ? <ul className="space-y-2">
                    {achievements.transactions.map((t: any, i: number) => (
                      <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{t.description || t.type}</p>
                          <p className="text-xs text-gray-400">{new Date(t.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}</p>
                        </div>
                        <span className={`text-sm font-bold tabular-nums ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.amount >= 0 ? '+' : ''}{t.amount} XP
                        </span>
                      </li>
                    ))}
                  </ul>
                : <p className="py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لا توجد نقاط بعد — تدرّب لتبدأ!' : 'No XP yet — practice to start earning!'}</p>
            )}

            {drill === 'badges' && (
              badges.length
                ? <ul className="grid grid-cols-2 gap-2">
                    {badges.map(b => (
                      <li key={b.id} className="rounded-xl border border-gray-100 p-3 text-center">
                        {b.iconUrl
                          ? <Image src={b.iconUrl.startsWith('http') ? b.iconUrl : `${API_ORIGIN}${b.iconUrl}`} alt="" width={40} height={40} className="mx-auto h-10 w-10 rounded-full object-cover mb-1.5" />
                          : <Award className="mx-auto h-8 w-8 text-blue-400 mb-1.5" />}
                        <p className="text-sm font-medium text-gray-900 truncate">{lang === 'ar' && b.nameAr ? b.nameAr : b.name}</p>
                        {b.awardedBy && <p className="text-[11px] text-gray-400">{lang === 'ar' ? 'من' : 'from'} {b.awardedBy}</p>}
                      </li>
                    ))}
                  </ul>
                : <p className="py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لم تُمنح شارات بعد.' : 'No badges yet.'}</p>
            )}

            {drill === 'attendance' && (
              recentAttendance.length
                ? <ul className="divide-y divide-gray-100">
                    {recentAttendance.map((r, i) => {
                      const Icon = STATUS_ICONS[r.status] || AlertCircle
                      const color = STATUS_COLORS[r.status] || 'text-gray-500 bg-gray-50'
                      return (
                        <li key={i} className="flex items-center gap-3 py-2.5">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
                          <div className="flex-1">
                            <p className="text-sm capitalize text-gray-900">{r.status}</p>
                            <p className="text-xs text-gray-400">{new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          {r.homeworkStatus && r.homeworkStatus !== 'not_assigned' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${HW_COLORS[r.homeworkStatus] || 'bg-gray-100 text-gray-600'}`}>{r.homeworkStatus.replace('_', ' ')}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                : <p className="py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لا توجد سجلات حضور بعد.' : 'No attendance records yet.'}</p>
            )}

            {drill === 'homework' && (
              recentHomework.length
                ? <ul className="divide-y divide-gray-100">
                    {recentHomework.map((h, i) => (
                      <li key={i} className="flex items-center justify-between py-2.5">
                        <p className="text-sm text-gray-700">{new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${HW_COLORS[h.status] || 'bg-gray-100 text-gray-600'}`}>{h.status.replace('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>
                : <p className="py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لا توجد واجبات بعد.' : 'No homework yet.'}</p>
            )}
          </div>
        </div>
      )}

      {/* ─── MASTERY CELEBRATION ─────────────────────────────────────── */}
      {celebration && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgb(var(--hymn-navy))]/95 p-6" role="status">
          {/* gentle gold confetti dots */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {[...Array(14)].map((_, i) => (
              <span key={i}
                className="absolute rounded-full motion-safe:animate-pulse"
                style={{
                  width: 6 + (i % 4) * 4, height: 6 + (i % 4) * 4,
                  left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`,
                  background: i % 3 === 0 ? 'rgb(var(--gold-400))' : 'rgba(255,255,255,0.25)',
                  opacity: 0.5,
                }} />
            ))}
          </div>
          <div className="relative text-center max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300 mb-3">
              {lang === 'ar' ? 'هذه الترنيمة أصبحت معك' : 'This hymn now lives in you'}
            </p>
            {celebration.titleCoptic && (
              <p className="font-coptic text-2xl text-gold-200 mb-2 leading-relaxed">{celebration.titleCoptic}</p>
            )}
            <p className="text-xl font-bold text-white">{celebration.title}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 border border-gold-400/40 px-4 py-1.5 text-sm font-semibold text-gold-200">
              <Star className="h-4 w-4 fill-gold-300 text-gold-300" />
              {lang === 'ar' ? 'أُتقنتها' : 'Mastered'}
            </div>
          </div>
        </div>
      )}

      {/* ─── PRACTICE MODAL ─────────────────────────────────────────── */}
      {practiceLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPracticeLesson(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            {practiceLesson?.referenceRecordingUrl && (
              <div className="mt-3 rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-medium text-gray-500 mb-1">{lang === 'ar' ? 'تسجيل المرجع' : 'Reference recording'}{practiceLesson.referenceRecordingName ? ` — ${practiceLesson.referenceRecordingName}` : ''}</div>
                <AudioPlayer src={assetUrl(practiceLesson.referenceRecordingUrl)} />
              </div>
            )}
            <PracticeRecorder
              lessonId={practiceLesson.id}
              lessonTitle={practiceLesson.title}
              referenceAudioUrl={getAudioUrl(practiceLesson)}
              onSubmit={handleSubmitPractice}
              onCancel={() => setPracticeLesson(null)}
              lang="en"
              code={code}
            />
            {/* Listening Loop: past practices + servant feedback for this hymn */}
            <div className="mt-4">
              <PracticeHistory code={code} lessonId={practiceLesson.id} lang="en" onResubmit={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

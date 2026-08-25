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

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '')
import {
  Cross, Loader2, Calendar, Church, CheckCircle2, XCircle, Clock, AlertCircle,
  Award, Star, BookOpen, ArrowLeft, Trophy, Play, Music,
  ChevronDown, ChevronRight, Search, Filter, ClipboardCheck, MoreVertical, LogOut, Eye, EyeOff, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useStudentHymnMap, useStudentThisSunday, useStudentDueReview, useStudentStats, useStudentPractice } from '@/components/hymn-learning/student-hooks'
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
    churchName?: string; churchNameAr?: string;
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
  }>
}

const STATUS_ICONS: Record<string, any> = { present: CheckCircle2, late: Clock, absent: XCircle, excused: AlertCircle }
const STATUS_COLORS: Record<string, string> = {
  present: 'text-green-600 bg-green-50', late: 'text-amber-600 bg-amber-50',
  absent: 'text-red-600 bg-red-50', excused: 'text-gray-500 bg-gray-50',
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
    setPracticeLesson(null)
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

  const { student, school, attendance, recentAttendance, badges, liturgy, totalXp, upcomingSessions, recentHomework, assessments } = data
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
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm text-2xl font-bold overflow-hidden shadow-lg shadow-black/20 shrink-0">
              {photoSrc ? (
                <Image src={photoSrc} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized />
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
              {school && (
                <div className="mt-2 flex items-center gap-2 text-white/60 text-xs">
                  {school.logoUrl && (
                    <Image
                      src={school.logoUrl.startsWith('http') ? school.logoUrl : `${API_ORIGIN}${school.logoUrl}`}
                      alt="" width={16} height={16} className="rounded" unoptimized
                    />
                  )}
                  <span>{lang === 'ar' && school.churchNameAr ? school.churchNameAr : (school.churchName || school.name)}</span>
                </div>
              )}
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
                              {l.servantNote && <span className="truncate text-gray-500 italic flex-1 text-end">“{l.servantNote}”</span>}
                              <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                                l.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
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
                                <Image src={b.iconUrl.startsWith('http') ? b.iconUrl : `${API_ORIGIN}${b.iconUrl}`} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" unoptimized />
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

                  {/* Stat tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-white border border-gray-200 p-4 text-center hover:border-gold-300 hover:shadow-sm transition-all">
                      <Trophy className="h-5 w-5 text-gold-700 mx-auto mb-1" />
                      <div className="text-xl font-bold text-gray-900 tabular-nums">{totalXp}</div>
                      <div className="text-xs text-gray-500">Total XP</div>
                      <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-amber-500" style={{ width: `${xpPct}%` }} /></div>
                    </div>
                    <div className="rounded-xl bg-white border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all">
                      <Award className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                      <div className="text-xl font-bold text-gray-900 tabular-nums">{badges.length}</div>
                      <div className="text-xs text-gray-500">Badges</div>
                    </div>
                    <div className="rounded-xl bg-white border border-gray-200 p-4 text-center hover:border-green-300 hover:shadow-sm transition-all">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                      <div className="text-xl font-bold text-gray-900 tabular-nums">{attendanceRate}%</div>
                      <div className="text-xs text-gray-500">Attendance</div>
                    </div>
                    <div className="rounded-xl bg-white border border-gray-200 p-4 text-center hover:border-purple-300 hover:shadow-sm transition-all">
                      <BookOpen className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                      <div className="text-xl font-bold text-gray-900 tabular-nums">{recentHomework.filter(h => h.status === 'completed').length}/{recentHomework.length}</div>
                      <div className="text-xs text-gray-500">Homework</div>
                    </div>
                  </div>
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
              const tiles = [
                { label: lang === 'ar' ? 'قيد الانتظار' : 'Pending', count: pending.length, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: lang === 'ar' ? 'متأخرة' : 'Overdue', count: overdue.length, cls: 'bg-red-50 text-red-700 border-red-200' },
                { label: lang === 'ar' ? 'مكتملة' : 'Done', count: done.length, cls: 'bg-green-50 text-green-700 border-green-200' },
              ]
              return (
                <>
                  {/* Status summary — aria-live so completion updates are announced */}
                  <div className="grid grid-cols-3 gap-2" aria-live="polite">
                    {tiles.map(tile => (
                      <div key={tile.label} className={`rounded-xl border p-3 text-center ${tile.cls}`}>
                        <div className="text-xl font-bold tabular-nums">{tile.count}</div>
                        <div className="text-[11px] font-medium">{tile.label}</div>
                      </div>
                    ))}
                  </div>
                  {assessments.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center mt-4">
                      <ClipboardCheck className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">
                        {lang === 'ar' ? 'لا توجد تقييمات مكلفة حالياً. ستظهر هنا عند تكليفها.' : 'No assigned assessments right now. They appear here when your servant assigns one.'}
                      </p>
                    </div>
                  ) : (
                    <section className="mt-4">
                      <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                        {lang === 'ar' ? `التقييمات المكلفة (${assessments.length})` : `Assigned Assessments (${assessments.length})`}
                      </h2>
                      <div className="space-y-2">
                        {[...overdue, ...pending, ...done].map(a => {
                          const isCompleted = a.submissionStatus === 'completed'
                          const isOverdue = overdue.includes(a)
                          const cardClasses = `rounded-xl border px-4 py-3 ${
                            isCompleted ? 'bg-green-50 border-green-200' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                          }`
                          const cardInner = (
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {a.titleAr || a.title}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                                    {a.type}
                                  </span>
                                  <span className="text-xs text-gray-500">{a.subject.nameAr || a.subject.name}</span>
                                  <span className="text-xs text-gray-400">&middot;</span>
                                  <span className="text-xs text-gray-500">{a.totalPoints} pts</span>
                                </div>
                                {a.dueDate && (
                                  <div className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                    Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {isCompleted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Done
                                  </span>
                                ) : isOverdue ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                                    <AlertCircle className="h-3.5 w-3.5" /> Overdue
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                    <Clock className="h-3.5 w-3.5" /> Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                          return isCompleted ? (
                            <div key={a.id} className={cardClasses}>{cardInner}</div>
                          ) : (
                            <Link key={a.id} href={`/student-portal/${code}/assessment/${a.id}/take`} className={`block ${cardClasses}`}>{cardInner}</Link>
                          )
                        })}
                      </div>
                    </section>
                  )}
                </>
              )
            })()}
          </>
        )}

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
                                        <Play className="h-3 w-3 fill-emerald-600" />{lang === 'ar' ? 'تدرّب' : 'Sing'}
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
              <PracticeHistory code={code} lessonId={practiceLesson.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

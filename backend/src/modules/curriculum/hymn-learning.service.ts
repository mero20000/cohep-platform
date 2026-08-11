import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

// ─── SM-2 Spaced Repetition ──────────────────────────────────────────────────
// quality: 0-5  (0=blackout, 3=correct-with-effort, 5=perfect)
// Self-rating map: 1★→q1, 2★→q2, 3★→q3, 4★→q4, 5★→q5
function sm2(easeFactor: number, interval: number, repetitions: number, quality: number) {
  const q = Math.max(0, Math.min(5, quality))
  let ef = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  ef = Math.max(1.3, ef)

  let newInterval: number
  let newRep: number

  if (q < 3) {
    newInterval = 1
    newRep = 0
  } else {
    newRep = repetitions + 1
    if (newRep === 1) newInterval = 1
    else if (newRep === 2) newInterval = 6
    else newInterval = Math.round(interval * ef)
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval)

  return { easeFactor: ef, interval: newInterval, repetitions: newRep, nextReviewAt }
}

function masteryFromRepetitions(rep: number, selfRating: number): string {
  if (rep === 0) return 'not_started'
  if (selfRating <= 2) return 'introduced'
  if (rep <= 2) return 'practicing'
  if (selfRating < 5) return 'known'
  return 'mastered'
}

// ─── Coptic Calendar helpers ─────────────────────────────────────────────────
const COPTIC_EPOCH_JD = 1825029.5 // Julian Day for 1 Thout 1 AM (29 Aug 284 CE)
const GREGORIAN_EPOCH_JD = 1721425.5

function gregorianToJD(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) -
    Math.floor(y / 100) + Math.floor(y / 400) - 32045
}

function jdToCoptic(jd: number): { month: number; day: number; year: number } {
  const copticDays = jd - COPTIC_EPOCH_JD
  const year = Math.floor(copticDays / 365.25)
  const remaining = copticDays - year * 365.25
  const month = Math.floor(remaining / 30) + 1
  const day = Math.floor(remaining % 30) + 1
  return { year: Math.floor(year) + 1, month: Math.max(1, Math.min(13, month)), day: Math.max(1, Math.min(30, day)) }
}

// Coptic month names (1=Thout ... 13=Nasie)
const COPTIC_MONTHS = ['', 'Thout', 'Paopi', 'Hathor', 'Kiahk', 'Tobi', 'Meshir', 'Paremhat', 'Parmouti', 'Pashons', 'Paoni', 'Epip', 'Mesori', 'Nasie']

// Season detection from Coptic month
function getCopticSeason(month: number, day: number): string {
  // Kiahk (month 4) = Advent / Midnight Praises season
  if (month === 4) return 'kiahk'
  // Tobi 1-11 = Nativity octave
  if (month === 5 && day <= 11) return 'nativity'
  // Parmouti roughly = Great Lent start varies; simplified: month 8 = pre-lent
  if (month === 7 || month === 8) return 'great_lent'
  // Pashons 1 week = Bright week / Pentecost season
  if (month === 9 && day <= 7) return 'bright_week'
  return 'regular'
}

function getUpcomingSundayDate(from = new Date()): Date {
  const d = new Date(from)
  const day = d.getDay() // 0=Sun
  const daysUntilSunday = day === 0 ? 7 : 7 - day
  d.setDate(d.getDate() + daysUntilSunday)
  return d
}

@Injectable()
export class HymnLearningService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Log a practice session + run SM-2 ──────────────────────────────────
  async logPracticeSession(dto: {
    studentId: string
    lessonId: string
    schoolId: string
    selfRating: number
    recordingUrl?: string
    durationSec?: number
  }) {
    const quality = Math.max(1, Math.min(5, dto.selfRating))

    // Upsert LessonProgress
    let progress = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: dto.studentId, lessonId: dto.lessonId } },
    })

    const currentEF = (progress as any)?.srEaseFactor ?? 2.5
    const currentInterval = (progress as any)?.srInterval ?? 1
    const currentRep = (progress as any)?.srRepetitions ?? 0

    const sr = sm2(currentEF, currentInterval, currentRep, quality)
    const mastery = masteryFromRepetitions(sr.repetitions, quality)

    progress = await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: dto.studentId, lessonId: dto.lessonId } },
      update: {
        sessionsCompleted: { increment: 1 },
        lastAccessedAt: new Date(),
        status: mastery,
        masteryStatus: mastery,
        srEaseFactor: sr.easeFactor,
        srInterval: sr.interval,
        srRepetitions: sr.repetitions,
        nextReviewAt: sr.nextReviewAt,
        progressPercent: Math.min(100, (sr.repetitions / 5) * 100),
        completedAt: mastery === 'mastered' ? new Date() : null,
      } as any,
      create: {
        studentId: dto.studentId,
        lessonId: dto.lessonId,
        status: mastery,
        sessionsCompleted: 1,
        totalSessions: 1,
        lastAccessedAt: new Date(),
        progressPercent: Math.min(100, (sr.repetitions / 5) * 100),
        masteryStatus: mastery,
        srEaseFactor: sr.easeFactor,
        srInterval: sr.interval,
        srRepetitions: sr.repetitions,
        nextReviewAt: sr.nextReviewAt,
      } as any,
    })

    // Create practice session record
    const session = await this.prisma.hymnPracticeSession.create({
      data: {
        studentId: dto.studentId,
        lessonId: dto.lessonId,
        progressId: progress.id,
        schoolId: dto.schoolId,
        selfRating: quality,
        srQuality: quality,
        recordingUrl: dto.recordingUrl,
        durationSec: dto.durationSec,
      } as any,
    })

    return { session, progress, nextReviewAt: sr.nextReviewAt, mastery }
  }

  // ─── Student hymn map: all lessons with their progress ──────────────────
  async getStudentHymnMap(studentId: string, schoolId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { schoolId, deletedAt: null, status: 'published' },
      include: {
        level: { select: { id: true, number: true, name: true } },
        subject: { select: { id: true, name: true, nameAr: true, color: true, icon: true } },
        lessonProgress: {
          where: { studentId },
          select: {
            status: true, masteryStatus: true, srRepetitions: true,
            progressPercent: true, nextReviewAt: true, lastAccessedAt: true,
          },
        } as any,
        resources: {
          where: { deletedAt: null, type: { in: ['audio', 'video'] } },
          select: { id: true, type: true, fileUrl: true, language: true, durationSeconds: true },
          take: 3,
        },
      },
      orderBy: [{ level: { number: 'asc' } }, { orderIndex: 'asc' }],
    })

    return lessons.map(l => ({
      id: l.id,
      title: l.title,
      titleAr: l.titleAr,
      titleCoptic: l.titleCoptic,
      level: l.level,
      subject: l.subject,
      estimatedDurationMinutes: l.estimatedDurationMinutes,
      liturgicalTags: l.liturgicalTags,
      resources: l.resources,
      audioUrl: (l as any).audioUrl ?? l.resources[0]?.fileUrl ?? null,
      progress: (l.lessonProgress as any[])[0] ?? null,
    }))
  }

  // ─── Hymns due for review today ──────────────────────────────────────────
  async getDueForReview(studentId: string, schoolId: string) {
    const now = new Date()
    const dueLessons = await this.prisma.lessonProgress.findMany({
      where: {
        studentId,
        nextReviewAt: { lte: now },
        masteryStatus: { not: 'not_started' },
        lesson: { schoolId, deletedAt: null },
      } as any,
      include: {
        lesson: {
          include: {
            level: { select: { number: true, name: true } },
            subject: { select: { name: true, color: true } },
            resources: {
              where: { deletedAt: null, type: 'audio' },
              take: 1,
              select: { fileUrl: true, language: true },
            },
          },
        },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: 20,
    })

    return dueLessons.map(p => ({
      progressId: p.id,
      lesson: {
        id: p.lesson.id,
        title: p.lesson.title,
        titleAr: p.lesson.titleAr,
        titleCoptic: p.lesson.titleCoptic,
        level: p.lesson.level,
        subject: p.lesson.subject,
        audioUrl: (p.lesson as any).audioUrl ?? p.lesson.resources[0]?.fileUrl ?? null,
      },
      mastery: (p as any).masteryStatus,
      srRepetitions: (p as any).srRepetitions,
      overdueDays: Math.floor((now.getTime() - new Date((p as any).nextReviewAt).getTime()) / 86400000),
    }))
  }

  // ─── This Sunday hymns ───────────────────────────────────────────────────
  async getThisSundayHymns(schoolId: string, fromDate?: string) {
    const base = fromDate ? new Date(fromDate) : new Date()
    const sunday = getUpcomingSundayDate(base)

    const jd = gregorianToJD(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate())
    const coptic = jdToCoptic(jd)
    const season = getCopticSeason(coptic.month, coptic.day)
    const copticMonthName = COPTIC_MONTHS[coptic.month] || ''

    // Fetch all published lessons with liturgical tags
    const lessons = await this.prisma.lesson.findMany({
      where: { schoolId, deletedAt: null, status: 'published' },
      include: {
        level: { select: { number: true, name: true } },
        subject: { select: { name: true, color: true } },
        resources: {
          where: { deletedAt: null, type: 'audio' },
          take: 1,
          select: { fileUrl: true, language: true },
        },
      },
      orderBy: [{ level: { number: 'asc' } }, { orderIndex: 'asc' }],
    })

    // Filter by liturgical tags OR always-Sunday hymns
    const sundayLessons = lessons.filter(l => {
      const tags = (l.liturgicalTags as any) ?? {}
      if (!tags.seasons && !tags.weekdayTypes) return false
      const seasons: string[] = tags.seasons ?? []
      const weekdayTypes: string[] = tags.weekdayTypes ?? []
      return seasons.includes(season) || seasons.includes('all') ||
        weekdayTypes.includes('sunday') || weekdayTypes.includes('all')
    })

    // If nothing tagged, return top-priority liturgy hymns by subject name
    const result = sundayLessons.length > 0 ? sundayLessons : lessons.filter(l => {
      const name = l.subject?.name?.toLowerCase() ?? ''
      return name.includes('liturgy') || name.includes('sunday') || name.includes('تسبحة')
    }).slice(0, 12)

    return {
      sunday: sunday.toISOString().split('T')[0],
      copticDate: { year: coptic.year, month: coptic.month, day: coptic.day, monthName: copticMonthName },
      season,
      hymns: result.map(l => ({
        id: l.id,
        title: l.title,
        titleAr: l.titleAr,
        titleCoptic: l.titleCoptic,
        level: l.level,
        subject: l.subject,
        audioUrl: (l as any).audioUrl ?? l.resources[0]?.fileUrl ?? null,
        liturgicalTags: l.liturgicalTags,
      })),
    }
  }

  // ─── Servant review queue (unreviewed recordings) ───────────────────────
  async getServantReviewQueue(schoolId: string) {
    const sessions = await this.prisma.hymnPracticeSession.findMany({
      where: {
        schoolId,
        recordingUrl: { not: null },
        servantReviewedAt: null,
      } as any,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
        lesson: { select: { id: true, title: true, titleAr: true, titleCoptic: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    return sessions.map(s => ({
      id: s.id,
      student: (s as any).student,
      lesson: (s as any).lesson,
      recordingUrl: s.recordingUrl,
      selfRating: s.selfRating,
      durationSec: s.durationSec,
      submittedAt: s.createdAt,
    }))
  }

  // ─── Servant submits review ──────────────────────────────────────────────
  async reviewSession(sessionId: string, reviewerId: string, dto: { servantRating: number; servantNote?: string }) {
    return this.prisma.hymnPracticeSession.update({
      where: { id: sessionId },
      data: {
        servantRating: dto.servantRating,
        servantNote: dto.servantNote,
        reviewedBy: reviewerId,
        servantReviewedAt: new Date(),
      } as any,
    })
  }

  // ─── Student practice history for a hymn ────────────────────────────────
  async getHymnHistory(studentId: string, lessonId: string) {
    return this.prisma.hymnPracticeSession.findMany({
      where: { studentId, lessonId } as any,
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }

  // ─── Overall student learning stats ─────────────────────────────────────
  async getStudentStats(studentId: string, schoolId: string) {
    const [total, progresses] = await Promise.all([
      this.prisma.lesson.count({ where: { schoolId, deletedAt: null, status: 'published' } }),
      this.prisma.lessonProgress.findMany({
        where: { studentId } as any,
        select: { masteryStatus: true } as any,
      }),
    ])

    const counts = { not_started: 0, introduced: 0, practicing: 0, known: 0, mastered: 0 }
    for (const p of progresses as any[]) {
      const s = p.masteryStatus ?? 'not_started'
      counts[s] = (counts[s] ?? 0) + 1
    }
    counts.not_started = total - (progresses.length)

    return { total, ...counts, touched: progresses.length }
  }
}

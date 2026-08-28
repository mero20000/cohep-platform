import { Injectable, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import {
  COPTIC_MONTHS, gregorianToJD, jdToCoptic,
  getCopticSeason, getUpcomingSundayDate,
} from '../../common/utils/coptic-calendar'

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

@Injectable()
export class HymnLearningService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly SERVANT_ROLES = ['servant', 'group_leader', 'level_leader', 'assistant_servant']
  private static readonly BYPASS_ROLES = ['super_admin', 'admin', 'principal']

  // ─── Ownership check for student-scoped writes (P-C1) ───────────────────
  async assertCanWriteStudent(caller: any, studentId: string) {
    if (!caller) throw new ForbiddenException('Missing caller context')
    const roles: string[] = caller.roles ?? []
    if (roles.some(r => HymnLearningService.BYPASS_ROLES.includes(r))) return
    if (caller.id === studentId) return

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, groupId: true, parentEmail: true, deletedAt: true },
    })
    if (!student || student.deletedAt) throw new ForbiddenException('Student not found')

    if (roles.includes('parent')) {
      const link = await this.prisma.studentParent.findUnique({
        where: { studentId_parentId: { studentId, parentId: caller.id } },
      })
      if (link) return
      const parent = await this.prisma.user.findUnique({
        where: { id: caller.id },
        select: { email: true },
      })
      if (parent?.email && student.parentEmail === parent.email) return
      throw new ForbiddenException('You are not a parent of this student')
    }

    if (roles.some(r => HymnLearningService.SERVANT_ROLES.includes(r))) {
      const metadata = (caller.metadata ?? {}) as Record<string, any>
      if (metadata.groupId && metadata.groupId === student.groupId) return
      throw new ForbiddenException('Student is not in your group')
    }

    throw new ForbiddenException('Not allowed to write for this student')
  }

  // ─── Log a practice session + run SM-2 ──────────────────────────────────
  async logPracticeSession(dto: {
    studentId: string
    lessonId: string
    schoolId: string
    selfRating?: number
    recordingUrl?: string
    durationSec?: number
  }, caller?: any) {
    await this.assertCanWriteStudent(caller, dto.studentId)
    const quality = Math.max(1, Math.min(5, dto.selfRating ?? 3))

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
  async getStudentHymnMap(studentId: string, schoolId: string, maxLevelNumber?: number, groupId?: string | null, groupName?: string | null) {
    // Curriculum-integrated scoping: prefer the lessons actually ALLOCATED to
    // the student's level/group for the current academic year (deduplicated —
    // an item allocated to several weeks appears once). Fall back to published
    // lessons at or below the student's level only when nothing is allocated.
    let allocatedLessonIds: string[] | null = null
    try {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { levelId: true, group: { select: { name: true } } },
      });
      const levelId = student?.levelId ?? null;
      if (levelId) {
        // Prefer the current academic year; if that year has no allocations
        // for this level, use the most recent year that does.
        const gName = groupName ?? student?.group?.name ?? '';
        const gm = /^Group\s*(\d+)/i.exec(gName || '') || /^(\d+)/.exec(gName || '');
        const years = await this.prisma.academicYear.findMany({
          where: { schoolId },
          orderBy: { startDate: 'desc' },
          select: { id: true, isCurrent: true },
        });
        const ordered = [
          ...years.filter(y => y.isCurrent),
          ...years.filter(y => !y.isCurrent && !years.find(x => x.isCurrent)),
        ];
        for (const year of ordered.length ? ordered : [undefined as any]) {
          if (!year) break;
          const allocations = await this.prisma.curriculumAllocation.findMany({
            where: {
              status: { not: 'draft' },
              levelId,
              academicYearId: year.id,
              ...(gm ? { groupNumber: parseInt(gm[1], 10) } : {}),
            },
            select: { lessonId: true, orderIndex: true },
            orderBy: { orderIndex: 'asc' },
          });
          if (allocations.length > 0) {
            const seen = new Set<string>();
            allocatedLessonIds = allocations.map(a => a.lessonId).filter(id => !seen.has(id) && seen.add(id));
            break;
          }
        }
      }
    } catch {
      allocatedLessonIds = null; // graceful fallback below
    }

    const lessons = await this.prisma.lesson.findMany({
      where: {
        schoolId,
        deletedAt: null,
        status: 'published',
        ...(allocatedLessonIds && allocatedLessonIds.length > 0
          ? { id: { in: allocatedLessonIds } }
          : maxLevelNumber
            ? { level: { number: { lte: maxLevelNumber } } }
            : {}),
      },
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
        subjectItem: {
          select: { id: true, name: true, recordingUrl: true, recordingMeta: true },
        },
      },
      orderBy: [{ level: { number: 'asc' } }, { orderIndex: 'asc' }],
    })

    // Hide data-entry duplicates: same normalized title within the same level
    // shows once (the student's practice progress still tracks each lesson id).
    const seenTitles = new Set<string>();
    const deduped = lessons.filter(l => {
      const key = `${l.level?.number}|${(l.title || '').trim().toLowerCase()}`
      if (seenTitles.has(key)) return false
      seenTitles.add(key)
      return true
    })
    return deduped.map(l => ({
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
      referenceRecordingUrl: (l as any).subjectItem?.recordingUrl ?? null,
      referenceRecordingName: (l as any).subjectItem?.recordingMeta?.originalName ?? null,
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
  async reviewSession(sessionId: string, reviewerId: string, dto: { servantRating: number; servantNote?: string }, caller?: any) {
    const session = await this.prisma.hymnPracticeSession.findUnique({
      where: { id: sessionId },
      select: { id: true, studentId: true },
    })
    if (!session) throw new ForbiddenException('Session not found')
    await this.assertCanWriteStudent(caller, session.studentId)
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

  // ─── Servant: Get submissions for a lesson (group-scoped) ────────────────
  async getSubmissionsForServant(lessonId: string, servantGroupId: string, caller?: any) {
    // Ensure caller is a servant in this group
    const metadata = (caller.metadata ?? {}) as Record<string, any>
    if (!metadata.groupId || metadata.groupId !== servantGroupId) {
      throw new ForbiddenException('You can only review submissions from your own group')
    }

    const submissions = await this.prisma.lessonProgress.findMany({
      where: {
        lessonId,
        student: { groupId: servantGroupId } as any,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
        practiceSessions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })

    return submissions.map(s => ({
      id: s.id,
      studentId: s.student.id,
      studentName: `${s.student.firstName} ${s.student.lastName}`,
      lessonId: s.lessonId,
      recordingUrl: (s.practiceSessions[0] as any)?.recordingUrl,
      submittedAt: s.practiceSessions[0]?.createdAt ?? s.lastAccessedAt,
      selfRating: (s.practiceSessions[0] as any)?.selfRating,
      masteryStatus: s.masteryStatus,
      servantFeedback: s.servantFeedback,
      servantFeedbackAt: s.servantFeedbackAt,
      awaitingFeedback: !s.servantFeedback,
    }))
  }

  // ─── Servant: Add feedback to a lesson progress ──────────────────────────
  async addFeedback(progressId: string, feedbackText: string, servantId: string, caller?: any) {
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { id: progressId },
      include: { student: { select: { groupId: true } } },
    })
    if (!progress) throw new ForbiddenException('Progress record not found')

    // Ensure caller is servant in this group
    const metadata = (caller.metadata ?? {}) as Record<string, any>
    if (!metadata.groupId || metadata.groupId !== progress.student.groupId) {
      throw new ForbiddenException('You can only provide feedback for students in your group')
    }

    return this.prisma.lessonProgress.update({
      where: { id: progressId },
      data: {
        servantFeedback: feedbackText.slice(0, 200),
        servantFeedbackAt: new Date(),
        servantId,
      },
    })
  }
}

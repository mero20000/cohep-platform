import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { StudentNotificationsService } from '../student-notifications/student-notifications.service'
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

/**
 * The SM-2 quality for one practice session.
 *
 * A servant's rating outranks the student's self-rating wherever one exists, so a 1★
 * review can correct an inflated self-assessment — previously the servant's rating was
 * written to the row and never read by the scheduler, making it decorative exactly where
 * it mattered most. An unreviewed session still counts on its self-rating, so the loop
 * never stalls waiting on the school-wide review queue.
 */
function practiceQuality(s: { servantRating?: number | null; selfRating?: number | null }): number {
  return Math.max(0, Math.min(5, s.servantRating ?? s.selfRating ?? 3))
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentNotifications: StudentNotificationsService,
  ) {}

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

  // ─── Delete a practice session and reset progress ────────────────────────
  async deletePracticeSession(sessionId: string, caller?: any) {
    const session = await this.prisma.hymnPracticeSession.findUnique({
      where: { id: sessionId },
      select: { studentId: true, lessonId: true, progressId: true },
    })
    if (!session) throw new Error('Session not found')

    await this.assertCanWriteStudent(caller, session.studentId)

    // Check if session has been reviewed by servant
    const reviewed = await this.prisma.hymnPracticeSession.findUnique({
      where: { id: sessionId },
      select: { servantReviewedAt: true },
    })
    if (reviewed?.servantReviewedAt) {
      throw new ForbiddenException('Cannot delete reviewed submission')
    }

    // Delete the session
    await this.prisma.hymnPracticeSession.delete({ where: { id: sessionId } })

    // Progress used to be reset to not_started unconditionally, regardless of how many
    // sessions survived: a mastered hymn with eight sessions dropped to zero because the
    // student removed a ninth, while the eight remaining sessions still showed in history.
    // Rebuild from what is actually left instead.
    await this.recomputeProgressFromSessions(session.studentId, session.lessonId)

    return { success: true }
  }

  /**
   * Rebuild LessonProgress by replaying SM-2 over the sessions that remain, oldest first.
   *
   * This is the single source of truth for progress after any change to the session set —
   * a deletion, or a servant review that supersedes a self-rating. With no sessions left
   * it resets to not_started, which is the only case where the old behaviour was right.
   */
  private async recomputeProgressFromSessions(studentId: string, lessonId: string) {
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
      select: { id: true },
    })
    if (!progress) return

    const sessions = await this.prisma.hymnPracticeSession.findMany({
      where: { studentId, lessonId },
      orderBy: { createdAt: 'asc' },
      select: { selfRating: true, servantRating: true, createdAt: true },
    })

    if (sessions.length === 0) {
      await this.prisma.lessonProgress.update({
        where: { id: progress.id },
        data: {
          status: 'not_started',
          masteryStatus: 'not_started',
          sessionsCompleted: 0,
          srEaseFactor: 2.5,
          srInterval: 1,
          srRepetitions: 0,
          nextReviewAt: null,
          progressPercent: 0,
          completedAt: null,
          lastAccessedAt: new Date(),
        } as any,
      })
      return
    }

    let ef = 2.5
    let interval = 1
    let rep = 0
    let quality = 3
    for (const s of sessions) {
      quality = practiceQuality(s)
      const sr = sm2(ef, interval, rep, quality)
      ef = sr.easeFactor
      interval = sr.interval
      rep = sr.repetitions
    }

    // The next review is due relative to the last surviving session, not to now —
    // otherwise deleting an old session would push the review date forward.
    const lastAt = sessions[sessions.length - 1].createdAt
    const nextReviewAt = new Date(lastAt)
    nextReviewAt.setDate(nextReviewAt.getDate() + interval)

    const mastery = masteryFromRepetitions(rep, quality)

    await this.prisma.lessonProgress.update({
      where: { id: progress.id },
      data: {
        status: mastery,
        masteryStatus: mastery,
        sessionsCompleted: sessions.length,
        srEaseFactor: ef,
        srInterval: interval,
        srRepetitions: rep,
        nextReviewAt,
        progressPercent: Math.min(100, (rep / 5) * 100),
        completedAt: mastery === 'mastered' ? lastAt : null,
        lastAccessedAt: new Date(),
      } as any,
    })
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

    // The lessonId arrives from the client. Without this check a student can log practice
    // against — and so create LessonProgress for — a lesson belonging to another school.
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: dto.lessonId, deletedAt: null },
      select: { id: true, schoolId: true },
    })
    if (!lesson) throw new NotFoundException('Lesson not found')
    if (lesson.schoolId !== dto.schoolId) {
      throw new ForbiddenException('This lesson does not belong to your school')
    }

    const quality = Math.max(1, Math.min(5, dto.selfRating ?? 3))

    // Upsert LessonProgress
    // Only select SR fields needed for calculation, avoiding non-existent servant fields
    let progress = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: dto.studentId, lessonId: dto.lessonId } },
      select: {
        id: true,
        srEaseFactor: true,
        srInterval: true,
        srRepetitions: true,
      },
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
            // Clergy write these three; no student endpoint returned any of them, so a
            // student was never told they had been cleared to sing in the liturgy.
            isReadyForLiturgy: true, readyForLiturgyAt: true, clergyNotes: true,
          },
        } as any,
        // Narrowing to audio+video made a PDF of lyrics or notation attached to a lesson
        // invisible to the student by construction. Documents are what a student reads
        // while practising, so they are the last thing that should be filtered out.
        resources: {
          where: { deletedAt: null },
          select: {
            id: true, type: true, title: true, titleAr: true, fileUrl: true,
            language: true, durationSeconds: true, isDownloadable: true,
          },
          orderBy: { orderIndex: 'asc' },
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
      // resources is no longer audio-only, so the reference recording has to be found by
      // type rather than by taking the first row.
      audioUrl: (l as any).audioUrl ?? l.resources.find(r => r.type === 'audio')?.fileUrl ?? null,
      // A student was previously given a single audio file and no text of any kind — no
      // lyrics, no Coptic, no transliteration, no pronunciation guide. These four columns
      // existed on the lesson all along and were never surfaced.
      description: l.description,
      descriptionAr: l.descriptionAr,
      requiredMemorization: l.requiredMemorization,
      requiredMemorizationAr: l.requiredMemorizationAr,
      objectives: l.objectives,
      objectivesAr: l.objectivesAr,
      presentationUrl: l.presentationUrl,
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
            // The due-for-review path narrowed to a single audio file, so a hymn's lyrics
            // and notation vanished exactly when the student came back to revise it.
            resources: {
              where: { deletedAt: null },
              select: {
                id: true, type: true, title: true, titleAr: true, fileUrl: true,
                language: true, durationSeconds: true, isDownloadable: true,
              },
              orderBy: { orderIndex: 'asc' },
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
        audioUrl: (p.lesson as any).audioUrl ?? p.lesson.resources.find(r => r.type === 'audio')?.fileUrl ?? null,
        resources: p.lesson.resources,
        description: p.lesson.description,
        descriptionAr: p.lesson.descriptionAr,
        requiredMemorization: p.lesson.requiredMemorization,
        requiredMemorizationAr: p.lesson.requiredMemorizationAr,
        presentationUrl: p.lesson.presentationUrl,
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
      select: { id: true, studentId: true, lessonId: true },
    })
    if (!session) throw new ForbiddenException('Session not found')
    await this.assertCanWriteStudent(caller, session.studentId)
    const updated = await this.prisma.hymnPracticeSession.update({
      where: { id: sessionId },
      data: {
        servantRating: dto.servantRating,
        servantNote: dto.servantNote,
        reviewedBy: reviewerId,
        servantReviewedAt: new Date(),
      } as any,
    })

    // The servant's rating now outranks the self-rating in SM-2, so the schedule has to
    // be rebuilt when a review lands — not only when the student submits.
    await this.recomputeProgressFromSessions(session.studentId, session.lessonId)

    // Feedback did reach the student before this, but only if they thought to open that
    // one specific hymn. Now they are told.
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: session.lessonId },
      select: { title: true, titleAr: true },
    })
    await this.studentNotifications.notifyOrRefresh({
      studentId: session.studentId,
      type: 'practice_reviewed',
      title: 'A servant reviewed your practice',
      titleAr: 'قام أحد الخدام بمراجعة تدريبك',
      body: [lesson?.title, `${dto.servantRating}/5`, dto.servantNote].filter(Boolean).join(' — '),
      bodyAr: [lesson?.titleAr ?? lesson?.title, `${dto.servantRating}/5`, dto.servantNote].filter(Boolean).join(' — '),
      linkPath: '?tab=hymns',
      referenceType: 'hymn_practice_session',
      referenceId: sessionId,
    })

    return updated
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
  /**
   * Stats are derived from the same hymn map the student actually sees.
   *
   * They used to count every published lesson school-wide as the denominator and derive
   * not_started by subtracting the student's progress rows — which are not restricted to
   * that set. The two views therefore contradicted each other, and not_started could go
   * negative whenever a student had progress on a hymn outside their allocations. Sharing
   * one source makes disagreement impossible rather than merely unlikely.
   */
  async getStudentStats(
    studentId: string,
    schoolId: string,
    maxLevelNumber?: number,
    levelId?: string | null,
    groupName?: string | null,
  ) {
    const map = await this.getStudentHymnMap(studentId, schoolId, maxLevelNumber, levelId, groupName)

    const counts = { not_started: 0, introduced: 0, practicing: 0, known: 0, mastered: 0 }
    let touched = 0
    for (const item of map as any[]) {
      const s = (item.progress?.masteryStatus ?? 'not_started') as keyof typeof counts
      counts[s] = (counts[s] ?? 0) + 1
      if (item.progress) touched++
    }

    return { total: map.length, ...counts, touched }
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
    }))
  }

  // ─── Servant: Add feedback to a lesson progress ──────────────────────────
  // TODO: Implement when servant_feedback column is added to database
  async addFeedback(progressId: string, feedbackText: string, servantId: string, caller?: any) {
    throw new Error('Feature not yet implemented: servant feedback requires database schema update')
  }

  // ─── Clergy: Get pending verifications for upcoming Sunday ──────────────────
  async getPendingVerificationsForClergy(schoolId: string, caller?: any) {
    const lessonsForSunday = await this.prisma.lesson.findMany({
      where: { schoolId },
      select: { id: true, title: true, titleAr: true },
    })

    if (!lessonsForSunday.length) {
      return { verifications: [], total: 0, pending: 0 }
    }

    const lessonIds = lessonsForSunday.map(l => l.id)

    const pendingProgress = await this.prisma.lessonProgress.findMany({
      where: {
        lessonId: { in: lessonIds },
        isReadyForLiturgy: false,
        masteryStatus: { in: ['practicing', 'known', 'mastered'] },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
        lesson: { select: { id: true, title: true, titleAr: true } },
        practiceSessions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    })

    const verifications = pendingProgress.map(p => ({
      id: p.id,
      studentId: p.student.id,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
      lessonId: p.lessonId,
      lessonTitle: p.lesson.title,
      masteryStatus: p.masteryStatus,
      selfRating: (p.practiceSessions[0] as any)?.selfRating,
      recordingUrl: (p.practiceSessions[0] as any)?.recordingUrl,
      recordingDuration: (p.practiceSessions[0] as any)?.durationSec,
      lastPracticedAt: p.practiceSessions[0]?.createdAt,
    }))

    return {
      verifications,
      total: verifications.length,
      pending: verifications.length,
    }
  }

  // ─── Clergy: Mark a student ready for liturgy ────────────────────────────────
  async markReadyForLiturgy(progressId: string, notes: string | undefined, clergyId: string, caller?: any) {
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { id: progressId },
      include: { student: true, lesson: true },
    })
    if (!progress) throw new ForbiddenException('Progress record not found')

    // Verify progress exists (date validation removed - liturgicalDate field not available)
    // TODO: Add proper date validation when liturgicalDate is added to schema

    if (progress.masteryStatus === 'not_started') {
      throw new ForbiddenException('Student has not begun practicing this hymn')
    }

    const cleared = await this.prisma.lessonProgress.update({
      where: { id: progressId },
      data: {
        isReadyForLiturgy: true,
        readyForLiturgyAt: new Date(),
        clergyId,
        clergyNotes: notes ? notes.slice(0, 300) : null,
      },
    })

    // Arguably the single most meaningful moment in this platform's purpose, and until now
    // the student was never told it had happened.
    await this.studentNotifications.notifyOrRefresh({
      studentId: progress.studentId,
      type: 'liturgy_clearance',
      title: 'You are cleared to sing in the liturgy',
      titleAr: 'تم اعتمادك للترتيل في القداس',
      body: [progress.lesson?.title, notes].filter(Boolean).join(' — '),
      bodyAr: [progress.lesson?.titleAr ?? progress.lesson?.title, notes].filter(Boolean).join(' — '),
      linkPath: '?tab=hymns',
      referenceType: 'lesson_progress',
      referenceId: progressId,
    })

    return cleared
  }

  // ─── Clergy: Get all verifications for a student (readiness summary) ────────
  async getStudentLiturgyReadiness(studentId: string, schoolId: string, caller?: any) {
    const lessonsForSunday = await this.prisma.lesson.findMany({
      where: { schoolId },
      select: { id: true, title: true, titleAr: true },
    })

    const lessonIds = lessonsForSunday.map(l => l.id)

    const progress = await this.prisma.lessonProgress.findMany({
      where: {
        studentId,
        lessonId: { in: lessonIds },
      },
      include: {
        lesson: { select: { id: true, title: true, titleAr: true } },
      },
    })

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
    })

    return {
      studentId,
      studentName: `${student?.firstName} ${student?.lastName}`,
      lessons: progress.map(p => ({
        lessonId: p.lessonId,
        lessonTitle: p.lesson.title,
        masteryStatus: p.masteryStatus,
        isReadyForLiturgy: p.isReadyForLiturgy,
        readyForLiturgyAt: p.readyForLiturgyAt,
      })),
      overallReadyCount: progress.filter(p => p.isReadyForLiturgy).length,
      totalLessonsForSunday: progress.length,
    }
  }
}

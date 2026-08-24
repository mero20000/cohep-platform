import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { CreateBadgeDto, UpdateBadgeDto } from './dto/gamification.dto';

interface BadgeCheckResult {
  badgeId: string
  earned: boolean
  reason?: string
}

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private schoolResolver: SchoolResolver,
  ) {}

  async getLeaderboard(schoolIdentifier: string, limit = 20) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const xpAggregates = await this.prisma.xPTransaction.groupBy({
      by: ['studentId'],
      where: { student: { schoolId, deletedAt: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    const leaderboard = await Promise.all(
      xpAggregates.map(async (entry, index) => {
        const student = await this.prisma.student.findUnique({
          where: { id: entry.studentId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });
        const badgeCount = await this.prisma.studentBadge.count({
          where: { studentId: entry.studentId },
        });
        const totalXp = entry._sum.amount || 0;
        const level = Math.floor(totalXp / 100) + 1;
        return {
          id: student?.id || entry.studentId,
          firstName: student?.firstName || 'Unknown',
          lastName: student?.lastName || '',
          xp: totalXp,
          level,
          streak: 0,
          rank: index + 1,
          badgeCount,
        };
      }),
    );

    return leaderboard;
  }

  async getStudentStats(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const xpResult = await this.prisma.xPTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
      _count: true,
    });

    const badgeCount = await this.prisma.studentBadge.count({ where: { studentId } });

    const recentTransactions = await this.prisma.xPTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { createdAt: true },
    });

    let streak = 0;
    if (recentTransactions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentDate = today;

      for (const tx of recentTransactions) {
        const txDate = new Date(tx.createdAt);
        txDate.setHours(0, 0, 0, 0);
        if (txDate.getTime() === currentDate.getTime()) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else if (txDate.getTime() < currentDate.getTime()) {
          break;
        }
      }
    }

    const totalXp = xpResult._sum.amount || 0;
    const level = Math.floor(totalXp / 100) + 1;

    return {
      studentId,
      totalXp,
      badgeCount,
      streak,
      level,
      xpTransactions: xpResult._count,
    };
  }

  async getAllBadges(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    return this.prisma.badge.findMany({
      where: { schoolId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBadge(data: CreateBadgeDto) {
    if (!data.schoolId) throw new BadRequestException('schoolId is required to create a badge');
    const schoolId = await this.schoolResolver.resolve(data.schoolId);
    return this.prisma.badge.create({
      data: {
        schoolId,
        name: data.name,
        description: data.description,
        category: data.category,
        iconUrl: data.iconUrl || '',
        xpReward: data.points || 0,
        criteria: data.criteria || {},
        isActive: true,
        isSecret: false,
      },
    });
  }

  async updateBadge(id: string, data: UpdateBadgeDto) {
    const badge = await this.prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundException('Badge not found');
    return this.prisma.badge.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
        ...(data.points !== undefined && { xpReward: data.points }),
        ...(data.criteria !== undefined && { criteria: data.criteria }),
      },
    });
  }

  async deleteBadge(id: string) {
    const badge = await this.prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundException('Badge not found');
    return this.prisma.badge.delete({ where: { id } });
  }

  async awardBadge(studentId: string, badgeId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const badge = await this.prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) throw new NotFoundException('Badge not found');

    const existing = await this.prisma.studentBadge.findFirst({
      where: { studentId, badgeId },
    });
    if (existing) throw new BadRequestException('Badge already awarded to this student');

    const result = await this.prisma.studentBadge.create({
      data: { studentId, badgeId },
      include: { badge: true, student: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (badge.xpReward > 0) {
      await this.addXp(studentId, badge.xpReward, 'badge_award', `Badge: ${badge.name}`);
    }

    return result;
  }

  async revokeBadge(studentBadgeId: string) {
    const studentBadge = await this.prisma.studentBadge.findUnique({ where: { id: studentBadgeId } });
    if (!studentBadge) throw new NotFoundException('Student badge record not found');
    return this.prisma.studentBadge.delete({ where: { id: studentBadgeId } });
  }

  // ── Badge Computation Engine ──

  async computeBadgesForStudent(studentId: string, badgeId?: string): Promise<{ awarded: number; total: number }> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true, groupId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const badges = badgeId
      ? [await this.prisma.badge.findUnique({ where: { id: badgeId } })].filter(Boolean)
      : await this.prisma.badge.findMany({ where: { schoolId: student.schoolId, isActive: true } });

    let awarded = 0;
    for (const badge of badges) {
      if (!badge) continue;
      const alreadyOwned = await this.prisma.studentBadge.findFirst({
        where: { studentId, badgeId: badge.id },
      });
      if (alreadyOwned) continue;

      const result = await this.checkBadgeCriterion(student, badge);
      if (result.earned) {
        try {
          await this.prisma.studentBadge.create({
            data: {
              studentId,
              badgeId: badge.id,
              reason: result.reason || undefined,
            },
          });
          if (badge.xpReward > 0) {
            await this.addXp(studentId, badge.xpReward, 'badge_award', `Badge: ${badge.name}`);
          }
          awarded++;
        } catch {
          // ignore duplicate race conditions
        }
      }
    }
    return { awarded, total: badges.length };
  }

  private async checkBadgeCriterion(student: { id: string; schoolId: string; groupId: string | null }, badge: any): Promise<BadgeCheckResult> {
    const criteria = (badge.criteria || {}) as Record<string, any>;
    const rule = criteria.rule as string;

    switch (rule) {
      case 'perfect_week':
        return this.checkPerfectWeek(student);
      case 'perfect_month':
        return this.checkPerfectMonth(student);
      case 'behavior_streak':
        return this.checkBehaviorStreak(student, criteria.count as number ?? 3);
      case 'participation_total':
        return this.checkParticipationTotal(student, criteria.count as number ?? 5);
      case 'liturgy_total':
        return this.checkLiturgyTotal(student, criteria.count as number ?? 5);
      case 'attendance_total':
        return this.checkAttendanceTotal(student, criteria.count as number ?? 50);
      case 'attendance_streak':
        return this.checkAttendanceStreak(student, criteria.weeks as number ?? 4);
      case 'points_total':
        return this.checkPointsTotal(student, criteria.points as number ?? 500);
      case 'attendance_improvement':
        return this.checkAttendanceImprovement(student, criteria.percent as number ?? 15);
      case 'assessment_perfect':
        return this.checkAssessmentPerfect(student);
      case 'xp_total':
        return this.checkXpTotal(student, criteria.xp as number ?? 1000);
      case 'practice_total':
        return this.checkPracticeTotal(student, criteria.count as number ?? 5);
      case 'practice_streak':
        return this.checkPracticeStreak(student, criteria.weeks as number ?? 3);
      case 'subject_items_passed':
        return this.checkSubjectItemsPassed(student, criteria.count as number ?? 5);
      case 'recordings_submitted':
        return this.checkRecordingsSubmitted(student, criteria.count as number ?? 5);
      case 'assessment_streak':
        return this.checkAssessmentStreak(student, criteria.count as number ?? 3);
      case 'parent_reports_total':
        return this.checkParentReportsTotal(student, criteria.count as number ?? 3);
      default:
        return { badgeId: badge.id, earned: false };
    }
  }

  private async checkPerfectWeek(student: { id: string; groupId: string | null }): Promise<BadgeCheckResult> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        groupId: student.groupId ?? undefined,
        scheduledDate: { gte: startOfWeek, lt: now },
        status: 'completed',
      },
      select: { id: true },
    });
    if (sessions.length === 0) return { badgeId: '', earned: false };

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId: student.id,
        attendanceSessionId: { in: sessions.map(s => s.id) },
      },
      select: { status: true },
    });
    if (records.length === 0) return { badgeId: '', earned: false };
    const allPresent = records.every(r => r.status === 'present' || r.status === 'late');
    return {
      badgeId: '',
      earned: allPresent,
      reason: allPresent ? `Attended ${records.length}/${sessions.length} sessions this week` : undefined,
    };
  }

  private async checkPerfectMonth(student: { id: string; groupId: string | null }): Promise<BadgeCheckResult> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        groupId: student.groupId ?? undefined,
        scheduledDate: { gte: startOfMonth, lt: now },
        status: 'completed',
      },
      select: { id: true },
    });
    if (sessions.length === 0) return { badgeId: '', earned: false };

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: student.id, attendanceSessionId: { in: sessions.map(s => s.id) } },
      select: { status: true },
    });
    if (records.length === 0) return { badgeId: '', earned: false };
    const allPresent = records.every(r => r.status === 'present' || r.status === 'late');
    return {
      badgeId: '',
      earned: allPresent,
      reason: allPresent ? `Perfect attendance this month (${records.length}/${sessions.length})` : undefined,
    };
  }

  private async checkBehaviorStreak(student: { id: string }, consecutive: number): Promise<BadgeCheckResult> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: student.id, behavior: { not: null } },
      orderBy: { attendanceSession: { scheduledDate: 'desc' } },
      select: { behavior: true, attendanceSession: { select: { scheduledDate: true } } },
      take: 50,
    });
    if (records.length < consecutive) return { badgeId: '', earned: false };

    let streak = 0;
    for (const r of records) {
      if ((r.behavior ?? 0) >= 5) {
        streak++;
        if (streak >= consecutive) break;
      } else {
        streak = 0;
      }
    }
    if (streak >= consecutive) {
      return { badgeId: '', earned: true, reason: `Behavior score 5/5 for ${consecutive} consecutive sessions` };
    }
    return { badgeId: '', earned: false };
  }

  private async checkParticipationTotal(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const total = await this.prisma.attendanceRecord.count({
      where: { studentId: student.id, participation: { gte: 5 } },
    });
    return {
      badgeId: '',
      earned: total >= count,
      reason: total >= count ? `${total} sessions with perfect participation` : undefined,
    };
  }

  private async checkLiturgyTotal(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const total = await this.prisma.attendanceRecord.count({
      where: { studentId: student.id, attendedLiturgy: true },
    });
    return {
      badgeId: '',
      earned: total >= count,
      reason: total >= count ? `Attended liturgy ${total} times` : undefined,
    };
  }

  private async checkAttendanceTotal(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const total = await this.prisma.attendanceRecord.count({
      where: { studentId: student.id, status: 'present' },
    });
    return {
      badgeId: '',
      earned: total >= count,
      reason: total >= count ? `Attended ${total} sessions total` : undefined,
    };
  }

  private async checkAttendanceStreak(student: { id: string; groupId: string | null }, weeks: number): Promise<BadgeCheckResult> {
    const now = new Date();
    const pastWeeks: { start: Date; end: Date }[] = [];
    for (let w = 0; w < weeks; w++) {
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      pastWeeks.push({ start, end });
    }

    for (const week of pastWeeks) {
      const sessions = await this.prisma.attendanceSession.findMany({
        where: {
          groupId: student.groupId ?? undefined,
          scheduledDate: { gte: week.start, lt: week.end },
          status: 'completed',
        },
        select: { id: true },
      });
      if (sessions.length === 0) continue;

      const records = await this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id, attendanceSessionId: { in: sessions.map(s => s.id) } },
        select: { status: true },
      });
      const attended = records.some(r => r.status === 'present' || r.status === 'late');
      if (!attended) return { badgeId: '', earned: false };
    }
    return { badgeId: '', earned: true, reason: `Attended at least one session each week for ${weeks} weeks` };
  }

  private async checkPointsTotal(student: { id: string; schoolId: string }, points: number): Promise<BadgeCheckResult> {
    const [attRecords, pointConfig] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        select: { status: true, behavior: true, participation: true, attendedLiturgy: true },
      }),
      this.prisma.systemConfig.findUnique({
        where: { schoolId_key: { schoolId: student.schoolId, key: 'point_rules' } },
        select: { value: true },
      }),
    ]);
    const rules: any = (pointConfig?.value as any) || {};
    const presentPoints = rules.presentPoints ?? 5;
    const liturgyPoints = rules.liturgyPoints ?? 3;
    const totalPoints = attRecords.reduce((sum: number, r: any) => {
      let s = 0;
      if (r.status === 'present') s += presentPoints;
      if (r.behavior) s += r.behavior;
      if (r.participation) s += r.participation;
      if (r.attendedLiturgy) s += liturgyPoints;
      return sum + s;
    }, 0);
    return {
      badgeId: '',
      earned: totalPoints >= points,
      reason: totalPoints >= points ? `Accumulated ${totalPoints} total points` : undefined,
    };
  }

  private async checkAttendanceImprovement(student: { id: string; groupId: string | null }, percent: number): Promise<BadgeCheckResult> {
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const countRate = async (from: Date, to: Date) => {
      const sessions = await this.prisma.attendanceSession.findMany({
        where: {
          groupId: student.groupId ?? undefined,
          scheduledDate: { gte: from, lte: to },
          status: 'completed',
        },
        select: { id: true },
      });
      if (sessions.length === 0) return 0;
      const records = await this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id, attendanceSessionId: { in: sessions.map(s => s.id) } },
        select: { status: true },
      });
      if (records.length === 0) return 0;
      const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
      return present / records.length;
    };

    const [currentRate, lastRate] = await Promise.all([
      countRate(startThisMonth, now),
      countRate(startLastMonth, endLastMonth),
    ]);
    if (lastRate === 0) return { badgeId: '', earned: false };
    const improvement = ((currentRate - lastRate) / lastRate) * 100;
    return {
      badgeId: '',
      earned: improvement >= percent,
      reason: improvement >= percent ? `Attendance improved by ${Math.round(improvement)}%` : undefined,
    };
  }

  private async checkAssessmentPerfect(student: { id: string }): Promise<BadgeCheckResult> {
    const submissions = await this.prisma.assessmentSubmission.findMany({
      where: { studentId: student.id, status: 'submitted' },
      select: {
        id: true,
        grades: { select: { score: true, maxScore: true } },
      },
      take: 50,
    });
    for (const sub of submissions) {
      if (sub.grades.length === 0) continue;
      const allPerfect = sub.grades.every(g => Number(g.score) >= Number(g.maxScore));
      if (allPerfect) {
        return { badgeId: '', earned: true, reason: 'Scored 100% on an assessment' };
      }
    }
    return { badgeId: '', earned: false };
  }

  private async checkXpTotal(student: { id: string }, xp: number): Promise<BadgeCheckResult> {
    const result = await this.prisma.xPTransaction.aggregate({
      where: { studentId: student.id },
      _sum: { amount: true },
    });
    const total = result._sum.amount || 0;
    return {
      badgeId: '',
      earned: total >= xp,
      reason: total >= xp ? `Earned ${total} XP total` : undefined,
    };
  }

  private async checkPracticeTotal(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const total = await this.prisma.familyPractice.count({ where: { studentId: student.id } });
    return {
      badgeId: '',
      earned: total >= count,
      reason: total >= count ? `Practiced ${total} times` : undefined,
    };
  }

  private async checkPracticeStreak(student: { id: string }, weeks: number): Promise<BadgeCheckResult> {
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    let consecutiveWeeks = 0;
    let checkDate = new Date(startOfThisWeek);

    for (let i = 0; i < weeks + 2; i++) {
      const weekStart = new Date(checkDate);
      weekStart.setDate(checkDate.getDate() - (consecutiveWeeks === 0 ? 0 : consecutiveWeeks * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const count = await this.prisma.familyPractice.count({
        where: { studentId: student.id, practicedAt: { gte: weekStart, lte: weekEnd } },
      });
      if (count > 0) {
        consecutiveWeeks++;
      } else if (consecutiveWeeks > 0) {
        break;
      }
      if (consecutiveWeeks >= weeks) break;
    }

    return {
      badgeId: '',
      earned: consecutiveWeeks >= weeks,
      reason: consecutiveWeeks >= weeks ? `Practiced for ${consecutiveWeeks} consecutive weeks` : undefined,
    };
  }

  private async checkSubjectItemsPassed(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const total = await this.prisma.studentSubjectPass.count({ where: { studentId: student.id } });
    return {
      badgeId: '',
      earned: total >= count,
      reason: total >= count ? `Passed ${total} subject items` : undefined,
    };
  }

  private async checkRecordingsSubmitted(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const total = await this.prisma.hymnPracticeSession.count({
      where: { studentId: student.id, recordingUrl: { not: null } },
    });
    return {
      badgeId: '',
      earned: total >= count,
      reason: total >= count ? `Submitted ${total} recordings` : undefined,
    };
  }

  private async checkAssessmentStreak(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const submissions = await this.prisma.assessmentSubmission.findMany({
      where: { studentId: student.id },
      select: {
        grades: { select: { score: true, maxScore: true } },
        assessment: { select: { passingScore: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: count,
    });
    if (submissions.length < count) return { badgeId: '', earned: false };

    const allPassed = submissions.every(sub => {
      if (sub.grades.length === 0) return false;
      const total = sub.grades.reduce((s, g) => s + Number(g.score), 0);
      const max = sub.grades.reduce((s, g) => s + Number(g.maxScore), 0);
      const pct = max > 0 ? (total / max) * 100 : 0;
      return pct >= Number(sub.assessment.passingScore);
    });

    return {
      badgeId: '',
      earned: allPassed,
      reason: allPassed ? `Passed ${count} consecutive assessments` : undefined,
    };
  }

  private async checkParentReportsTotal(student: { id: string }, count: number): Promise<BadgeCheckResult> {
    const total = await this.prisma.assessmentSubmission.count({
      where: { studentId: student.id, metadata: { path: ['source'], equals: 'parent_home_practice' } },
    });
    return {
      badgeId: '',
      earned: total >= count,
      reason: total >= count ? `Parent reported ${total} assessments` : undefined,
    };
  }

  async computeAllBadges(schoolIdentifier: string): Promise<{ total: number; awarded: number; errors: number }> {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true },
    });

    // M15: process students concurrently with a bounded pool to avoid slow serial
    // runs on large schools while still capping DB load.
    const CONCURRENCY = 5;
    const results = await this.studentBadgeWorker(students, CONCURRENCY);

    let awarded = 0;
    let errors = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        awarded += r.value.awarded;
      } else {
        errors++;
      }
    }
    return { total: students.length, awarded, errors };
  }

  private async studentBadgeWorker(
    students: { id: string }[],
    concurrency: number,
  ): Promise<PromiseSettledResult<{ awarded: number }>[]> {
    const results: PromiseSettledResult<{ awarded: number }>[] = [];
    let index = 0;
    let completed = 0;
    return new Promise(resolve => {
      const runWorker = async () => {
        while (index < students.length) {
          const i = index++;
          try {
            const result = await this.computeBadgesForStudent(students[i].id);
            results.push({ status: 'fulfilled', value: { awarded: result.awarded } });
          } catch (err) {
            results.push({ status: 'rejected', reason: err });
          }
          completed++;
          if (completed === students.length) resolve(results);
        }
      };
      const n = Math.min(concurrency, Math.max(students.length, 1));
      for (let w = 0; w < n; w++) void runWorker();
    });
  }

  async addXp(studentId: string, amount: number, type: string, description?: string) {
    return this.prisma.$transaction(async tx => {
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException('Student not found');

      // M14: serialize concurrent awards for the same student by locking the
      // student row, then recompute the balance inside the same transaction so
      // read-modify-write is atomic.
      await tx.$queryRawUnsafe('SELECT id FROM students WHERE id = $1 FOR UPDATE', studentId);

      const currentBalance = await tx.xPTransaction.aggregate({
        where: { studentId },
        _sum: { amount: true },
      });

      const balanceAfter = (currentBalance._sum.amount || 0) + amount;

      return tx.xPTransaction.create({
        data: {
          studentId,
          amount,
          balanceAfter,
          type,
          description,
        },
      });
    });
  }

  async getStudentBadges(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.studentBadge.findMany({
      where: { studentId },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });
  }

  async getStudentTransactions(studentId: string, skip = 0, take = 50) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const [items, total] = await Promise.all([
      this.prisma.xPTransaction.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.xPTransaction.count({ where: { studentId } }),
    ]);

    return { items, total, skip, take };
  }

  async resetLeaderboard(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true },
    });
    const ids = students.map(s => s.id);
    await this.prisma.xPTransaction.deleteMany({ where: { studentId: { in: ids } } });
    return { message: `Leaderboard reset for ${ids.length} students` };
  }

  // ── Personal Growth Mirror ─────────────────────────────────────────────

  async getPersonalGrowthMirror(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { level: { select: { number: true, name: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    // XP per calendar month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const allTx = await this.prisma.xPTransaction.findMany({
      where: { studentId, createdAt: { gte: sixMonthsAgo } },
      select: { amount: true, createdAt: true, type: true },
      orderBy: { createdAt: 'asc' },
    });

    // Bucket by month
    const monthMap: Record<string, number> = {};
    for (const tx of allTx) {
      const key = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] || 0) + tx.amount;
    }
    const monthlyXp = Object.entries(monthMap).map(([month, xp]) => ({ month, xp }));

    // Running XP total at start vs now
    const totalXpResult = await this.prisma.xPTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });
    const totalXp = totalXpResult._sum.amount || 0;

    const oneMonthAgoXpResult = await this.prisma.xPTransaction.aggregate({
      where: { studentId, createdAt: { lt: new Date(new Date().setMonth(new Date().getMonth() - 1)) } },
      _sum: { amount: true },
    });
    const xpOneMonthAgo = oneMonthAgoXpResult._sum.amount || 0;
    const xpGainedThisMonth = totalXp - xpOneMonthAgo;
    const growthPercent = xpOneMonthAgo > 0
      ? Math.round(((totalXp - xpOneMonthAgo) / xpOneMonthAgo) * 100)
      : 0;

    // Attendance rate this month vs last month
    const today = new Date();
    const startThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const thisMonthAtt = await this.prisma.attendanceRecord.findMany({
      where: { studentId, attendanceSession: { scheduledDate: { gte: startThisMonth } } },
      select: { status: true },
    });
    const lastMonthAtt = await this.prisma.attendanceRecord.findMany({
      where: { studentId, attendanceSession: { scheduledDate: { gte: startLastMonth, lte: endLastMonth } } },
      select: { status: true },
    });

    const rate = (recs: { status: string }[]) => {
      if (!recs.length) return 0;
      return Math.round(recs.filter(r => r.status === 'present' || r.status === 'late').length / recs.length * 100);
    };
    const thisMonthRate = rate(thisMonthAtt);
    const lastMonthRate = rate(lastMonthAtt);
    const attendanceImprovement = thisMonthRate - lastMonthRate;

    // Assessments passed this month vs last
    const passedThisMonth = await this.prisma.assessmentSubmission.count({
      where: {
        studentId, status: 'submitted',
        createdAt: { gte: startThisMonth },
        grades: { some: { score: { gt: 0 } } },
      },
    });
    const passedLastMonth = await this.prisma.assessmentSubmission.count({
      where: {
        studentId, status: 'submitted',
        createdAt: { gte: startLastMonth, lte: endLastMonth },
        grades: { some: { score: { gt: 0 } } },
      },
    });

    // Badges timeline
    const badgeTimeline = await this.prisma.studentBadge.findMany({
      where: { studentId },
      include: { badge: { select: { name: true, category: true, iconUrl: true } } },
      orderBy: { awardedAt: 'asc' },
    });

    return {
      studentId,
      levelNumber: student.level?.number,
      levelName: student.level?.name,
      totalXp,
      xpOneMonthAgo,
      xpGainedThisMonth,
      growthPercent,
      monthlyXp,
      attendance: {
        thisMonth: thisMonthRate,
        lastMonth: lastMonthRate,
        improvement: attendanceImprovement,
      },
      assessments: {
        passedThisMonth,
        passedLastMonth,
        improvement: passedThisMonth - passedLastMonth,
      },
      badgeTimeline: badgeTimeline.map(b => ({
        badgeName: b.badge.name,
        category: b.badge.category,
        icon: b.badge.iconUrl,
        earnedAt: b.awardedAt,
      })),
      totalBadges: badgeTimeline.length,
    };
  }

  // ── Group Trophy ────────────────────────────────────────────────────────

  async getGroupTrophy(groupId: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        students: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');

    const studentIds = group.students.map(s => s.id);
    if (!studentIds.length) return {
      groupId,
      groupName: group.name,
      levelName: undefined,
      levelNumber: undefined,
      totalStudents: 0,
      totalXp: 0,
      achievedMilestones: 0,
      totalMilestones: 0,
      allMilestonesComplete: false,
      milestones: [],
      students: [],
    };

    // Milestone 1: All students attended at least once this month
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const attendedThisMonth = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        status: { in: ['present', 'late'] },
        attendanceSession: { scheduledDate: { gte: startMonth } },
      },
    });
    const attendedIds = new Set(attendedThisMonth.map(r => r.studentId));
    const allAttendedThisMonth = studentIds.every(id => attendedIds.has(id));

    // Milestone 2: All students have at least one badge
    const badgeCounts = await this.prisma.studentBadge.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds } },
      _count: true,
    });
    const studentsWithBadges = new Set(badgeCounts.map(b => b.studentId));
    const allHaveBadge = studentIds.every(id => studentsWithBadges.has(id));

    // Milestone 3: All students passed at least one assessment
    const passedSubs = await this.prisma.assessmentSubmission.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, status: 'submitted' },
    });
    const passedIds = new Set(passedSubs.map(s => s.studentId));
    const allPassedAssessment = studentIds.every(id => passedIds.has(id));

    // Milestone 4: Average attendance rate > 80%
    const allAtt = await this.prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, status: true },
    });
    const attByStudent = studentIds.map(id => {
      const recs = allAtt.filter(r => r.studentId === id);
      if (!recs.length) return 0;
      return recs.filter(r => r.status === 'present' || r.status === 'late').length / recs.length * 100;
    });
    const avgAttendance = attByStudent.length
      ? Math.round(attByStudent.reduce((a, b) => a + b, 0) / attByStudent.length)
      : 0;
    const groupAttendanceGoalMet = avgAttendance >= 80;

    // Total XP earned by group
    const groupXp = await this.prisma.xPTransaction.aggregate({
      where: { studentId: { in: studentIds } },
      _sum: { amount: true },
    });

    const milestones = [
      {
        id: 'all_attended_this_month',
        title: 'Full House',
        titleAr: 'الفريق الكامل',
        description: 'Every student attended at least once this month',
        descriptionAr: 'كل طالب حضر مرة على الأقل هذا الشهر',
        icon: 'Users',
        achieved: allAttendedThisMonth,
        progress: Math.round((attendedIds.size / studentIds.length) * 100),
        current: attendedIds.size,
        target: studentIds.length,
      },
      {
        id: 'all_have_badge',
        title: 'Badge Brigade',
        titleAr: 'فرقة الشارات',
        description: 'Every student has earned at least one badge',
        descriptionAr: 'كل طالب حصل على شارة واحدة على الأقل',
        icon: 'Award',
        achieved: allHaveBadge,
        progress: Math.round(studentIds.filter(id => studentsWithBadges.has(id)).length / studentIds.length * 100),
        current: studentIds.filter(id => studentsWithBadges.has(id)).length,
        target: studentIds.length,
      },
      {
        id: 'all_passed_assessment',
        title: 'Assessment Champions',
        titleAr: 'أبطال التقييم',
        description: 'Every student has passed at least one assessment',
        descriptionAr: 'كل طالب اجتاز تقييماً واحداً على الأقل',
        icon: 'CheckCircle',
        achieved: allPassedAssessment,
        progress: Math.round(studentIds.filter(id => passedIds.has(id)).length / studentIds.length * 100),
        current: studentIds.filter(id => passedIds.has(id)).length,
        target: studentIds.length,
      },
      {
        id: 'group_attendance_80',
        title: 'Faithful Presence',
        titleAr: 'الحضور الأمين',
        description: 'Group average attendance reaches 80%',
        descriptionAr: 'معدل حضور المجموعة يصل إلى 80٪',
        icon: 'Heart',
        achieved: groupAttendanceGoalMet,
        progress: Math.min(100, avgAttendance),
        current: avgAttendance,
        target: 80,
        suffix: '%',
      },
    ];

    const achievedCount = milestones.filter(m => m.achieved).length;

    return {
      groupId,
      groupName: group.name,
      totalStudents: studentIds.length,
      totalXp: groupXp._sum.amount || 0,
      achievedMilestones: achievedCount,
      totalMilestones: milestones.length,
      allMilestonesComplete: achievedCount === milestones.length,
      milestones,
      students: group.students.map(s => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        attendedThisMonth: attendedIds.has(s.id),
        hasBadge: studentsWithBadges.has(s.id),
        passedAssessment: passedIds.has(s.id),
      })),
    };
  }

  // ── Liturgical Season Badges ────────────────────────────────────────────

  getLiturgicalSeasonInfo(): {
    season: string; seasonAr: string; start: Date; end: Date;
    badge: { name: string; nameAr: string; description: string; descriptionAr: string; icon: string; category: string }
  } | null {
    const now = new Date();
    const year = now.getFullYear();
    const m = now.getMonth() + 1; // 1-indexed
    const d = now.getDate();

    // Approximate Coptic season windows (Gregorian dates, approximate)
    const seasons = [
      {
        season: 'kiahk', seasonAr: 'كيهك',
        start: new Date(`${year}-11-10`), end: new Date(`${year}-12-08`), // ~29 days of Kiahk
        badge: { name: 'Kiahk Lantern', nameAr: 'فانوس كيهك', description: 'Earned during the 29 holy days of Kiahk', descriptionAr: 'تُكسب خلال 29 يوماً المقدسة من شهر كيهك', icon: 'Star', category: 'liturgy' },
      },
      {
        season: 'great_lent', seasonAr: 'الصوم الكبير',
        start: new Date(`${year}-03-02`), end: new Date(`${year}-04-19`),
        badge: { name: 'Fasting Lamp', nameAr: 'مصباح الصوم', description: 'Earned during the Great Lent', descriptionAr: 'تُكسب خلال الصوم الكبير المقدس', icon: 'Flame', category: 'liturgy' },
      },
      {
        season: 'holy_week', seasonAr: 'أسبوع الآلام',
        start: new Date(`${year}-04-13`), end: new Date(`${year}-04-19`),
        badge: { name: 'Holy Week Witness', nameAr: 'شاهد أسبوع الآلام', description: 'Earned during Holy Week', descriptionAr: 'تُكسب خلال أسبوع الآلام المجيد', icon: 'Cross', category: 'liturgy' },
      },
      {
        season: 'great_50', seasonAr: 'الخمسين المقدسة',
        start: new Date(`${year}-04-20`), end: new Date(`${year}-06-08`),
        badge: { name: 'Resurrection Crown', nameAr: 'إكليل القيامة', description: 'Earned during the Great 50 Days of the Resurrection', descriptionAr: 'تُكسب خلال أيام الخمسين المقدسة للقيامة', icon: 'Crown', category: 'liturgy' },
      },
      {
        season: 'apostles_fast', seasonAr: 'صوم الرسل',
        start: new Date(`${year}-06-12`), end: new Date(`${year}-07-11`),
        badge: { name: 'Apostles Scroll', nameAr: 'مخطوطة الرسل', description: 'Earned during the Fast of the Holy Apostles', descriptionAr: 'تُكسب خلال صوم الرسل الأطهار', icon: 'BookOpen', category: 'liturgy' },
      },
    ];

    for (const s of seasons) {
      if (now >= s.start && now <= s.end) return s;
    }
    return null;
  }

  async getSeasonalBadgeStatus(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const season = this.getLiturgicalSeasonInfo();

    if (!season) {
      return { activeSeason: null, badge: null, message: 'No active liturgical season badge at this time.' };
    }

    // Check if seasonal badge already exists for this school
    const existingBadge = await this.prisma.badge.findFirst({
      where: {
        schoolId,
        category: 'liturgy',
        name: season.badge.name,
        isActive: true,
      },
    });

    return {
      activeSeason: season.season,
      activeSeasonAr: season.seasonAr,
      startDate: season.start,
      endDate: season.end,
      daysRemaining: Math.ceil((season.end.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      badge: {
        ...season.badge,
        schoolId,
        existingBadgeId: existingBadge?.id || null,
        alreadyCreated: !!existingBadge,
      },
    };
  }

  async createSeasonalBadge(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const season = this.getLiturgicalSeasonInfo();
    if (!season) throw new BadRequestException('No active liturgical season at this time');

    const existing = await this.prisma.badge.findFirst({
      where: { schoolId, name: season.badge.name, isActive: true },
    });
    if (existing) return existing;

    return this.prisma.badge.create({
      data: {
        schoolId,
        name: season.badge.name,
        nameAr: season.badge.nameAr,
        description: season.badge.description,
        descriptionAr: season.badge.descriptionAr,
        iconUrl: season.badge.icon,
        category: 'liturgy',
        xpReward: 50,
        isActive: true,
        isSecret: false,
        criteria: { rule: 'seasonal', season: season.season, endDate: season.end.toISOString() },
        metadata: { seasonal: true, season: season.season, endDate: season.end.toISOString() },
      },
    });
  }

  // ── Servant Recognition ──────────────────────────────────────────────────

  async getServantMilestones(userId: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Sessions taught: attendance sessions where this servant was involved
    const sessionsTaught = await this.prisma.attendanceSession.count({
      where: { schoolId },
    });

    // Students assessed: unique students who attended sessions run by this servant
    const servedSessions = await this.prisma.attendanceSession.findMany({
      where: { schoolId, servantId: userId },
      select: { id: true },
    });
    const servedSessionIds = servedSessions.map(s => s.id);
    const studentsAssessedRaw = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId'],
      where: { attendanceSessionId: { in: servedSessionIds } },
    });
    const studentsAssessed = studentsAssessedRaw;

    // Years active: from account creation
    const yearsActive = Math.floor(
      (new Date().getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
    );

    // Lessons planned
    const lessonsPlanned = await this.prisma.lesson.count({
      where: { schoolId },
    });

    const milestones = [
      {
        id: 'sessions_10',    threshold: 10,   current: sessionsTaught,    unit: 'sessions',    label: '10 Sessions Taught',    labelAr: '10 جلسات تعليم',   achieved: sessionsTaught >= 10,
      },
      {
        id: 'sessions_50',    threshold: 50,   current: sessionsTaught,    unit: 'sessions',    label: '50 Sessions Taught',    labelAr: '50 جلسة تعليم',    achieved: sessionsTaught >= 50,
      },
      {
        id: 'sessions_100',   threshold: 100,  current: sessionsTaught,    unit: 'sessions',    label: '100 Sessions Taught',   labelAr: '100 جلسة تعليم',   achieved: sessionsTaught >= 100,
      },
      {
        id: 'sessions_500',   threshold: 500,  current: sessionsTaught,    unit: 'sessions',    label: '500 Sessions Taught',   labelAr: '500 جلسة تعليم',   achieved: sessionsTaught >= 500,
      },
      {
        id: 'students_10',    threshold: 10,   current: studentsAssessed.length, unit: 'students', label: '10 Students Assessed', labelAr: '10 طلاب تم تقييمهم', achieved: studentsAssessed.length >= 10,
      },
      {
        id: 'students_50',    threshold: 50,   current: studentsAssessed.length, unit: 'students', label: '50 Students Assessed', labelAr: '50 طالب تم تقييمهم', achieved: studentsAssessed.length >= 50,
      },
      {
        id: 'students_100',   threshold: 100,  current: studentsAssessed.length, unit: 'students', label: '100 Students Assessed', labelAr: '100 طالب تم تقييمهم', achieved: studentsAssessed.length >= 100,
      },
      {
        id: 'years_1',        threshold: 1,    current: yearsActive,        unit: 'years',       label: '1 Year of Service',     labelAr: 'سنة خدمة',         achieved: yearsActive >= 1,
      },
      {
        id: 'years_3',        threshold: 3,    current: yearsActive,        unit: 'years',       label: '3 Years of Service',    labelAr: '3 سنوات خدمة',     achieved: yearsActive >= 3,
      },
      {
        id: 'years_5',        threshold: 5,    current: yearsActive,        unit: 'years',       label: '5 Years of Service',    labelAr: '5 سنوات خدمة',     achieved: yearsActive >= 5,
      },
      {
        id: 'lessons_20',     threshold: 20,   current: lessonsPlanned,     unit: 'lessons',     label: '20 Lessons Planned',    labelAr: '20 درس مخطط',       achieved: lessonsPlanned >= 20,
      },
    ];

    const achievedMilestones = milestones.filter(m => m.achieved);

    return {
      servant: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        yearsActive,
      },
      stats: {
        sessionsTaught,
        studentsAssessed: studentsAssessed.length,
        lessonsPlanned,
        yearsActive,
      },
      milestones,
      achievedCount: achievedMilestones.length,
      latestAchieved: achievedMilestones[achievedMilestones.length - 1] || null,
    };
  }
}

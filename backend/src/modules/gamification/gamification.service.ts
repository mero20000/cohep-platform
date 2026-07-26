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
    if (!data.schoolId) throw new Error('schoolId is required to create a badge');
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

    return this.prisma.studentBadge.create({
      data: { studentId, badgeId },
      include: { badge: true, student: { select: { id: true, firstName: true, lastName: true } } },
    });
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

  async computeAllBadges(schoolIdentifier: string): Promise<{ total: number; awarded: number; errors: number }> {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true },
    });
    let awarded = 0;
    let errors = 0;
    for (const s of students) {
      try {
        const result = await this.computeBadgesForStudent(s.id);
        awarded += result.awarded;
      } catch {
        errors++;
      }
    }
    return { total: students.length, awarded, errors };
  }

  async addXp(studentId: string, amount: number, type: string, description?: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const currentBalance = await this.prisma.xPTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });

    const balanceAfter = (currentBalance._sum.amount || 0) + amount;

    return this.prisma.xPTransaction.create({
      data: {
        studentId,
        amount,
        balanceAfter,
        type,
        description,
      },
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
}

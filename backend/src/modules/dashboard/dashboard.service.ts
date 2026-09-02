import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { getCopticContext } from '../../common/utils/coptic-calendar';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private schoolResolver: SchoolResolver,
  ) {}

  async getStats(schoolId: string) {
    const resolvedId = await this.schoolResolver.resolve(schoolId);
    const where = { deletedAt: null as any };

    const [
      totalStudents, totalLevels, totalLessons, totalAllocations,
      totalChurches, totalUsers, totalBadgesEarned,
      completedSessions, totalSessions,
      activeStudents, publishedAssessments, totalAssessments,
    ] = await Promise.all([
      this.prisma.student.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.level.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.lesson.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.curriculumAllocation.count({ where: { academicYear: { schoolId: resolvedId } } }),
      this.prisma.church.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.studentBadge.count({ where: { student: { schoolId: resolvedId, deletedAt: null } } }),
      this.prisma.attendanceSession.count({ where: { schoolId: resolvedId, status: 'completed' } }),
      this.prisma.attendanceSession.count({ where: { schoolId: resolvedId, deletedAt: null } }),
      this.prisma.student.count({ where: { schoolId: resolvedId, status: 'active', ...where } }),
      this.prisma.assessment.count({ where: { schoolId: resolvedId, status: 'published', deletedAt: null } }),
      this.prisma.assessment.count({ where: { schoolId: resolvedId, deletedAt: null } }),
    ]);

    // Student attendance rate (present + late / total records)
    // Only count today's attendance records
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        attendanceSession: { schoolId: resolvedId, deletedAt: null, scheduledDate: { gte: today, lt: tomorrow } }
      },
      select: { status: true },
    });
    const attendanceRate = attendanceRecords.length > 0
      ? Math.round((attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length / attendanceRecords.length) * 100)
      : 0;

    // Grade distribution — students grouped by gradeId
    const gradeGroups = await this.prisma.student.groupBy({
      by: ['gradeId'],
      where: { schoolId: resolvedId, deletedAt: null, gradeId: { not: null } },
      _count: { id: true },
    });
    const gradeRows = await this.prisma.schoolGrade.findMany({
      where: { schoolId: resolvedId, deletedAt: null },
      select: { id: true, name: true, orderIndex: true },
    });
    const gradeNameMap = new Map(gradeRows.map(g => [g.id, g.name]));
    const gradeOrderMap = new Map(gradeRows.map(g => [g.id, g.orderIndex]));
    const gradeDistribution = [...gradeGroups]
      .sort((a, b) => (gradeOrderMap.get(a.gradeId!) ?? Number.MAX_SAFE_INTEGER) - (gradeOrderMap.get(b.gradeId!) ?? Number.MAX_SAFE_INTEGER))
      .map(g => ({
        grade: gradeNameMap.get(g.gradeId!) ?? 'Unknown',
        count: g._count.id,
      }));

    // Students per level
    const levelGroups = await this.prisma.student.groupBy({
      by: ['levelId'],
      where: { schoolId: resolvedId, deletedAt: null },
      _count: { id: true },
    });
    const levelIds = levelGroups.map(g => g.levelId);
    const levels = await this.prisma.level.findMany({
      where: { id: { in: levelIds } },
      select: { id: true, name: true },
    });
    const levelMap = new Map(levels.map(l => [l.id, l.name]));
    const studentsPerLevel = levelGroups.map(g => ({
      levelName: levelMap.get(g.levelId) || 'Unknown',
      count: g._count.id,
    }));

    // Students without grade
    const studentsWithoutGrade = await this.prisma.student.count({
      where: { schoolId: resolvedId, deletedAt: null, gradeId: null },
    });

    // Assessment status breakdown
    const statusGroups = await this.prisma.assessment.groupBy({
      by: ['status'],
      where: { schoolId: resolvedId, deletedAt: null },
      _count: { id: true },
    });
    const assessmentsByStatus = statusGroups.map(g => ({
      status: g.status,
      count: g._count.id,
    }));

    // Grading stats
    const gradedSubmissions = await this.prisma.assessmentSubmission.findMany({
      where: {
        assessment: { schoolId: resolvedId, deletedAt: null },
        status: 'completed',
        grades: { some: { questionId: null } },
      },
      include: {
        grades: { where: { questionId: null } },
        assessment: { select: { passingScore: true, title: true } },
        student: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
      },
    });
    const gradedCount = gradedSubmissions.length;
    let passCount = 0;
    for (const sub of gradedSubmissions) {
      const grade = sub.grades[0];
      if (grade && Number(grade.score) >= Number(sub.assessment.passingScore)) {
        passCount++;
      }
    }
    const passRate = gradedCount > 0 ? Math.round((passCount / gradedCount) * 100) : 0;
    const allScores = gradedSubmissions
      .map(s => (s.grades[0] ? Number(s.grades[0].score) : 0))
      .filter(s => s > 0);
    const avgGradeScore = allScores.length
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

    // Recent grading activity (last 10)
    const recentGrades = await this.prisma.grade.findMany({
      where: {
        submission: { assessment: { schoolId: resolvedId } },
        questionId: null,
        gradedBy: { not: 'system' },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        submission: {
          select: {
            assessment: { select: { id: true, title: true, passingScore: true } },
            student: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
          },
        },
      },
    });

    // Students by status
    const studentsByStatus = await this.prisma.student.groupBy({
      by: ['status'],
      where: { schoolId: resolvedId, deletedAt: null },
      _count: { id: true },
    });

    const existing = {
      recentActivity: await this.prisma.auditLog.findMany({
        where: { schoolId: resolvedId },
        orderBy: { createdAt: 'desc' }, take: 10,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      upcomingSessions: await this.prisma.attendanceSession.findMany({
        where: { schoolId: resolvedId, status: 'scheduled', scheduledDate: { gte: new Date() } },
        orderBy: { scheduledDate: 'asc' }, take: 5,
        include: { level: true, servant: { select: { firstName: true, lastName: true } } },
      }),
      topStudents: await (async () => {
        const top = await this.prisma.xPTransaction.groupBy({
          by: ['studentId'],
          where: { student: { schoolId: resolvedId, deletedAt: null } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 5,
        });
        const results: any[] = [];
        for (const [i, entry] of top.entries()) {
          const student = await this.prisma.student.findFirst({
            where: { id: entry.studentId, deletedAt: null },
            select: { id: true, firstName: true, lastName: true, photoUrl: true, level: { select: { number: true, name: true } } },
          });
          if (!student) continue;
          const badgeCount = await this.prisma.studentBadge.count({ where: { studentId: student.id } });
          results.push({
            rank: i + 1,
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            photoUrl: student.photoUrl,
            level: student.level?.number,
            levelName: student.level?.name,
            xp: entry._sum.amount || 0,
            badgeCount,
          });
        }
        return results;
      })(),
      weeklyStats: await this.prisma.attendanceSession.findMany({
        where: { schoolId: resolvedId, scheduledDate: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) } },
        select: { scheduledDate: true, status: true, _count: { select: { attendanceRecords: true } } },
        orderBy: { scheduledDate: 'asc' },
      }),
      school: await this.prisma.school.findUnique({
        where: { id: resolvedId },
        select: { name: true, nameAr: true, logoUrl: true },
      }),
    };

    return {
      totalStudents,
      totalLevels,
      totalLessons,
      totalAllocations,
      totalChurches,
      totalUsers,
      totalBadges: totalBadgesEarned,
      activeStudents,
      publishedAssessments,
      totalAssessments,
      attendanceRate,
      completedSessions,
      gradeDistribution,
      studentsPerLevel,
      studentsByStatus: studentsByStatus.map(s => ({ status: s.status, count: s._count.id })),
      studentsWithoutGrade,
      assessmentsByStatus,
      assessmentStats: { gradedCount, passCount, passRate, avgGradeScore },
      recentGrades: recentGrades.map(g => ({
        id: g.id,
        studentName: `${g.submission.student.firstName} ${g.submission.student.lastName}`,
        studentPhotoUrl: g.submission.student.photoUrl,
        assessmentTitle: g.submission.assessment.title,
        assessmentId: g.submission.assessment.id,
        score: Number(g.score),
        maxScore: Number(g.maxScore),
        passed: Number(g.score) >= Number(g.submission.assessment.passingScore),
        gradedAt: g.createdAt,
      })),
      recentActivity: existing.recentActivity,
      upcomingSessions: existing.upcomingSessions,
      topStudents: existing.topStudents,
      weeklyStats: existing.weeklyStats,
      school: existing.school,
    };
  }

  private async resolveAcademicYear(schoolId: string) {
    return this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
  }

  async getMine(user: any, schoolId: string, viewRole?: string) {
    const resolvedId = await this.schoolResolver.resolve(schoolId);
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    if (viewRole && !roles.includes(viewRole)) throw new ForbiddenException('Invalid viewRole');
    const roleToUse = viewRole || roles[0] || 'guest';
    const MINISTRY = ['servant', 'group_leader', 'level_leader'];
    const category = MINISTRY.includes(roleToUse)
      ? 'ministry'
      : roleToUse === 'parent'
        ? 'parent'
        : 'management';

    const school = await this.prisma.school.findUnique({
      where: { id: resolvedId },
      select: { name: true, nameAr: true, logoUrl: true, church: { select: { name: true, logoUrl: true } } },
    });

    if (category === 'parent') return this.getParentView(user, resolvedId, roleToUse, school);
    if (category === 'ministry') return this.getMinistryView(user, resolvedId, roleToUse, school);

    const stats = await this.getStats(schoolId);
    return { category: 'management', role: roleToUse, ...stats };
  }

  private async getMinistryView(user: any, schoolId: string, roleToUse: string, school: any) {
    // Read metadata assignments for this servant
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { metadata: true },
    });
    const meta = (userRecord?.metadata as any) || {};
    const assignedGroupId = meta.groupId as string | undefined;
    const assignedLevelId = meta.levelId as string | undefined;
    const assignedGradeId = meta.gradeId as string | undefined;

    // If the servant has a metadata group assignment, use ONLY that group
    // Otherwise fall back to attendance session groups
    let groupIds: string[];
    let scoped: boolean;

    if (assignedGroupId) {
      // Metadata assignment takes precedence — only show this group
      groupIds = [assignedGroupId];
      scoped = true;
    } else {
      // Fall back to attendance session groups
      const own = await this.prisma.attendanceSession.findMany({
        where: { schoolId, servantId: user.id },
        select: { groupId: true },
      });
      const ownGroupIds = [...new Set(own.map((s: any) => s.groupId).filter(Boolean))] as string[];
      scoped = ownGroupIds.length > 0;
      groupIds = scoped
        ? ownGroupIds
        : (await this.prisma.group.findMany({
            where: { schoolId, deletedAt: null },
            select: { id: true },
          })).map((g: any) => g.id);
    }

    // Build filter conditions based on assignments
    const sessionWhere: any = { schoolId, groupId: { in: groupIds }, status: 'scheduled' };
    const studentWhere: any = { schoolId, groupId: { in: groupIds }, deletedAt: null };
    const gradeWhereBase: any = { submission: { assessment: { schoolId }, student: { groupId: { in: groupIds } } } };

    // If levelId is assigned, further restrict sessions to that level
    if (assignedLevelId) {
      sessionWhere.levelId = assignedLevelId;
      // Also filter students and grades by level
      studentWhere.levelId = assignedLevelId;
      gradeWhereBase.submission.student.levelId = assignedLevelId;
    }

    // If gradeId is assigned, further restrict students and grades to that school grade
    if (assignedGradeId) {
      studentWhere.gradeId = assignedGradeId;
      gradeWhereBase.submission.student.gradeId = assignedGradeId;
    }

    const now = new Date();
    const daysSinceSat = (now.getDay() + 1) % 7;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() - daysSinceSat);
    saturday.setHours(0, 0, 0, 0);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    sunday.setHours(23, 59, 59, 999);

    const [sessions, groups, studentsCount, completedSessions, totalSessions, attendanceRecords, recentGrades, weekRecords] = await Promise.all([
      this.prisma.attendanceSession.findMany({
        where: sessionWhere,
        orderBy: { scheduledDate: 'asc' },
        take: 8,
        include: {
          level: { select: { id: true, name: true, number: true } },
          group: { select: { id: true, name: true } },
        },
      }),
      this.prisma.group.findMany({
        where: { id: { in: groupIds }, deletedAt: null },
        select: {
          id: true,
          name: true,
          nameAr: true,
          students: {
            where: assignedGradeId ? { gradeId: assignedGradeId, deletedAt: null } : { deletedAt: null },
            select: { id: true },
          },
        },
      }),
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.attendanceSession.count({ where: { schoolId, groupId: { in: groupIds }, status: 'completed' } }),
      this.prisma.attendanceSession.count({ where: { schoolId, groupId: { in: groupIds }, deletedAt: null } }),
      this.prisma.attendanceRecord.findMany({
        where: {
          attendanceSession: { schoolId, groupId: { in: groupIds } },
          student: { deletedAt: null },
        },
        select: { status: true },
      }),
      this.prisma.grade.findMany({
        where: {
          ...gradeWhereBase,
          questionId: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          submission: {
            select: {
              assessment: { select: { id: true, title: true, passingScore: true } },
              student: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
            },
          },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          attendanceSession: {
            schoolId,
            groupId: { in: groupIds },
            scheduledDate: { gte: saturday, lte: sunday },
          },
          student: { deletedAt: null },
        },
        select: { status: true },
      }),
    ]);

    // Resolve assigned names for the response
    let assignedGroupName: string | null = null;
    let assignedLevelName: string | null = null;
    let assignedGradeName: string | null = null;
    if (assignedGroupId) {
      const g = await this.prisma.group.findUnique({ where: { id: assignedGroupId }, select: { name: true } });
      assignedGroupName = g?.name || null;
    }
    if (assignedLevelId) {
      const l = await this.prisma.level.findUnique({ where: { id: assignedLevelId }, select: { name: true } });
      assignedLevelName = l?.name || null;
    }
    if (assignedGradeId) {
      const gr = await this.prisma.schoolGrade.findUnique({ where: { id: assignedGradeId }, select: { name: true } });
      assignedGradeName = gr?.name || null;
    }

    let attendanceRate = 0;
    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      attendanceRate = Math.round((present / attendanceRecords.length) * 100);
    }

    const weekPresent = weekRecords.filter((r: any) => r.status === 'present').length;
    const weekLate = weekRecords.filter((r: any) => r.status === 'late').length;
    const weekAbsent = weekRecords.filter((r: any) => r.status === 'absent').length;
    const weekExcused = weekRecords.filter((r: any) => r.status === 'excused').length;
    const weekTotal = weekRecords.length;
    const thisWeek = {
      present: weekPresent,
      late: weekLate,
      absent: weekAbsent,
      excused: weekExcused,
      total: weekTotal,
      attendanceRate: weekTotal > 0 ? Math.round(((weekPresent + weekLate) / weekTotal) * 100) : 0,
    };

    return {
      category: 'ministry',
      role: roleToUse,
      scoped,
      school,
      assigned: {
        groupId: assignedGroupId || null,
        groupName: assignedGroupName,
        levelId: assignedLevelId || null,
        levelName: assignedLevelName,
        gradeId: assignedGradeId || null,
        gradeName: assignedGradeName,
      },
      sessions: sessions.map((s: any) => ({
        id: s.id,
        scheduledDate: s.scheduledDate,
        status: s.status,
        levelName: s.level?.name,
        levelNumber: s.level?.number,
        groupName: s.group?.name,
        groupId: s.groupId,
        levelId: s.levelId,
      })),
      groups: groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        studentCount: g.students?.length ?? 0,
      })),
      studentsCount,
      attendanceRate,
      completedSessions,
      totalSessions,
      recentGrades: recentGrades.map((g: any) => ({
        id: g.id,
        studentName: `${g.submission.student.firstName} ${g.submission.student.lastName}`,
        studentPhotoUrl: g.submission.student.photoUrl,
        assessmentTitle: g.submission.assessment.title,
        assessmentId: g.submission.assessment.id,
        score: Number(g.score),
        maxScore: Number(g.maxScore),
        passed: Number(g.score) >= Number(g.submission.assessment.passingScore),
        gradedAt: g.createdAt,
      })),
      thisWeek,
    };
  }

  private async getParentView(user: any, schoolId: string, roleToUse: string, school: any) {
    const parent = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true },
    });
    const [links, emailStudents] = await Promise.all([
      this.prisma.studentParent.findMany({
        where: { parentId: user.id },
        include: {
          student: {
            include: {
              level: { select: { id: true, name: true, number: true } },
              group: { select: { id: true, name: true } },
              grade: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.student.findMany({
        where: { parentEmail: parent?.email, schoolId, deletedAt: null },
        include: {
          level: { select: { id: true, name: true, number: true } },
          group: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true } },
        },
      }),
    ]);
    const byStudent = new Map<string, any>();
    for (const l of links) byStudent.set(l.student.id, l.student);
    for (const s of emailStudents) {
      if (!byStudent.has(s.id)) byStudent.set(s.id, s);
    }
    const children = Array.from(byStudent.values());
    const isDemo = false;

    const academicYear = await this.resolveAcademicYear(schoolId);

    const childrenData = await Promise.all(
      children.map(async (student: any) => {
        // Compute progress from real activity (attendance, grades, XP transactions).
        // Do NOT read StudentProgress — that is an admin-managed summary, not live data.
        const [att, grades, xp, pointConfig] = await Promise.all([
          this.prisma.attendanceRecord.findMany({ where: { studentId: student.id }, select: { status: true, behavior: true, participation: true, attendedLiturgy: true } }),
          this.prisma.grade.findMany({
            where: { submission: { studentId: student.id }, questionId: null },
            select: { score: true, maxScore: true },
          }),
          this.prisma.xPTransaction.aggregate({ where: { studentId: student.id }, _sum: { amount: true } }),
          this.prisma.systemConfig.findUnique({
            where: { schoolId_key: { schoolId, key: 'point_rules' } },
            select: { value: true },
          }),
        ]);
        const attTotal = att.length;
        const attPresent = att.filter((r: any) => r.status === 'present').length;
        const attLate = att.filter((r: any) => r.status === 'late').length;
        const attendancePercent = attTotal > 0 ? Math.round(((attPresent + attLate) / attTotal) * 100) : 0;
        const graded = grades.filter((g: any) => Number(g.maxScore) > 0);
        const averageScore = graded.length > 0
          ? Math.round((graded.reduce((s: number, g: any) => s + Number(g.score) / Number(g.maxScore), 0) / graded.length) * 100)
          : 0;
        const totalXp = xp._sum.amount || 0;

        // Compute total points from attendance records using point rules
        const rules: any = (pointConfig?.value as any) || {};
        const presentPoints = rules.presentPoints ?? 5;
        const liturgyPoints = rules.liturgyPoints ?? 3;
        const totalPoints = att.reduce((sum: number, r: any) => {
          let s = 0;
          if (r.status === 'present') s += presentPoints;
          if (r.behavior) s += r.behavior;
          if (r.participation) s += r.participation;
          if (r.attendedLiturgy) s += liturgyPoints;
          return sum + s;
        }, 0);

        const prog: any = {
          attendancePercent,
          averageScore,
          totalXp,
          currentStreak: 0,
          longestStreak: 0,
          progressPercent: attendancePercent || averageScore || 0,
          completedLessons: 0,
          totalLessons: 0,
        };
        const recentGrades = await this.prisma.grade.findMany({
          where: { submission: { studentId: student.id }, questionId: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            submission: { select: { assessment: { select: { id: true, title: true, passingScore: true } } } },
          },
        });
        const badges = await this.prisma.studentBadge.count({ where: { studentId: student.id } });
        const [recentBadges, upcomingSessions] = await Promise.all([
          this.prisma.studentBadge.findMany({
            where: { studentId: student.id },
            orderBy: { awardedAt: 'desc' },
            take: 3,
            include: { badge: { select: { id: true, name: true, nameAr: true, iconUrl: true, category: true } } },
          }),
          (student.levelId
            ? this.prisma.attendanceSession.findMany({
                where: {
                  levelId: student.levelId,
                  schoolId,
                  scheduledDate: { gt: new Date() },
                  status: { not: 'cancelled' },
                },
                orderBy: { scheduledDate: 'asc' },
                take: 3,
                include: {
                  servant: { select: { id: true, firstName: true, lastName: true } },
                  level: { select: { id: true, name: true } },
                },
              })
            : Promise.resolve([])
          ),
        ]);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [attThisWeek, attLastWeek, xpThisW, xpLastW] = await Promise.all([
          this.prisma.attendanceRecord.findMany({ where: { studentId: student.id, createdAt: { gte: weekAgo } }, select: { status: true } }),
          this.prisma.attendanceRecord.findMany({ where: { studentId: student.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } }, select: { status: true } }),
          this.prisma.xPTransaction.aggregate({ where: { studentId: student.id, createdAt: { gte: weekAgo } }, _sum: { amount: true } }),
          this.prisma.xPTransaction.aggregate({ where: { studentId: student.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } }, _sum: { amount: true } }),
        ]);
        const weeklyComparison = {
          attendanceThisWeek: attThisWeek.length > 0 ? Math.round((attThisWeek.filter((r: any) => r.status === 'present' || r.status === 'late').length / attThisWeek.length) * 100) : 0,
          attendanceLastWeek: attLastWeek.length > 0 ? Math.round((attLastWeek.filter((r: any) => r.status === 'present' || r.status === 'late').length / attLastWeek.length) * 100) : 0,
          xpThisWeek: xpThisW._sum.amount || 0,
          xpLastWeek: xpLastW._sum.amount || 0,
        };
        let currentLesson: any = null;
        if (academicYear && student.levelId) {
          const allocs = await this.prisma.curriculumAllocation.findMany({
            where: { levelId: student.levelId, academicYearId: academicYear.id },
            orderBy: [{ weekNumber: 'asc' }, { orderIndex: 'asc' }],
            include: { lesson: { select: { id: true, title: true, titleAr: true } } },
          });
          const completedIdx = prog.completedLessons || 0;
          currentLesson = allocs.length > completedIdx && allocs[completedIdx]
            ? { id: allocs[completedIdx].lesson.id, title: allocs[completedIdx].lesson.title, titleAr: allocs[completedIdx].lesson.titleAr }
            : allocs.length > 0
            ? { id: allocs[allocs.length - 1].lesson.id, title: allocs[allocs.length - 1].lesson.title, titleAr: allocs[allocs.length - 1].lesson.titleAr }
            : null;
        }
        return {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          photoUrl: student.photoUrl,
          levelName: student.level?.name,
          levelNumber: student.level?.number,
          groupName: student.group?.name,
          gradeName: student.grade?.name || null,
          totalPoints,
          progress: {
            attendancePercent: Number(prog.attendancePercent),
            averageScore: Number(prog.averageScore),
            totalXp: prog.totalXp,
            currentStreak: prog.currentStreak,
            longestStreak: prog.longestStreak,
            progressPercent: Number(prog.progressPercent),
            completedLessons: prog.completedLessons,
            totalLessons: prog.totalLessons,
          },
          badges,
          recentBadges: recentBadges.map((sb: any) => ({
            id: sb.id,
            badgeId: sb.badge.id,
            name: sb.badge.name,
            nameAr: sb.badge.nameAr,
            iconUrl: sb.badge.iconUrl,
            category: sb.badge.category,
            awardedAt: sb.awardedAt,
          })),
          weeklyComparison,
          upcomingSessions: upcomingSessions.map((sess: any) => ({
            id: sess.id,
            title: sess.servant?.firstName && sess.servant?.lastName ? `${sess.servant.firstName} ${sess.servant.lastName}` : '',
            scheduledDate: sess.scheduledDate,
            levelName: sess.level?.name,
          })),
          currentLesson,
          recentGrades: recentGrades.map((g: any) => ({
            id: g.id,
            assessmentTitle: g.submission.assessment.title,
            assessmentId: g.submission.assessment.id,
            score: Number(g.score),
            maxScore: Number(g.maxScore),
            passed: Number(g.score) >= Number(g.submission.assessment.passingScore),
            gradedAt: g.createdAt,
          })),
        };
      }),
    );

    return { category: 'parent', role: roleToUse, isDemo, school, children: childrenData };
  }

  async getParentLeaderboard(schoolId: string, limit = 10) {
    const resolvedId = await this.schoolResolver.resolve(schoolId);
    const rows = await this.prisma.xPTransaction.groupBy({
      by: ['studentId'],
      where: { student: { schoolId: resolvedId, deletedAt: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });
    const studentIds = rows.map((r: any) => r.studentId);
    if (studentIds.length === 0) return { leaderboard: [] };
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, photoUrl: true,
        grade: { select: { name: true } },
        level: { select: { name: true } },
      },
    });
    const studentMap = new Map(students.map((s: any) => [s.id, s]));
    const leaderboard = rows.map((r: any, i: number) => {
      const s = studentMap.get(r.studentId);
      return {
        rank: i + 1,
        studentId: r.studentId,
        firstName: s?.firstName || 'Unknown',
        lastName: s?.lastName || '',
        photoUrl: s?.photoUrl || null,
        gradeName: s?.grade?.name || null,
        levelName: s?.level?.name || null,
        totalXp: r._sum.amount || 0,
      };
    });
    return { leaderboard };
  }

  // ── Servant Digest ────────────────────────────────────────────────────────

  private async resolveServantClass(userId: string, schoolId: string) {
    // Metadata assignment (servant module) takes precedence over session-derived class
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    const meta = (userRecord?.metadata as any) || {};
    const assignedGroupId = meta.groupId as string | undefined;
    const assignedLevelId = meta.levelId as string | undefined;

    if (assignedGroupId) {
      // If assigned to a specific group, return that group's students
      const groupIds = [assignedGroupId];
      const levelIds = assignedLevelId ? [assignedLevelId] : [];
      const studentIds = (await this.prisma.student.findMany({
        where: { groupId: { in: groupIds }, deletedAt: null },
        select: { id: true },
      })).map((s: any) => s.id);
      return { groupIds, levelIds, studentIds };
    } else if (assignedLevelId) {
      // If assigned to a level but not a specific group, return all students in that level
      const levelIds = [assignedLevelId];
      const students = await this.prisma.student.findMany({
        where: { levelId: assignedLevelId, deletedAt: null },
        select: { id: true, groupId: true },
      });
      const groupIds = [...new Set(students.map((s: any) => s.groupId).filter(Boolean))] as string[];
      const studentIds = students.map((s: any) => s.id);
      return { groupIds, levelIds, studentIds };
    }

    const ownSessions = await this.prisma.attendanceSession.findMany({
      where: { schoolId, servantId: userId },
      select: { groupId: true, levelId: true },
    });
    const groupIds = [...new Set(ownSessions.map((s: any) => s.groupId).filter(Boolean))] as string[];
    const levelIds = [...new Set(ownSessions.map((s: any) => s.levelId).filter(Boolean))] as string[];
    const studentIds = groupIds.length > 0
      ? (await this.prisma.student.findMany({
          where: { groupId: { in: groupIds }, deletedAt: null },
          select: { id: true },
        })).map((s: any) => s.id)
      : [];
    return { groupIds, levelIds, studentIds };
  }

  async getServantDigest(user: any, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const { groupIds, levelIds, studentIds } = await this.resolveServantClass(user.id, schoolId);

    // ── ONE STUDENT STORY ────────────────────────────────────────────────
    // Find a student with a recent positive milestone in the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let studentStory: any = null;

    // Best story: a student with the longest consecutive attendance streak
    if (studentIds.length > 0) {
      const recentRecords = await this.prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          attendanceSession: { scheduledDate: { gte: weekAgo } },
          status: { in: ['present', 'late'] },
        },
        include: { student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } } },
        orderBy: { createdAt: 'desc' },
      });

      // Count streaks per student
      const allRecords = await this.prisma.attendanceRecord.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { createdAt: 'desc' },
        select: { studentId: true, status: true, createdAt: true },
      });
      const streakMap: Record<string, number> = {};
      for (const id of studentIds) {
        const recs = allRecords.filter((r: any) => r.studentId === id);
        let streak = 0;
        for (const r of recs) {
          if (r.status === 'present' || r.status === 'late') streak++;
          else break;
        }
        streakMap[id] = streak;
      }
      // Find student with best streak
      const bestStudentId = Object.entries(streakMap)
        .sort(([, a], [, b]) => b - a)
        .find(([, streak]) => streak >= 2)?.[0];

      if (bestStudentId) {
        const student = await this.prisma.student.findUnique({
          where: { id: bestStudentId },
          select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
        });
        if (student) {
          studentStory = {
            studentId: bestStudentId,
            firstName: student.firstName,
            lastName: student.lastName,
            firstNameAr: student.firstNameAr,
            lastNameAr: student.lastNameAr,
            streak: streakMap[bestStudentId],
            storyEn: `${student.firstName} has attended ${streakMap[bestStudentId]} sessions in a row — their longest streak this term.`,
            storyAr: `${student.firstNameAr || student.firstName} حضر ${streakMap[bestStudentId]} جلسات متتالية — أطول تتابع له هذا الفصل.`,
          };
        }
      }

      // Fallback: first student who earned a badge this week
      if (!studentStory) {
        const recentBadge = await this.prisma.studentBadge.findFirst({
          where: { studentId: { in: studentIds }, awardedAt: { gte: weekAgo } },
          include: {
            student: { select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
            badge: { select: { name: true, nameAr: true } },
          },
          orderBy: { awardedAt: 'desc' },
        });
        if (recentBadge) {
          studentStory = {
            studentId: recentBadge.studentId,
            firstName: recentBadge.student.firstName,
            lastName: recentBadge.student.lastName,
            storyEn: `${recentBadge.student.firstName} earned the "${recentBadge.badge.name}" badge this week.`,
            storyAr: `${recentBadge.student.firstNameAr || recentBadge.student.firstName} حصل على شارة "${recentBadge.badge.nameAr || recentBadge.badge.name}" هذا الأسبوع.`,
          };
        }
      }
    }

    // ── ONE CLASS TREND ──────────────────────────────────────────────────
    let classTrend: any = null;
    if (groupIds.length > 0) {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const [thisWeekSessions, lastWeekSessions] = await Promise.all([
        this.prisma.attendanceSession.findMany({
          where: { groupId: { in: groupIds }, scheduledDate: { gte: weekAgo } },
          include: { attendanceRecords: { select: { status: true } } },
        }),
        this.prisma.attendanceSession.findMany({
          where: { groupId: { in: groupIds }, scheduledDate: { gte: twoWeeksAgo, lt: weekAgo } },
          include: { attendanceRecords: { select: { status: true } } },
        }),
      ]);
      const rate = (sessions: any[]) => {
        const all = sessions.flatMap((s: any) => s.attendanceRecords);
        if (!all.length) return 0;
        return Math.round(all.filter((r: any) => r.status === 'present' || r.status === 'late').length / all.length * 100);
      };
      const thisRate = rate(thisWeekSessions);
      const lastRate = rate(lastWeekSessions);
      const diff = thisRate - lastRate;
      const groups = await this.prisma.group.findMany({ where: { id: { in: groupIds } }, select: { name: true } });
      const groupName = groups[0]?.name || 'your group';
      classTrend = {
        thisWeekRate: thisRate,
        lastWeekRate: lastRate,
        improvement: diff,
        trendEn: diff > 0
          ? `${groupName}'s attendance improved from ${lastRate}% to ${thisRate}% this week — up ${diff}%.`
          : diff < 0
          ? `${groupName}'s attendance dropped from ${lastRate}% to ${thisRate}% this week.`
          : `${groupName}'s attendance held steady at ${thisRate}% this week.`,
        trendAr: diff > 0
          ? `تحسّن حضور ${groupName} من ${lastRate}٪ إلى ${thisRate}٪ هذا الأسبوع — ارتفع ${diff}٪.`
          : diff < 0
          ? `انخفض حضور ${groupName} من ${lastRate}٪ إلى ${thisRate}٪ هذا الأسبوع.`
          : `ثبت حضور ${groupName} على ${thisRate}٪ هذا الأسبوع.`,
      };
    }

    // ── ONE MILESTONE ────────────────────────────────────────────────────
    const totalSessionsTaught = await this.prisma.attendanceSession.count({
      where: { schoolId, servantId: user.id, deletedAt: null },
    });
    const MILESTONES = [10, 25, 50, 100, 200, 500];
    const nextMilestone = MILESTONES.find(m => m > totalSessionsTaught) || null;
    const lastMilestone = [...MILESTONES].reverse().find(m => m <= totalSessionsTaught) || null;
    let milestone: any = null;
    if (lastMilestone !== null && totalSessionsTaught >= lastMilestone && totalSessionsTaught - lastMilestone < 3) {
      milestone = {
        value: lastMilestone,
        totalSessions: totalSessionsTaught,
        messageEn: `You just reached ${lastMilestone} sessions taught. That is ${lastMilestone} hours poured into the next generation.`,
        messageAr: `لقد وصلت للتو إلى ${lastMilestone} جلسة تعليم. هذه ${lastMilestone} ساعة مستثمرة في الجيل القادم.`,
        isFresh: true,
      };
    } else {
      milestone = {
        totalSessions: totalSessionsTaught,
        nextMilestone,
        messageEn: nextMilestone
          ? `You have taught ${totalSessionsTaught} sessions. ${nextMilestone - totalSessionsTaught} more to reach your next milestone.`
          : `You have taught ${totalSessionsTaught} sessions. An extraordinary contribution to the Church.`,
        messageAr: nextMilestone
          ? `علّمت ${totalSessionsTaught} جلسة. ${nextMilestone - totalSessionsTaught} جلسات أخرى للوصول إلى الإنجاز التالي.`
          : `علّمت ${totalSessionsTaught} جلسة. مساهمة استثنائية في الكنيسة.`,
        isFresh: false,
      };
    }

    // ── ABSENCE ALERTS ───────────────────────────────────────────────────
    const absenceAlerts: any[] = [];
    if (studentIds.length > 0) {
      for (const studentId of studentIds) {
        const lastSessions = await this.prisma.attendanceRecord.findMany({
          where: { studentId },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { status: true },
        });
        if (lastSessions.length >= 3 && lastSessions.every((r: any) => r.status === 'absent')) {
          const student = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
          });
          if (student) {
            absenceAlerts.push({
              studentId,
              firstName: student.firstName,
              lastName: student.lastName,
              firstNameAr: student.firstNameAr,
              lastNameAr: student.lastNameAr,
              consecutiveAbsences: lastSessions.length,
              messageEn: `${student.firstName} has missed the last 3 sessions. A gentle check-in may help.`,
              messageAr: `${student.firstNameAr || student.firstName} تغيّب عن آخر 3 جلسات. قد يساعد التواصل الودي معه.`,
            });
          }
        }
      }
    }

    // ── NEXT SESSION ────────────────────────────────────────────────────
    const nextSession = await this.prisma.attendanceSession.findFirst({
      where: {
        schoolId,
        servantId: user.id,
        groupId: { in: groupIds },
        status: 'scheduled',
        scheduledDate: { gte: new Date() },
      },
      orderBy: { scheduledDate: 'asc' },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
      },
    });

    return {
      generatedAt: new Date(),
      servant: { id: user.id, firstName: user.firstName, lastName: user.lastName },
      studentStory,
      classTrend,
      milestone,
      absenceAlerts,
      nextSession: nextSession ? {
        id: nextSession.id,
        scheduledDate: nextSession.scheduledDate,
        levelId: nextSession.levelId,
        levelName: (nextSession as any).level?.name,
        levelNumber: (nextSession as any).level?.number,
        groupId: nextSession.groupId,
        groupName: (nextSession as any).group?.name,
      } : null,
    };
  }

  async getClassOverview(user: any, schoolIdentifier: string): Promise<any> {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { groupIds, levelIds, studentIds } = await this.resolveServantClass(user.id, schoolId);

    const nextSession = await this.prisma.attendanceSession.findFirst({
      where: { schoolId, servantId: user.id, groupId: { in: groupIds }, status: 'scheduled', scheduledDate: { gte: new Date() } },
      orderBy: { scheduledDate: 'asc' },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
      },
    });

    let todayLesson: any = null;
    if (levelIds.length > 0) {
      const alloc = await this.prisma.curriculumAllocation.findFirst({
        where: {
          academicYear: { schoolId },
          levelId: { in: levelIds },
          scheduledDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        orderBy: { scheduledDate: 'asc' },
        include: {
          lesson: { select: { id: true, title: true, titleAr: true, titleCoptic: true } },
          level: { select: { id: true, name: true, number: true } },
          subject: { select: { name: true } },
        },
      });
      if (alloc) {
        todayLesson = {
          lessonId: alloc.lessonId,
          title: alloc.lesson.title,
          titleAr: alloc.lesson.titleAr,
          titleCoptic: alloc.lesson.titleCoptic,
          levelId: alloc.levelId,
          levelName: alloc.level.name,
          levelNumber: alloc.level.number,
          subjectName: alloc.subject.name,
          scheduledDate: alloc.scheduledDate,
        };
      }
    }

    const nextWeekday = nextSession ? new Date(nextSession.scheduledDate).getDay() : null;
    const roster = await this.buildClassRoster(studentIds, todayLesson ? todayLesson.lessonId : null, nextWeekday);

    return {
      servant: { id: user.id, firstName: user.firstName, lastName: user.lastName },
      nextSession: nextSession ? {
        id: nextSession.id,
        scheduledDate: nextSession.scheduledDate,
        levelId: nextSession.levelId,
        levelName: nextSession.level?.name,
        levelNumber: nextSession.level?.number,
        groupId: nextSession.groupId,
        groupName: nextSession.group?.name,
      } : null,
      todayLesson,
      roster,
    };
  }

  private async buildClassRoster(
    studentIds: string[],
    followUpLessonId: string | null,
    nextSessionWeekday: number | null,
  ): Promise<any[]> {
    const roster: any[] = [];
    if (studentIds.length === 0) return roster;

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true, photoUrl: true,
      },
    });

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { recordedAt: 'desc' },
      select: {
        studentId: true, status: true, recordedAt: true,
        note: true, noteCategory: true, isPrivateNote: true,
      },
    });

    let progressByStudent: Record<string, any> = {};
    if (followUpLessonId) {
      const progresses = await this.prisma.lessonProgress.findMany({
        where: { lessonId: followUpLessonId, studentId: { in: studentIds } },
        select: { studentId: true, masteryStatus: true },
      });
      progressByStudent = Object.fromEntries(progresses.map(p => [p.studentId, p]));
    }

    const overdueIds = new Set(
      (await this.prisma.lessonProgress.findMany({
        where: { studentId: { in: studentIds }, nextReviewAt: { lt: new Date() } },
        select: { studentId: true },
      })).map(p => p.studentId),
    );

    const ungradedIds = new Set(
      (await this.prisma.assessmentSubmission.findMany({
        where: { studentId: { in: studentIds }, grades: { none: {} } },
        select: { studentId: true },
      })).map(s => s.studentId),
    );

    for (const student of students) {
      const sr = records.filter(r => r.studentId === student.id);
      const presentCount = sr.filter(r => r.status === 'present' || r.status === 'late').length;
      const attendanceRate = sr.length ? Math.round(presentCount / sr.length * 100) : 0;
      const lastStatus = sr[0]?.status ?? null;

      const lastTwo = sr.slice(0, 2);
      const lastTwoAbsent = lastTwo.length >= 2 && lastTwo.every(r => r.status === 'absent');
      const historicallyAbsentOnWeekday = nextSessionWeekday !== null
        && sr.filter(r => r.status === 'absent' && new Date(r.recordedAt).getDay() === nextSessionWeekday).length >= 2;
      const likelyAbsent = attendanceRate < 60 || lastTwoAbsent || historicallyAbsentOnWeekday;

      const reasons: string[] = [];
      if (overdueIds.has(student.id)) reasons.push('overdue_review');
      if (followUpLessonId) {
        const p = progressByStudent[student.id];
        if (p && (p.masteryStatus === 'not_started' || p.masteryStatus === 'introduced')) reasons.push('low_mastery');
      }
      if (sr.length >= 3 && sr.slice(0, 3).every(r => r.status === 'absent')) reasons.push('absent_3plus');
      if (ungradedIds.has(student.id)) reasons.push('ungraded_assessment');

      const notes = sr
        .filter(r => r.note)
        .slice(0, 5)
        .map(r => ({ category: r.noteCategory, note: r.note, isPrivate: r.isPrivateNote, createdAt: r.recordedAt }));

      roster.push({
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameAr: student.firstNameAr,
        lastNameAr: student.lastNameAr,
        photoUrl: student.photoUrl,
        attendanceRate,
        lastAttendanceStatus: lastStatus,
        likelyAbsent,
        needsFollowUp: reasons.length > 0,
        followUpReasons: reasons,
        notes,
      });
    }

    roster.sort((a, b) => {
      const aFlag = a.likelyAbsent || a.needsFollowUp ? 0 : 1;
      const bFlag = b.likelyAbsent || b.needsFollowUp ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      return (a.lastName || '').localeCompare(b.lastName || '');
    });

    return roster;
  }

  private async findNextUpcomingLesson(levelIds: string[], schoolId: string, nextSessionDate: Date | null) {
    if (levelIds.length === 0) return null;
    // Only surface a lesson that belongs to the upcoming session's week
    if (!nextSessionDate) return null;
    const weekStart = new Date(nextSessionDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const alloc = await this.prisma.curriculumAllocation.findFirst({
      where: {
        academicYear: { schoolId },
        levelId: { in: levelIds },
        scheduledDate: { gte: weekStart, lt: weekEnd },
      },
      orderBy: { scheduledDate: 'asc' },
      include: {
        lesson: {
          select: {
            id: true, title: true, titleAr: true, titleCoptic: true,
            audioUrl: true,
            subjectItemId: true,
            subjectItem: { select: { hazzat: true, presentationUrl: true } },
          },
        },
        level: { select: { id: true, name: true, number: true } },
        subject: { select: { name: true, color: true } },
      },
    });
    if (!alloc) return null;
    return {
      lessonId: alloc.lessonId,
      title: alloc.lesson.title,
      titleAr: alloc.lesson.titleAr,
      titleCoptic: alloc.lesson.titleCoptic,
      levelId: alloc.levelId,
      levelName: alloc.level.name,
      levelNumber: alloc.level.number,
      subjectName: alloc.subject.name,
      subjectColor: alloc.subject.color,
      audioUrl: alloc.lesson.audioUrl,
      subjectItemId: alloc.lesson.subjectItemId,
      hazzat: alloc.lesson.subjectItem?.hazzat ?? null,
      presentationUrl: alloc.lesson.subjectItem?.presentationUrl ?? null,
      scheduledDate: alloc.scheduledDate,
    };
  }

  async getWeeklyBriefing(user: any, schoolIdentifier: string): Promise<any> {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { groupIds, levelIds, studentIds } = await this.resolveServantClass(user.id, schoolId);

    const nextSession = await this.prisma.attendanceSession.findFirst({
      where: {
        schoolId,
        servantId: user.id,
        groupId: { in: groupIds },
        status: 'scheduled',
        scheduledDate: { gte: new Date() },
      },
      orderBy: { scheduledDate: 'asc' },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
      },
    });

    const teachingDate = nextSession ? new Date(nextSession.scheduledDate) : new Date();
    const coptic = getCopticContext(teachingDate);
    const nextLesson = await this.findNextUpcomingLesson(levelIds, schoolId, nextSession ? new Date(nextSession.scheduledDate) : null);
    const nextSessionWeekday = nextSession ? new Date(nextSession.scheduledDate).getDay() : null;
    const roster = await this.buildClassRoster(studentIds, nextLesson ? nextLesson.lessonId : null, nextSessionWeekday);

    return {
      generatedAt: new Date(),
      coptic,
      nextSession: nextSession ? {
        id: nextSession.id,
        scheduledDate: nextSession.scheduledDate,
        levelId: nextSession.levelId,
        levelName: nextSession.level?.name,
        levelNumber: nextSession.level?.number,
        groupId: nextSession.groupId,
        groupName: nextSession.group?.name,
      } : null,
      nextLesson,
      roster,
    };
  }

  // ── Absence Cascade ───────────────────────────────────────────────────────

  async runAbsenceCascade(schoolIdentifier: string, notificationsService: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true, parentEmail: true, groupId: true },
    });

    const cascaded: string[] = [];

    for (const student of students) {
      // Get last 3 attendance records ordered by date
      const lastRecords = await this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { status: true },
      });

      if (lastRecords.length < 3) continue;
      if (!lastRecords.every((r: any) => r.status === 'absent')) continue;

      // Find parent users
      const parents = await this.prisma.studentParent.findMany({
        where: { studentId: student.id },
        select: { parentId: true },
      });
      const parentByEmail = student.parentEmail
        ? await this.prisma.user.findFirst({ where: { email: student.parentEmail, schoolId }, select: { id: true } })
        : null;

      const parentIds = new Set([
        ...parents.map((p: any) => p.parentId),
        ...(parentByEmail ? [parentByEmail.id] : []),
      ]);

      const name = student.firstName;
      const nameAr = student.firstNameAr || student.firstName;

      // Notify parents
      for (const parentId of parentIds) {
        // Check if already notified this week
        const existing = await this.prisma.notification.findFirst({
          where: {
            schoolId, userId: parentId, type: 'absence_cascade',
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            referenceType: 'student',
            referenceId: student.id,
          },
        });
        if (existing) continue;

        await notificationsService.createNotification({
          schoolId,
          userId: parentId,
          type: 'absence_cascade',
          title: `We miss ${name} in class`,
          titleAr: `نشتاق إلى ${nameAr} في الفصل`,
          body: `${name} hasn\'t been to class for the last 3 sessions. We hope everything is alright and look forward to seeing them soon.`,
          bodyAr: `${nameAr} لم يحضر الفصل في آخر 3 جلسات. نأمل أن يكون كل شيء على ما يرام ونتطلع إلى رؤيته قريباً.`,
        });
      }

      // Find and notify servant
      if (student.groupId) {
        const servantSession = await this.prisma.attendanceSession.findFirst({
          where: { groupId: student.groupId, schoolId },
          orderBy: { scheduledDate: 'desc' },
          select: { servantId: true },
        });
        if (servantSession?.servantId) {
          const existingServant = await this.prisma.notification.findFirst({
            where: {
              schoolId, userId: servantSession.servantId, type: 'absence_cascade_servant',
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              referenceType: 'student',
              referenceId: student.id,
            },
          });
          if (!existingServant) {
            // Create servant notification (we'll add direct student reference support later)
            await this.prisma.notification.create({
              data: {
                schoolId,
                userId: servantSession.servantId,
                type: 'absence_cascade_servant',
                title: `${name} hasn\'t attended in 3 sessions`,
                titleAr: `${nameAr} لم يحضر منذ 3 جلسات`,
                body: `${name} has missed the last 3 sessions. No action required — just in case you want to check in.`,
                bodyAr: `${nameAr} تغيّب عن آخر 3 جلسات. لا حاجة لأي إجراء — فقط للعلم، في حال أردت التواصل.`,
                channel: 'in_app',
                referenceType: 'student',
                referenceId: student.id,
                sentAt: new Date(),
                deliveredAt: new Date(),
              },
            });
          }
        }
      }

      cascaded.push(student.id);
    }

    return { processed: students.length, cascaded: cascaded.length, studentIds: cascaded };
  }

  // ── Practice Stats ───────────────────────────────────────────────────────

  async getPracticeStats(user: any, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const ownSessions = await this.prisma.attendanceSession.findMany({
      where: { schoolId, servantId: user.id },
      select: { groupId: true },
    });
    const groupIds = [...new Set(ownSessions.map((s: any) => s.groupId).filter(Boolean))] as string[];

    const students = await this.prisma.student.findMany({
      where: { groupId: { in: groupIds }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
      orderBy: { firstName: 'asc' },
    });

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const practices = await this.prisma.familyPractice.groupBy({
      by: ['studentId'],
      where: { studentId: { in: students.map((s: any) => s.id) }, practicedAt: { gte: weekAgo } },
      _count: { id: true },
    });

    const practiceMap = new Map<string, number>();
    for (const p of practices) {
      practiceMap.set(p.studentId, p._count.id);
    }

    return {
      weekStart: weekAgo,
      students: students.map((s: any) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        firstNameAr: s.firstNameAr,
        lastNameAr: s.lastNameAr,
        practiceCount: practiceMap.get(s.id) || 0,
      })),
    };
  }

  async getLevelReport(user: any, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const userMeta = (user.metadata as any) || {};
    const levelId = userMeta.levelId as string | undefined;

    if (!levelId) {
      return { error: 'No level assigned to this user' };
    }

    const level = await this.prisma.level.findUnique({
      where: { id: levelId },
      select: { name: true, nameAr: true },
    });

    // Get all students in this level
    const students = await this.prisma.student.findMany({
      where: { levelId, deletedAt: null },
      select: { id: true, groupId: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
    });

    // Get unique group IDs from students
    const groupIds = [...new Set(students.map(s => s.groupId))];
    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds }, deletedAt: null },
      select: { id: true, name: true },
    });

    // Count servants
    const servants = await this.prisma.user.findMany({
      where: {
        schoolId,
        metadata: { path: ['levelId'], equals: levelId },
        deletedAt: null,
      },
      select: { id: true },
    });

    // Attendance rate
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: { attendanceSession: { schoolId, groupId: { in: groupIds } } },
      select: { status: true },
    });
    const attendanceRate = attendanceRecords.length > 0
      ? Math.round((attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length / attendanceRecords.length) * 100)
      : 0;

    // Assessment completion
    const studentIds = students.map(s => s.id);
    const assessmentSubmissions = await this.prisma.assessmentSubmission.findMany({
      where: { studentId: { in: studentIds } },
      select: { id: true },
    });
    const assessmentCompletionRate = students.length > 0
      ? Math.round((assessmentSubmissions.length / (students.length * 5)) * 100) // Assume 5 assessments per student
      : 0;

    // Mastery distribution (from grades)
    const grades = await this.prisma.grade.findMany({
      where: { submission: { studentId: { in: studentIds } }, questionId: null },
      select: { score: true, maxScore: true },
    });

    const masteryRates = grades.map(g => {
      const maxScore = typeof g.maxScore === 'object' ? g.maxScore.toNumber() : Number(g.maxScore);
      const score = typeof g.score === 'object' ? g.score.toNumber() : Number(g.score);
      return maxScore > 0 ? (score / maxScore) * 100 : 0;
    });
    const masteryDistribution = {
      excellent: masteryRates.filter(r => r >= 90).length,
      good: masteryRates.filter(r => r >= 80 && r < 90).length,
      satisfactory: masteryRates.filter(r => r >= 70 && r < 80).length,
      needsImprovement: masteryRates.filter(r => r < 70).length,
    };

    // Normalize to percentages
    const total = Object.values(masteryDistribution).reduce((a, b) => a + b, 0) || 1;
    const masteryPct = {
      excellent: total > 0 ? Math.round((masteryDistribution.excellent / total) * 100) : 0,
      good: total > 0 ? Math.round((masteryDistribution.good / total) * 100) : 0,
      satisfactory: total > 0 ? Math.round((masteryDistribution.satisfactory / total) * 100) : 0,
      needsImprovement: total > 0 ? Math.round((masteryDistribution.needsImprovement / total) * 100) : 0,
    };

    // Top and low performers
    const studentScores = students.map(s => {
      const studentGrades = grades.filter(g => {
        const maxScore = typeof g.maxScore === 'object' ? g.maxScore.toNumber() : Number(g.maxScore);
        return maxScore > 0;
      });
      const avgScore = studentGrades.length > 0
        ? Math.round(studentGrades.reduce((sum, g) => {
          const score = typeof g.score === 'object' ? g.score.toNumber() : Number(g.score);
          const maxScore = typeof g.maxScore === 'object' ? g.maxScore.toNumber() : Number(g.maxScore);
          return sum + (score / maxScore);
        }, 0) / studentGrades.length * 100)
        : 0;
      return {
        name: `${s.firstName} ${s.lastName}`,
        score: avgScore,
      };
    });

    const topPerformers = studentScores.length > 0 ? studentScores.sort((a, b) => b.score - a.score).slice(0, 10) : [];
    const lowPerformers = studentScores.length > 0 ? studentScores.sort((a, b) => a.score - b.score).slice(0, 10) : [];

    return {
      levelName: level?.name || 'Level',
      levelNameAr: level?.nameAr || 'مستوى',
      totalStudents: students.length,
      totalServants: servants.length,
      totalGroups: groupIds.length,
      attendanceRate,
      assessmentCompletionRate,
      masteryDistribution: masteryPct || { excellent: 0, good: 0, satisfactory: 0, needsImprovement: 0 },
      topPerformers,
      lowPerformers,
      recentActivity: [],
    };
  }

  async getGroupReport(user: any, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const userMeta = (user.metadata as any) || {};
    const groupId = userMeta.groupId as string | undefined;

    if (!groupId) {
      return { error: 'No group assigned to this user' };
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true, nameAr: true },
    });

    const students = await this.prisma.student.findMany({
      where: { groupId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
    });

    const studentIds = students.map(s => s.id);

    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: { attendanceSession: { schoolId, groupId } },
      select: { status: true },
    });
    const attendanceRate = attendanceRecords.length > 0
      ? Math.round((attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length / attendanceRecords.length) * 100)
      : 0;

    const assessmentSubmissions = await this.prisma.assessmentSubmission.findMany({
      where: { studentId: { in: studentIds } },
      select: { id: true },
    });
    const assessmentCompletionRate = students.length > 0
      ? Math.round((assessmentSubmissions.length / (students.length * 5)) * 100)
      : 0;

    const grades = await this.prisma.grade.findMany({
      where: { submission: { studentId: { in: studentIds } }, questionId: null },
      select: { score: true, maxScore: true },
    });

    const masteryRates = grades.map(g => {
      const maxScore = typeof g.maxScore === 'object' ? g.maxScore.toNumber() : Number(g.maxScore);
      const score = typeof g.score === 'object' ? g.score.toNumber() : Number(g.score);
      return maxScore > 0 ? (score / maxScore) * 100 : 0;
    });
    const masteryDistribution = {
      excellent: masteryRates.filter(r => r >= 90).length,
      good: masteryRates.filter(r => r >= 80 && r < 90).length,
      satisfactory: masteryRates.filter(r => r >= 70 && r < 80).length,
      needsImprovement: masteryRates.filter(r => r < 70).length,
    };

    const total = Object.values(masteryDistribution).reduce((a, b) => a + b, 0) || 1;
    const masteryPct = {
      excellent: total > 0 ? Math.round((masteryDistribution.excellent / total) * 100) : 0,
      good: total > 0 ? Math.round((masteryDistribution.good / total) * 100) : 0,
      satisfactory: total > 0 ? Math.round((masteryDistribution.satisfactory / total) * 100) : 0,
      needsImprovement: total > 0 ? Math.round((masteryDistribution.needsImprovement / total) * 100) : 0,
    };

    const studentScores = students.map(s => {
      const studentGrades = grades.filter(g => {
        const maxScore = typeof g.maxScore === 'object' ? g.maxScore.toNumber() : Number(g.maxScore);
        return maxScore > 0;
      });
      const avgScore = studentGrades.length > 0
        ? Math.round(studentGrades.reduce((sum, g) => {
          const score = typeof g.score === 'object' ? g.score.toNumber() : Number(g.score);
          const maxScore = typeof g.maxScore === 'object' ? g.maxScore.toNumber() : Number(g.maxScore);
          return sum + (score / maxScore);
        }, 0) / studentGrades.length * 100)
        : 0;
      return {
        name: `${s.firstName} ${s.lastName}`,
        score: avgScore,
      };
    });

    const topPerformers = studentScores.length > 0 ? studentScores.sort((a, b) => b.score - a.score).slice(0, 10) : [];
    const lowPerformers = studentScores.length > 0 ? studentScores.sort((a, b) => a.score - b.score).slice(0, 10) : [];

    return {
      groupName: group?.name || 'Group',
      groupNameAr: group?.nameAr || 'مجموعة',
      totalStudents: students.length,
      attendanceRate,
      assessmentCompletionRate,
      masteryDistribution: masteryPct || { excellent: 0, good: 0, satisfactory: 0, needsImprovement: 0 },
      topPerformers,
      lowPerformers,
      recentActivity: [],
    };
  }
}
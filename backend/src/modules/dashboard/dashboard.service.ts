import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

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
      totalChurches, totalUsers, totalBadges,
      completedSessions, totalSessions,
      activeStudents, publishedAssessments, totalAssessments,
    ] = await Promise.all([
      this.prisma.student.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.level.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.lesson.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.curriculumAllocation.count({ where: { academicYear: { schoolId: resolvedId } } }),
      this.prisma.church.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { schoolId: resolvedId, ...where } }),
      this.prisma.badge.count({ where: { schoolId: resolvedId, isActive: true } }),
      this.prisma.attendanceSession.count({ where: { schoolId: resolvedId, status: 'completed' } }),
      this.prisma.attendanceSession.count({ where: { schoolId: resolvedId, deletedAt: null } }),
      this.prisma.student.count({ where: { schoolId: resolvedId, status: 'active', ...where } }),
      this.prisma.assessment.count({ where: { schoolId: resolvedId, status: 'published', deletedAt: null } }),
      this.prisma.assessment.count({ where: { schoolId: resolvedId, deletedAt: null } }),
    ]);

    const attendanceRate = totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
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
      totalBadges,
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
    const roleToUse = viewRole || roles[0] || 'guest';
    const MINISTRY = ['servant', 'group_leader', 'level_leader', 'assistant_servant'];
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
    const own = await this.prisma.attendanceSession.findMany({
      where: { schoolId, servantId: user.id },
      select: { groupId: true },
    });
    const ownGroupIds = [...new Set(own.map((s: any) => s.groupId).filter(Boolean))] as string[];

    // Read metadata assignments for this servant
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { metadata: true },
    });
    const meta = (userRecord?.metadata as any) || {};
    const assignedGroupId = meta.groupId as string | undefined;
    const assignedLevelId = meta.levelId as string | undefined;
    const assignedGradeId = meta.gradeId as string | undefined;

    if (assignedGroupId && !ownGroupIds.includes(assignedGroupId)) {
      ownGroupIds.push(assignedGroupId);
    }

    // Determine the effective group IDs to scope to
    // Priority: metadata groupId > attendance session groups > all school groups
    const scoped = ownGroupIds.length > 0;
    const groupIds = scoped
      ? ownGroupIds
      : (await this.prisma.group.findMany({
          where: { schoolId, deletedAt: null },
          select: { id: true },
        })).map((g: any) => g.id);

    // Build filter conditions based on assignments
    const sessionWhere: any = { schoolId, groupId: { in: groupIds }, status: 'scheduled' };
    const studentWhere: any = { schoolId, groupId: { in: groupIds }, deletedAt: null };
    const gradeWhereBase: any = { submission: { assessment: { schoolId }, student: { groupId: { in: groupIds } } } };

    // If levelId is assigned, further restrict to that level
    if (assignedLevelId) {
      sessionWhere.levelId = assignedLevelId;
      // For students, we need to filter by level through the group relation
      const levelGroupIds = (await this.prisma.group.findMany({
        where: { schoolId, levelId: assignedLevelId, deletedAt: null },
        select: { id: true },
      })).map((g: any) => g.id);
      // Intersect with already-scoped groups
      const effectiveGroupIds = groupIds.filter((id: string) => levelGroupIds.includes(id));
      sessionWhere.groupId = { in: effectiveGroupIds };
      studentWhere.groupId = { in: effectiveGroupIds };
      gradeWhereBase.submission.student.groupId = { in: effectiveGroupIds };
    }

    // If gradeId is assigned, further restrict students to that school grade
    if (assignedGradeId) {
      studentWhere.gradeId = assignedGradeId;
    }

    const [sessions, groups, studentsCount, completedSessions, totalSessions, recentGrades] = await Promise.all([
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
        include: {
          _count: { select: { students: true } },
        },
      }),
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.attendanceSession.count({ where: { schoolId, groupId: { in: groupIds }, status: 'completed' } }),
      this.prisma.attendanceSession.count({ where: { schoolId, groupId: { in: groupIds }, deletedAt: null } }),
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

    const attendanceRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

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
        studentCount: g._count.students,
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

  async getServantDigest(user: any, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    // Find groups this servant teaches
    const ownSessions = await this.prisma.attendanceSession.findMany({
      where: { schoolId, servantId: user.id },
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
            data: { path: ['studentId'], equals: student.id },
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
          data: { studentId: student.id, type: 'absence_cascade' },
          channels: ['in_app'],
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
              data: { path: ['studentId'], equals: student.id },
            },
          });
          if (!existingServant) {
            await notificationsService.createNotification({
              schoolId,
              userId: servantSession.servantId,
              type: 'absence_cascade_servant',
              title: `${name} hasn\'t attended in 3 sessions`,
              titleAr: `${nameAr} لم يحضر منذ 3 جلسات`,
              body: `${name} has missed the last 3 sessions. No action required — just in case you want to check in.`,
              bodyAr: `${nameAr} تغيّب عن آخر 3 جلسات. لا حاجة لأي إجراء — فقط للعلم، في حال أردت التواصل.`,
              data: { studentId: student.id, type: 'absence_cascade_servant' },
              channels: ['in_app'],
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
}
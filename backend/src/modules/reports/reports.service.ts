import { loadAttendanceTrend } from '../attendance/attendance-trend';
import { findAtRiskStudents } from '../attendance/absence-risk';
import { computeHealthScore } from './health-score';
import { buildLevelGroupOverview } from './level-group-overview';
import { CLASS_SESSION_FILTER } from '../attendance/attendance-metrics';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { attendanceRate } from '../attendance/attendance-metrics';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
  ) {}

  // ── Level & group comparison (school leadership) ───────────────────────

  /**
   * Every level and group side by side: students, attendance (this window vs the one before), at-risk count and
   * pass rate. Fixed number of queries regardless of school size. `days` is clamped to 7..180.
   */
  async getLevelGroupOverview(schoolIdentifier: string, daysInput = 30) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const days = Math.min(180, Math.max(7, Math.floor(Number(daysInput) || 30)));
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const currentSince = new Date(now.getTime() - days * dayMs);
    const prevSince = new Date(now.getTime() - 2 * days * dayMs);

    const [levels, groups, students, rows, atRisk, graded] = await Promise.all([
      this.prisma.level.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, name: true, nameAr: true, orderIndex: true } }),
      this.prisma.group.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, name: true, nameAr: true, orderIndex: true } }),
      this.prisma.student.findMany({ where: { schoolId, deletedAt: null, status: 'active' }, select: { id: true, levelId: true, groupId: true } }),
      this.prisma.attendanceRecord.findMany({
        where: {
          status: { in: ['present', 'late', 'absent'] },
          student: { schoolId, deletedAt: null, status: 'active' },
          attendanceSession: { schoolId, deletedAt: null, scheduledDate: { gte: prevSince, lte: now }, AND: [CLASS_SESSION_FILTER] },
        },
        select: { studentId: true, status: true, attendanceSession: { select: { scheduledDate: true } } },
      }),
      findAtRiskStudents(this.prisma, schoolId, { now }),
      this.prisma.assessmentSubmission.findMany({
        where: {
          assessment: { schoolId, deletedAt: null },
          status: 'completed',
          grades: { some: { questionId: null, createdAt: { gte: currentSince } } },
          student: { schoolId, deletedAt: null, status: 'active' },
        },
        select: {
          studentId: true,
          assessment: { select: { passingScore: true } },
          grades: { where: { questionId: null }, select: { score: true } },
        },
      }),
    ]);

    const overview = buildLevelGroupOverview({
      levels,
      groups,
      students,
      records: rows.map((r: any) => ({
        studentId: r.studentId,
        status: r.status,
        current: new Date(r.attendanceSession.scheduledDate) >= currentSince,
      })),
      atRisk: new Set(atRisk.keys()),
      grades: graded
        .filter((g: any) => g.grades[0])
        .map((g: any) => ({ studentId: g.studentId, passed: Number(g.grades[0].score) >= Number(g.assessment.passingScore) })),
    });

    return { generatedAt: now.toISOString(), windowDays: days, ...overview };
  }

  // ── 30-Second Priest Pulse ─────────────────────────────────────────────

  async getPriestPulse(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Attendance and "at risk" come from the same shared code as the dashboard headline and the servant alerts,
    // so every screen agrees. A null rate means no class was held in that window (not 0%).
    const [trend, atRiskMap, totalActiveStudents] = await Promise.all([
      loadAttendanceTrend(this.prisma, schoolId),
      findAtRiskStudents(this.prisma, schoolId),
      this.prisma.student.count({ where: { schoolId, deletedAt: null, status: 'active' } }),
    ]);
    const attendanceThisWeek = trend[trend.length - 1].rate;
    const attendanceLastWeek = trend[trend.length - 2].rate;
    const attendanceDelta =
      attendanceThisWeek !== null && attendanceLastWeek !== null ? attendanceThisWeek - attendanceLastWeek : null;
    const atRiskCount = atRiskMap.size;

    // Assessments pending grading
    const pendingGrading = await this.prisma.assessmentSubmission.count({
      where: {
        assessment: { schoolId, deletedAt: null },
        status: 'submitted',
        grades: { none: {} },
      },
    });

    // XP earned this week
    const xpResult = await this.prisma.xPTransaction.aggregate({
      where: { student: { schoolId, deletedAt: null }, createdAt: { gte: weekAgo } },
      _sum: { amount: true },
    });
    const xpThisWeek = xpResult._sum.amount || 0;

    // Family practice sessions this week
    const familyPractice = await this.prisma.xPTransaction.count({
      where: { student: { schoolId, deletedAt: null }, type: 'family_practice', createdAt: { gte: weekAgo } },
    });

    // Active students this week
    const activeThisWeek = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId'],
      where: {
        student: { schoolId, deletedAt: null },
        attendanceSession: { scheduledDate: { gte: weekAgo } },
        status: { in: ['present', 'late'] },
      },
    });

    const health = computeHealthScore({
      attendanceRate: attendanceThisWeek,
      pendingGrading,
      studentsAtRisk: atRiskCount,
      familiesPracticedThisWeek: familyPractice,
    });

    const signals: any[] = [];
    if (atRiskCount > 0) {
      signals.push({
        type: 'warning',
        messageEn: atRiskCount + ' student' + (atRiskCount > 1 ? 's have' : ' has') + ' missed 3+ sessions in a row.',
        messageAr: atRiskCount + ' طالب' + (atRiskCount > 1 ? ' غابوا' : ' غاب') + ' عن 3 جلسات متتالية أو أكثر.',
      });
    }
    if (pendingGrading > 0) {
      signals.push({
        type: 'info',
        messageEn: pendingGrading + ' assessment' + (pendingGrading > 1 ? 's are' : ' is') + ' waiting to be graded.',
        messageAr: pendingGrading + ' تقييم' + (pendingGrading > 1 ? ' ينتظران' : ' ينتظر') + ' التصحيح.',
      });
    }
    if (attendanceDelta !== null && attendanceDelta >= 5) {
      signals.push({
        type: 'success',
        messageEn: 'Attendance improved ' + attendanceDelta + '% this week — a great sign.',
        messageAr: 'تحسّن الحضور ' + attendanceDelta + '٪ هذا الأسبوع — علامة رائعة.',
      });
    }
    if (familyPractice > 0) {
      signals.push({
        type: 'success',
        messageEn: familyPractice + ' famil' + (familyPractice > 1 ? 'ies' : 'y') + ' practiced hymns at home this week.',
        messageAr: familyPractice + ' ' + (familyPractice > 1 ? 'عائلات' : 'عائلة') + ' مارسوا التراتيل في المنزل هذا الأسبوع.',
      });
    }

    return {
      generatedAt: today,
      schoolId,
      pulse: {
        attendanceThisWeek,
        attendanceLastWeek,
        attendanceTrend: attendanceDelta,
        attendanceTrendPoints: trend,
        studentsAtRisk: atRiskCount,
        pendingGrading,
        xpEarnedThisWeek: xpThisWeek,
        familyPracticeThisWeek: familyPractice,
        totalStudents: totalActiveStudents,
        activeStudentsThisWeek: activeThisWeek.length,
        healthScore: health.score,
        healthBreakdown: health.components,
      },
      signals,
    };
  }

  // ── Liturgical Season Engagement Report ──────────────────────────────────

  async getLiturgicalEngagementReport(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const now = new Date();
    const yr = now.getFullYear();

    const seasons = [
      { key: 'nayrouz',      labelEn: 'Nayrouz (Coptic New Year)', labelAr: 'نيروز', color: '#F59E0B', start: new Date(yr + '-09-11'), end: new Date(yr + '-09-30') },
      { key: 'kiahk',        labelEn: 'Advent / Kiahk',            labelAr: 'كيهك',  color: '#6366F1', start: new Date(yr + '-11-10'), end: new Date(yr + '-12-08') },
      { key: 'christmas',    labelEn: 'Christmas Season',           labelAr: 'الميلاد', color: '#EF4444', start: new Date(yr + '-12-25'), end: new Date((yr + 1) + '-01-19') },
      { key: 'great_lent',   labelEn: 'Great Lent',                labelAr: 'الصوم الكبير', color: '#8B5CF6', start: new Date(yr + '-03-02'), end: new Date(yr + '-04-19') },
      { key: 'holy_week',    labelEn: 'Holy Week',                  labelAr: 'أسبوع الآلام', color: '#1F2937', start: new Date(yr + '-04-13'), end: new Date(yr + '-04-19') },
      { key: 'great_50',     labelEn: 'Great 50 Days',              labelAr: 'الخمسين المقدسة', color: '#10B981', start: new Date(yr + '-04-20'), end: new Date(yr + '-06-08') },
      { key: 'apostles_fast',labelEn: 'Fast of the Apostles',       labelAr: 'صوم الرسل', color: '#F97316', start: new Date(yr + '-06-12'), end: new Date(yr + '-07-11') },
    ];

    const seasonStats = await Promise.all(seasons.map(async (season) => {
      const sessions = await this.prisma.attendanceSession.findMany({
        where: { schoolId, scheduledDate: { gte: season.start, lte: season.end }, deletedAt: null },
        include: { attendanceRecords: { select: { status: true, attendedLiturgy: true } } },
      });
      const allRecs = sessions.flatMap((s: any) => s.attendanceRecords);
      const present = allRecs.filter((r: any) => r.status === 'present' || r.status === 'late').length;
      const liturgy = allRecs.filter((r: any) => r.attendedLiturgy).length;
      const rate = attendanceRate(allRecs);
      const xp = await this.prisma.xPTransaction.aggregate({
        where: { student: { schoolId, deletedAt: null }, createdAt: { gte: season.start, lte: season.end } },
        _sum: { amount: true },
      });
      return {
        ...season,
        sessions: sessions.length,
        totalRecords: allRecs.length,
        present,
        attendanceRate: rate,
        liturgyCount: liturgy,
        xpEarned: xp._sum.amount || 0,
        inPast: season.end < now,
        isCurrent: season.start <= now && now <= season.end,
      };
    }));

    // Monthly breakdown last 12 months
    const monthly: { month: string; rate: number; sessions: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const sessions = await this.prisma.attendanceSession.findMany({
        where: { schoolId, type: 'class', scheduledDate: { gte: start, lte: end }, deletedAt: null },
        include: { attendanceRecords: { select: { status: true } } },
      });
      const all = sessions.flatMap((s: any) => s.attendanceRecords);
      monthly.push({
        month: start.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        rate: attendanceRate(all),
        sessions: sessions.length,
      });
    }

    return { seasons: seasonStats, monthly };
  }

  // ── Servant Contribution Report ──────────────────────────────────────────

  async getServantContributions(schoolIdentifier: string, includeAll = false) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const MINISTRY_ROLES = ['servant', 'group_leader', 'level_leader', 'curriculum_manager'];

    const roleRecords = await this.prisma.userRole.findMany({
      where: { user: { schoolId, deletedAt: null, isActive: true }, role: { name: { in: MINISTRY_ROLES } } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true, createdAt: true } },
        role: { select: { name: true, displayName: true } },
      },
    });

    const userMap = new Map<string, any>();
    for (const ur of roleRecords) {
      if (!userMap.has(ur.userId)) userMap.set(ur.userId, { ...ur.user, roles: [] });
      userMap.get(ur.userId).roles.push(ur.role.name);
    }

    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const endLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0);

    const contributions = await Promise.all(Array.from(userMap.values()).map(async (servant: any) => {
      const [totalSessions, sessionsThisMonth, sessionsLastMonth, studentsReached] = await Promise.all([
        this.prisma.attendanceSession.count({ where: { schoolId, servantId: servant.id, deletedAt: null } }),
        this.prisma.attendanceSession.count({ where: { schoolId, servantId: servant.id, scheduledDate: { gte: thisMonth }, deletedAt: null } }),
        this.prisma.attendanceSession.count({ where: { schoolId, servantId: servant.id, scheduledDate: { gte: lastMonth, lte: endLastMonth }, deletedAt: null } }),
        this.prisma.attendanceRecord.groupBy({
          by: ['studentId'],
          where: { attendanceSession: { schoolId, servantId: servant.id, deletedAt: null } },
        }),
      ]);

      const yearsActive = Math.max(0, Math.floor((Date.now() - new Date(servant.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365)));

      let appreciationEn = '';
      let appreciationAr = '';
      const name = servant.firstName;
      const nameAr = servant.firstNameAr || servant.firstName;
      const reached = studentsReached.length;
      if (totalSessions >= 100) {
        appreciationEn = name + ' has taught over 100 sessions and reached ' + reached + ' students.';
        appreciationAr = nameAr + ' علّم أكثر من 100 جلسة ووصل إلى ' + reached + ' طالب.';
      } else if (totalSessions >= 50) {
        appreciationEn = name + ' has taught ' + totalSessions + ' sessions this year.';
        appreciationAr = nameAr + ' علّم ' + totalSessions + ' جلسة هذا العام.';
      } else {
        appreciationEn = name + ' has contributed ' + totalSessions + ' sessions to the school.';
        appreciationAr = nameAr + ' ساهم بـ ' + totalSessions + ' جلسة في المدرسة.';
      }

      return {
        id: servant.id,
        firstName: servant.firstName, lastName: servant.lastName,
        firstNameAr: servant.firstNameAr, lastNameAr: servant.lastNameAr,
        roles: servant.roles,
        yearsActive,
        totalSessions,
        sessionsThisMonth,
        sessionsLastMonth,
        trend: sessionsThisMonth - sessionsLastMonth,
        studentsReached: reached,
        appreciationEn,
        appreciationAr,
      };
    }));

    contributions.sort((a, b) => b.totalSessions - a.totalSessions);
    const mostActiveThisMonth = [...contributions].sort((a, b) => b.sessionsThisMonth - a.sessionsThisMonth)[0] || null;

    // An appreciation report should celebrate actual contribution. Seed/QA
    // accounts (never recorded a session) are excluded by default; callers can
    // pass includeInactive=true for a full roster (e.g. admin audits).
    const active = includeAll ? contributions : contributions.filter(c => c.totalSessions > 0);

    return {
      servants: active,
      excludedZeroActivity: contributions.length - active.length,
      summary: {
        totalServants: active.length,
        totalSessionsAllTime: active.reduce((s, c) => s + c.totalSessions, 0),
        mostActiveThisMonth: mostActiveThisMonth ? {
          name: mostActiveThisMonth.firstName,
          nameAr: mostActiveThisMonth.firstNameAr,
          sessions: mostActiveThisMonth.sessionsThisMonth,
        } : null,
      },
    };
  }
  // ── Diocese Dashboard ──────────────────────────────────────────────────────

  async getDioceseDashboard(churchId: string) {
    // Find all schools under this church
    const schools = await this.prisma.school.findMany({
      where: { churchId, deletedAt: null },
      select: { id: true, name: true, nameAr: true, slug: true, isActive: true, createdAt: true },
    });

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const schoolStats = await Promise.all(schools.map(async (school: any) => {
      const [totalStudents, activeStudents, atRiskCount, servantCount, sessionsThisWeek, xpThisWeek] = await Promise.all([
        this.prisma.student.count({ where: { schoolId: school.id, deletedAt: null } }),
        this.prisma.attendanceRecord.groupBy({
          by: ['studentId'],
          where: { student: { schoolId: school.id, deletedAt: null }, attendanceSession: { scheduledDate: { gte: weekAgo } }, status: { in: ['present', 'late'] } },
        }).then((r: any[]) => r.length),
        // at-risk: students with last 3 all absent
        this.prisma.student.findMany({ where: { schoolId: school.id, deletedAt: null }, select: { id: true } })
          .then(async (students: any[]) => {
            let count = 0;
            for (const s of students) {
              const last3 = await this.prisma.attendanceRecord.findMany({
                where: { studentId: s.id }, orderBy: { createdAt: 'desc' }, take: 3, select: { status: true },
              });
              if (last3.length >= 3 && last3.every((r: any) => r.status === 'absent')) count++;
            }
            return count;
          }),
        this.prisma.userRole.count({ where: { user: { schoolId: school.id }, role: { name: { in: ['servant', 'group_leader', 'level_leader', 'curriculum_manager'] } } } }),
        this.prisma.attendanceSession.findMany({
          where: { schoolId: school.id, type: 'class', scheduledDate: { gte: weekAgo }, deletedAt: null },
          include: { attendanceRecords: { select: { status: true } } },
        }).then((sessions: any[]) => {
          const all = sessions.flatMap((s: any) => s.attendanceRecords);
          return { count: sessions.length, rate: attendanceRate(all) };
        }),
        this.prisma.xPTransaction.aggregate({
          where: { student: { schoolId: school.id, deletedAt: null }, createdAt: { gte: weekAgo } },
          _sum: { amount: true },
        }).then((r: any) => r._sum.amount || 0),
      ]);

      const healthScore = Math.min(100, Math.round(
        (sessionsThisWeek.rate * 0.5) +
        (atRiskCount === 0 ? 30 : Math.max(0, 30 - atRiskCount * 5)) +
        (servantCount > 0 ? 20 : 5),
      ));

      return {
        schoolId: school.id,
        schoolName: school.name,
        schoolNameAr: school.nameAr,
        slug: school.slug,
        isActive: school.isActive,
        totalStudents,
        activeStudentsThisWeek: activeStudents,
        atRiskStudents: atRiskCount,
        servantCount,
        sessionsThisWeek: sessionsThisWeek.count,
        attendanceRateThisWeek: sessionsThisWeek.rate,
        xpThisWeek,
        healthScore,
        signals: [
          atRiskCount > 0 ? { type: 'warning', messageEn: atRiskCount + ' student' + (atRiskCount > 1 ? 's' : '') + ' at risk', messageAr: atRiskCount + ' طالب' + (atRiskCount > 1 ? 'ون' : '') + ' في خطر' } : null,
          sessionsThisWeek.rate < 60 && sessionsThisWeek.count > 0 ? { type: 'warning', messageEn: 'Low attendance: ' + sessionsThisWeek.rate + '%', messageAr: 'حضور منخفض: ' + sessionsThisWeek.rate + '٪' } : null,
          sessionsThisWeek.rate >= 90 ? { type: 'success', messageEn: 'Excellent attendance: ' + sessionsThisWeek.rate + '%', messageAr: 'حضور ممتاز: ' + sessionsThisWeek.rate + '٪' } : null,
        ].filter(Boolean),
      };
    }));

    const church = await this.prisma.church.findUnique({ where: { id: churchId }, select: { name: true, nameAr: true } });
    const totalStudentsAll = schoolStats.reduce((s: number, sc: any) => s + sc.totalStudents, 0);
    const avgHealth = schoolStats.length > 0 ? Math.round(schoolStats.reduce((s: number, sc: any) => s + sc.healthScore, 0) / schoolStats.length) : 0;
    const totalAtRisk = schoolStats.reduce((s: number, sc: any) => s + sc.atRiskStudents, 0);
    const bestSchool = [...schoolStats].sort((a: any, b: any) => b.healthScore - a.healthScore)[0] || null;

    return {
      churchId,
      churchName: church?.name || '',
      churchNameAr: church?.nameAr || '',
      totalSchools: schools.length,
      totalStudents: totalStudentsAll,
      avgHealthScore: avgHealth,
      totalAtRisk,
      bestPerforming: bestSchool ? { name: bestSchool.schoolName, score: bestSchool.healthScore } : null,
      schools: schoolStats,
    };
  }


  // ── Diocese Dashboard ─────────────────────────────────────────────────────

async getDioceseReport(churchId?: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const churches = await this.prisma.church.findMany({
      where: {
        deletedAt: null, isActive: true,
        ...(churchId ? { id: churchId } : {}),
      },
      include: {
        schools: {
          where: { deletedAt: null },
          select: {
            id: true, name: true, nameAr: true, slug: true,
            isActive: true, createdAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const calcRate = (sessions: any[]) => {
      const all = sessions.flatMap((s: any) => s.attendanceRecords);
      if (!all.length) return 0;
      return attendanceRate(all);
    };

    const schoolStats = await Promise.all(
      churches.flatMap((church: any) =>
        church.schools.map(async (school: any) => {
          const [
            totalStudents, totalServants,
            thisWeekSessions, lastWeekSessions,
            pendingGrading, recentBadges,
          ] = await Promise.all([
            this.prisma.student.count({ where: { schoolId: school.id, deletedAt: null } }),

            this.prisma.userRole.count({
              where: {
                user: { schoolId: school.id },
                role: { name: { in: ['servant', 'group_leader', 'level_leader', 'curriculum_manager'] } },
              },
            }),

            this.prisma.attendanceSession.findMany({
              where: { schoolId: school.id, type: 'class', scheduledDate: { gte: weekAgo }, deletedAt: null },
              include: { attendanceRecords: { select: { status: true } } },
            }),

            this.prisma.attendanceSession.findMany({
              where: { schoolId: school.id, type: 'class', scheduledDate: { gte: twoWeeksAgo, lt: weekAgo }, deletedAt: null },
              include: { attendanceRecords: { select: { status: true } } },
            }),

            this.prisma.assessmentSubmission.count({
              where: {
                assessment: { schoolId: school.id, deletedAt: null },
                status: 'submitted',
                grades: { none: {} },
              },
            }),

            this.prisma.studentBadge.count({
              where: {
                student: { schoolId: school.id },
                awardedAt: { gte: weekAgo },
              },
            }),
          ]);

          const attendanceThisWeek = calcRate(thisWeekSessions);
          const attendanceLastWeek = calcRate(lastWeekSessions);
          const trend = attendanceThisWeek - attendanceLastWeek;

          // At-risk students
          const students = await this.prisma.student.findMany({
            where: { schoolId: school.id, deletedAt: null },
            select: { id: true },
          });
          let atRisk = 0;
          for (const s of students) {
            const last3 = await this.prisma.attendanceRecord.findMany({
              where: { studentId: s.id },
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: { status: true },
            });
            if (last3.length >= 3 && last3.every((r: any) => r.status === 'absent')) atRisk++;
          }

          // Health score
          const healthScore = Math.min(100, Math.round(
            (attendanceThisWeek * 0.5) +
            (pendingGrading === 0 ? 20 : Math.max(0, 20 - pendingGrading * 2)) +
            (atRisk === 0 ? 20 : Math.max(0, 20 - atRisk * 4)) +
            (recentBadges > 0 ? 10 : 0),
          ));

          const signals: string[] = [];
          if (atRisk > 0) signals.push(atRisk + ' student' + (atRisk > 1 ? 's' : '') + ' at risk');
          if (pendingGrading > 0) signals.push(pendingGrading + ' pending grade' + (pendingGrading > 1 ? 's' : ''));
          if (trend >= 5) signals.push('+' + trend + '% attendance this week');

          return {
            churchId: church.id,
            churchName: church.name,
            churchNameAr: church.nameAr,
            schoolId: school.id,
            schoolName: school.name,
            schoolNameAr: school.nameAr,
            slug: school.slug,
            isActive: school.isActive,
            totalStudents,
            totalServants,
            attendanceThisWeek,
            attendanceLastWeek,
            trend,
            pendingGrading,
            studentsAtRisk: atRisk,
            badgesThisWeek: recentBadges,
            healthScore,
            signals,
          };
        })
      )
    );

    const totalStudents = schoolStats.reduce((s, c) => s + c.totalStudents, 0);
    const totalServants = schoolStats.reduce((s, c) => s + c.totalServants, 0);
    const avgAttendance = schoolStats.length
      ? Math.round(schoolStats.reduce((s, c) => s + c.attendanceThisWeek, 0) / schoolStats.length)
      : 0;
    const totalAtRisk = schoolStats.reduce((s, c) => s + c.studentsAtRisk, 0);
    const healthiest = [...schoolStats].sort((a, b) => b.healthScore - a.healthScore)[0] || null;
    const needsAttention = schoolStats.filter(s => s.healthScore < 60);

    return {
      generatedAt: now,
      summary: {
        totalChurches: churches.length,
        totalSchools: schoolStats.length,
        totalStudents,
        totalServants,
        avgAttendance,
        totalAtRisk,
        dioceseHealthScore: schoolStats.length
          ? Math.round(schoolStats.reduce((s, c) => s + c.healthScore, 0) / schoolStats.length)
          : 0,
      },
      healthiest: healthiest ? { schoolName: healthiest.schoolName, churchName: healthiest.churchName, score: healthiest.healthScore } : null,
      needsAttention: needsAttention.map(s => ({ schoolName: s.schoolName, churchName: s.churchName, score: s.healthScore, signals: s.signals })),
      schools: schoolStats.sort((a, b) => b.healthScore - a.healthScore),
    };
  }

}
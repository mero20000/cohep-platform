import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
  ) {}

  // ── 30-Second Priest Pulse ─────────────────────────────────────────────

  async getPriestPulse(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const calcRate = (sessions: any[]) => {
      const all = sessions.flatMap((s: any) => s.attendanceRecords);
      if (!all.length) return 0;
      return Math.round(all.filter((r: any) => r.status === 'present' || r.status === 'late').length / all.length * 100);
    };

    const [thisWeekSessions, lastWeekSessions] = await Promise.all([
      this.prisma.attendanceSession.findMany({
        where: { schoolId, scheduledDate: { gte: weekAgo }, deletedAt: null },
        include: { attendanceRecords: { select: { status: true } } },
      }),
      this.prisma.attendanceSession.findMany({
        where: { schoolId, scheduledDate: { gte: twoWeeksAgo, lt: weekAgo }, deletedAt: null },
        include: { attendanceRecords: { select: { status: true } } },
      }),
    ]);

    const attendanceThisWeek = calcRate(thisWeekSessions);
    const attendanceLastWeek = calcRate(lastWeekSessions);

    // Students at risk: 3+ consecutive absences
    const allStudents = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
    });

    let atRiskCount = 0;
    for (const student of allStudents) {
      const last3 = await this.prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { status: true },
      });
      if (last3.length >= 3 && last3.every((r: any) => r.status === 'absent')) {
        atRiskCount++;
      }
    }

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

    const healthScore = Math.min(100, Math.round(
      (attendanceThisWeek * 0.5) +
      (pendingGrading === 0 ? 20 : Math.max(0, 20 - pendingGrading * 2)) +
      (atRiskCount === 0 ? 20 : Math.max(0, 20 - atRiskCount * 4)) +
      (familyPractice > 0 ? 10 : 0),
    ));

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
    if (attendanceThisWeek - attendanceLastWeek >= 5) {
      signals.push({
        type: 'success',
        messageEn: 'Attendance improved ' + (attendanceThisWeek - attendanceLastWeek) + '% this week — a great sign.',
        messageAr: 'تحسّن الحضور ' + (attendanceThisWeek - attendanceLastWeek) + '٪ هذا الأسبوع — علامة رائعة.',
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
        attendanceTrend: attendanceThisWeek - attendanceLastWeek,
        studentsAtRisk: atRiskCount,
        pendingGrading,
        xpEarnedThisWeek: xpThisWeek,
        familyPracticeThisWeek: familyPractice,
        totalStudents: allStudents.length,
        activeStudentsThisWeek: activeThisWeek.length,
        healthScore,
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
      const rate = allRecs.length > 0 ? Math.round(present / allRecs.length * 100) : 0;
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
        where: { schoolId, scheduledDate: { gte: start, lte: end }, deletedAt: null },
        include: { attendanceRecords: { select: { status: true } } },
      });
      const all = sessions.flatMap((s: any) => s.attendanceRecords);
      const pres = all.filter((r: any) => r.status === 'present' || r.status === 'late').length;
      monthly.push({
        month: start.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        rate: all.length > 0 ? Math.round(pres / all.length * 100) : 0,
        sessions: sessions.length,
      });
    }

    return { seasons: seasonStats, monthly };
  }

  // ── Servant Contribution Report ──────────────────────────────────────────

  async getServantContributions(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const MINISTRY_ROLES = ['servant', 'group_leader', 'level_leader', 'assistant_servant', 'curriculum_manager'];

    const roleRecords = await this.prisma.userRole.findMany({
      where: { user: { schoolId }, role: { name: { in: MINISTRY_ROLES } } },
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

    return {
      servants: contributions,
      summary: {
        totalServants: contributions.length,
        totalSessionsAllTime: contributions.reduce((s, c) => s + c.totalSessions, 0),
        mostActiveThisMonth: mostActiveThisMonth ? {
          name: mostActiveThisMonth.firstName,
          nameAr: mostActiveThisMonth.firstNameAr,
          sessions: mostActiveThisMonth.sessionsThisMonth,
        } : null,
      },
    };
  }
}

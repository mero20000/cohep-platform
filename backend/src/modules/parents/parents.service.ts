import { Injectable, NotFoundException, ForbiddenException, HttpException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async unlinkChild(studentId: string, userId: string) {
    const parent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!parent) throw new NotFoundException('Parent not found');

    // Delete explicit StudentParent join record if it exists
    await this.prisma.studentParent.deleteMany({
      where: { studentId, parentId: userId },
    });

    // Also clear parentEmail on the student if it matches the parent's email
    if (parent.email) {
      await this.prisma.student.updateMany({
        where: { id: studentId, parentEmail: parent.email },
        data: { parentEmail: null },
      });
    }

    return this.getChildren(userId);
  }

  async getChildren(userId: string) {
    const parent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, schoolId: true },
    });
    if (!parent) return [];

    const [links, emailStudents] = await Promise.all([
      this.prisma.studentParent.findMany({
        where: { parentId: userId },
        include: {
          student: {
            include: {
              level: { select: { number: true, name: true } },
              group: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.findMany({
        where: { parentEmail: parent.email, schoolId: parent.schoolId, deletedAt: null },
        include: {
          level: { select: { number: true, name: true } },
          group: { select: { name: true } },
        },
      }),
    ]);

    const byStudent = new Map<string, any>();
    for (const sp of links) {
      byStudent.set(sp.student.id, sp);
    }
    for (const s of emailStudents) {
      if (!byStudent.has(s.id)) {
        byStudent.set(s.id, { student: s, relationship: 'parent', isPrimary: false });
      }
    }

    return Promise.all(Array.from(byStudent.values()).map(sp => this.mapStudentParent(sp)));
  }

  private async mapStudentParent(sp: any) {
    const attCounts = await this.getAttendanceCounts(sp.student.id);
    const upcomingCount = await this.prisma.attendanceSession.count({
      where: {
        groupId: sp.student.groupId,
        status: 'scheduled',
        scheduledDate: { gte: new Date() },
      },
    });
    // Compute total points from attendance records
    const [attRecords, pointConfig, badgeCount, currentLesson] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId: sp.student.id },
        select: { status: true, behavior: true, participation: true, attendedLiturgy: true },
      }),
      this.prisma.systemConfig.findUnique({
        where: { schoolId_key: { schoolId: sp.student.schoolId, key: 'point_rules' } },
        select: { value: true },
      }),
      this.prisma.studentBadge.count({ where: { studentId: sp.student.id } }),
      this.getChildrenCurrentLesson(sp.student.id),
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
      relationship: sp.relationship,
      isPrimary: sp.isPrimary,
      student: {
        id: sp.student.id,
        studentCode: sp.student.studentCode,
        firstName: sp.student.firstName,
        lastName: sp.student.lastName,
        firstNameAr: sp.student.firstNameAr,
        lastNameAr: sp.student.lastNameAr,
        photoUrl: sp.student.photoUrl,
        levelNumber: sp.student.level?.number,
        levelName: sp.student.level?.name,
        groupName: sp.student.group?.name,
        schoolGrade: sp.student.schoolGrade,
        status: sp.student.status,
        totalPoints,
        badges: badgeCount,
        ...attCounts,
        upcomingSessions: upcomingCount,
        attendanceRate: attCounts.total > 0
          ? Math.round(((attCounts.present + attCounts.late) / attCounts.total) * 100)
          : 0,
      },
      currentLesson,
    };
  }

  private async getChildrenCurrentLesson(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, levelId: true },
    });
    if (!student?.levelId) return null;

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: student.schoolId, isCurrent: true },
    });
    if (!academicYear) return null;

    const now = new Date();
    const yearStart = new Date(academicYear.startDate);
    const yearEnd = new Date(academicYear.endDate);
    const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
    const elapsed = (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
    const term = totalDays > 0 ? Math.min(Math.ceil((elapsed / totalDays) * 3), 3) : 1;

    const allocation = await this.prisma.curriculumAllocation.findFirst({
      where: {
        academicYearId: academicYear.id,
        levelId: student.levelId,
        term,
        scheduledDate: { lte: now },
        status: 'active',
      },
      include: {
        lesson: {
          select: { id: true, title: true, titleAr: true, audioUrl: true, audioDuration: true },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });
    if (!allocation?.lesson) return null;
    return allocation.lesson;
  }

  async getChild(studentId: string, userId: string) {
    const parent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId: userId } },
      include: {
        student: {
          include: {
            level: { select: { number: true, name: true } },
            group: { select: { name: true } },
          },
        },
      },
    });
    const student =
      link?.student ??
      (await this.prisma.student.findFirst({
        where: { id: studentId, parentEmail: parent?.email, deletedAt: null },
        include: {
          level: { select: { number: true, name: true } },
          group: { select: { name: true } },
        },
      }));
    if (!student) throw new ForbiddenException('You are not a parent of this student');
    return (await this.mapStudentParent({ student, relationship: link?.relationship || 'parent', isPrimary: link?.isPrimary || false })).student;
  }

  async linkChild(studentCode: string, userId: string, relationship = 'parent') {
    const parent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true, email: true },
    });
    if (!parent) throw new NotFoundException('Parent not found');
    const student = await this.prisma.student.findFirst({
      where: { studentCode, schoolId: parent.schoolId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('No student found with that code in your school');
    const existing = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId: student.id, parentId: userId } },
    });
    if (!existing) {
      await this.prisma.studentParent.create({
        data: { studentId: student.id, parentId: userId, relationship, isPrimary: false },
      });
    }
    if (!student.parentEmail && parent.email) {
      await this.prisma.student.update({
        where: { id: student.id },
        data: { parentEmail: parent.email },
      });
    }
    return this.getChildren(userId);
  }

  async getChildAttendance(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      include: {
        attendanceSession: {
          include: { level: { select: { number: true, name: true } } },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 50,
    });
    return records.map(r => ({
      id: r.id,
      date: r.attendanceSession?.scheduledDate,
      status: r.status,
      homeworkStatus: r.homeworkStatus,
      note: r.note,
      levelNumber: r.attendanceSession?.level?.number,
      levelName: r.attendanceSession?.level?.name,
    }));
  }

  async getChildAssessments(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);
    const submissions = await this.prisma.assessmentSubmission.findMany({
      where: { studentId },
      include: {
        assessment: { include: { subject: { select: { name: true, nameAr: true } } } },
        grades: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map(s => {
      const totalScore = s.grades.reduce((sum, g) => sum + Number(g.score), 0);
      const maxScore = s.grades.reduce((sum, g) => sum + Number(g.maxScore), 0) || Number(s.assessment.totalPoints);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      return {
        id: s.id,
        assessmentId: s.assessment.id,
        title: s.assessment.title,
        titleAr: s.assessment.titleAr,
        subject: s.assessment.subject?.name,
        subjectAr: s.assessment.subject?.nameAr,
        status: s.status,
        score: totalScore,
        maxScore,
        percentage,
        passed: percentage >= Number(s.assessment.passingScore),
        gradedAt: s.grades.length > 0 ? s.grades[0]?.gradedAt : null,
      };
    });
  }

  async getChildProgress(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { groupId: (await this.prisma.student.findUnique({ where: { id: studentId }, select: { groupId: true } }))?.groupId, status: 'completed' },
      select: { id: true, scheduledDate: true, levelId: true },
      orderBy: { scheduledDate: 'desc' },
      take: 20,
    });
    const assessments = await this.prisma.assessmentSubmission.findMany({
      where: { studentId, status: 'graded' },
      select: { id: true, createdAt: true, grades: { select: { score: true, maxScore: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return { sessions, assessments };
  }

  private async getAttendanceCounts(studentId: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      select: { status: true },
    });
    let present = 0, late = 0, absent = 0, excused = 0;
    for (const r of records) {
      if (r.status === 'present') present++;
      else if (r.status === 'late') late++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'excused') excused++;
    }
    return { total: records.length, present, late, absent, excused };
  }


  async getChildHome(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        level: { select: { id: true, number: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    // XP & streak
    const xpResult = await this.prisma.xPTransaction.aggregate({
      where: { studentId },
      _sum: { amount: true },
    });
    const totalXp = xpResult._sum.amount || 0;
    const xpLevel = Math.floor(totalXp / 100) + 1;
    const xpInCurrentLevel = totalXp % 100;

    const recentTx = await this.prisma.xPTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { createdAt: true },
    });
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let cursor = new Date(today);
    const txDays = new Set(recentTx.map(t => { const d = new Date(t.createdAt); d.setHours(0,0,0,0); return d.getTime(); }));
    for (let i = 0; i < 60; i++) {
      if (txDays.has(cursor.getTime())) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }

    // Badges
    const studentBadges = await this.prisma.studentBadge.findMany({
      where: { studentId },
      include: { badge: { select: { id: true, name: true, description: true, category: true, iconUrl: true, xpReward: true } } },
      orderBy: { awardedAt: 'desc' },
    });

    // Attendance
    const attRecords = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      select: { status: true },
    });
    const present = attRecords.filter(r => r.status === 'present').length;
    const total = attRecords.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    // Hymn Journey — built from subjects allocated to this student's level
    const journeyItems: any[] = [];
    if (student.levelId) {
      // Get distinct subjects for this level via curriculum allocations
      const allocations = await this.prisma.curriculumAllocation.findMany({
        where: { levelId: student.levelId },
        include: {
          subject: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { orderIndex: 'asc' },
        take: 30,
      });

      // Get lessons the student has attended (proxy for hymns learned)
      const attendedSessions = await this.prisma.attendanceRecord.findMany({
        where: { studentId, status: { in: ['present', 'late'] } },
        select: { attendanceSessionId: true },
      });
      const attendedSessionIds = new Set(attendedSessions.map(r => r.attendanceSessionId));

      // Get assessments this student passed
      const passedSubs = await this.prisma.assessmentSubmission.findMany({
        where: { studentId, status: 'submitted' },
        select: {
          assessmentId: true,
          grades: { select: { score: true, maxScore: true } },
        },
      });
      const passedAssessmentIds = new Set<string>();
      for (const sub of passedSubs) {
        const ts = sub.grades.reduce((s: number, g: any) => s + Number(g.score), 0);
        const ms = sub.grades.reduce((s: number, g: any) => s + Number(g.maxScore), 0);
        if (ms > 0 && ts / ms >= 0.5) passedAssessmentIds.add(sub.assessmentId);
      }

      // De-duplicate subjects
      const seenSubjects = new Set<string>();
      for (const alloc of allocations) {
        if (!alloc.subject || seenSubjects.has(alloc.subject.id)) continue;
        seenSubjects.add(alloc.subject.id);

        // Check if student has a passed assessment for this subject
        const subjectAssessments = await this.prisma.assessment.findMany({
          where: { subjectId: alloc.subjectId },
          select: { id: true },
        });
        const isPassed = subjectAssessments.some(a => passedAssessmentIds.has(a.id));

        journeyItems.push({
          id: alloc.subject.id,
          name: alloc.subject.name || `Subject ${journeyItems.length + 1}`,
          nameAr: alloc.subject.nameAr,
          subject: alloc.subject.name,
          subjectAr: alloc.subject.nameAr,
          status: isPassed ? 'completed' : 'upcoming',
        });
      }
    }
    const firstUpcoming = journeyItems.findIndex(i => i.status === 'upcoming');
    if (firstUpcoming >= 0) journeyItems[firstUpcoming].status = 'current';

    // Seasonal challenge
    const month = new Date().getMonth();
    const seasonalChallenges: Record<number, any> = {
      11: { title: 'Kiahk Challenge', titleAr: 'تحدي كيهك', description: 'Learn 3 Kiahk praise hymns before Christmas', descriptionAr: 'تعلم 3 تراتيل تسبحة كيهك قبل الميلاد', icon: '⭐' },
      2: { title: 'Great Lent Challenge', titleAr: 'تحدي الصوم الكبير', description: 'Practice the fasting hymns every week', descriptionAr: 'تدرب على تراتيل الصوم كل أسبوع', icon: '✝' },
      3: { title: 'Holy Week Challenge', titleAr: 'تحدي أسبوع الآلام', description: 'Learn the Golgotha Praises before Great Friday', descriptionAr: 'تعلم تسبحة الجلجثة قبل الجمعة العظيمة', icon: '🕊' },
      4: { title: 'Resurrection Challenge', titleAr: 'تحدي القيامة', description: 'Sing the Resurrection hymns with joy this season', descriptionAr: 'رتل تراتيل القيامة بفرح في هذا الموسم', icon: '🌟' },
    };
    const challenge = seasonalChallenges[month] || {
      title: 'Weekly Practice Challenge', titleAr: 'تحدي الأسبوع',
      description: 'Practice your current hymn 3 times this week', descriptionAr: 'تدرب على ترنيمتك الحالية 3 مرات هذا الأسبوع',
      icon: '🎵',
    };

    // Recent activity
    const recentActivity = await this.prisma.xPTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { amount: true, type: true, description: true, createdAt: true },
    });

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameAr: student.firstNameAr,
        lastNameAr: student.lastNameAr,
        photoUrl: student.photoUrl,
        studentCode: student.studentCode,
        levelNumber: student.level?.number,
        levelName: student.level?.name,
        groupName: student.group?.name,
      },
      xp: { total: totalXp, level: xpLevel, inCurrentLevel: xpInCurrentLevel, toNextLevel: 100 - xpInCurrentLevel },
      streak,
      badges: studentBadges.map(sb => ({
        id: sb.id, badgeId: sb.badge.id, name: sb.badge.name,
        description: sb.badge.description, category: sb.badge.category,
        icon: sb.badge.iconUrl, xpReward: sb.badge.xpReward, earnedAt: sb.awardedAt,
      })),
      attendance: { present, total, rate: attendanceRate },
      journey: journeyItems,
      challenge,
      recentActivity: recentActivity.map(t => ({ amount: t.amount, type: t.type, description: t.description, date: t.createdAt })),
    };
  }

  async getCurrentLesson(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, levelId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId: student.schoolId, isCurrent: true },
    });
    if (!academicYear) return null;

    const now = new Date();
    const yearStart = new Date(academicYear.startDate);
    const yearEnd = new Date(academicYear.endDate);
    const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
    const elapsed = (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
    const term = totalDays > 0 ? Math.min(Math.ceil((elapsed / totalDays) * 3), 3) : 1;

    const allocation = await this.prisma.curriculumAllocation.findFirst({
      where: {
        academicYearId: academicYear.id,
        levelId: student.levelId,
        term,
        scheduledDate: { lte: now },
        status: 'active',
      },
      include: {
        lesson: {
          include: {
            sessions: { orderBy: { orderIndex: 'asc' } },
            subject: { select: { name: true, nameAr: true } },
            level: { select: { number: true, name: true } },
          },
        },
        subject: { select: { name: true, nameAr: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    if (!allocation) return null;

    return {
      lesson: {
        id: allocation.lesson.id,
        title: allocation.lesson.title,
        titleAr: allocation.lesson.titleAr,
        titleCoptic: allocation.lesson.titleCoptic,
        description: allocation.lesson.description,
        descriptionAr: allocation.lesson.descriptionAr,
        requiredMemorization: allocation.lesson.requiredMemorization,
        requiredMemorizationAr: allocation.lesson.requiredMemorizationAr,
        sessions: allocation.lesson.sessions.map(s => ({
          id: s.id,
          title: s.title,
          titleAr: s.titleAr,
          orderIndex: s.orderIndex,
          contentEn: s.contentEn,
          contentAr: s.contentAr,
          contentCoptic: s.contentCoptic,
        })),
      },
      subject: { name: allocation.subject.name, nameAr: allocation.subject.nameAr },
      level: { number: allocation.lesson.level.number, name: allocation.lesson.level.name },
    };
  }

  async logPractice(studentId: string, lessonId: string, userId: string) {
    await this.verifyParent(userId, studentId);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [xpRewardCfg, weeklyLimitCfg] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { schoolId_key: { schoolId: student.schoolId, key: 'practice_xp_reward' } },
      }),
      this.prisma.systemConfig.findUnique({
        where: { schoolId_key: { schoolId: student.schoolId, key: 'practice_weekly_limit' } },
      }),
    ]);
    const xpReward = (xpRewardCfg?.value as number) ?? 20;
    const weeklyLimit = (weeklyLimitCfg?.value as number) ?? 3;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyCount = await this.prisma.familyPractice.count({
      where: { studentId, practicedAt: { gte: startOfWeek } },
    });

    if (weeklyCount >= weeklyLimit) {
      throw new HttpException(
        { error: 'Weekly limit reached', weeklyCount, weeklyLimit },
        429,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const practice = await tx.familyPractice.create({
        data: { studentId, lessonId, source: 'parent' },
      });

      const xpAgg = await tx.xPTransaction.aggregate({
        where: { studentId },
        _sum: { amount: true },
      });
      const currentBalance = xpAgg._sum.amount || 0;

      await tx.xPTransaction.create({
        data: {
          studentId,
          amount: xpReward,
          balanceAfter: currentBalance + xpReward,
          type: 'practice',
          referenceType: 'family_practice',
          referenceId: practice.id,
          description: 'Practiced lesson at home',
          createdBy: userId,
        },
      });

      return practice;
    });

    return { practiced: true, xpAwarded: xpReward, weeklyCount: weeklyCount + 1, weeklyLimit };
  }

  async getPracticeSummary(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const weeklyLimitCfg = await this.prisma.systemConfig.findUnique({
      where: { schoolId_key: { schoolId: student.schoolId, key: 'practice_weekly_limit' } },
    });
    const weeklyLimit = (weeklyLimitCfg?.value as number) ?? 3;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [weeklyCount, lastPractice, totalPractices] = await Promise.all([
      this.prisma.familyPractice.count({
        where: { studentId, practicedAt: { gte: startOfWeek } },
      }),
      this.prisma.familyPractice.findFirst({
        where: { studentId },
        orderBy: { practicedAt: 'desc' },
        select: { practicedAt: true },
      }),
      this.prisma.familyPractice.count({ where: { studentId } }),
    ]);

    return { weeklyCount, weeklyLimit, lastPracticedAt: lastPractice?.practicedAt || null, totalPractices };
  }

  async logLiturgy(studentId: string, date: string, notes: string | undefined, userId: string) {
    await this.verifyParent(userId, studentId);
    const liturgyDate = new Date(date);
    liturgyDate.setHours(0, 0, 0, 0);

    const existing = await this.prisma.familyLiturgy.findUnique({
      where: { studentId_date: { studentId, date: liturgyDate } },
    });
    if (existing) {
      throw new HttpException({ error: 'Liturgy already logged for this date' }, 409);
    }

    const record = await this.prisma.familyLiturgy.create({
      data: { studentId, date: liturgyDate, notedBy: userId, notes, status: 'pending' },
    });

    return { id: record.id, status: record.status, date: record.date };
  }

  async getLiturgyRecords(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);
    const records = await this.prisma.familyLiturgy.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 30,
    });
    return records.map(r => ({
      id: r.id,
      date: r.date,
      status: r.status,
      notes: r.notes,
      verifiedAt: r.verifiedAt,
      createdAt: r.createdAt,
    }));
  }

  async getMilestones(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);

    const [completedLessons, liturgies, badges] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { studentId, status: 'completed', completedAt: { not: null } },
        include: { lesson: { select: { id: true, title: true, titleAr: true } } },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.familyLiturgy.findMany({
        where: { studentId, status: 'verified' },
        orderBy: { date: 'desc' },
      }),
      this.prisma.studentBadge.findMany({
        where: { studentId },
        include: { badge: { select: { id: true, name: true, nameAr: true, iconUrl: true } } },
        orderBy: { awardedAt: 'desc' },
      }),
    ]);

    const milestones: any[] = [];

    completedLessons.forEach(lp => {
      milestones.push({
        type: 'lesson',
        label: { en: `Memorized: ${lp.lesson.title}`, ar: `حفظ: ${lp.lesson.titleAr || lp.lesson.title}` },
        date: lp.completedAt!,
        icon: 'book',
        milestonePhotoUrl: lp.milestonePhotoUrl,
        milestoneCaption: lp.milestoneCaption,
      });
    });

    liturgies.forEach(r => {
      milestones.push({
        type: 'liturgy',
        label: { en: `Attended Divine Liturgy`, ar: `حضر القداس الإلهي` },
        date: r.date,
        icon: 'church',
        photoUrl: r.photoUrl,
        servantNote: r.servantNote,
      });
    });

    badges.forEach(sb => {
      milestones.push({
        type: 'badge',
        label: { en: `Earned badge: ${sb.badge.name}`, ar: `حصل على شارة: ${sb.badge.nameAr || sb.badge.name}` },
        date: sb.awardedAt,
        icon: 'award',
      });
    });

    milestones.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { milestones, totalCount: milestones.length };
  }

  async getArchiveData(studentId: string, userId: string) {
    await this.verifyParent(userId, studentId);

    const [student, completedLessons, liturgies, badges] = await Promise.all([
      this.prisma.student.findUnique({
        where: { id: studentId },
        select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true, level: { select: { number: true, name: true } } },
      }),
      this.prisma.lessonProgress.findMany({
        where: { studentId, status: 'completed', completedAt: { not: null } },
        include: { lesson: { select: { id: true, title: true, titleAr: true } } },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.familyLiturgy.findMany({
        where: { studentId, status: 'verified' },
        orderBy: { date: 'desc' },
      }),
      this.prisma.studentBadge.findMany({
        where: { studentId },
        include: { badge: { select: { id: true, name: true, nameAr: true } } },
        orderBy: { awardedAt: 'desc' },
      }),
    ]);

    const milestones: any[] = [];
    completedLessons.forEach(lp => {
      milestones.push({
        type: 'lesson',
        title: lp.lesson.titleAr || lp.lesson.title,
        date: lp.completedAt!,
        milestonePhotoUrl: lp.milestonePhotoUrl,
        milestoneCaption: lp.milestoneCaption,
      });
    });
    liturgies.forEach(r => {
      milestones.push({
        type: 'liturgy',
        title: 'Divine Liturgy',
        date: r.date,
        photoUrl: r.photoUrl,
        servantNote: r.servantNote,
      });
    });
    badges.forEach(sb => {
      milestones.push({
        type: 'badge',
        title: sb.badge.nameAr || sb.badge.name,
        date: sb.awardedAt,
      });
    });
    milestones.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      student: {
        name: student?.firstNameAr && student?.lastNameAr
          ? `${student.firstNameAr} ${student.lastNameAr}`
          : `${student?.firstName} ${student?.lastName}`,
        nameEn: `${student?.firstName} ${student?.lastName}`,
        level: student?.level ? `${student.level.name} (Level ${student.level.number})` : '',
      },
      stats: {
        lessonsCount: completedLessons.length,
        liturgiesCount: liturgies.length,
        badgesCount: badges.length,
      },
      milestones,
    };
  }

  async getTermReport(studentId: string, term: number, academicYearId: string | undefined, userId: string) {
    await this.verifyParent(userId, studentId);

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { academicYearId: true, schoolId: true, levelId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const yearId = academicYearId || student.academicYearId;
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      select: { startDate: true, endDate: true, name: true },
    });
    if (!academicYear) throw new NotFoundException('Academic year not found');

    const yearStart = new Date(academicYear.startDate);
    const yearEnd = new Date(academicYear.endDate);
    const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);

    const termStart = new Date(yearStart.getTime() + (totalDays / 3) * (term - 1) * 86400000);
    const termEnd = term < 3
      ? new Date(yearStart.getTime() + (totalDays / 3) * term * 86400000)
      : yearEnd;

    const [completedLessons, liturgies, badges, practices, xpResult, attendanceRecords] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { studentId, status: 'completed', completedAt: { gte: termStart, lte: termEnd } },
        include: { lesson: { select: { id: true, title: true, titleAr: true } } },
        orderBy: { completedAt: 'asc' },
      }),
      this.prisma.familyLiturgy.findMany({
        where: { studentId, status: 'verified', date: { gte: termStart, lte: termEnd } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.studentBadge.findMany({
        where: { studentId, awardedAt: { gte: termStart, lte: termEnd } },
        include: { badge: { select: { id: true, name: true, nameAr: true } } },
        orderBy: { awardedAt: 'asc' },
      }),
      this.prisma.familyPractice.findMany({
        where: { studentId, practicedAt: { gte: termStart, lte: termEnd } },
      }),
      this.prisma.xPTransaction.aggregate({
        where: { studentId },
        _sum: { amount: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          studentId,
          attendanceSession: { scheduledDate: { gte: termStart, lte: termEnd } },
        },
        select: { status: true },
      }),
    ]);

    const totalXp = xpResult._sum.amount || 0;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const attendanceRate = attendanceRecords.length > 0
      ? Math.round((presentCount / attendanceRecords.length) * 100)
      : 0;

    return {
      studentId,
      academicYear: academicYear.name,
      term,
      period: { start: termStart, end: termEnd },
      hymns: completedLessons.map(lp => ({
        title: lp.lesson.title,
        titleAr: lp.lesson.titleAr,
        completedAt: lp.completedAt,
      })),
      liturgies: liturgies.map(r => ({ date: r.date })),
      badges: badges.map(sb => ({ name: sb.badge.name, nameAr: sb.badge.nameAr, awardedAt: sb.awardedAt })),
      practiceCount: practices.length,
      attendanceRate,
      totalXp,
      servantNote: null,
    };
  }

  private async verifyParent(userId: string, studentId: string) {
    const parent = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId: userId } },
    });
    if (link) return link;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, parentEmail: parent?.email, deletedAt: null },
    });
    if (student) return { student } as any;
    throw new ForbiddenException('You are not a parent of this student');
  }
}

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    const [attRecords, pointConfig, badgeCount] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { studentId: sp.student.id },
        select: { status: true, behavior: true, participation: true, attendedLiturgy: true },
      }),
      this.prisma.systemConfig.findUnique({
        where: { schoolId_key: { schoolId: sp.student.schoolId, key: 'point_rules' } },
        select: { value: true },
      }),
      this.prisma.studentBadge.count({ where: { studentId: sp.student.id } }),
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
    };
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

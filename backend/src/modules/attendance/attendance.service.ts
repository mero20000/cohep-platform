import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private schoolResolver: SchoolResolver,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => GamificationService))
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly analytics: AnalyticsService,
    private readonly assessments: AssessmentsService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * Resolve the group IDs a servant may see in the attendance module, based on
   * the assignment stored in user.metadata (group, optionally + level, + grade).
   * A grade is resolved through SchoolGrade (each grade maps to one or more groups).
   */
  private async resolveServantSessionGroupIds(meta: any, schoolId: string): Promise<string[]> {
    const groupId = meta?.groupId as string | undefined;
    const gradeId = meta?.gradeId as string | undefined;

    let groupIds: string[] = [];
    if (groupId) {
      groupIds = [groupId];
    } else if (gradeId) {
      const grades = await this.prisma.schoolGrade.findMany({
        where: { schoolId, id: gradeId },
        select: { groupId: true },
      });
      groupIds = grades.map((g: any) => g.groupId).filter(Boolean);
    }

    if (gradeId && groupIds.length > 0) {
      const grades = await this.prisma.schoolGrade.findMany({
        where: { schoolId, id: gradeId, groupId: { in: groupIds } },
        select: { groupId: true },
      });
      const gradeGroupIds = new Set(grades.map((g: any) => g.groupId));
      groupIds = groupIds.filter((g) => gradeGroupIds.has(g));
    }

    return groupIds;
  }

  async getSessions(schoolIdentifier: string, filters: {
    page?: number; limit?: number; status?: string; levelId?: string;
    groupId?: string; servantId?: string; from?: string; to?: string;
  }, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { page = 1, limit: rawLimit = 50, status, levelId, groupId, servantId, from, to } = filters;
    const limit = Math.min(rawLimit, 1000);

    const where: any = { schoolId, deletedAt: null };
    if (status) where.status = status;
    if (levelId) where.levelId = levelId;
    if (groupId) where.groupId = groupId;
    
    // If servantId is provided or user is a servant, filter by their sessions
    if (servantId) {
      where.servantId = servantId;
    } else if (user) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { metadata: true, userRoles: { select: { role: { select: { name: true } } } } },
      });
      const isServant = userRecord?.userRoles?.some((ur: any) =>
        ['servant', 'group_leader', 'level_leader'].includes(ur.role.name)
      );
      if (isServant) {
        // Scope to the servant's assigned group/level/grade (servant module assignment).
        const meta = (userRecord?.metadata as any) || {};
        const groupIds = await this.resolveServantSessionGroupIds(meta, schoolId);
        if (groupIds.length > 0) {
          where.groupId = { in: groupIds };
          if (meta.levelId) where.levelId = meta.levelId;
        } else {
          // No assignment set: fall back to sessions they personally created.
          where.servantId = user.id;
        }
      }
    }
    
    if (from || to) {
      where.scheduledDate = {};
      if (from) where.scheduledDate.gte = new Date(from);
      // H8: include the entire `to` day (set to 23:59:59.999)
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.scheduledDate.lte = end;
      }
    }

    const [sessions, total] = await Promise.all([
      this.prisma.attendanceSession.findMany({
        where,
        include: {
          level: { select: { id: true, name: true, number: true } },
          group: { select: { id: true, name: true } },
          servant: { select: { id: true, firstName: true, lastName: true } },
          attendanceRecords: {
            select: { status: true, student: { select: { deletedAt: true } } },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledDate: 'asc' },
      }),
      this.prisma.attendanceSession.count({ where }),
    ]);

    const data = sessions.map(session => {
      // M1: exclude records belonging to soft-deleted students from the summary
      const records = session.attendanceRecords.filter(r => r.student && !r.student.deletedAt);
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const late = records.filter(r => r.status === 'late').length;
      const excused = records.filter(r => r.status === 'excused').length;
      const { attendanceRecords, ...sessionData } = session;
      return { ...sessionData, summary: { present, absent, late, excused, total: records.length } };
    });

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getSessionById(id: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        servant: { select: { id: true, firstName: true, lastName: true } },
        attendanceRecords: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, studentCode: true, photoUrl: true, levelId: true, groupId: true, deletedAt: true },
            },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    // Filter out records belonging to soft-deleted students
    session.attendanceRecords = session.attendanceRecords.filter(r => r.student && !r.student.deletedAt);
    const subjectItem = await this.resolveSessionSubjectItem(session);
    let passedStudentIds: string[] = [];
    if (subjectItem) {
      const passes = await this.prisma.studentSubjectPass.findMany({
        where: { subjectItemId: subjectItem.id, student: { deletedAt: null } },
        select: { studentId: true },
      });
      passedStudentIds = passes.map(x => x.studentId);
    }
    return { ...session, subjectItem, passedStudentIds };
  }

  /**
   * Resolve the subject item being delivered by a session.
   * Prefers an explicitly linked subjectItemId, otherwise derives it from the
   * curriculum allocation for the session's level/week (lesson -> subjectItem).
   */
  private async resolveSessionSubjectItem(session: { id: string; levelId: string; groupId: string; scheduledDate: Date; subjectItemId?: string | null }): Promise<{ id: string; name: string; nameAr?: string | null; status: string } | null> {
    const load = (id: string) =>
      this.prisma.subjectItem.findUnique({
        where: { id },
        select: { id: true, name: true, nameAr: true, status: true },
      });

    if (session.subjectItemId) {
      const si = await load(session.subjectItemId);
      return si ?? null;
    }

    const group = await this.prisma.group.findUnique({
      where: { id: session.groupId },
      select: { id: true },
    });
    void group;
    const weekStart = new Date(session.scheduledDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const alloc = await this.prisma.curriculumAllocation.findFirst({
      where: {
        levelId: session.levelId,
        scheduledDate: { gte: weekStart, lt: weekEnd },
      },
      orderBy: { scheduledDate: 'asc' },
      include: { lesson: { select: { subjectItemId: true } } },
    });
    const subjectItemId = alloc?.lesson?.subjectItemId;
    if (!subjectItemId) return null;
    return (await load(subjectItemId)) ?? null;
  }

  /**
   * Mark the subject item delivered by a session as in_progress / completed.
   * On completion: create a minimal draft assessment for the group and report
   * the actual vs planned number of sessions used to deliver the subject item.
   */
  async markSubjectItemStatus(
    sessionId: string,
    status: 'in_progress' | 'completed' | 'allocated',
    subjectItemId?: string,
  ): Promise<{
    subjectItemId: string;
    status: string;
    assessment?: any;
    sessionsUsed: number | null;
    plannedSessions: number | null;
  }> {
    if (status !== 'in_progress' && status !== 'completed' && status !== 'allocated') {
      throw new BadRequestException('status must be in_progress, completed, or allocated');
    }
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Attendance session not found');

    // Optionally link a subject item (e.g. supplied from the "Start Class" launch).
    if (subjectItemId && subjectItemId !== session.subjectItemId) {
      const si = await this.prisma.subjectItem.findUnique({ where: { id: subjectItemId }, select: { id: true } });
      if (!si) throw new BadRequestException('Subject item not found');
      await this.prisma.attendanceSession.update({
        where: { id: sessionId },
        data: { subjectItemId },
      });
      session.subjectItemId = subjectItemId;
    }

    const resolved = await this.resolveSessionSubjectItem(session);
    const effectiveSubjectItemId = resolved?.id || session.subjectItemId;
    if (!effectiveSubjectItemId) {
      throw new BadRequestException('No subject item is linked to this session');
    }

    await this.prisma.subjectItem.update({
      where: { id: effectiveSubjectItemId },
      data: { status },
    });

    let assessment: any = undefined;
    let sessionsUsed: number | null = null;
    let plannedSessions: number | null = null;

    if (status === 'completed') {
      const si = await this.prisma.subjectItem.findUnique({
        where: { id: effectiveSubjectItemId },
        select: { name: true, subjectId: true },
      });
      const weekStart = new Date(session.scheduledDate);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const alloc = await this.prisma.curriculumAllocation.findFirst({
        where: {
          levelId: session.levelId,
          scheduledDate: { gte: weekStart, lt: weekEnd },
          lesson: { subjectItemId: effectiveSubjectItemId },
        },
        select: { groupNumber: true },
      });
      const gn = alloc?.groupNumber ?? 1;
      const planned = (si as any)[`sessionsGroup${gn}`] ?? 0;
      const used = await this.prisma.attendanceSession.count({
        where: { subjectItemId: effectiveSubjectItemId, status: 'completed' },
      });

      const existingDraft = await this.prisma.assessment.findFirst({
        where: {
          schoolId: session.schoolId,
          levelId: session.levelId,
          groupId: session.groupId,
          subjectId: si!.subjectId,
          title: `Assessment: ${si!.name}`,
          status: 'draft',
          deletedAt: null,
        },
        select: { id: true, title: true, status: true },
      });
      assessment = existingDraft ?? await this.assessments.create(
        {
          schoolId: session.schoolId,
          levelId: session.levelId,
          groupId: session.groupId,
          subjectId: si!.subjectId,
          title: `Assessment: ${si!.name}`,
          totalPoints: 0,
          passingPoints: 0,
          type: 'quiz',
          status: 'draft',
        },
        session.schoolId,
      );
      const qCount = await this.prisma.assessmentQuestion.count({ where: { assessmentId: (assessment as any).id } });
      (assessment as any).actionRequired = qCount === 0 ? 'add-questions-then-publish' : null;
      (assessment as any).publishUrl = `/dashboard/assessments/${(assessment as any).id}`;

      sessionsUsed = used + 1; // include the session just completed
      plannedSessions = planned;
    }

    return { subjectItemId: effectiveSubjectItemId, status, assessment, sessionsUsed, plannedSessions };
  }


  /**
   * Servant manually marks a student as having PASSED the session's subject
   * item. Reflected automatically to the parent portal journey (and any view
   * reading StudentSubjectPass). Sends a WhatsApp awareness message to the
   * parent when the Cloud API is configured and a parent phone is known.
   */
  async markSubjectPassed(sessionId: string, studentId: string, passedBy?: string) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');

    const subjectItem = await this.resolveSessionSubjectItem(session);
    if (!subjectItem) throw new BadRequestException('No subject item is linked to this session');

    if (!passedBy) throw new BadRequestException('passedBy (authenticated user) is required');
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      select: { id: true, firstName: true, firstNameAr: true, metadata: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const existingPass = await this.prisma.studentSubjectPass.findFirst({
      where: { studentId, subjectItemId: subjectItem.id, revokedAt: null },
    });
    if (existingPass) {
      await this.prisma.studentSubjectPass.update({
        where: { id: existingPass.id },
        data: { passedAt: new Date(), status: 'passed', revokedBy: null, passedBy: passedBy!, sessionId },
      });
    } else {
      await this.prisma.studentSubjectPass.create({
        data: { studentId, subjectItemId: subjectItem.id, status: 'passed', passedBy: passedBy!, sessionId },
      });
    }

    // Parent awareness via WhatsApp (Twilio/Meta when configured; otherwise a
    // wa.me deep link so the servant can send the pre-written message manually)
    const meta = (student.metadata as any) || {};
    const phone: string | undefined = meta.parentPhone || meta.parentWhatsApp || meta.phone;
    let whatsappSent = false;
    let whatsappLink: string | undefined;
    const name = student.firstNameAr || student.firstName;
    const message = `${name} \u0642\u062f \u0623\u062c\u0627\u0632 "${subjectItem.name}" \u0628\u0646\u062c\u0627\u062d \u2705\n${student.firstName} has passed "${subjectItem.name}" \u2705`;
    if (phone) {
      const res = await this.whatsapp.sendText(phone, message);
      whatsappSent = res.sent;
      if (!whatsappSent) {
        const digits = phone.replace(/[^\\d]/g, '').replace(/^\\+/, '');
        whatsappLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
      }
    }

    return { passed: true, studentId, subjectItemId: subjectItem.id, whatsappSent, whatsappLink };
  }

  async createSession(dto: CreateAttendanceSessionDto) {
    const schoolId = await this.schoolResolver.resolve(dto.schoolId || '');
    const scheduledDate = new Date(dto.scheduledDate);

    // H9: prevent duplicate sessions for the same group on the same date
    if (dto.groupId) {
      const existing = await this.prisma.attendanceSession.findFirst({
        where: { schoolId, groupId: dto.groupId, scheduledDate, deletedAt: null },
      });
      if (existing) throw new BadRequestException('A session already exists for this group on the selected date');
    }

    const session = await this.prisma.attendanceSession.create({
      data: {
        schoolId,
        sessionId: dto.sessionId,
        servantId: dto.servantId,
        levelId: dto.levelId,
        groupId: dto.groupId,
        scheduledDate,
        scheduledTime: dto.scheduledTime,
        status: dto.status || 'scheduled',
        notes: dto.notes,
        metadata: dto.metadata,
      },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
      },
    });
    if (dto.levelId && dto.groupId) {
      const students = await this.prisma.student.findMany({
        where: { levelId: dto.levelId, groupId: dto.groupId, deletedAt: null },
        select: { id: true },
      });
      if (students.length > 0) {
        await this.prisma.attendanceRecord.createMany({
          data: students.map(s => ({
            attendanceSessionId: session.id,
            studentId: s.id,
            status: 'unmarked',
            recordedBy: dto.servantId,
          })),
        });
      }
    }
    await this.audit.log({
      schoolId,
      action: 'CREATE',
      entityType: 'attendance_session',
      entityId: session.id,
      newValues: { levelId: dto.levelId, groupId: dto.groupId, scheduledDate: dto.scheduledDate, status: dto.status },
    });
    return session;
  }

  private async syncSessionStudents(sessionId: string, recordedBy: string) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    const activeStudents = await this.prisma.student.findMany({
      where: { groupId: session.groupId, levelId: session.levelId, deletedAt: null },
      select: { id: true },
    });
    const activeIds = new Set(activeStudents.map(s => s.id));

    // Remove records for students no longer in this group
    await this.prisma.attendanceRecord.deleteMany({
      where: { attendanceSessionId: sessionId, studentId: { notIn: Array.from(activeIds) } },
    });

    // Create records for new students who joined the group
    const existing = await this.prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map(r => r.studentId));
    const newRecords = activeStudents
      .filter(s => !existingIds.has(s.id))
      .map(s => ({
        attendanceSessionId: sessionId, studentId: s.id, status: 'unmarked',
        homeworkStatus: 'not_assigned', recordedBy, recordedAt: new Date(),
      }));
    if (newRecords.length > 0) {
      await this.prisma.attendanceRecord.createMany({ data: newRecords });
    }
  }

  async markAttendance(sessionId: string, dto: MarkAttendanceDto) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');

    // Sync attendance records with current active students in this group
    await this.syncSessionStudents(sessionId, dto.recordedBy || session.servantId);

    const recordedBy = dto.recordedBy || session.servantId;
    const upserts = dto.records.map(record =>
      this.prisma.attendanceRecord.upsert({
        where: { attendanceSessionId_studentId: { attendanceSessionId: sessionId, studentId: record.studentId } },
        create: {
          attendanceSessionId: sessionId, studentId: record.studentId, status: record.status,
          homeworkStatus: record.homeworkStatus || 'not_assigned',
          behavior: record.behavior, participation: record.participation, attendedLiturgy: record.attendedLiturgy,
          note: record.note,
          recordedBy, recordedAt: new Date(),
        },
        update: {
          status: record.status, homeworkStatus: record.homeworkStatus || 'not_assigned',
          behavior: record.behavior, participation: record.participation, attendedLiturgy: record.attendedLiturgy,
          note: record.note, recordedBy, recordedAt: new Date(),
        },
      }),
    );
    await this.prisma.$transaction(upserts);

    // MEASURE (C2): first attendance within 7 days of signup = activation.
    this.analytics.record({
      name: 'attendance.marked',
      category: 'activation',
      userId: recordedBy,
      schoolId: session.schoolId,
      properties: { count: dto.records.length, sessionId },
    });

    // Compute badges for all affected students (fire-and-forget)
    const affectedStudentIds = [...new Set(dto.records.map(r => r.studentId))];
    for (const sid of affectedStudentIds) {
      this.gamification.computeBadgesForStudent(sid).catch(() => {});
    }

    // Absence cascade: check for 3 consecutive absences
    for (const record of dto.records) {
      if (record.status === 'absent') {
        this.checkAbsenceCascade(record.studentId, session.schoolId, recordedBy).catch(() => {});
      }
    }

    return this.getSessionById(sessionId);
  }

  private async checkAbsenceCascade(studentId: string, schoolId: string, servantId: string) {
    const recent = await this.prisma.attendanceRecord.findMany({
      where: { studentId, status: { in: ['present', 'late', 'absent'] } },
      include: {
        attendanceSession: { select: { scheduledDate: true } },
        student: { select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true, parentEmail: true } },
      },
      orderBy: { attendanceSession: { scheduledDate: 'desc' } },
      take: 3,
    });

    if (recent.length < 3) return;
    const allAbsent = recent.every(r => r.status === 'absent');
    if (!allAbsent) return;

    const student = recent[0].student;
    const studentName = `${student.firstName} ${student.lastName}`;
    const studentNameAr = student.firstNameAr && student.lastNameAr ? `${student.firstNameAr} ${student.lastNameAr}` : studentName;

    const group = await this.prisma.attendanceSession.findFirst({
      where: { attendanceRecords: { some: { studentId } } },
      include: { group: { select: { name: true } } },
      orderBy: { scheduledDate: 'desc' },
    });
    const groupName = group?.group?.name || 'class';

    // Notify parent in-app
    const parentLink = await this.prisma.studentParent.findFirst({ where: { studentId } });
    if (parentLink) {
      await this.notifications.createNotification({
        schoolId,
        userId: parentLink.parentId,
        type: 'attendance',
        title: 'Missing in class',
        titleAr: 'غائب عن الفصل',
        body: `${studentName} hasn't attended ${groupName} for 3 consecutive sessions. We miss them!`,
        bodyAr: `${studentNameAr} لم يحضر ${groupName} لمدة 3 جلسات متتالية. نحن نفتقدهم!`,
      });
    }

    // Email parent
    if (student.parentEmail) {
      try {
        await this.mail.sendAttendanceAlert(student.parentEmail, studentName, studentNameAr, groupName);
      } catch {
        // email is best-effort
      }
    }

    // Notify servant
    await this.notifications.createNotification({
      schoolId,
      userId: servantId,
      type: 'attendance',
      title: 'Absence alert',
      titleAr: 'تنبيه غياب',
      body: `${studentName} hasn't attended for 3 consecutive sessions. You may want to check in.`,
      bodyAr: `${studentNameAr} لم يحضر لمدة 3 جلسات متتالية. قد ترغب في التواصل.`,
    });
  }

  async qrCheckIn(servantId: string, studentId: string) {
    const servant = await this.prisma.user.findUnique({ where: { id: servantId }, select: { schoolId: true } });
    if (!servant) throw new NotFoundException('Servant not found');

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let session = await this.prisma.attendanceSession.findFirst({
      where: {
        servantId,
        scheduledDate: { gte: today, lt: tomorrow },
        deletedAt: null,
      },
    });

    if (!session) {
      session = await this.prisma.attendanceSession.findFirst({
        where: { servantId, deletedAt: null },
        orderBy: { scheduledDate: 'desc' },
      });
      if (!session) throw new BadRequestException('No session found. Start a class first.');
    }

    const record = await this.prisma.attendanceRecord.upsert({
      where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId } },
      create: {
        attendanceSessionId: session.id,
        studentId,
        status: 'present',
        recordedBy: servantId,
        recordedAt: new Date(),
      },
      update: {
        status: 'present',
        recordedBy: servantId,
        recordedAt: new Date(),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
        attendanceSession: { select: { id: true, group: { select: { name: true } } } },
      },
    });

    this.gamification.computeBadgesForStudent(studentId).catch(() => {});

    // Notify parents of arrival
    const parentLinks = await this.prisma.studentParent.findMany({
      where: { studentId },
      include: { student: { select: { firstName: true, lastName: true } } },
    });
    const groupName = record.attendanceSession?.group?.name || 'class';
    for (const link of parentLinks) {
      this.notifications.createNotification({
        schoolId: servant.schoolId,
        userId: link.parentId,
        type: 'attendance',
        title: `${(record.student as any).firstName} has arrived!`,
        titleAr: `وصل ${(record.student as any).firstNameAr || (record.student as any).firstName}!`,
        body: `${(record.student as any).firstName} ${(record.student as any).lastName} checked in for ${groupName}.`,
        bodyAr: `سجل ${(record.student as any).firstNameAr || (record.student as any).firstName} حضوره في ${groupName}.`,
      }).catch(() => {});
    }

    return { record, message: `${record.student.firstName} ${record.student.lastName} checked in!` };
  }

  async startClass(servantId: string) {
    const servant = await this.prisma.user.findUnique({ where: { id: servantId }, select: { schoolId: true, metadata: true } });
    if (!servant) throw new NotFoundException('Servant not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find existing session for today
    const existing = await this.prisma.attendanceSession.findFirst({
      where: {
        servantId,
        scheduledDate: { gte: today, lt: tomorrow },
        deletedAt: null,
      },
      include: {
        group: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        attendanceRecords: { include: { student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } } } },
      },
    });
    if (existing) return { session: existing, created: false };

    // Check user metadata for assigned group/level
    const meta = (servant.metadata as any) || {};
    const metaGroupId = meta.groupId as string | undefined;
    const metaLevelId = meta.levelId as string | undefined;

    // Find servant's group(s) from their recent sessions or metadata
    const recentSessions = await this.prisma.attendanceSession.findMany({
      where: { servantId, deletedAt: null },
      include: { group: { select: { id: true, name: true } }, level: { select: { id: true, name: true, number: true } } },
      orderBy: { scheduledDate: 'desc' },
      take: 1,
    });

    let groupId: string | undefined = metaGroupId;
    let levelId: string | undefined = metaLevelId;

    // If no metadata assignment, try to get from recent sessions
    if (!groupId && recentSessions.length > 0) {
      groupId = recentSessions[0].groupId;
      levelId = levelId || recentSessions[0].levelId;
    }

    if (!groupId) {
      // No assignment found — return all school groups for the client to pick
      const groups = await this.prisma.group.findMany({
        where: { schoolId: servant.schoolId, deletedAt: null, status: { not: 'inactive' } },
      });
      if (groups.length === 0) {
        throw new BadRequestException('No groups found in this school.');
      }
      return { groups: groups.map(g => ({ id: g.id, name: g.name })), requiresGroupPick: true };
    }

    if (!levelId) {
      // Try to find level from a recent session for this group
      const groupSession = await this.prisma.attendanceSession.findFirst({
        where: { servantId, groupId, deletedAt: null },
        select: { levelId: true },
      });
      if (groupSession) {
        levelId = groupSession.levelId;
      } else {
        // Get the first level for this school
        const firstLevel = await this.prisma.level.findFirst({
          where: { schoolId: servant.schoolId, deletedAt: null },
          select: { id: true },
        });
        levelId = firstLevel?.id;
      }
    }

    if (!levelId) {
      throw new BadRequestException('No level found. Ask your admin to set up levels.');
    }

    const session = await this.prisma.attendanceSession.create({
      data: {
        schoolId: servant.schoolId,
        servantId,
        levelId,
        groupId,
        scheduledDate: new Date(),
        scheduledTime: new Date().toTimeString().slice(0, 5),
        status: 'in_progress',
        actualStartTime: new Date(),
      },
    });

    // Pre-mark all students as present
    const students = await this.prisma.student.findMany({
      where: { groupId, levelId, schoolId: servant.schoolId, deletedAt: null, status: 'active' },
      select: { id: true },
    });
    if (students.length > 0) {
      await this.prisma.attendanceRecord.createMany({
        data: students.map(s => ({
          attendanceSessionId: session.id,
          studentId: s.id,
          status: 'present',
          recordedBy: servantId,
          recordedAt: new Date(),
        })),
      });
    }

    const full = await this.getSessionById(session.id);
    return { session: full, created: true };
  }

  async liturgyHeatmap(schoolIdentifier: string, groupId?: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        schoolId,
        ...(groupId ? { groupId } : {}),
        status: 'completed',
        deletedAt: null,
      },
      include: {
        attendanceRecords: {
          include: { student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } } },
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: { scheduledDate: 'desc' },
      take: 52,
    });

    // Group by ISO week
    const weekMap = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const week = getISOWeeks(s.scheduledDate);
      if (!weekMap.has(week)) weekMap.set(week, []);
      weekMap.get(week)!.push(s);
    }
    const weeks = [...weekMap.keys()].sort().slice(-12);

    // Collect unique students across all weeks
    const studentMap = new Map<string, { name: string; nameAr: string; liturgyCount: number; classCount: number; weeks: Record<string, { classStatus: string; liturgy: boolean }> }>();
    for (const week of weeks) {
      const weekSessions = weekMap.get(week) || [];
      for (const s of weekSessions) {
        for (const r of s.attendanceRecords) {
          const st = r.student;
          if (!studentMap.has(st.id)) {
            studentMap.set(st.id, { name: `${st.firstName} ${st.lastName}`, nameAr: st.firstNameAr && st.lastNameAr ? `${st.firstNameAr} ${st.lastNameAr}` : '', liturgyCount: 0, classCount: 0, weeks: {} });
          }
          const entry = studentMap.get(st.id)!;
          entry.classCount++;
          if (r.attendedLiturgy) entry.liturgyCount++;
          if (!entry.weeks[week] || entry.weeks[week].classStatus === 'absent') {
            entry.weeks[week] = { classStatus: r.status, liturgy: r.attendedLiturgy || false };
          }
        }
      }
    }

    return {
      totalStudents: studentMap.size,
      weeks,
      students: [...studentMap.values()].sort((a, b) => b.classCount - a.classCount),
    };
  }

  async getSessionStats(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const activeLevels = await this.prisma.level.findMany({
      where: { schoolId, status: { not: 'inactive' } },
      select: { id: true },
    });
    const activeLevelIds = activeLevels.map(l => l.id);
    if (activeLevelIds.length === 0) {
      return { totalSessions: 0, completedSessions: 0, scheduledSessions: 0, inProgressSessions: 0, totalRecords: 0, presentCount: 0, lateCount: 0, absentCount: 0, excusedCount: 0, averageAttendanceRate: 0 };
    }
    const levelFilter = { levelId: { in: activeLevelIds } };

    const totalSessions = await this.prisma.attendanceSession.count({ where: { schoolId, deletedAt: null, ...levelFilter } });
    const completedSessions = await this.prisma.attendanceSession.count({ where: { schoolId, deletedAt: null, status: 'completed', ...levelFilter } });
    const scheduledSessions = await this.prisma.attendanceSession.count({ where: { schoolId, deletedAt: null, status: 'scheduled', ...levelFilter } });
    const inProgressSessions = await this.prisma.attendanceSession.count({ where: { schoolId, deletedAt: null, status: 'in_progress', ...levelFilter } });

    const allCompleted = await this.prisma.attendanceSession.findMany({
      where: { schoolId, deletedAt: null, status: 'completed', ...levelFilter },
      select: { attendanceRecords: { select: { status: true } } },
    });

    let totalRecords = 0, presentCount = 0, lateCount = 0, absentCount = 0, excusedCount = 0;
    for (const session of allCompleted) {
      for (const record of session.attendanceRecords) {
        totalRecords++;
        if (record.status === 'present') presentCount++;
        else if (record.status === 'late') lateCount++;
        else if (record.status === 'absent') absentCount++;
        else if (record.status === 'excused') excusedCount++;
      }
    }

    const avgRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 10000) / 100 : 0;

    return {
      totalSessions, completedSessions, scheduledSessions, inProgressSessions,
      totalRecords, presentCount, lateCount, absentCount, excusedCount,
      averageAttendanceRate: avgRate,
    };
  }

  async getLevelStats(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const levels = await this.prisma.level.findMany({ where: { schoolId, status: { not: 'inactive' } }, orderBy: { number: 'asc' } });

    const stats: any[] = [];
    for (const level of levels) {
      const sessions = await this.prisma.attendanceSession.findMany({
        where: { schoolId, levelId: level.id, status: 'completed', deletedAt: null },
        select: { attendanceRecords: { select: { status: true } } },
      });
      let total = 0, present = 0;
      for (const s of sessions) {
        for (const r of s.attendanceRecords) {
          total++;
          if (r.status === 'present' || r.status === 'late') present++;
        }
      }
      stats.push({
        levelId: level.id, levelNumber: level.number, levelName: level.name,
        totalSessions: sessions.length, totalRecords: total,
        attendanceRate: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
      });
    }
    return stats;
  }

  async getGroupStats(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const groups = await this.prisma.group.findMany({
      where: { schoolId, status: { not: 'inactive' }, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    const stats: any[] = [];
    for (const group of groups) {
      const sessions = await this.prisma.attendanceSession.findMany({
        where: { schoolId, groupId: group.id, status: 'completed', deletedAt: null },
        select: { attendanceRecords: { select: { status: true } } },
      });
      let total = 0, present = 0;
      for (const s of sessions) {
        for (const r of s.attendanceRecords) {
          total++;
          if (r.status === 'present' || r.status === 'late') present++;
        }
      }
      stats.push({
        groupId: group.id, groupName: group.name,
        totalSessions: sessions.length, totalRecords: total,
        attendanceRate: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
      });
    }
    return stats;
  }

  async searchStudentAttendance(q: string, schoolId: string) {
    const students = await this.prisma.student.findMany({
      where: {
        schoolId,
        deletedAt: null,
        OR: [
          { studentCode: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { firstNameAr: { contains: q, mode: 'insensitive' } },
          { lastNameAr: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, studentCode: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
      take: 20,
    });
    if (!students.length) return [];
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: { in: students.map(s => s.id) } },
      include: {
        attendanceSession: {
          include: {
            level: { select: { name: true, number: true } },
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
    });
    return students.map(s => ({
      student: s,
      records: records.filter(r => r.studentId === s.id),
    }));
  }

  async generateSessions(
    schoolIdentifier: string,
    options?: { groupId?: string; levelId?: string; gradeId?: string },
  ) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);

    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true, deletedAt: null },
    });
    if (!year) throw new NotFoundException('No current academic year found');

    const activeDays: number[] = (year.activeDays as number[]) || [6, 0];
    if (!activeDays.length) throw new BadRequestException('No active days configured for this academic year');

    const weeks = await this.prisma.academicWeek.findMany({
      where: { academicYearId: year.id, isAvailable: true },
      orderBy: { weekNumber: 'asc' },
    });

    const groupWhere: any = { schoolId, deletedAt: null, status: { not: 'inactive' } };
    if (options?.groupId) {
      groupWhere.id = options.groupId;
    }

    const groups = await this.prisma.group.findMany({
      where: groupWhere,
      orderBy: { orderIndex: 'asc' },
    });

    // No lesson allocation needed — attendance is per-day

    const adminUser = await this.prisma.user.findFirst({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const defaultServantId = adminUser?.id || '00000000-0000-0000-0000-000000000000';

    let created = 0;
    let skipped = 0;

    for (const week of weeks) {
      const start = new Date(week.startDate);
      const end = new Date(week.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (!activeDays.includes(dayOfWeek)) continue;

        const dateStr = d.toISOString().split('T')[0];

        for (const group of groups) {
          const levelWhere: any = { groupId: group.id, schoolId, deletedAt: null, status: 'active' };
          if (options?.levelId) {
            levelWhere.levelId = options.levelId;
          }
          if (options?.gradeId) {
            levelWhere.gradeId = options.gradeId;
          }

          const groupLevels = await this.prisma.student.findMany({
            where: levelWhere,
            select: { levelId: true },
            distinct: ['levelId'],
          });
          if (groupLevels.length === 0) continue;

          for (const { levelId } of groupLevels) {
            const existing = await this.prisma.attendanceSession.findFirst({
              where: {
                schoolId,
                levelId,
                groupId: group.id,
                scheduledDate: new Date(dateStr),
                deletedAt: null,
              },
            });
            if (existing) {
              skipped++;
              continue;
            }

            const studentWhere: any = { groupId: group.id, levelId, schoolId, deletedAt: null, status: 'active' };
            if (options?.gradeId) {
              studentWhere.gradeId = options.gradeId;
            }

            const students = await this.prisma.student.findMany({
              where: studentWhere,
              select: { id: true },
            });

            const session = await this.prisma.attendanceSession.create({
              data: {
                schoolId,
                servantId: defaultServantId,
                levelId,
                groupId: group.id,
                scheduledDate: new Date(dateStr),
                scheduledTime: '12:00',
                status: 'scheduled',
              },
            });

            if (students.length > 0) {
              await this.prisma.attendanceRecord.createMany({
                data: students.map(s => ({
                  attendanceSessionId: session.id,
                  studentId: s.id,
                  status: 'unmarked',
                  homeworkStatus: 'not_assigned',
                  recordedBy: defaultServantId,
                  recordedAt: new Date(),
                })),
              });
            }

            created++;
          }
        }
      }
    }

    return { created, skipped, total: created + skipped };
  }

  async updateSession(id: string, dto: Partial<CreateAttendanceSessionDto>) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Attendance session not found');

    const statusChanged = !!dto.status && dto.status !== session.status;
    const groupChanged = !!dto.groupId && dto.groupId !== session.groupId;

    const updated = await this.prisma.attendanceSession.update({
      where: { id },
      data: {
        ...(dto.servantId && { servantId: dto.servantId }),
        ...(dto.levelId && { levelId: dto.levelId }),
        ...(dto.groupId && { groupId: dto.groupId }),
        ...(dto.scheduledDate && { scheduledDate: new Date(dto.scheduledDate) }),
        ...(dto.scheduledTime && { scheduledTime: dto.scheduledTime }),
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(statusChanged && dto.status === 'in_progress' && !session.actualStartTime && { actualStartTime: new Date() }),
        ...(statusChanged && dto.status === 'completed' && { actualEndTime: new Date() }),
      },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        servant: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Sync students when status or group changes
    if (statusChanged || groupChanged) {
      await this.syncSessionStudents(id, dto.servantId || session.servantId);
    }

    await this.audit.log({
      schoolId: session.schoolId,
      action: 'UPDATE',
      entityType: 'attendance_session',
      entityId: id,
      oldValues: { status: session.status, servantId: session.servantId },
      newValues: { status: updated.status, servantId: updated.servantId },
    });

    // When session is completed, notify parents of present students with practice guide
    if (dto.status === 'completed') {
      this.sendPracticeGuideNotifications(id).catch(() => {});
    }

    return updated;
  }

  private async sendPracticeGuideNotifications(sessionId: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId, status: 'present' },
    });
    if (records.length === 0) return;

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { schoolId: true },
    });
    if (!session) return;

    for (const record of records) {
      const student = await this.prisma.student.findUnique({
        where: { id: record.studentId },
        select: { id: true, firstName: true, levelId: true, schoolId: true },
      });
      if (!student?.levelId) continue;

      const parentLinks = await this.prisma.studentParent.findMany({
        where: { studentId: student.id },
        select: { parentId: true },
      });
      if (parentLinks.length === 0) continue;

      const now = new Date();
      const academicYear = await this.prisma.academicYear.findFirst({
        where: { schoolId: session.schoolId, isCurrent: true },
        select: { id: true, startDate: true, endDate: true },
      });
      if (!academicYear) continue;

      const totalDays = (academicYear.endDate.getTime() - academicYear.startDate.getTime()) / (1000 * 60 * 60 * 24);
      const elapsed = (now.getTime() - academicYear.startDate.getTime()) / (1000 * 60 * 60 * 24);
      const term = totalDays > 0 ? Math.min(Math.ceil((elapsed / totalDays) * 3), 3) : 1;

      const allocation = await this.prisma.curriculumAllocation.findFirst({
        where: {
          academicYearId: academicYear.id,
          levelId: student.levelId,
          term,
          scheduledDate: { lte: now },
          status: 'active',
        },
        orderBy: { scheduledDate: 'desc' },
        include: { lesson: { select: { id: true, title: true, titleAr: true, audioUrl: true } } },
      });
      if (!allocation?.lesson || !allocation?.lesson.audioUrl) continue;
      const lesson = allocation.lesson;

      for (const link of parentLinks) {
        await this.notifications.createNotification({
          schoolId: student.schoolId,
          userId: link.parentId,
          type: 'practice_guide',
          title: `${student.firstName} practice guide for this week`,
          body: `${student.firstName} learned ${lesson.titleAr || lesson.title} today`,
        });
      }
    }
  }

  async deleteSession(id: string) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Attendance session not found');
    await this.prisma.attendanceSession.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      schoolId: session.schoolId,
      action: 'DELETE',
      entityType: 'attendance_session',
      entityId: id,
      oldValues: { status: session.status, levelId: session.levelId, groupId: session.groupId },
    });
    return { deleted: true };
  }

  async batchDeleteSessions(sessionIds: string[]) {
    if (!sessionIds || sessionIds.length === 0) {
      throw new BadRequestException('No session IDs provided');
    }

    // Fetch all sessions to check status and audit
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { id: { in: sessionIds }, deletedAt: null },
      select: { id: true, status: true, schoolId: true, levelId: true, groupId: true },
    });

    if (sessions.length !== sessionIds.length) {
      throw new BadRequestException(`Some sessions not found or already deleted. Found ${sessions.length}/${sessionIds.length}`);
    }

    // Only allow deletion of 'scheduled' status sessions
    const nonScheduled = sessions.filter(s => s.status !== 'scheduled');
    if (nonScheduled.length > 0) {
      throw new BadRequestException(`Cannot delete sessions with status other than 'scheduled'. Found ${nonScheduled.length} non-scheduled sessions`);
    }

    // Delete all sessions (soft delete)
    const now = new Date();
    await this.prisma.attendanceSession.updateMany({
      where: { id: { in: sessionIds } },
      data: { deletedAt: now },
    });

    // Audit each deletion
    const schoolIdSet = new Set(sessions.map(s => s.schoolId));
    for (const schoolId of schoolIdSet) {
      const schoolSessions = sessions.filter(s => s.schoolId === schoolId);
      for (const session of schoolSessions) {
        await this.audit.log({
          schoolId,
          action: 'DELETE',
          entityType: 'attendance_session',
          entityId: session.id,
          oldValues: { status: session.status, levelId: session.levelId, groupId: session.groupId },
        });
      }
    }

    return { deletedCount: sessions.length };
  }

  async createRecurringSessions(servantId: string, schoolIdentifier: string, body: { groupId: string; levelId: string; dayOfWeek: number; time: string; weeks?: number }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { groupId, levelId, dayOfWeek, time, weeks = 4 } = body;

    const sessions: any[] = [];
    const now = new Date();

    for (let i = 0; i < weeks; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + (i * 7) + ((dayOfWeek - targetDate.getDay() + 7) % 7));
      
      const existing = await this.prisma.attendanceSession.findFirst({
        where: { schoolId, groupId, scheduledDate: targetDate, deletedAt: null },
      });

      if (!existing) {
        const session = await this.prisma.attendanceSession.create({
          data: {
            schoolId,
            servantId,
            levelId,
            groupId,
            scheduledDate: targetDate,
            scheduledTime: time,
            status: 'scheduled',
          },
        });

        const students = await this.prisma.student.findMany({
          where: { levelId, groupId, deletedAt: null },
          select: { id: true },
        });

        if (students.length > 0) {
          await this.prisma.attendanceRecord.createMany({
            data: students.map(s => ({
              attendanceSessionId: session.id,
              studentId: s.id,
              status: 'unmarked',
              recordedBy: servantId,
            })),
          });
        }

        sessions.push(session);
      }
    }

    return { created: sessions.length, sessions };
  }

  async batchUpdateRecords(sessionId: string, updates: Array<{ studentId: string; status: string }>) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');

    const results: any[] = [];
    for (const update of updates) {
      const record = await this.prisma.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: sessionId,
            studentId: update.studentId,
          },
        },
        update: { status: update.status },
        create: {
          attendanceSessionId: sessionId,
          studentId: update.studentId,
          status: update.status,
          recordedBy: session.servantId || '',
        },
      });
      results.push(record);
    }

    return { updated: results.length };
  }

  async updateSessionNotes(sessionId: string, notes: string) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');

    await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { notes },
    });

    return { updated: true };
  }
}

function getISOWeeks(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week = Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 4).getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

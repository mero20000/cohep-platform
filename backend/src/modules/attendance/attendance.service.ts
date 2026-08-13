import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { AnalyticsService } from '../analytics/analytics.service';
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
  ) {}

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
        select: { userRoles: { select: { role: { select: { name: true } } } } },
      });
      const isServant = userRecord?.userRoles?.some((ur: any) =>
        ['servant', 'group_leader', 'level_leader'].includes(ur.role.name)
      );
      if (isServant) {
        where.servantId = user.id;
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
              select: { id: true, firstName: true, lastName: true, studentCode: true, levelId: true, groupId: true, deletedAt: true },
            },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    // Filter out records belonging to soft-deleted students
    session.attendanceRecords = session.attendanceRecords.filter(r => r.student && !r.student.deletedAt);
    return session;
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
        channels: ['in_app'],
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
      channels: ['in_app'],
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
        channels: ['in_app', 'push'],
        data: { url: '/portal' },
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

  async generateSessions(schoolIdentifier: string) {
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

    const groups = await this.prisma.group.findMany({
      where: { schoolId, deletedAt: null, status: { not: 'inactive' } },
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
          const groupLevels = await this.prisma.student.findMany({
            where: { groupId: group.id, schoolId, deletedAt: null, status: 'active' },
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

            const students = await this.prisma.student.findMany({
              where: { groupId: group.id, levelId, schoolId, deletedAt: null, status: 'active' },
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
          data: {
            url: `/portal/children/${student.id}/practice-guide`,
            lessonId: lesson.id,
            audioUrl: lesson.audioUrl,
            hymnName: lesson.titleAr || lesson.title,
          },
          channels: ['in_app'],
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

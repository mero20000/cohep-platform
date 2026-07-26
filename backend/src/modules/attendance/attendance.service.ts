import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { GamificationService } from '../gamification/gamification.service';
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
  ) {}

  async getSessions(schoolIdentifier: string, filters: {
    page?: number; limit?: number; status?: string; levelId?: string;
    groupId?: string; from?: string; to?: string;
  }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { page = 1, limit: rawLimit = 50, status, levelId, groupId, from, to } = filters;
    const limit = Math.min(rawLimit, 100);

    const where: any = { schoolId, deletedAt: null };
    if (status) where.status = status;
    if (levelId) where.levelId = levelId;
    if (groupId) where.groupId = groupId;
    if (from || to) {
      where.scheduledDate = {};
      if (from) where.scheduledDate.gte = new Date(from);
      if (to) where.scheduledDate.lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      this.prisma.attendanceSession.findMany({
        where,
        include: {
          level: { select: { id: true, name: true, number: true } },
          group: { select: { id: true, name: true } },
          servant: { select: { id: true, firstName: true, lastName: true } },
          attendanceRecords: { select: { status: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledDate: 'desc' },
      }),
      this.prisma.attendanceSession.count({ where }),
    ]);

    const data = sessions.map(session => {
      const records = session.attendanceRecords;
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
    const session = await this.prisma.attendanceSession.create({
      data: {
        schoolId,
        sessionId: dto.sessionId,
        servantId: dto.servantId,
        levelId: dto.levelId,
        groupId: dto.groupId,
        scheduledDate: new Date(dto.scheduledDate),
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

    // Compute badges for all affected students (fire-and-forget)
    const affectedStudentIds = [...new Set(dto.records.map(r => r.studentId))];
    for (const sid of affectedStudentIds) {
      this.gamification.computeBadgesForStudent(sid).catch(() => {});
    }

    return this.getSessionById(sessionId);
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
      where: { level: { schoolId, status: { not: 'inactive' } }, status: { not: 'inactive' } },
      include: { level: { select: { number: true, name: true } } },
      orderBy: [{ level: { number: 'asc' } }, { name: 'asc' }],
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
        levelNumber: group.level.number, levelName: group.level.name,
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
    if (!activeDays.length) throw new Error('No active days configured for this academic year');

    const weeks = await this.prisma.academicWeek.findMany({
      where: { academicYearId: year.id, isAvailable: true },
      orderBy: { weekNumber: 'asc' },
    });

    const levels = await this.prisma.level.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        groups: { where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { number: 'asc' },
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

        for (const level of levels) {
          if (!level.groups.length) continue;

          for (const group of level.groups) {
            const existing = await this.prisma.attendanceSession.findFirst({
              where: {
                schoolId,
                levelId: level.id,
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
              where: { groupId: group.id, deletedAt: null },
              select: { id: true },
            });

            const session = await this.prisma.attendanceSession.create({
              data: {
                schoolId,
                servantId: defaultServantId,
                levelId: level.id,
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
      },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        servant: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Sync students when status changes
    if (dto.status && dto.status !== session.status) {
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

    return updated;
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
}

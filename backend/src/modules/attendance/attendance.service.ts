import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
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
import { MarkAttendanceDto, FinalizeAttendanceDto } from './dto/mark-attendance.dto';
import { CLASS_SESSION_FILTER, preciseRateFromCounts } from './attendance-metrics';
import { classTargetFor, isSessionType, normalizeGender, rosterFragments, SessionType, TargetInput } from './attendance-targets';
import { Actor, canCreateMultiGroup, canCreateType, isAdminActor, isGroupStaffActor, isLevelLeaderActor } from './attendance-permissions';

interface StatusTally { present: number; late: number; absent: number; excused: number; unmarked: number }
const emptyTally = (): StatusTally => ({ present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 });
function addTally(into: StatusTally, from?: StatusTally) {
  if (!from) return;
  into.present += from.present; into.late += from.late; into.absent += from.absent;
  into.excused += from.excused; into.unmarked += from.unmarked;
}

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
    groupId?: string; servantId?: string; from?: string; to?: string; notes?: string; excludeNotes?: string; type?: string;
  }, user?: any) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { page = 1, limit: rawLimit = 50, status, levelId, groupId, servantId, from, to, notes, excludeNotes, type } = filters;
    const limit = Math.min(rawLimit, 1000);

    const where: any = { schoolId, deletedAt: null };
    if (status) where.status = status;
    if (levelId) where.levelId = levelId;
    if (groupId) where.groupId = groupId;
    const and: any[] = [];
    if (type) {
      if (!isSessionType(type)) throw new BadRequestException('type must be class, liturgy or event');
      where.type = type;
    }
    if (notes) where.notes = notes;
    else if (excludeNotes) {
      and.push({ OR: [{ notes: null }, { notes: { not: excludeNotes } }] });
    }
    
    // If servantId is provided or user is a servant, filter by their sessions
    if (servantId) {
      where.servantId = servantId;
    } else if (user) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { metadata: true, userRoles: { select: { role: { select: { name: true } } } } },
      });
      const roleNames = (userRecord?.userRoles || []).map((ur: any) => ur.role?.name).filter(Boolean);
      const isAdmin = roleNames.some((r: string) => ['super_admin', 'admin', 'principal'].includes(r));
      const isServant = !isAdmin && roleNames.some((r: string) =>
        ['servant', 'group_leader', 'level_leader'].includes(r)
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
    
    // A group filter/scope matches a session's own group or any of its audience rows,
    // so multi-group liturgy/event sessions show up under every group they cover.
    if (where.groupId !== undefined) {
      const groupScope = where.groupId;
      delete where.groupId;
      and.push({ OR: [{ groupId: groupScope }, { targets: { some: { groupId: groupScope } } }, { allGroups: true }] });
    }
    if (and.length > 0) where.AND = and;

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
          grade: { select: { id: true, name: true } },
          servant: { select: { id: true, firstName: true, lastName: true } },
          targets: { select: { groupId: true, levelId: true, gradeId: true, gender: true, group: { select: { name: true } } } },
          attendanceRecords: {
            select: { status: true, student: { select: { deletedAt: true } } },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledDate: 'desc' },
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
        grade: { select: { id: true, name: true } },
        servant: { select: { id: true, firstName: true, lastName: true } },
        targets: { select: { groupId: true, levelId: true, gradeId: true, gender: true, group: { select: { name: true } } } },
        attendanceRecords: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, studentCode: true, photoUrl: true, levelId: true, groupId: true, gradeId: true, deletedAt: true, grade: { select: { id: true, name: true, nameAr: true } }, group: { select: { id: true, name: true } } },
            },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    // Filter out records belonging to soft-deleted students
    session.attendanceRecords = session.attendanceRecords.filter(r => r.student && !r.student.deletedAt);
    // Curriculum subject items belong to classes; liturgy/event sessions have none.
    const subjectItem = (session.type ?? 'class') === 'class' ? await this.resolveSessionSubjectItem(session) : null;
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
  private async resolveSessionSubjectItem(session: { id: string; levelId: string | null; groupId: string | null; scheduledDate: Date; subjectItemId?: string | null }): Promise<{ id: string; name: string; nameAr?: string | null; status: string; isAssessmentItem?: boolean | null; passRequired?: boolean | null } | null> {
    const load = (id: string) =>
      this.prisma.subjectItem.findUnique({
        where: { id },
        select: { id: true, name: true, nameAr: true, status: true, isAssessmentItem: true, passRequired: true },
      });

    if (session.subjectItemId) {
      const si = await load(session.subjectItemId);
      return si ?? null;
    }

    const weekStart = new Date(session.scheduledDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (!session.levelId) return null;

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
        select: { name: true, subjectId: true, isAssessmentItem: true },
      });
      const weekStart = new Date(session.scheduledDate);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      let gn = 1;
      if (session.levelId) {
        const alloc = await this.prisma.curriculumAllocation.findFirst({
          where: {
            levelId: session.levelId,
            scheduledDate: { gte: weekStart, lt: weekEnd },
            lesson: { subjectItemId: effectiveSubjectItemId },
          },
          select: { groupNumber: true },
        });
        gn = alloc?.groupNumber ?? 1;
      }
      const planned = (si as any)[`sessionsGroup${gn}`] ?? 0;
      const used = await this.prisma.attendanceSession.count({
        where: { subjectItemId: effectiveSubjectItemId, status: 'completed', deletedAt: null },
      });

      // Only assessment items draft a formal assessment on completion.
      // Plain items complete with just the status flip + sessions report.
      if ((si as any)?.isAssessmentItem !== false && session.levelId) {
        const existingDraft = await this.prisma.assessment.findFirst({
          where: {
            schoolId: session.schoolId,
            levelId: session.levelId!,
            groupId: session.groupId!,
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
            levelId: session.levelId!,
            groupId: session.groupId!,
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
      }

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
        const digits = phone.replace(/\D/g, '');
        whatsappLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
      }
    }

    return { passed: true, studentId, subjectItemId: subjectItem.id, whatsappSent, whatsappLink };
  }

  async createSession(dto: CreateAttendanceSessionDto, user?: { id: string; schoolId?: string }) {
    const type = dto.type ?? 'class';
    if (!isSessionType(type)) throw new BadRequestException('type must be class, liturgy or event');
    if (type !== 'class') return this.createTypedSession(dto, type, user);

    const schoolId = await this.schoolResolver.resolve(dto.schoolId || '');
    const scheduledDate = new Date(dto.scheduledDate);
    if (!dto.servantId) dto.servantId = user?.id;
    if (!dto.servantId) throw new BadRequestException('servantId is required');
    const servantId: string = dto.servantId;

    if (!dto.groupId) throw new BadRequestException('Group is required');

    // H9: prevent duplicate sessions for the same group+level+grade+gender on the same date
    if (dto.groupId) {
      const dupWhere: any = { schoolId, groupId: dto.groupId, scheduledDate, deletedAt: null };
      if (dto.levelId) dupWhere.levelId = dto.levelId;
      else dupWhere.levelId = null;
      if (dto.gradeId) dupWhere.gradeId = dto.gradeId;
      else dupWhere.gradeId = null;
      const existing = await this.prisma.attendanceSession.findMany({
        where: dupWhere,
      });
      const genderFilter = dto.gender || null;
      const duplicate = existing.find(s => {
        const sMeta = (s.metadata as any) || {};
        return (sMeta.genderFilter || null) === genderFilter;
      });
      if (duplicate) throw new BadRequestException('A session already exists for this group on the selected date with the same filters');
    }

    const sessionMetadata = { ...dto.metadata };
    if (dto.gender) sessionMetadata.genderFilter = dto.gender;

    const session = await this.prisma.attendanceSession.create({
      data: {
        schoolId,
        sessionId: dto.sessionId,
        servantId,
        levelId: dto.levelId || null,
        groupId: dto.groupId,
        gradeId: dto.gradeId || null,
        scheduledDate,
        scheduledTime: dto.scheduledTime,
        status: dto.status || 'scheduled',
        notes: dto.notes,
        metadata: Object.keys(sessionMetadata).length > 0 ? sessionMetadata : undefined,
        targets: this.targetsCreate(classTargetFor({ groupId: dto.groupId, levelId: dto.levelId, gradeId: dto.gradeId }, dto.gender)),
      },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
      },
    });

    const studentWhere: any = { groupId: dto.groupId, deletedAt: null };
    if (dto.levelId) studentWhere.levelId = dto.levelId;
    if (dto.gradeId) studentWhere.gradeId = dto.gradeId;
    const effectiveGender = dto.gender || undefined;
    if (!effectiveGender) {
      const servant = await this.prisma.user.findUnique({ where: { id: servantId }, select: { metadata: true } });
      const servantTeachingGender = (servant?.metadata as any)?.teachingGender;
      if (servantTeachingGender && servantTeachingGender !== 'both') {
        studentWhere.gender = servantTeachingGender;
      }
    } else if (effectiveGender !== 'both') {
      studentWhere.gender = effectiveGender;
    }
    const students = await this.prisma.student.findMany({
      where: studentWhere,
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

    await this.audit.log({
      schoolId,
      action: 'CREATE',
      entityType: 'attendance_session',
      entityId: session.id,
      newValues: { levelId: dto.levelId, groupId: dto.groupId, gradeId: dto.gradeId, scheduledDate: dto.scheduledDate, status: dto.status },
    });
    return session;
  }

  /** Prisma nested-create payload for a session's audience rows (omitted when there is none). */
  private targetsCreate(...targets: Array<TargetInput | null>) {
    const rows = targets.filter((t): t is TargetInput => !!t);
    return rows.length > 0 ? { create: rows } : undefined;
  }

  /** Keep a class session's single audience row in step with its own columns. */
  private async replaceClassTarget(sessionId: string, target: TargetInput | null) {
    await this.prisma.attendanceSessionTarget.deleteMany({ where: { sessionId } });
    if (target) await this.prisma.attendanceSessionTarget.create({ data: { sessionId, ...target } });
  }

  private async syncSessionStudents(sessionId: string, recordedBy: string) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    // Classes (and sessions without audience rows) use the session's own columns,
    // exactly as before; liturgy/event sessions use the union of their audience rows.
    const targets = (session.type ?? 'class') !== 'class'
      ? await this.prisma.attendanceSessionTarget.findMany({
          where: { sessionId },
          select: { groupId: true, levelId: true, gradeId: true, gender: true },
        })
      : [];
    const fragments = rosterFragments(session, targets);
    const studentWhere: any = {
      deletedAt: null,
      ...(session.allGroups ? { schoolId: session.schoolId } : {}),
      ...(fragments.length === 1 ? fragments[0] : { OR: fragments }),
    };
    const sessionGenderFilter = (session.metadata as any)?.genderFilter;
    if (sessionGenderFilter && sessionGenderFilter !== 'both') {
      studentWhere.gender = sessionGenderFilter;
    } else if (!sessionGenderFilter && (session.type ?? 'class') === 'class') {
      // A servant's teaching-gender only narrows *their class*, never a liturgy/event audience.
      const servantUser = await this.prisma.user.findUnique({ where: { id: session.servantId }, select: { metadata: true } });
      const teachingGender = (servantUser?.metadata as any)?.teachingGender;
      if (teachingGender && teachingGender !== 'both') {
        studentWhere.gender = teachingGender;
      }
    }
    const activeStudents = await this.prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    });
    const activeIds = new Set(activeStudents.map(s => s.id));

    // Remove unmarked records for students no longer matching (group/level/grade/gender filter).
    // Preserve records already marked (present/absent/late) to avoid losing real attendance data.
    await this.prisma.attendanceRecord.deleteMany({
      where: { attendanceSessionId: sessionId, studentId: { notIn: Array.from(activeIds) }, status: 'unmarked' },
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

  /**
   * Diagnostic (read-only): list sessions whose records look auto-seeded
   * rather than manually reported — every record is `present` with no
   * enrichment (no behavior score, no note, no liturgy flag). A
   * `seedTimeMatch` flag marks rows recorded within 15 minutes of the
   * session creation (the legacy Start-Class pre-mark signature).
   * Heuristic, not proof: a servant using Mark-All right after Start Class
   * produces the same shape. An admin reviews before any cleanup.
   */
  async findSuspectAutoSeeds(schoolId: string, opts: { from?: string; to?: string; limit?: number }) {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    // Intentionally scans soft-deleted sessions too: deleting a session
    // leaves its records behind, and several readers historically counted
    // them. The `deletedAt` field in each row tells that story.
    const where: any = { schoolId };
    if (opts.from || opts.to) {
      where.scheduledDate = {};
      if (opts.from) where.scheduledDate.gte = new Date(opts.from);
      if (opts.to) where.scheduledDate.lte = new Date(opts.to);
    }
    const sessions = await this.prisma.attendanceSession.findMany({
      where,
      orderBy: { scheduledDate: 'desc' },
      take: limit,
      include: {
        level: { select: { name: true } },
        group: { select: { name: true } },
        servant: { select: { id: true, firstName: true, lastName: true } },
        attendanceRecords: {
          select: { status: true, behavior: true, participation: true, note: true, attendedLiturgy: true, recordedAt: true },
        },
      },
    });
    return sessions
      .map((s: any) => {
        const recs = s.attendanceRecords || [];
        const unenriched = recs.filter(
          (r: any) =>
            r.status === 'present' &&
            (r.behavior == null || r.behavior === 0) &&
            (r.participation == null || r.participation === 0) &&
            !r.note &&
            !r.attendedLiturgy,
        );
        const createdAt = new Date(s.createdAt).getTime();
        const seedTimeMatch =
          recs.length > 0 &&
          !isNaN(createdAt) &&
          recs.every((r: any) => {
            const t = new Date(r.recordedAt).getTime();
            return !isNaN(t) && Math.abs(t - createdAt) <= 15 * 60 * 1000;
          });
        return {
          id: s.id,
          scheduledDate: s.scheduledDate,
          status: s.status,
          deletedAt: s.deletedAt ?? null,
          levelName: s.level?.name ?? null,
          groupName: s.group?.name ?? null,
          servant: s.servant ? { id: s.servant.id, name: `${s.servant.firstName} ${s.servant.lastName}`.trim() } : null,
          totalRecords: recs.length,
          presentRecords: recs.filter((r: any) => r.status === 'present').length,
          unenrichedPresents: unenriched.length,
          seedTimeMatch,
          suspect: recs.length > 0 && unenriched.length === recs.length,
        };
      })
      .filter((s: any) => s.suspect);
  }

  /**
   * Cleanup (write): reset auto-seed-like records to `unmarked` on exactly
   * the sessions flagged by findSuspectAutoSeeds. Safe by default: runs as
   * a dry run unless `{ dryRun: false, confirm: true }` is passed.
   * Only the status flips — recordedBy/recordedAt history is preserved.
   */
  async resetSuspectAutoSeeds(
    schoolId: string,
    opts: { from?: string; to?: string; limit?: number; dryRun?: boolean; confirm?: boolean },
  ) {
    const suspects = await this.findSuspectAutoSeeds(schoolId, opts);
    const sessionIds = suspects.map((s: any) => s.id);
    const dryRun = opts.dryRun !== false || opts.confirm !== true;
    let recordsReset = 0;
    if (!dryRun && sessionIds.length) {
      const res = await this.prisma.attendanceRecord.updateMany({
        where: {
          attendanceSessionId: { in: sessionIds },
          status: 'present',
          OR: [{ behavior: null }, { behavior: 0 }],
          AND: [
            { OR: [{ participation: null }, { participation: 0 }] },
            { note: null },
            { OR: [{ attendedLiturgy: null }, { attendedLiturgy: false }] },
          ],
        },
        data: { status: 'unmarked' },
      });
      recordsReset = res.count;
    }
    return {
      dryRun,
      sessions: suspects.map((s: any) => ({
        id: s.id,
        scheduledDate: s.scheduledDate,
        groupName: s.groupName,
        servant: s.servant,
        totalRecords: s.totalRecords,
        seedTimeMatch: s.seedTimeMatch,
      })),
      sessionCount: suspects.length,
      recordsReset,
    };
  }

  // ─── Liturgy / event sessions ────────────────────────────────────────────

  /** The caller as the permission rules see them (roles + assignment come from the DB). */
  private async loadActor(user: { id: string }): Promise<Actor> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, schoolId: true, metadata: true, userRoles: { select: { role: { select: { name: true } } } } },
    });
    if (!row) throw new ForbiddenException('User not found');
    return {
      id: row.id,
      schoolId: row.schoolId,
      roles: (row.userRoles || []).map((ur: any) => ur.role?.name).filter(Boolean),
      metadata: (row.metadata as any) || {},
    };
  }

  /** Start of the scheduled day .. end of it, for same-day duplicate checks. */
  private dayRange(date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { start, end };
  }

  /**
   * Turn the requested audience into validated target rows, applying who-may-do-what:
   * group staff only their own group (liturgy); level leaders any audience but only
   * their own level; admins anything.
   */
  private async resolveAudience(
    dto: { targets?: Array<{ groupId: string; levelId?: string | null; gradeId?: string | null; gender?: string | null }>; allGroups?: boolean; groupId?: string; levelId?: string; gradeId?: string; gender?: string },
    type: Exclude<SessionType, 'class'>,
    actor: Actor,
    schoolId: string,
  ): Promise<{ targets: TargetInput[]; allGroups: boolean }> {
    if (!canCreateType(type, actor)) {
      throw new ForbiddenException(type === 'event'
        ? 'Only admins, principals and level leaders can create events'
        : 'You are not allowed to create liturgy sessions');
    }
    const multiOk = canCreateMultiGroup(actor);

    let requested: TargetInput[] = (dto.targets ?? []).map(t => ({ groupId: t.groupId, levelId: t.levelId ?? null, gradeId: t.gradeId ?? null, gender: normalizeGender(t.gender) }));
    if (requested.length === 0 && dto.groupId) {
      requested = [{ groupId: dto.groupId, levelId: dto.levelId ?? null, gradeId: dto.gradeId ?? null, gender: normalizeGender(dto.gender) }];
    }
    let allGroups = !!dto.allGroups;

    if (!allGroups && requested.length === 0) {
      if (type === 'liturgy' && isGroupStaffActor(actor)) {
        // Default audience for a servant: their own group(s).
        const own = await this.resolveServantSessionGroupIds(actor.metadata, schoolId);
        requested = own.map(groupId => ({ groupId, levelId: actor.metadata?.levelId ?? null, gradeId: null, gender: null }));
      }
      if (requested.length === 0) throw new BadRequestException('Choose at least one group, or select all groups');
    }

    if (!multiOk) {
      // Group staff: liturgy for their own group only.
      const own = new Set(await this.resolveServantSessionGroupIds(actor.metadata, schoolId));
      if (allGroups || requested.length !== 1 || !own.has(requested[0].groupId)) {
        throw new ForbiddenException('You can only create a liturgy session for your own group');
      }
    }

    // Level leaders: audience is limited to their own level.
    if (isLevelLeaderActor(actor)) {
      const levelId = actor.metadata?.levelId as string | undefined;
      if (!levelId) throw new ForbiddenException('No level is assigned to you');
      if (allGroups) {
        const groups = await this.prisma.group.findMany({ where: { schoolId, deletedAt: null, status: { not: 'inactive' } }, select: { id: true } });
        requested = groups.map(g => ({ groupId: g.id, levelId, gradeId: null, gender: null }));
        allGroups = false;
      }
      if (requested.some(t => t.levelId && t.levelId !== levelId)) {
        throw new ForbiddenException('Level leaders can only target their own level');
      }
      requested = requested.map(t => ({ ...t, levelId }));
    }

    // De-duplicate and verify every group belongs to this school.
    const seen = new Set<string>();
    const targets = requested.filter(t => {
      const key = [t.groupId, t.levelId ?? '', t.gradeId ?? '', t.gender ?? ''].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (targets.length > 0) {
      const ids = [...new Set(targets.map(t => t.groupId))];
      const found = await this.prisma.group.findMany({ where: { id: { in: ids }, schoolId, deletedAt: null }, select: { id: true } });
      if (found.length !== ids.length) throw new BadRequestException('One or more selected groups were not found in this school');
    }
    return { targets, allGroups };
  }

  private async createTypedSession(
    dto: CreateAttendanceSessionDto,
    type: Exclude<SessionType, 'class'>,
    user?: { id: string },
  ) {
    if (!user?.id) throw new ForbiddenException('Authentication required');
    const actor = await this.loadActor(user);
    const schoolId = await this.schoolResolver.resolve(dto.schoolId || actor.schoolId);
    if (actor.schoolId !== schoolId && !actor.roles.includes('super_admin')) {
      throw new ForbiddenException('Access to the requested school is not permitted');
    }
    const title = dto.title?.trim() || null;
    if (type === 'event' && !title) throw new BadRequestException('An event needs a title');

    const { targets, allGroups } = await this.resolveAudience(dto, type, actor, schoolId);
    const scheduledDate = dto.startNow ? new Date() : new Date(dto.scheduledDate);
    if (isNaN(scheduledDate.getTime())) throw new BadRequestException('Invalid date');

    // One liturgy per group/level on a given day (events can repeat).
    if (type === 'liturgy' && !allGroups) {
      const { start, end } = this.dayRange(scheduledDate);
      const clash = await this.prisma.attendanceSession.findFirst({
        where: {
          schoolId, type: 'liturgy', deletedAt: null, scheduledDate: { gte: start, lt: end },
          OR: [{ allGroups: true }, ...targets.map(t => ({ targets: { some: { groupId: t.groupId, ...(t.levelId ? { levelId: t.levelId } : {}) } } }))],
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException({ message: 'A liturgy session already exists for this group on that date', existingSessionId: clash.id });
      }
    }

    const single = targets.length === 1 && !allGroups ? targets[0] : null;
    const now = new Date();
    const session = await this.prisma.attendanceSession.create({
      data: {
        schoolId,
        servantId: actor.id,
        type,
        title,
        titleAr: dto.titleAr?.trim() || null,
        location: dto.location?.trim() || null,
        allGroups,
        // A single-group session also fills the legacy columns so older readers keep working.
        groupId: single?.groupId ?? null,
        levelId: single?.levelId ?? null,
        gradeId: single?.gradeId ?? null,
        scheduledDate,
        scheduledTime: dto.scheduledTime,
        status: dto.startNow ? 'in_progress' : (dto.status || 'scheduled'),
        actualStartTime: dto.startNow ? now : undefined,
        notes: dto.notes,
        metadata: dto.metadata && Object.keys(dto.metadata).length > 0 ? dto.metadata : undefined,
        targets: targets.length > 0 ? { create: targets } : undefined,
      },
    });

    // Seed the roster (unmarked) from the audience.
    await this.syncSessionStudents(session.id, actor.id);

    await this.audit.log({
      schoolId,
      action: 'CREATE',
      entityType: 'attendance_session',
      entityId: session.id,
      newValues: { type, title, allGroups, groups: targets.map(t => t.groupId), scheduledDate: dto.scheduledDate, startNow: !!dto.startNow },
    });
    return this.getSessionById(session.id);
  }

  /** Liturgy/event sessions can't be marked before their scheduled day (classes: unchanged). */
  private assertDateReached(session: { type?: string | null; scheduledDate: Date }) {
    if ((session.type ?? 'class') === 'class') return;
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    if (new Date(session.scheduledDate).getTime() > endOfToday.getTime()) {
      const day = new Date(session.scheduledDate).toISOString().slice(0, 10);
      throw new BadRequestException(`This session is scheduled for ${day}. Attendance can be recorded from that day.`);
    }
  }

  /**
   * Who may record attendance for a liturgy/event: admins, level leaders, its creator,
   * and anyone assigned to a group in its audience. (Classes: unchanged.)
   */
  private async assertCanMarkSession(
    session: { id: string; type?: string | null; servantId: string; groupId: string | null; allGroups?: boolean | null; schoolId: string },
    user?: { id: string },
  ) {
    if (!user || (session.type ?? 'class') === 'class') return;
    const actor = await this.loadActor(user);
    if (isAdminActor(actor) || isLevelLeaderActor(actor) || session.servantId === actor.id) return;
    const own = await this.resolveServantSessionGroupIds(actor.metadata, session.schoolId);
    if (own.length > 0) {
      if (session.allGroups) return;
      const targetGroups = new Set<string>(
        (await this.prisma.attendanceSessionTarget.findMany({ where: { sessionId: session.id }, select: { groupId: true } })).map(t => t.groupId),
      );
      if (session.groupId) targetGroups.add(session.groupId);
      if (own.some(g => targetGroups.has(g))) return;
    }
    throw new ForbiddenException('You are not assigned to this session');
  }

  /** Liturgy/event attendance is present/absent only; per-student scores don't apply. */
  private sanitizeRecordsForType<T extends { studentId: string; status: string; behavior?: number; participation?: number; homeworkStatus?: string; attendedLiturgy?: boolean }>(
    type: string | null | undefined,
    records: T[],
  ): T[] {
    if ((type ?? 'class') === 'class') return records;
    return records.map(r => {
      if (!['present', 'absent', 'unmarked'].includes(r.status)) {
        throw new BadRequestException('Liturgy and event attendance allows only present or absent');
      }
      return {
        ...r,
        behavior: undefined,
        participation: undefined,
        homeworkStatus: undefined,
        attendedLiturgy: type === 'liturgy' ? r.status === 'present' : undefined,
      };
    });
  }

  /** Completed sessions are read-only at the API level; they must be re-opened first. */
  private assertSessionWritable(session: { status: string; deletedAt?: Date | null }) {
    if (session.deletedAt) throw new NotFoundException('Attendance session not found');
    // Legacy liturgy sessions were stored as 'recorded'; that means finished.
    if (session.status === 'completed' || session.status === 'recorded') {
      throw new ConflictException('This session is completed and read-only. Re-open it to make changes.');
    }
  }

  private buildRecordUpsert(sessionId: string, record: MarkAttendanceDto['records'][number], recordedBy: string) {
    return this.prisma.attendanceRecord.upsert({
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
    });
  }

  private async loadRecordStatuses(sessionId: string, studentIds: string[]) {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId, studentId: { in: studentIds } },
      select: { studentId: true, status: true },
    });
    return new Map<string, string>((rows ?? []).map(r => [r.studentId, r.status]));
  }

  /** Analytics, XP, badges and absence alerts after marks are committed (all best-effort). */
  private runMarkSideEffects(
    session: { schoolId: string; type?: string | null },
    sessionId: string,
    records: MarkAttendanceDto['records'],
    recordedBy: string,
    previousStatus?: Map<string, string>,
  ) {
    const type = session.type ?? 'class';

    // MEASURE (C2): first attendance within 7 days of signup = activation.
    this.analytics.record({
      name: 'attendance.marked',
      category: 'activation',
      userId: recordedBy,
      schoolId: session.schoolId,
      properties: { count: records.length, sessionId, type },
    });

    // Events never touch XP, badges or absence alerts.
    if (type === 'event') return;

    // Badges (liturgy badges read the liturgy flag, class badges read everything).
    const affectedStudentIds = [...new Set(records.map(r => r.studentId))];
    for (const sid of affectedStudentIds) {
      this.gamification.computeBadgesForStudent(sid).catch(() => {});
    }
    // Liturgy sessions earn no class XP and trigger no absence alerts.
    if (type !== 'class') return;

    // Award direct attendance XP (fire-and-forget)
    for (const rec of records) {
      this.gamification.awardAttendanceXp(rec.studentId, sessionId, rec.status, session.schoolId).catch(() => {});
    }

    // Absence cascade: only when a student *newly* becomes absent. Re-saving an
    // already-absent record must not re-notify parents.
    for (const record of records) {
      if (record.status === 'absent' && previousStatus?.get(record.studentId) !== 'absent') {
        this.checkAbsenceCascade(record.studentId, session.schoolId, recordedBy).catch(() => {});
      }
    }
  }

  async markAttendance(sessionId: string, dto: MarkAttendanceDto, user?: { id: string }) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');
    this.assertSessionWritable(session);
    await this.assertCanMarkSession(session, user);
    this.assertDateReached(session);
    const records = this.sanitizeRecordsForType(session.type, dto.records);

    if (session.status === 'scheduled') {
      await this.prisma.attendanceSession.update({
        where: { id: sessionId },
        data: { status: 'in_progress', actualStartTime: new Date() },
      });
    }

    const isClass = (session.type ?? 'class') === 'class';
    const recordedBy = (!isClass && user?.id) || dto.recordedBy || session.servantId;

    // Sync attendance records with current active students in this session's audience
    await this.syncSessionStudents(sessionId, recordedBy);

    const previousStatus = await this.loadRecordStatuses(sessionId, records.map(r => r.studentId));
    await this.prisma.$transaction(records.map(record => this.buildRecordUpsert(sessionId, record, recordedBy)));

    this.runMarkSideEffects(session, sessionId, records, recordedBy, previousStatus);

    return this.getSessionById(sessionId);
  }

  /**
   * Save the final marks and complete the session atomically: either every
   * record is written AND the session is completed, or nothing changes.
   *
   * Anyone still `unmarked` when a session is finalized is saved as absent, in
   * the same transaction. Classes: anything other than present/late/excused
   * counts as absent. Liturgy and events: anything other than present.
   */
  async finalizeSession(sessionId: string, dto: FinalizeAttendanceDto, user?: { id: string }) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');
    this.assertSessionWritable(session);
    await this.assertCanMarkSession(session, user);
    this.assertDateReached(session);

    const type = session.type ?? 'class';
    const isClass = type === 'class';
    const recordedBy = (!isClass && user?.id) || dto.recordedBy || session.servantId;
    const records = this.sanitizeRecordsForType(type, dto.records ?? []);

    await this.syncSessionStudents(sessionId, recordedBy);

    // Validate against the roster as it will be after this save.
    const existing = await this.prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: sessionId, student: { deletedAt: null } },
      select: { studentId: true, status: true },
    });
    const previousStatus = new Map<string, string>(existing.map(r => [r.studentId, r.status]));
    const finalStatus = new Map<string, string>(previousStatus);
    for (const r of records) finalStatus.set(r.studentId, r.status);
    if (finalStatus.size === 0) {
      throw new BadRequestException('Cannot finalize a session with no students.');
    }
    // Students nobody marked: they become absent when the session is finalized.
    const autoAbsentIds = [...finalStatus.entries()].filter(([, st]) => st === 'unmarked').map(([id]) => id);
    const unmarkedCount = autoAbsentIds.length;

    const now = new Date();
    await this.prisma.$transaction([
      ...records.map(record => this.buildRecordUpsert(sessionId, record, recordedBy)),
      // Whoever is still unmarked is absent (after the explicit marks above are written).
      this.prisma.attendanceRecord.updateMany({
        where: { attendanceSessionId: sessionId, status: 'unmarked' },
        data: { status: 'absent', recordedBy, recordedAt: now, ...(type === 'liturgy' ? { attendedLiturgy: false } : {}) },
      }),
      this.prisma.attendanceSession.updateMany({
        where: { id: sessionId, status: { notIn: ['completed', 'recorded'] } },
        data: {
          status: 'completed',
          actualEndTime: now,
          ...(!session.actualStartTime && { actualStartTime: now }),
        },
      }),
    ]);

    await this.audit.log({
      schoolId: session.schoolId,
      action: 'FINALIZE',
      entityType: 'attendance_session',
      entityId: sessionId,
      oldValues: { status: session.status },
      newValues: { status: 'completed', type, autoMarkedAbsent: unmarkedCount },
    });

    // Auto-absent students count like any other absence (badges, 3-in-a-row parent alert).
    const effective = [...records, ...autoAbsentIds.map(studentId => ({ studentId, status: 'absent' }))] as MarkAttendanceDto['records'];
    this.runMarkSideEffects(session, sessionId, effective, recordedBy, previousStatus);
    if (isClass) this.sendPracticeGuideNotifications(sessionId).catch(() => {});

    return this.getSessionById(sessionId);
  }

  /**
   * A session completed through the plain status update (not /finalize) must obey the
   * same rule: anyone still unmarked becomes absent.
   */
  private async markUnmarkedAbsent(session: { id: string; schoolId: string; type?: string | null; servantId: string }, recordedBy: string) {
    const unmarked = await this.prisma.attendanceRecord.findMany({
      where: { attendanceSessionId: session.id, status: 'unmarked', student: { deletedAt: null } },
      select: { studentId: true },
    });
    if (unmarked.length === 0) return;
    const type = session.type ?? 'class';
    await this.prisma.attendanceRecord.updateMany({
      where: { attendanceSessionId: session.id, status: 'unmarked' },
      data: { status: 'absent', recordedBy, recordedAt: new Date(), ...(type === 'liturgy' ? { attendedLiturgy: false } : {}) },
    });
    const absent = unmarked.map(r => ({ studentId: r.studentId, status: 'absent' })) as MarkAttendanceDto['records'];
    this.runMarkSideEffects(session, session.id, absent, recordedBy, new Map(unmarked.map(r => [r.studentId, 'unmarked'])));
  }

  private async checkAbsenceCascade(studentId: string, schoolId: string, servantId: string) {
    // Class sessions only (liturgy and deleted sessions don't count). Fetch one
    // extra row so we alert once, when the streak reaches exactly 3.
    const recent = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        status: { in: ['present', 'late', 'absent'] },
        attendanceSession: { deletedAt: null, AND: [CLASS_SESSION_FILTER] },
      },
      include: {
        attendanceSession: { select: { scheduledDate: true } },
        student: { select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true, parentEmail: true } },
      },
      orderBy: { attendanceSession: { scheduledDate: 'desc' } },
      take: 4,
    });

    if (recent.length < 3) return;
    const streak = recent.slice(0, 3);
    if (!streak.every(r => r.status === 'absent')) return;
    // A 4th consecutive absence means the alert already went out at 3.
    if (recent.length === 4 && recent[3].status === 'absent') return;

    const student = streak[0].student;
    const studentName = `${student.firstName} ${student.lastName}`;
    const studentNameAr = student.firstNameAr && student.lastNameAr ? `${student.firstNameAr} ${student.lastNameAr}` : studentName;

    const group = await this.prisma.attendanceSession.findFirst({
      where: { attendanceRecords: { some: { studentId } }, deletedAt: null },
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
    this.assertSessionWritable(session);

    const recordInclude = {
      student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
      attendanceSession: { select: { id: true, group: { select: { name: true } } } },
    };

    // A repeat scan must not reset the check-in time or re-notify parents.
    const already = await this.prisma.attendanceRecord.findUnique({
      where: { attendanceSessionId_studentId: { attendanceSessionId: session.id, studentId } },
      include: recordInclude,
    });
    if (already && (already.status === 'present' || already.status === 'late')) {
      return {
        record: already,
        alreadyCheckedIn: true,
        message: `${already.student.firstName} ${already.student.lastName} is already checked in.`,
      };
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
      include: recordInclude,
    });

    this.gamification.awardAttendanceXp(studentId, session.id, 'present', servant.schoolId!).catch(() => {});
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

  async startClass(servantId: string, selectedGroupId?: string, selectedLevelId?: string, selectedGradeId?: string, selectedGender?: string) {
    const servant = await this.prisma.user.findUnique({ where: { id: servantId }, select: { schoolId: true, metadata: true } });
    if (!servant) throw new NotFoundException('Servant not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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

    let groupId: string | undefined = selectedGroupId || metaGroupId;
    const levelId: string | undefined = selectedLevelId || metaLevelId || (recentSessions.length > 0 ? recentSessions[0].levelId ?? undefined : undefined);
    const gradeId: string | undefined = selectedGradeId;

    // If no metadata assignment, try to get from recent sessions (only for non-admin servants)
    const servantRoles = await this.prisma.userRole.findMany({
      where: { userId: servantId },
      include: { role: { select: { name: true } } },
    });
    const isAdmin = servantRoles.some(ur => ['super_admin', 'admin'].includes(ur.role?.name));
    if (!groupId && !isAdmin && recentSessions.length > 0) {
      groupId = recentSessions[0].groupId || undefined;
    }

    if (!groupId) {
      // No assignment found — return all school groups, levels, and grades for the client to pick
      const [groups, levels, grades] = await Promise.all([
        this.prisma.group.findMany({
          where: { schoolId: servant.schoolId, deletedAt: null, status: { not: 'inactive' } },
        }),
        this.prisma.level.findMany({
          where: { schoolId: servant.schoolId, deletedAt: null, status: { not: 'inactive' } },
          orderBy: { number: 'asc' },
        }),
        this.prisma.schoolGrade.findMany({
          where: { schoolId: servant.schoolId, deletedAt: null, status: 'active' },
          orderBy: { orderIndex: 'asc' },
        }),
      ]);
      if (groups.length === 0) {
        throw new BadRequestException('No groups found in this school.');
      }
      return {
        groups: groups.map(g => ({ id: g.id, name: g.name })),
        levels: levels.map(l => ({ id: l.id, name: l.name, number: l.number })),
        grades: grades.map(g => ({ id: g.id, name: g.name, groupId: g.groupId })),
        requiresGroupPick: true,
      };
    }

    // Find existing session for today matching the same filters
    const existingWhere: any = {
      servantId,
      groupId,
      scheduledDate: { gte: today, lt: tomorrow },
      deletedAt: null,
    };
    if (levelId) existingWhere.levelId = levelId;
    else existingWhere.levelId = null;
    if (gradeId) existingWhere.gradeId = gradeId;
    else existingWhere.gradeId = null;
    const existingSessions = await this.prisma.attendanceSession.findMany({
      where: existingWhere,
      include: {
        group: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        attendanceRecords: { include: { student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } } } },
      },
    });
    const genderVal = selectedGender || null;
    const existing = existingSessions.find(s => {
      const sMeta = (s.metadata as any) || {};
      return (sMeta.genderFilter || null) === genderVal;
    });
    if (existing) {
      if (existing.status === 'in_progress') {
        await this.syncSessionStudents(existing.id, servantId);
        const refreshed = await this.prisma.attendanceSession.findUnique({
          where: { id: existing.id },
          include: {
            group: { select: { id: true, name: true } },
            level: { select: { id: true, name: true } },
            grade: { select: { id: true, name: true } },
            attendanceRecords: { include: { student: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } } } },
          },
        });
        return { session: refreshed, created: false };
      }
      return { session: existing, created: false };
    }

    const sessionMeta: Record<string, any> = {};
    if (selectedGender) sessionMeta.genderFilter = selectedGender;

    const session = await this.prisma.attendanceSession.create({
      data: {
        schoolId: servant.schoolId,
        servantId,
        levelId: levelId || null,
        groupId,
        gradeId: gradeId || null,
        scheduledDate: new Date(),
        scheduledTime: '12:00',
        status: 'scheduled',
        ...(Object.keys(sessionMeta).length > 0 && { metadata: sessionMeta }),
        targets: this.targetsCreate(classTargetFor({ groupId, levelId, gradeId }, selectedGender)),
      },
    });

    // Seed the roster as unmarked — the servant marks each student explicitly.
    const studentWhere: any = { groupId, schoolId: servant.schoolId, deletedAt: null, status: 'active' };
    if (levelId) studentWhere.levelId = levelId;
    if (gradeId) studentWhere.gradeId = gradeId;
    if (selectedGender && selectedGender !== 'both') {
      studentWhere.gender = selectedGender;
    } else {
      const metaTeachingGender = meta.teachingGender as string | undefined;
      if (metaTeachingGender && metaTeachingGender !== 'both') {
        studentWhere.gender = metaTeachingGender;
      }
    }
    const students = await this.prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    });
    if (students.length > 0) {
      await this.prisma.attendanceRecord.createMany({
        data: students.map(s => ({
          attendanceSessionId: session.id,
          studentId: s.id,
          status: 'unmarked',
          recordedBy: servantId,
          recordedAt: new Date(),
        })),
      });
    }

    const full = await this.getSessionById(session.id);
    return { session: full, created: true };
  }

  async startSession(sessionId: string, servantId: string, roles?: string[]) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');
    if ((session.type ?? 'class') === 'class') {
      const isAdmin = (roles || []).some(r => ['super_admin', 'admin'].includes(r));
      if (!isAdmin && session.servantId !== servantId) throw new ForbiddenException('Not your session');
    } else {
      await this.assertCanMarkSession(session, { id: servantId });
      this.assertDateReached(session);
    }
    if (session.status === 'in_progress') return { session, started: false };
    if (session.status === 'completed' || session.status === 'recorded') throw new BadRequestException('Cannot start a completed session');

    const updated = await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { status: 'in_progress', actualStartTime: new Date() },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        servant: { select: { id: true, firstName: true, lastName: true } },
        attendanceRecords: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    await this.syncSessionStudents(sessionId, servantId);

    await this.audit.log({
      schoolId: session.schoolId,
      action: 'START',
      entityType: 'attendance_session',
      entityId: sessionId,
      oldValues: { status: session.status },
      newValues: { status: 'in_progress' },
    });

    return { session: updated, started: true };
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

  /** Class sessions only (soft-deleted and liturgy sessions excluded). */
  private classSessionWhere(schoolId: string, extra: Record<string, any> = {}, and: any[] = []) {
    return { schoolId, deletedAt: null, ...extra, AND: [CLASS_SESSION_FILTER, ...and] };
  }

  /**
   * Per-session status tallies for completed class sessions, computed with a
   * database GROUP BY instead of loading every attendance record into memory.
   */
  private async completedSessionTallies(schoolId: string, and: any[] = []) {
    const where = this.classSessionWhere(schoolId, { status: 'completed' }, and);
    const [sessions, grouped] = await Promise.all([
      this.prisma.attendanceSession.findMany({ where: where as any, select: { id: true, levelId: true, groupId: true } }),
      (this.prisma.attendanceRecord as any).groupBy({
        by: ['attendanceSessionId', 'status'],
        where: { attendanceSession: where, student: { deletedAt: null } },
        _count: { _all: true },
      }) as Promise<Array<{ attendanceSessionId: string; status: string; _count: { _all: number } }>>,
    ]);
    const bySession = new Map<string, StatusTally>();
    for (const g of grouped) {
      const t = bySession.get(g.attendanceSessionId) ?? emptyTally();
      if (g.status in t) (t as any)[g.status] += g._count._all;
      bySession.set(g.attendanceSessionId, t);
    }
    return { sessions, bySession };
  }

  async getSessionStats(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const activeLevels = await this.prisma.level.findMany({
      where: { schoolId, status: { not: 'inactive' } },
      select: { id: true },
    });
    // Sessions without a level (now allowed) still count; only sessions of
    // deactivated levels are left out.
    const levelScope = { OR: [{ levelId: null }, { levelId: { in: activeLevels.map(l => l.id) } }] };

    const [byStatus, { sessions, bySession }] = await Promise.all([
      (this.prisma.attendanceSession as any).groupBy({
        by: ['status'],
        where: this.classSessionWhere(schoolId, {}, [levelScope]),
        _count: { _all: true },
      }) as Promise<Array<{ status: string; _count: { _all: number } }>>,
      this.completedSessionTallies(schoolId, [levelScope]),
    ]);
    const sessionCount = (status: string) => byStatus.find(g => g.status === status)?._count._all ?? 0;

    const total = emptyTally();
    for (const s of sessions) addTally(total, bySession.get(s.id));

    return {
      totalSessions: byStatus.reduce((n, g) => n + g._count._all, 0),
      completedSessions: sessionCount('completed'),
      scheduledSessions: sessionCount('scheduled'),
      inProgressSessions: sessionCount('in_progress'),
      // Marked records only: unmarked rows are pending work, not attendance data.
      totalRecords: total.present + total.late + total.absent + total.excused,
      presentCount: total.present,
      lateCount: total.late,
      absentCount: total.absent,
      excusedCount: total.excused,
      unmarkedCount: total.unmarked,
      averageAttendanceRate: preciseRateFromCounts(total),
    };
  }

  async getLevelStats(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const levels = await this.prisma.level.findMany({ where: { schoolId, status: { not: 'inactive' } }, orderBy: { number: 'asc' } });
    const { sessions, bySession } = await this.completedSessionTallies(schoolId);

    const summarize = (subset: typeof sessions) => {
      const tally = emptyTally();
      for (const s of subset) addTally(tally, bySession.get(s.id));
      return {
        totalSessions: subset.length,
        totalRecords: tally.present + tally.late + tally.absent + tally.excused,
        attendanceRate: preciseRateFromCounts(tally),
      };
    };

    const stats: any[] = levels.map(level => ({
      levelId: level.id, levelNumber: level.number, levelName: level.name,
      ...summarize(sessions.filter(s => s.levelId === level.id)),
    }));
    const noLevel = sessions.filter(s => !s.levelId);
    if (noLevel.length > 0) {
      stats.push({ levelId: null, levelNumber: null, levelName: null, ...summarize(noLevel) });
    }
    return stats;
  }

  async getGroupStats(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const [groups, levels, { sessions, bySession }] = await Promise.all([
      this.prisma.group.findMany({
        where: { schoolId, status: { not: 'inactive' }, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.level.findMany({ where: { schoolId }, select: { id: true, number: true, name: true } }),
      this.completedSessionTallies(schoolId),
    ]);
    const levelById = new Map(levels.map(l => [l.id, l]));

    return groups.map(group => {
      const groupSessions = sessions.filter(s => s.groupId === group.id);
      const tally = emptyTally();
      for (const s of groupSessions) addTally(tally, bySession.get(s.id));
      // A group spans several levels, so report which levels it actually ran.
      const levelIds = [...new Set(groupSessions.map(s => s.levelId).filter((id): id is string => !!id))];
      return {
        groupId: group.id, groupName: group.name,
        levels: levelIds
          .map(id => levelById.get(id))
          .filter((l): l is NonNullable<typeof l> => !!l)
          .sort((a, b) => a.number - b.number)
          .map(l => ({ number: l.number, name: l.name })),
        totalSessions: groupSessions.length,
        totalRecords: tally.present + tally.late + tally.absent + tally.excused,
        attendanceRate: preciseRateFromCounts(tally),
      };
    });
  }

  async searchStudentAttendance(q: string, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
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
      // Rows that were never marked are not attendance history.
      where: { studentId: { in: students.map(s => s.id) }, status: { not: 'unmarked' }, attendanceSession: { deletedAt: null } },
      include: {
        attendanceSession: {
          include: {
            level: { select: { name: true, number: true } },
          },
        },
      },
      orderBy: { attendanceSession: { scheduledDate: 'desc' } },
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
                targets: this.targetsCreate(classTargetFor({ groupId: group.id, levelId })),
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

  async updateSession(id: string, dto: Partial<CreateAttendanceSessionDto>, user?: { id: string }) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Attendance session not found');

    const sessionType = (session.type ?? 'class') as SessionType;
    if (dto.type && dto.type !== sessionType) throw new BadRequestException('The session type cannot be changed');

    // Liturgy / event: who may edit, and the editable descriptive fields + audience.
    let typedData: Record<string, any> = {};
    let typedAudience: { targets: TargetInput[]; allGroups: boolean } | null = null;
    if (sessionType !== 'class') {
      if (user) {
        const actor = await this.loadActor(user);
        if (!(isAdminActor(actor) || isLevelLeaderActor(actor) || session.servantId === actor.id)) {
          throw new ForbiddenException('Only the creator, a level leader or an admin can edit this session');
        }
        if (dto.targets !== undefined || dto.allGroups !== undefined || dto.groupId !== undefined) {
          typedAudience = await this.resolveAudience(dto, sessionType, actor, session.schoolId);
        }
      }
      if (dto.title !== undefined) {
        const title = dto.title?.trim() || null;
        if (sessionType === 'event' && !title) throw new BadRequestException('An event needs a title');
        typedData.title = title;
      }
      if (dto.titleAr !== undefined) typedData.titleAr = dto.titleAr?.trim() || null;
      if (dto.location !== undefined) typedData.location = dto.location?.trim() || null;
      if (typedAudience) {
        const single = typedAudience.targets.length === 1 && !typedAudience.allGroups ? typedAudience.targets[0] : null;
        typedData = { ...typedData, allGroups: typedAudience.allGroups, groupId: single?.groupId ?? null, levelId: single?.levelId ?? null, gradeId: single?.gradeId ?? null };
      }
    }

    const statusChanged = !!dto.status && dto.status !== session.status;
    const groupChanged = !!dto.groupId && dto.groupId !== session.groupId;
    const genderChanged = dto.gender !== undefined;

    let metadataUpdate: any = undefined;
    if (genderChanged) {
      const existingMeta = (session.metadata as any) || {};
      if (dto.gender) {
        metadataUpdate = { ...existingMeta, genderFilter: dto.gender };
      } else {
        const { genderFilter: _, ...rest } = existingMeta;
        metadataUpdate = Object.keys(rest).length > 0 ? rest : null;
      }
    }

    const updated = await this.prisma.attendanceSession.update({
      where: { id },
      data: {
        ...(dto.servantId && { servantId: dto.servantId }),
        ...(dto.levelId !== undefined && { levelId: dto.levelId || null }),
        ...(dto.groupId && { groupId: dto.groupId }),
        ...(dto.gradeId !== undefined && { gradeId: dto.gradeId || null }),
        ...(dto.scheduledDate && { scheduledDate: new Date(dto.scheduledDate) }),
        ...(dto.scheduledTime && { scheduledTime: dto.scheduledTime }),
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(metadataUpdate !== undefined && { metadata: metadataUpdate }),
        ...(statusChanged && dto.status === 'in_progress' && !session.actualStartTime && { actualStartTime: new Date() }),
        ...(statusChanged && dto.status === 'completed' && { actualEndTime: new Date() }),
        ...typedData,
      },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        servant: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (typedAudience) {
      await this.prisma.attendanceSessionTarget.deleteMany({ where: { sessionId: id } });
      if (typedAudience.targets.length > 0) {
        await this.prisma.attendanceSessionTarget.createMany({ data: typedAudience.targets.map(t => ({ sessionId: id, ...t })) });
      }
    }

    // Keep the class audience row in step with the session's own columns.
    if ((updated.type ?? 'class') === 'class' && (groupChanged || dto.levelId !== undefined || dto.gradeId !== undefined || genderChanged)) {
      const gender = ((updated.metadata as any)?.genderFilter as string | undefined) ?? null;
      await this.replaceClassTarget(id, classTargetFor(updated, gender));
    }

    // Sync students when status, group, level, grade, or gender changes
    if (statusChanged || groupChanged || dto.levelId !== undefined || dto.gradeId !== undefined || genderChanged || typedAudience) {
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

    // Completing a session by status change also saves unmarked students as absent.
    if (statusChanged && dto.status === 'completed') {
      await this.markUnmarkedAbsent(updated, user?.id || session.servantId);
    }

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
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id },
      select: { id: true, schoolId: true, status: true, levelId: true, groupId: true, attendanceRecords: { select: { studentId: true } } },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    // Collect affected student IDs BEFORE soft-deleting the session — after
    // deletion the records are filtered out by attendanceSession.deletedAt: null
    // so we wouldn't be able to recover them.
    const affectedStudentIds = [...new Set(session.attendanceRecords.map(r => r.studentId))];
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
    // Recompute badges for affected students: badges tied to deleted
    // attendance are revoked and their XP reversed; anything still
    // qualifying is awarded fresh.
    for (const sid of affectedStudentIds) {
      this.gamification.computeBadgesForStudent(sid, undefined, true).catch(() => {});
    }
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
        where: { schoolId, groupId, levelId: levelId || null, scheduledDate: targetDate, deletedAt: null },
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
            targets: this.targetsCreate(classTargetFor({ groupId, levelId })),
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

  async batchUpdateRecords(sessionId: string, updates: Array<{ studentId: string; status: string }>, user?: { id: string }) {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Attendance session not found');
    this.assertSessionWritable(session);
    await this.assertCanMarkSession(session, user);
    this.assertDateReached(session);
    this.sanitizeRecordsForType(session.type, updates);

    const results: any[] = [];
    for (const update of updates) {
      const record = await this.prisma.attendanceRecord.upsert({
        where: {
          attendanceSessionId_studentId: {
            attendanceSessionId: sessionId,
            studentId: update.studentId,
          },
        },
        update: { status: update.status, ...(session.type === 'liturgy' ? { attendedLiturgy: update.status === 'present' } : {}) },
        create: {
          attendanceSessionId: sessionId,
          studentId: update.studentId,
          status: update.status,
          recordedBy: session.servantId || '',
          ...(session.type === 'liturgy' ? { attendedLiturgy: update.status === 'present' } : {}),
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

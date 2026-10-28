import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';
import { CreateAssessmentDto, UpdateAssessmentDto, SubmitAssessmentDto, CreateQuestionDto } from './dto/assessment.dto';

type Actor = { id?: string; roles?: string[]; schoolId?: string };
type QuestionScore = { questionId: string; score: number };

const ADMIN_ROLES = ['super_admin', 'admin', 'principal'];
const REVIEWER_ROLES = ['servant', 'group_leader'];

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private schoolResolver: SchoolResolver,
    private readonly audit: AuditService,
    private readonly studentNotifications: StudentNotificationsService,
  ) {}

  async findAll(schoolIdentifier: string, filters: {
    page?: number;
    limit?: number;
    levelId?: string;
    subjectId?: string;
    status?: string;
    type?: string;
  }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { page = 1, limit = 20, levelId, subjectId, status, type } = filters;

    const where: any = { schoolId, deletedAt: null };
    if (levelId) where.levelId = levelId;
    if (subjectId) where.subjectId = subjectId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        include: {
          level: { select: { id: true, name: true, number: true } },
          group: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          lesson: { select: { id: true, title: true } },
          _count: { select: { questions: true, submissions: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.assessment.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
        questions: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { submissions: true } },
      },
    });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }
    return assessment;
  }

  async create(dto: CreateAssessmentDto, schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier || dto.schoolId || '');

    const adminUser = await this.prisma.user.findFirst({
      where: { schoolId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    const data: any = {
      schoolId,
      levelId: dto.levelId,
      groupId: dto.groupId || null,
      lessonId: dto.lessonId || null,
      subjectId: dto.subjectId,
      title: dto.title,
      description: dto.description,
      referenceRecordingUrl: dto.referenceRecordingUrl || null,
      referenceRecordingName: dto.referenceRecordingName || null,
      type: dto.type || 'quiz',
      totalPoints: dto.totalPoints,
      passingScore: dto.passingPoints,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: dto.status || 'draft',
      createdBy: adminUser?.id || '00000000-0000-0000-0000-000000000000',
      metadata: {
        academicYearId: dto.academicYearId,
        term: dto.term,
        grade: dto.grade || null,
        durationMinutes: dto.durationMinutes ?? null,
      },
    };

    if (dto.questions && dto.questions.length > 0) {
      this.validateQuestions(dto.questions, dto.totalPoints);
      data.questions = {
        create: dto.questions.map(q => ({
          questionText: q.text,
          type: q.type,
          options: q.options || undefined,
          correctAnswer: q.correctAnswer,
          points: q.points,
          orderIndex: q.orderIndex,
        })),
      };
    }

    return this.prisma.assessment.create({
      data,
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  async update(id: string, dto: UpdateAssessmentDto) {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.levelId !== undefined) data.levelId = dto.levelId;
    if (dto.groupId !== undefined) data.groupId = dto.groupId || null;
    if (dto.lessonId !== undefined) data.lessonId = dto.lessonId || null;
    if (dto.subjectId !== undefined) data.subjectId = dto.subjectId;
    if (dto.referenceRecordingUrl !== undefined) data.referenceRecordingUrl = dto.referenceRecordingUrl || null;
    if (dto.referenceRecordingName !== undefined) data.referenceRecordingName = dto.referenceRecordingName || null;
    if (dto.totalPoints !== undefined) data.totalPoints = dto.totalPoints;
    if (dto.passingPoints !== undefined) data.passingScore = dto.passingPoints;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.type !== undefined) data.type = dto.type;

    if (dto.academicYearId !== undefined || dto.term !== undefined || dto.grade !== undefined || dto.durationMinutes !== undefined) {
      const metadata = (existing.metadata as any) || {};
      if (dto.academicYearId !== undefined) metadata.academicYearId = dto.academicYearId;
      if (dto.term !== undefined) metadata.term = dto.term;
      if (dto.grade !== undefined) metadata.grade = dto.grade || null;
      if (dto.durationMinutes !== undefined) metadata.durationMinutes = dto.durationMinutes;
      data.metadata = metadata;
    }

    if (dto.questions !== undefined) {
      const questions = dto.questions;
      this.validateQuestions(questions, dto.totalPoints ?? Number(existing.totalPoints));
      await this.prisma.$transaction(async (tx) => {
        const keptIds = questions.filter(q => q.id).map(q => q.id as string);
        if (keptIds.length > 0) {
          await tx.assessmentQuestion.deleteMany({
            where: { assessmentId: id, id: { notIn: keptIds }, grades: { none: {} } },
          });
        } else {
          await tx.assessmentQuestion.deleteMany({
            where: { assessmentId: id, grades: { none: {} } },
          });
        }
        for (const q of questions) {
          const questionData = {
            questionText: q.text,
            type: q.type,
            options: q.options || undefined,
            correctAnswer: q.correctAnswer,
            points: q.points,
            orderIndex: q.orderIndex,
          };
          if (q.id) {
            await tx.assessmentQuestion.update({ where: { id: q.id }, data: questionData });
          } else {
            await tx.assessmentQuestion.create({
              data: { assessmentId: id, ...questionData },
            });
          }
        }
      });
    }

    return this.prisma.assessment.update({
      where: { id },
      data,
      include: {
        level: { select: { id: true, name: true, number: true } },
        group: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
        questions: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  async publishAssessment(assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.status === 'published') {
      return assessment;
    }
    if (assessment.status !== 'draft') {
      throw new BadRequestException('Only draft assessments can be published');
    }
    const questions = await this.prisma.assessmentQuestion.findMany({ where: { assessmentId }, select: { id: true } });
    if (questions.length === 0) {
      throw new BadRequestException('Cannot publish assessment without questions');
    }
    if (Number(assessment.totalPoints) <= 0) {
      throw new BadRequestException('Cannot publish assessment with zero total points');
    }
    const updated = await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'published' },
    });
    let assigned = 0;
    if ((assessment as any).groupId) {
      const students = await this.prisma.student.findMany({
        where: { groupId: (assessment as any).groupId, deletedAt: null, status: 'active' },
        select: { id: true },
      });
      if (students.length > 0) {
        const res = await this.assignStudents(assessmentId, students.map(s => s.id));
        assigned = res.assigned;
      }
    }
    return { ...updated, assigned };
  }

  async delete(id: string) {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }

    await this.prisma.$transaction([
      this.prisma.grade.deleteMany({
        where: { submission: { assessmentId: id } },
      }),
      this.prisma.assessmentSubmission.deleteMany({ where: { assessmentId: id } }),
      this.prisma.assessment.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);

    return { message: 'Assessment deleted successfully' };
  }

  /**
   * The live submission for a student on an assessment: the newest attempt that a
   * re-take has not archived. Prior attempts are retained with status 'superseded'.
   *
   * Every caller must go through this. An unordered findFirst on
   * {assessmentId, studentId} leaves it undefined which attempt wins, which is how a
   * re-take could resolve to an old 'submitted' row and fail as "already submitted".
   */
  private liveSubmission(assessmentId: string, studentId: string) {
    return this.prisma.assessmentSubmission.findFirst({
      where: { assessmentId, studentId, status: { not: 'superseded' } },
      orderBy: [{ attemptNumber: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async submit(assessmentId: string, studentId: string, dto: SubmitAssessmentDto, actor?: { id?: string; schoolId?: string }) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.status !== 'published') {
      throw new BadRequestException('Assessment is not open for submission');
    }

    const assignment = await this.liveSubmission(assessmentId, studentId);
    if (!assignment) {
      throw new BadRequestException('This student is not assigned to this assessment');
    }
    if (['submitted', 'completed'].includes(assignment.status)) {
      throw new BadRequestException('This student has already submitted this assessment');
    }

    // Past-due submissions are always accepted; they are only flagged as late.
    const isLate = !!(assessment.dueDate && new Date() > assessment.dueDate);

    const submission = await this.prisma.$transaction(async (tx) => {
      // Fill in the attempt row itself rather than inserting a second row beside it.
      // Two live rows per attempt is what made the findFirst lookups undefined.
      const sub = await tx.assessmentSubmission.update({
        where: { id: assignment.id },
        data: {
          submissionType: 'online',
          submissionContent: JSON.stringify(dto.answers),
          fileUrl: dto.fileUrl || null,
          fileType: dto.fileType || null,
          durationSeconds: dto.durationSeconds ?? null,
          ...(dto.notes ? { metadata: { ...(((assignment.metadata as any) || {}) as object), notes: dto.notes } } : {}),
          status: 'submitted',
          submittedAt: new Date(),
          isLate,
        },
      });

      // A re-submission on a reused row must not accumulate stale auto-grades.
      await tx.grade.deleteMany({ where: { submissionId: sub.id, questionId: { not: null } } });

      const gradeData = dto.answers
        .map((answer) => {
          const question = assessment.questions.find(q => q.id === answer.questionId);
          if (!question) return null;
          if (question.type === 'essay') return null; // not auto-graded; graded manually
          const isCorrect = question.correctAnswer
            ? answer.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim()
            : false;
          const score = isCorrect ? Number(question.points) : 0;
          return {
            submissionId: sub.id,
            questionId: question.id,
            score,
            maxScore: Number(question.points),
            gradedBy: null,
          };
        })
        .filter(Boolean);

      if (gradeData.length > 0) {
        await tx.grade.createMany({ data: gradeData as any });
      }

      return sub;
    });

    await this.audit.log({
      schoolId: actor?.schoolId || assessment.schoolId,
      userId: actor?.id,
      action: 'PROXY_SUBMIT',
      entityType: 'assessment_submission',
      entityId: submission.id,
      newValues: { studentId, assessmentId },
    });

    await this.notifyReviewers(assessment, studentId, submission.id, actor?.id);

    return this.prisma.assessmentSubmission.findUnique({
      where: { id: submission.id },
      include: {
        grades: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  private isAdminActor(actor?: Actor) {
    return (actor?.roles || []).some((r) => ADMIN_ROLES.includes(r));
  }

  /**
   * Which students an actor may review. `{}` for admins; for servants/leaders the group,
   * level, grade and gender recorded on their profile; `null` when a non-admin has no
   * group or level at all (so a mis-configured account sees nothing rather than everything).
   */
  private async reviewStudentScope(actor?: Actor): Promise<Record<string, any> | null> {
    if (this.isAdminActor(actor)) return {};
    if (!actor?.id) return null;
    const user = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { metadata: true } });
    const meta = ((user as any)?.metadata as any) || {};
    if (!meta.groupId && !meta.levelId) return null;
    const scope: Record<string, any> = {};
    if (meta.groupId) scope.groupId = meta.groupId;
    if (meta.levelId) scope.levelId = meta.levelId;
    if (meta.gradeId) scope.gradeId = meta.gradeId;
    if (meta.teachingGender && meta.teachingGender !== 'both') scope.gender = meta.teachingGender;
    return scope;
  }

  /**
   * Every live submission still waiting for a mark. Admins see the whole school and can
   * mark on a servant's behalf via markStudent; servants and leaders see their own group.
   */
  async getPendingReview(schoolIdentifier: string, actor?: Actor) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const scope = await this.reviewStudentScope(actor);
    if (!scope) return [];

    const submissions = await this.prisma.assessmentSubmission.findMany({
      where: {
        status: 'submitted',
        assessment: { schoolId, deletedAt: null },
        student: { deletedAt: null, ...scope },
      },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, studentCode: true,
            level: { select: { id: true, name: true } },
            group: { select: { id: true, name: true } },
            grade: { select: { name: true } },
          },
        },
        assessment: {
          select: {
            id: true, title: true, titleAr: true, type: true, dueDate: true, totalPoints: true,
            referenceRecordingUrl: true, referenceRecordingName: true,
            questions: { orderBy: { orderIndex: 'asc' } },
          },
        },
        grades: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    const toNum = (v: any) => (v == null ? 0 : typeof v === 'number' ? v : Number(v.toString()));

    return submissions.map((s) => {
      let rawAnswers: { questionId: string; answer: string }[] = [];
      try {
        const parsed = JSON.parse(s.submissionContent || '[]');
        if (Array.isArray(parsed)) rawAnswers = parsed;
      } catch {
        rawAnswers = [];
      }
      const answers = s.assessment.questions.map((q) => {
        const given = rawAnswers.find((a) => a.questionId === q.id);
        const grade = s.grades.find((g) => g.questionId === q.id);
        return {
          questionId: q.id,
          questionText: q.questionText,
          type: q.type,
          points: toNum(q.points),
          correctAnswer: q.type === 'essay' ? null : q.correctAnswer,
          answer: given?.answer ?? null,
          awarded: grade ? toNum(grade.score) : null,
        };
      });

      // Answers whose question was edited or removed after the student answered are still
      // evidence the marker should see, so they are listed rather than silently dropped.
      const knownIds = new Set(s.assessment.questions.map((q) => q.id));
      const extraAnswers = rawAnswers
        .filter((a) => a && !knownIds.has(a.questionId) && a.answer)
        .map((a) => ({ questionId: a.questionId, answer: a.answer }));
      const meta = ((s.metadata as any) || {}) as Record<string, any>;

      return {
        submissionId: s.id,
        submittedAt: s.submittedAt,
        isLate: s.isLate,
        attemptNumber: s.attemptNumber,
        recording: s.fileUrl
          ? { url: s.fileUrl, type: s.fileType ?? null, durationSeconds: s.durationSeconds ?? null }
          : null,
        notes: typeof meta.notes === 'string' && meta.notes ? meta.notes : null,
        extraAnswers,
        student: {
          id: s.student.id,
          firstName: s.student.firstName,
          lastName: s.student.lastName,
          studentCode: s.student.studentCode,
          levelName: s.student.level?.name ?? null,
          groupName: s.student.group?.name ?? null,
          gradeName: s.student.grade?.name ?? null,
        },
        assessment: {
          id: s.assessment.id,
          title: s.assessment.title,
          titleAr: s.assessment.titleAr,
          type: s.assessment.type,
          dueDate: s.assessment.dueDate,
          totalPoints: toNum(s.assessment.totalPoints),
          referenceRecordingUrl: s.assessment.referenceRecordingUrl ?? null,
          referenceRecordingName: s.assessment.referenceRecordingName ?? null,
        },
        hasEssay: s.assessment.questions.some((q) => q.type === 'essay'),
        autoScore: s.grades
          .filter((g) => g.questionId !== null)
          .reduce((sum, g) => sum + toNum(g.score), 0),
        answers,
      };
    });
  }

  /**
   * Everything already handled, newest first: marked work (who marked it and the result) and
   * work returned to the student to redo (who returned it and why). Both keep the student's
   * recording and notes so a reviewer can still refer back to them. Same visibility scope
   * as the pending queue. Capped, with `truncated` set when more exist.
   */
  async getMarked(schoolIdentifier: string, actor?: Actor, days = 90) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const scope = await this.reviewStudentScope(actor);
    if (!scope) return { days, truncated: false, items: [] };

    const window = Math.min(Math.max(Math.floor(days) || 90, 1), 365);
    const since = new Date(Date.now() - window * 86_400_000);
    const LIMIT = 500;
    const toNum = (v: any) => (v == null ? 0 : typeof v === 'number' ? v : Number(v.toString()));

    const studentSelect = {
      id: true, firstName: true, lastName: true, studentCode: true,
      group: { select: { id: true, name: true } },
      grade: { select: { name: true } },
    } as const;
    const assessmentSelect = { id: true, title: true, titleAr: true, totalPoints: true } as const;

    const [grades, returnedRows] = await Promise.all([
      this.prisma.grade.findMany({
        where: {
          questionId: null,
          gradedAt: { gte: since },
          submission: {
            status: 'completed',
            assessment: { schoolId, deletedAt: null },
            student: { deletedAt: null, ...scope },
          },
        },
        orderBy: { gradedAt: 'desc' },
        take: LIMIT + 1,
        include: {
          grader: {
            select: {
              id: true, firstName: true, lastName: true,
              userRoles: { select: { role: { select: { name: true } } } },
            },
          },
          submission: {
            select: {
              id: true, submittedAt: true, submissionType: true, isLate: true,
              fileUrl: true, fileType: true, durationSeconds: true, metadata: true,
              student: { select: studentSelect },
              assessment: { select: assessmentSelect },
            },
          },
        },
      }),
      // A returned attempt is back with the student ('assigned') carrying a return history.
      this.prisma.assessmentSubmission.findMany({
        where: {
          status: 'assigned',
          metadata: { not: Prisma.DbNull },
          assessment: { schoolId, deletedAt: null },
          student: { deletedAt: null, ...scope },
        },
        select: {
          id: true, isLate: true, fileUrl: true, fileType: true, durationSeconds: true, metadata: true,
          submittedAt: true,
          student: { select: studentSelect },
          assessment: { select: assessmentSelect },
        },
      }),
    ]);

    const recordingOf = (sub: { fileUrl: string | null; fileType: string | null; durationSeconds: number | null }) =>
      sub.fileUrl ? { url: sub.fileUrl, type: sub.fileType ?? null, durationSeconds: sub.durationSeconds ?? null } : null;
    const notesOf = (metadata: unknown) => {
      const n = ((metadata as any) || {}).notes;
      return typeof n === 'string' && n ? n : null;
    };
    const studentOut = (st: any) => ({
      id: st.id, firstName: st.firstName, lastName: st.lastName, studentCode: st.studentCode,
      groupName: st.group?.name ?? null, gradeName: st.grade?.name ?? null,
    });
    const assessmentOut = (a: any) => ({
      id: a.id, title: a.title, titleAr: a.titleAr, totalPoints: toNum(a.totalPoints),
    });

    const marked = grades.map((g) => {
      const sub = g.submission;
      const score = toNum(g.score);
      const maxScore = toNum(g.maxScore);
      const roleNames = (g.grader?.userRoles || []).map((ur: any) => ur.role?.name).filter(Boolean) as string[];
      return {
        status: 'marked' as const,
        submissionId: sub.id,
        at: g.gradedAt,
        score,
        maxScore,
        percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : null,
        feedback: g.feedback ?? null,
        // Submitted by the student, or entered directly by staff without a student submission.
        submittedAt: sub.submissionType === 'online' ? sub.submittedAt : null,
        isLate: sub.isLate,
        recording: recordingOf(sub),
        notes: notesOf(sub.metadata),
        by: g.grader
          ? {
              id: g.grader.id,
              name: `${g.grader.firstName} ${g.grader.lastName}`.trim(),
              isAdmin: roleNames.some((r) => ADMIN_ROLES.includes(r)),
            }
          : null,
        student: studentOut(sub.student),
        assessment: assessmentOut(sub.assessment),
      };
    });

    // The latest return entry per attempt; older ones stay in metadata as history.
    const returned = returnedRows
      .map((r) => {
        const history = Array.isArray(((r.metadata as any) || {}).returns) ? ((r.metadata as any).returns as any[]) : [];
        const last = history[history.length - 1];
        return last && last.at ? { r, last } : null;
      })
      .filter((x): x is { r: (typeof returnedRows)[number]; last: any } => !!x && new Date(x.last.at) >= since);

    const returnerIds = Array.from(new Set(returned.map((x) => x.last.by).filter(Boolean))) as string[];
    const returners = returnerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: returnerIds } },
          select: {
            id: true, firstName: true, lastName: true,
            userRoles: { select: { role: { select: { name: true } } } },
          },
        })
      : [];
    const returnerById = new Map(returners.map((u) => [u.id, u]));

    const returnedItems = returned.map(({ r, last }) => {
      const u = last.by ? returnerById.get(last.by) : undefined;
      const roleNames = (u?.userRoles || []).map((ur: any) => ur.role?.name).filter(Boolean) as string[];
      return {
        status: 'returned' as const,
        submissionId: r.id,
        at: new Date(last.at),
        score: null as number | null,
        maxScore: toNum(r.assessment.totalPoints),
        percentage: null as number | null,
        feedback: (last.note as string | null) ?? null,
        submittedAt: r.submittedAt,
        isLate: r.isLate,
        recording: recordingOf(r),
        notes: notesOf(r.metadata),
        by: u
          ? { id: u.id, name: `${u.firstName} ${u.lastName}`.trim(), isAdmin: roleNames.some((x) => ADMIN_ROLES.includes(x)) }
          : null,
        student: studentOut(r.student),
        assessment: assessmentOut(r.assessment),
      };
    });

    const all = [...marked, ...returnedItems].sort((x, y) => y.at.getTime() - x.at.getTime());
    return { days: window, truncated: all.length > LIMIT, items: all.slice(0, LIMIT) };
  }

  /**
   * Admin: discard a pending submission and put the student back to "not yet submitted".
   * Nothing is hard-deleted: the discarded attempt is archived (status 'superseded', flagged
   * as admin-discarded) so it never counts against the student's attempts, and a fresh open
   * attempt replaces it. Only a submission still awaiting review can be reset.
   */
  async resetPendingSubmission(schoolIdentifier: string, submissionId: string, actor?: Actor) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const sub = await this.prisma.assessmentSubmission.findFirst({
      where: { id: submissionId, status: 'submitted', assessment: { schoolId, deletedAt: null } },
      include: { assessment: { select: { id: true, title: true, titleAr: true, schoolId: true } } },
    });
    if (!sub) throw new BadRequestException('This submission is no longer awaiting review');

    const meta = ((sub.metadata as any) || {}) as Record<string, any>;
    const fresh = await this.prisma.$transaction(async (tx) => {
      await tx.assessmentSubmission.update({
        where: { id: sub.id },
        data: {
          status: 'superseded',
          metadata: { ...meta, discardedByAdmin: { at: new Date().toISOString(), by: actor?.id ?? null } },
        },
      });
      return tx.assessmentSubmission.create({
        data: {
          assessmentId: sub.assessmentId,
          studentId: sub.studentId,
          submissionType: 'online',
          status: 'assigned',
          attemptNumber: sub.attemptNumber,
        },
      });
    });

    await this.audit.log({
      schoolId: sub.assessment.schoolId,
      userId: actor?.id,
      action: 'assessment.reset',
      entityType: 'assessment_submission',
      entityId: sub.id,
      oldValues: { status: 'submitted' },
      newValues: { status: 'assigned', newSubmissionId: fresh.id, assessmentId: sub.assessmentId, studentId: sub.studentId },
    }).catch(() => undefined);

    await this.studentNotifications.notifyOrRefresh({
      studentId: sub.studentId,
      type: 'assessment_reset',
      title: 'Your assessment was reset',
      titleAr: 'تمت إعادة ضبط تقييمك',
      body: `${sub.assessment.title} — please submit it again`,
      bodyAr: `${sub.assessment.titleAr ?? sub.assessment.title} — يرجى تسليمه مرة أخرى`,
      linkPath: '?tab=assessments',
      referenceType: 'assessment_submission',
      referenceId: fresh.id,
    }).catch(() => undefined);

    return { reset: true, newSubmissionId: fresh.id };
  }

  async getPendingReviewCount(schoolIdentifier: string, actor?: Actor) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const scope = await this.reviewStudentScope(actor);
    if (!scope) return { count: 0, oldestSubmittedAt: null };

    const where = {
      status: 'submitted',
      assessment: { schoolId, deletedAt: null },
      student: { deletedAt: null, ...scope },
    };
    const [count, oldest] = await Promise.all([
      this.prisma.assessmentSubmission.count({ where }),
      this.prisma.assessmentSubmission.findFirst({ where, orderBy: { submittedAt: 'asc' }, select: { submittedAt: true } }),
    ]);
    return { count, oldestSubmittedAt: oldest?.submittedAt ?? null };
  }

  /**
   * Accept the automatic score as the final mark for many submissions at once. Anything
   * containing an essay is refused (it needs a human), and each id is reported separately
   * so one bad row never blocks the rest.
   */
  async acceptAutoScores(schoolIdentifier: string, submissionIds: string[], actor?: Actor) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const ids = Array.from(new Set(submissionIds)).slice(0, 100);
    const results: { submissionId: string; ok: boolean; score?: number; error?: string }[] = [];

    for (const id of ids) {
      try {
        const sub = await this.prisma.assessmentSubmission.findFirst({
          where: { id, status: 'submitted', assessment: { schoolId, deletedAt: null } },
          include: {
            assessment: { select: { id: true, totalPoints: true, questions: { select: { type: true } } } },
            grades: true,
          },
        });
        if (!sub) {
          results.push({ submissionId: id, ok: false, error: 'Not awaiting review' });
          continue;
        }
        if (sub.assessment.questions.some((q) => q.type === 'essay')) {
          results.push({ submissionId: id, ok: false, error: 'Contains an essay — needs manual marking' });
          continue;
        }
        if (sub.fileUrl || sub.assessment.questions.length === 0) {
          results.push({ submissionId: id, ok: false, error: 'Has a recording or no auto-graded questions — needs manual marking' });
          continue;
        }
        const score = sub.grades
          .filter((g) => g.questionId !== null)
          .reduce((sum, g) => sum + Number(g.score.toString()), 0);
        await this.markStudent(
          sub.assessmentId, sub.studentId, score, Number(sub.assessment.totalPoints.toString()),
          undefined, actor?.id ?? null, { actor, viaAutoAccept: true },
        );
        results.push({ submissionId: id, ok: true, score });
      } catch (err: any) {
        results.push({ submissionId: id, ok: false, error: err?.message || 'Failed' });
      }
    }
    return { accepted: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  }

  /**
   * Send a submitted attempt back to the student to redo, without deleting anything the
   * way unassignStudent does. The student is notified with the reviewer's note.
   */
  async returnSubmission(assessmentId: string, studentId: string, note?: string, actor?: Actor) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deletedAt) throw new NotFoundException('Assessment not found');

    const submission = await this.liveSubmission(assessmentId, studentId);
    if (!submission) throw new NotFoundException('Student not assigned to this assessment');
    if (submission.status !== 'submitted') {
      throw new BadRequestException('Only a submitted attempt awaiting review can be returned');
    }

    const meta = ((submission.metadata as any) || {}) as Record<string, any>;
    const history = Array.isArray(meta.returns) ? meta.returns : [];
    const updated = await this.prisma.assessmentSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'assigned',
        metadata: {
          ...meta,
          returns: [...history, { at: new Date().toISOString(), by: actor?.id ?? null, note: note || null }],
        },
      },
    });

    await this.audit.log({
      schoolId: assessment.schoolId,
      userId: actor?.id,
      action: 'assessment.return',
      entityType: 'assessment_submission',
      entityId: submission.id,
      newValues: { assessmentId, studentId, note: note || null },
    }).catch(() => undefined);

    await this.studentNotifications.notifyOrRefresh({
      studentId,
      type: 'assessment_returned',
      title: 'Your assessment was returned',
      titleAr: 'تمت إعادة تقييمك إليك',
      body: note ? `${assessment.title} — ${note}` : `${assessment.title} — please review and submit again`,
      bodyAr: note ? `${assessment.titleAr ?? assessment.title} — ${note}` : `${assessment.titleAr ?? assessment.title} — يرجى المراجعة والتسليم مرة أخرى`,
      linkPath: '?tab=assessments',
      referenceType: 'assessment_submission',
      referenceId: submission.id,
    }).catch(() => undefined);

    return updated;
  }

  /** Backlog and turnaround per group and per marker (admin overview). */
  async getReviewStats(schoolIdentifier: string, days = 90) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const since = new Date(Date.now() - days * 86_400_000);
    const toNum = (v: any) => (v == null ? 0 : typeof v === 'number' ? v : Number(v.toString()));

    const [pending, completed] = await Promise.all([
      this.prisma.assessmentSubmission.findMany({
        where: { status: 'submitted', assessment: { schoolId, deletedAt: null }, student: { deletedAt: null } },
        select: { submittedAt: true, student: { select: { group: { select: { id: true, name: true } } } } },
      }),
      this.prisma.assessmentSubmission.findMany({
        where: {
          status: 'completed',
          submissionType: 'online',
          assessment: { schoolId, deletedAt: null },
          grades: { some: { questionId: null, gradedAt: { gte: since } } },
        },
        select: {
          submittedAt: true,
          student: { select: { group: { select: { id: true, name: true } } } },
          grades: {
            where: { questionId: null },
            select: {
              gradedAt: true,
              grader: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    type G = { groupId: string; groupName: string; pending: number; oldestPendingAt: Date | null; completed: number; totalHours: number };
    const groups = new Map<string, G>();
    const bucket = (g?: { id: string; name: string } | null): G => {
      const key = g?.id ?? 'none';
      if (!groups.has(key)) {
        groups.set(key, { groupId: key, groupName: g?.name ?? '—', pending: 0, oldestPendingAt: null, completed: 0, totalHours: 0 });
      }
      return groups.get(key)!;
    };

    for (const p of pending) {
      const b = bucket(p.student?.group);
      b.pending += 1;
      if (!b.oldestPendingAt || p.submittedAt < b.oldestPendingAt) b.oldestPendingAt = p.submittedAt;
    }

    const markers = new Map<string, { userId: string; name: string; completed: number; totalHours: number }>();
    for (const c of completed) {
      const grade = c.grades[0];
      if (!grade) continue;
      const hours = Math.max(0, (grade.gradedAt.getTime() - c.submittedAt.getTime()) / 3_600_000);
      const b = bucket(c.student?.group);
      b.completed += 1;
      b.totalHours += hours;
      if (grade.grader) {
        const key = grade.grader.id;
        const m = markers.get(key) ?? {
          userId: key, name: `${grade.grader.firstName} ${grade.grader.lastName}`.trim(), completed: 0, totalHours: 0,
        };
        m.completed += 1;
        m.totalHours += hours;
        markers.set(key, m);
      }
    }

    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      days,
      totalPending: pending.length,
      groups: Array.from(groups.values())
        .map((g) => ({
          groupId: g.groupId, groupName: g.groupName, pending: g.pending,
          oldestPendingAt: g.oldestPendingAt, completed: g.completed,
          avgTurnaroundHours: g.completed ? round(g.totalHours / g.completed) : null,
        }))
        .sort((a, b) => b.pending - a.pending),
      markers: Array.from(markers.values())
        .map((m) => ({
          userId: m.userId, name: m.name, completed: m.completed,
          avgTurnaroundHours: m.completed ? round(m.totalHours / m.completed) : null,
        }))
        .sort((a, b) => b.completed - a.completed),
    };
  }

  /** Tell the student's own servants (same group) that work is waiting. Never fails a submission. */
  private async notifyReviewers(assessment: { id: string; schoolId: string; title: string; titleAr: string | null }, studentId: string, submissionId: string, skipUserId?: string) {
    try {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { firstName: true, lastName: true, groupId: true },
      });
      if (!student?.groupId) return;
      const users = await this.prisma.user.findMany({
        where: {
          schoolId: assessment.schoolId,
          deletedAt: null,
          isActive: true,
          userRoles: { some: { role: { name: { in: REVIEWER_ROLES } } } },
        },
        select: { id: true, metadata: true },
      });
      const reviewers = users.filter((u) => ((u.metadata as any) || {}).groupId === student.groupId && u.id !== skipUserId);
      const name = `${student.firstName} ${student.lastName}`.trim();
      for (const r of reviewers) {
        await this.prisma.notification.upsert({
          where: {
            schoolId_userId_type_referenceId: {
              schoolId: assessment.schoolId, userId: r.id, type: 'assessment_submitted', referenceId: submissionId,
            },
          },
          create: {
            schoolId: assessment.schoolId, userId: r.id, type: 'assessment_submitted',
            title: 'Assessment waiting for review', titleAr: 'تقييم بانتظار المراجعة',
            body: `${name} submitted ${assessment.title}`.slice(0, 500),
            bodyAr: `${name} سلّم ${assessment.titleAr ?? assessment.title}`.slice(0, 500),
            channel: 'in_app', linkPath: '/dashboard/assessments/pending-review',
            referenceType: 'assessment_submission', referenceId: submissionId,
          },
          update: { isRead: false, readAt: null, createdAt: new Date() },
        });
      }
    } catch (err) {
      console.error('notifyReviewers failed', err);
    }
  }

  async getSubmissions(assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }

    return this.prisma.assessmentSubmission.findMany({
      where: { assessmentId, status: { not: 'superseded' } },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
        grades: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getTakeQuestions(assessmentId: string, studentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
        subject: { select: { id: true, name: true, nameAr: true } },
        lesson: { select: { subjectItem: { select: { hazzat: true, presentationUrl: true } } } },
      },
    });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.status !== 'published') {
      throw new BadRequestException('Assessment is not open for submission');
    }

    const submission = await this.liveSubmission(assessmentId, studentId);
    if (!submission) {
      throw new BadRequestException('This student is not assigned to this assessment');
    }
    if (['submitted', 'completed'].includes(submission.status)) {
      throw new BadRequestException('This student has already submitted this assessment');
    }

    const metadata = (assessment.metadata as any) || {};
    return {
      assessment: {
        id: assessment.id,
        title: assessment.title,
        titleAr: assessment.titleAr,
        type: assessment.type,
        subject: assessment.subject,
        totalPoints: Number(assessment.totalPoints),
        passingScore: Number(assessment.passingScore),
        dueDate: assessment.dueDate,
        durationMinutes: metadata.durationMinutes ?? null,
        referenceRecordingUrl: assessment.referenceRecordingUrl ?? null,
        referenceRecordingName: assessment.referenceRecordingName ?? null,
        hazzat: assessment.lesson?.subjectItem?.hazzat ?? null,
        presentationUrl: assessment.lesson?.subjectItem?.presentationUrl ?? null,
      },
      questions: assessment.questions.map((q: any) => ({
        id: q.id,
        text: q.questionText,
        type: q.type,
        options: q.options || null,
        points: Number(q.points),
        orderIndex: q.orderIndex,
      })),
    };
  }

  async assignStudents(assessmentId: string, studentIds: string[]) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }

    const existing = await this.prisma.assessmentSubmission.findMany({
      where: { assessmentId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map(s => s.studentId));

    const toCreate = studentIds
      .filter(id => !existingIds.has(id))
      .map(studentId => ({
        assessmentId,
        studentId,
        submissionType: 'assigned',
        status: 'assigned',
      }));

    if (toCreate.length > 0) {
      await this.prisma.assessmentSubmission.createMany({ data: toCreate });
    }

    return { assigned: toCreate.length, skipped: studentIds.length - toCreate.length };
  }

  async unassignStudent(assessmentId: string, studentId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }
    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { assessmentId, studentId },
    });
    if (!submission) {
      throw new NotFoundException('Student not assigned to this assessment');
    }
    await this.prisma.grade.deleteMany({ where: { submissionId: submission.id } });
    await this.prisma.assessmentSubmission.delete({ where: { id: submission.id } });
    return { message: 'Student unassigned' };
  }

  async reassessStudent(assessmentId: string, studentId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }
    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { assessmentId, studentId },
    });
    if (!submission) {
      throw new NotFoundException('Student not assigned to this assessment');
    }
    await this.prisma.grade.deleteMany({ where: { submissionId: submission.id } });
    await this.prisma.xPTransaction.deleteMany({
      where: { referenceType: 'submission', referenceId: submission.id },
    });
    return this.prisma.assessmentSubmission.update({
      where: { id: submission.id },
      data: { status: 'assigned' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
        grades: true,
      },
    });
  }

  async markStudent(
    assessmentId: string,
    studentId: string,
    score: number,
    maxScore: number,
    feedback?: string,
    gradedBy?: string | null,
    opts?: { questionScores?: QuestionScore[]; extraScore?: number; actor?: Actor; viaAutoAccept?: boolean },
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      ...(opts?.questionScores?.length ? { include: { questions: true } } : {}),
    });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
    }

    // Per-question scores: the overall mark is their sum, never a number typed separately.
    const questionScores = opts?.questionScores?.length ? opts.questionScores : null;
    if (questionScores) {
      const questions: any[] = (assessment as any).questions || [];
      const seen = new Set<string>();
      let sum = 0;
      for (const qs of questionScores) {
        const q = questions.find((x) => x.id === qs.questionId);
        if (!q) throw new BadRequestException('Unknown question in questionScores');
        if (seen.has(qs.questionId)) throw new BadRequestException('Duplicate question in questionScores');
        seen.add(qs.questionId);
        if (qs.score < 0 || qs.score > Number(q.points)) {
          throw new BadRequestException(`Score for a question cannot exceed its ${Number(q.points)} points`);
        }
        sum += qs.score;
      }
      score = Math.round((sum + (opts?.extraScore ?? 0)) * 100) / 100;
    } else if (opts?.extraScore !== undefined) {
      // Nothing to score per question (oral / recording-only): the marker's score is the mark.
      score = opts.extraScore;
    }

    const total = Number(assessment.totalPoints);
    if (maxScore <= 0) {
      throw new BadRequestException('maxScore must be greater than zero');
    }
    if (score < 0 || score > maxScore) {
      throw new BadRequestException('score cannot exceed maxScore');
    }
    if (Number(maxScore) > total) {
      throw new BadRequestException('maxScore cannot exceed the assessment total');
    }

    let submission = await this.liveSubmission(assessmentId, studentId);

    if (!submission) {
      submission = await this.prisma.assessmentSubmission.create({
        data: { assessmentId, studentId, submissionType: 'manual', status: 'completed' },
      });
    } else {
      submission = await this.prisma.assessmentSubmission.update({
        where: { id: submission.id },
        data: { status: 'completed' },
      });
    }

    if (!gradedBy) {
      const adminUser = await this.prisma.user.findFirst({ where: { deletedAt: null }, select: { id: true } });
      gradedBy = adminUser?.id || null;
    }

    if (questionScores) {
      for (const qs of questionScores) {
        const q = ((assessment as any).questions as any[]).find((x) => x.id === qs.questionId);
        const existingQ = await this.prisma.grade.findFirst({
          where: { submissionId: submission.id, questionId: qs.questionId },
        });
        if (existingQ) {
          await this.prisma.grade.update({
            where: { id: existingQ.id },
            data: { score: qs.score, maxScore: Number(q.points), gradedBy },
          });
        } else {
          await this.prisma.grade.create({
            data: { submissionId: submission.id, questionId: qs.questionId, score: qs.score, maxScore: Number(q.points), gradedBy },
          });
        }
      }
    }

    const existingGrade = await this.prisma.grade.findFirst({
      where: { submissionId: submission.id, questionId: null },
    });

    if (existingGrade) {
      await this.prisma.grade.update({
        where: { id: existingGrade.id },
        data: { score, maxScore, feedback: feedback || null, gradedBy },
      });
    } else {
      await this.prisma.grade.create({
        data: {
          submissionId: submission.id,
          questionId: null,
          score,
          maxScore,
          feedback: feedback || null,
          gradedBy,
        },
      });
    }

    // Credit XP for the scored mark (update existing or create new)
    const xpAmount = Math.round((Number(score) / Number(maxScore)) * 100);
    const existingXp = await this.prisma.xPTransaction.findFirst({
      where: { referenceType: 'submission', referenceId: submission.id },
    });
    const xpWhere: any = { studentId };
    if (existingXp) xpWhere.id = { not: existingXp.id };
    const currentBalance = await this.prisma.xPTransaction.aggregate({
      where: xpWhere,
      _sum: { amount: true },
    });
    const balanceAfter = (currentBalance._sum.amount || 0) + xpAmount;
    let lessonLabel = '';
    if (assessment.lessonId) {
      const lesson = await this.prisma.lesson.findUnique({ where: { id: assessment.lessonId }, select: { title: true } });
      if (lesson) lessonLabel = ` · ${lesson.title}`;
    }
    const xpDesc = `Assessment mark: ${score}/${maxScore}${lessonLabel}`;
    if (existingXp) {
      await this.prisma.xPTransaction.update({
        where: { id: existingXp.id },
        data: { amount: xpAmount, balanceAfter, description: xpDesc },
      });
    } else {
      await this.prisma.xPTransaction.create({
        data: {
          studentId,
          amount: xpAmount,
          balanceAfter,
          type: 'assessment',
          referenceType: 'submission',
          referenceId: submission.id,
          description: xpDesc,
        },
      });
    }

    // Who marked, and whether an admin did it in place of the servant, must be traceable.
    await this.audit.log({
      schoolId: assessment.schoolId,
      userId: gradedBy ?? undefined,
      action: 'assessment.mark',
      entityType: 'assessment_submission',
      entityId: submission.id,
      newValues: { assessmentId, studentId, score, maxScore, perQuestion: !!questionScores },
      metadata: {
        markedByAdmin: this.isAdminActor(opts?.actor),
        viaAutoAccept: !!opts?.viaAutoAccept,
      },
    }).catch(() => undefined);

    // Grading was pull-only: a student had to reopen the assessment to discover a mark.
    // notifyOrRefresh rather than notify, so a re-grade updates the message and shows as
    // unread again instead of being silently swallowed as a duplicate.
    await this.studentNotifications.notifyOrRefresh({
      studentId,
      type: 'assessment_graded',
      title: 'Your assessment was marked',
      titleAr: 'تم تصحيح تقييمك',
      body: `${assessment.title} — ${score}/${maxScore}`,
      bodyAr: `${assessment.titleAr ?? assessment.title} — ${score}/${maxScore}`,
      linkPath: '?tab=assessments',
      referenceType: 'assessment_submission',
      referenceId: submission.id,
    });

    return this.prisma.assessmentSubmission.findUnique({
      where: { id: submission.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
        grades: true,
      },
    });
  }

  async getStudentsForAssessment(assessmentId: string, gradeId?: string) {
    try {
      const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
      if (!assessment || assessment.deletedAt) {
        throw new NotFoundException('Assessment not found');
      }

      const students = await this.prisma.student.findMany({
        where: {
          schoolId: assessment.schoolId,
          deletedAt: null,
          levelId: assessment.levelId,
          ...(assessment.groupId ? { groupId: assessment.groupId } : {}),
          ...(gradeId ? { gradeId } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentCode: true,
          grade: { select: { name: true } },
          status: true,
        },
        orderBy: { firstName: 'asc' },
      });

      // Superseded attempts must not shadow the live one in this map.
      const submissions = await this.prisma.assessmentSubmission.findMany({
        where: { assessmentId, status: { not: 'superseded' } },
        include: { grades: { include: { grader: { select: { firstName: true, lastName: true } } } } },
        orderBy: [{ attemptNumber: 'asc' }, { createdAt: 'asc' }],
      });
      const submissionByStudent = new Map(submissions.map(s => [s.studentId, s]));

      const toNum = (v: any) => (v == null ? 0 : typeof v === 'number' ? v : Number(v.toString()));

      return students.map(s => {
        const sub = submissionByStudent.get(s.id);
        const overall = sub?.grades?.find(g => g.questionId === null);
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentCode: s.studentCode,
          gradeName: s.grade?.name ?? null,
          status: s.status,
          assigned: !!sub,
          submissionStatus: sub?.status || null,
          mark: overall ? toNum(overall.score) : null,
          maxMark: overall ? toNum(overall.maxScore) : toNum(assessment.totalPoints),
          submittedAt: sub && sub.status !== 'assigned' ? sub.submittedAt : null,
          markedBy: overall?.grader ? `${overall.grader.firstName} ${overall.grader.lastName}`.trim() : null,
          markedAt: overall ? overall.gradedAt : null,
        };
      });
    } catch (err) {
      console.error('getStudentsForAssessment failed', err);
      return [];
    }
  }

  async getStats(schoolId: string) {
    const resolvedId = await this.schoolResolver.resolve(schoolId);
    const where = { schoolId: resolvedId, deletedAt: null } as any;

    const [total, byStatus] = await Promise.all([
      this.prisma.assessment.count({ where }),
      this.prisma.assessment.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
    ]);

    const submissions = await this.prisma.assessmentSubmission.findMany({
      where: { assessment: where, status: 'completed' },
      include: {
        grades: { where: { questionId: null } },
        assessment: { select: { passingScore: true, title: true, id: true } },
      },
    });

    const gradedCount = submissions.length;
    let passCount = 0;
    for (const sub of submissions) {
      const grade = sub.grades[0];
      if (grade && Number(grade.score) >= Number(sub.assessment.passingScore)) passCount++;
    }
    const passRate = gradedCount > 0 ? Math.round((passCount / gradedCount) * 100) : 0;
    const scores = submissions.map(s => (s.grades[0] ? Number(s.grades[0].score) : 0)).filter(s => s > 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return {
      total,
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
      grading: { gradedCount, passCount, passRate, avgScore },
    };
  }

  async getSubmissionReview(submissionId: string, studentId: string, assessmentId: string) {
    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { id: submissionId, studentId, assessmentId },
      include: {
        assessment: {
          select: {
            id: true, title: true, titleAr: true, type: true, totalPoints: true, passingScore: true,
            questions: { orderBy: { orderIndex: 'asc' } },
          },
        },
        grades: { include: { question: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const answers = JSON.parse(submission.submissionContent || '[]') as any[];

    // A servant's overall mark is stored as a grade row with a null questionId. Where it
    // exists it is authoritative for the submission as a whole — summing it alongside the
    // per-question auto-grades double-counts and can push the score past 100%.
    const overallGrade = submission.grades.find(g => g.questionId === null);
    const totalScore = overallGrade
      ? Number(overallGrade.score)
      : submission.grades
          .filter(g => g.questionId !== null)
          .reduce((sum, g) => sum + Number(g.score), 0);
    const maxScore = overallGrade
      ? Number(overallGrade.maxScore)
      : Number(submission.assessment.totalPoints);

    // Marking is only finished at 'completed'. Until then the answer key must stay shut:
    // this endpoint is reachable directly with a known submission id, so a student could
    // otherwise read the answers off a previous attempt and then re-take.
    const gradingComplete = submission.status === 'completed';

    return {
      submission: {
        id: submission.id,
        submittedAt: submission.submittedAt,
        status: submission.status,
        fileUrl: submission.fileUrl,
        durationSeconds: submission.durationSeconds,
        isLate: submission.isLate,
      },
      assessment: {
        id: submission.assessment.id,
        title: submission.assessment.title,
        titleAr: submission.assessment.titleAr,
        type: submission.assessment.type,
        totalPoints: maxScore,
        passingScore: Number(submission.assessment.passingScore),
      },
      grade: {
        gradingComplete,
        earned: gradingComplete ? totalScore : null,
        max: maxScore,
        percentage: gradingComplete && maxScore > 0
          ? Math.min(100, Math.round((totalScore / maxScore) * 100))
          : null,
        passed: gradingComplete
          ? totalScore >= Number(submission.assessment.passingScore)
          : null,
      },
      questions: submission.assessment.questions.map((q: any) => {
        const grade = submission.grades.find(g => g.questionId === q.id);
        const answer = answers.find(a => a.questionId === q.id);
        return {
          id: q.id,
          text: q.questionText,
          type: q.type,
          options: q.options || null,
          points: Number(q.points),
          studentAnswer: answer?.answer || null,
          correctAnswer: gradingComplete && q.type !== 'essay' ? q.correctAnswer : null,
          isCorrect: gradingComplete && grade ? Number(grade.score) === Number(grade.maxScore) : null,
          score: gradingComplete && grade ? Number(grade.score) : null,
          maxScore: grade ? Number(grade.maxScore) : null,
          feedback: grade?.feedback || null,
          feedbackAr: grade?.feedbackAr || null,
        };
      }),
      metadata: submission.metadata,
    };
  }

  async prepareRetake(assessmentId: string, studentId: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });
    if (!assessment || assessment.deletedAt) throw new NotFoundException('Assessment not found');
    if (assessment.status !== 'published') throw new BadRequestException('Assessment is not open');

    const existing = await this.liveSubmission(assessmentId, studentId);
    if (!existing) throw new BadRequestException('Student not assigned to this assessment');

    // Check if has essay questions (not retakeable)
    const hasEssay = assessment.questions.some(q => q.type === 'essay');
    if (hasEssay) throw new BadRequestException('Cannot retake assessments with essay questions');

    // Grading is in progress while the attempt sits at 'submitted' and no servant has
    // marked it completed. The previous test — `grades.some(g => g.score === null)` —
    // could never fire: Grade.score is a non-nullable Decimal.
    if (existing.status === 'submitted') {
      throw new BadRequestException('Cannot retake while grading is in progress');
    }

    // An untaken attempt is already open; handing back a second one would strand a row.
    if (existing.status === 'assigned') {
      return {
        newSubmissionId: existing.id,
        attemptNumber: existing.attemptNumber,
        attemptsRemaining: assessment.maxAttempts === null
          ? null
          : Math.max(0, assessment.maxAttempts - existing.attemptNumber),
        message: 'Ready to retake. You can now access the assessment again.',
      };
    }

    // An attempt an admin discarded was never the student's to use, so it must not count.
    const priorAttempts = await this.prisma.assessmentSubmission.findMany({
      where: { assessmentId, studentId },
      select: { metadata: true },
    });
    const attemptsUsed = priorAttempts.filter((a) => !((a.metadata as any) || {}).discardedByAdmin).length;
    if (assessment.maxAttempts !== null && attemptsUsed >= assessment.maxAttempts) {
      throw new BadRequestException(
        `No attempts remaining — this assessment allows ${assessment.maxAttempts}.`,
      );
    }

    // Archive the attempt being replaced and open the next one atomically, so a student
    // never holds two live rows. The prior attempt is retained, as the dialog promises.
    const newSubmission = await this.prisma.$transaction(async (tx) => {
      await tx.assessmentSubmission.update({
        where: { id: existing.id },
        data: { status: 'superseded' },
      });
      return tx.assessmentSubmission.create({
        data: {
          assessmentId,
          studentId,
          submissionType: 'online',
          status: 'assigned',
          attemptNumber: existing.attemptNumber + 1,
        },
      });
    });

    return {
      newSubmissionId: newSubmission.id,
      attemptNumber: newSubmission.attemptNumber,
      attemptsRemaining: assessment.maxAttempts === null
        ? null
        : Math.max(0, assessment.maxAttempts - newSubmission.attemptNumber),
      message: 'Ready to retake. You can now access the assessment again.',
    };
  }

  private validateQuestions(questions: CreateQuestionDto[], totalPoints: number) {
    const sum = questions.reduce((a, q) => a + q.points, 0);
    if (sum > totalPoints) {
      throw new BadRequestException(`Question points (${sum}) exceed total points (${totalPoints})`);
    }
    for (const q of questions) {
      if (q.type === 'multiple_choice') {
        const opts = Array.isArray(q.options) ? q.options.map(String) : [];
        if (opts.some(o => !o || !String(o).trim())) {
          throw new BadRequestException('Multiple-choice options cannot be empty');
        }
        if (q.correctAnswer && !opts.includes(String(q.correctAnswer))) {
          throw new BadRequestException('Correct answer must be one of the options');
        }
      }
    }
  }
}

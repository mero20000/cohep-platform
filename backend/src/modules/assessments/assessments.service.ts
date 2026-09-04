import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';
import { CreateAssessmentDto, UpdateAssessmentDto, SubmitAssessmentDto, CreateQuestionDto } from './dto/assessment.dto';

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

    await this.prisma.assessment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

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

    // Due dates were displayed but never enforced: isLate was never written and
    // allowLateSubmission was never read. Stamp the one, honour the other.
    const isLate = !!(assessment.dueDate && new Date() > assessment.dueDate);
    if (isLate && !assessment.allowLateSubmission) {
      throw new BadRequestException(
        'The due date for this assessment has passed and late submissions are not allowed',
      );
    }

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
          ...(dto.notes ? { metadata: { notes: dto.notes } } : {}),
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

    return this.prisma.assessmentSubmission.findUnique({
      where: { id: submission.id },
      include: {
        grades: true,
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
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

  async markStudent(assessmentId: string, studentId: string, score: number, maxScore: number, feedback?: string, gradedBy?: string | null) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.deletedAt) {
      throw new NotFoundException('Assessment not found');
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
        include: { grades: true },
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

    const attemptsUsed = await this.prisma.assessmentSubmission.count({
      where: { assessmentId, studentId },
    });
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

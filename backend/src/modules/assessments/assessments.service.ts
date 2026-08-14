import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { CreateAssessmentDto, UpdateAssessmentDto, SubmitAssessmentDto } from './dto/assessment.dto';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private schoolResolver: SchoolResolver,
  ) {}

  async findAll(schoolIdentifier: string, filters: {
    page?: number;
    limit?: number;
    levelId?: string;
    subjectId?: string;
    status?: string;
  }) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const { page = 1, limit = 20, levelId, subjectId, status } = filters;

    const where: any = { schoolId, deletedAt: null };
    if (levelId) where.levelId = levelId;
    if (subjectId) where.subjectId = subjectId;
    if (status) where.status = status;

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
      type: 'general',
      totalPoints: dto.totalPoints,
      passingScore: dto.passingPoints,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: dto.status || 'draft',
      createdBy: adminUser?.id || '00000000-0000-0000-0000-000000000000',
      metadata: {
        academicYearId: dto.academicYearId,
        term: dto.term,
        grade: dto.grade || null,
      },
    };

    if (dto.questions && dto.questions.length > 0) {
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

    if (dto.academicYearId !== undefined || dto.term !== undefined || dto.grade !== undefined) {
      const metadata = (existing.metadata as any) || {};
      if (dto.academicYearId !== undefined) metadata.academicYearId = dto.academicYearId;
      if (dto.term !== undefined) metadata.term = dto.term;
      if (dto.grade !== undefined) metadata.grade = dto.grade || null;
      data.metadata = metadata;
    }

    if (dto.questions !== undefined) {
      await this.prisma.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
      if (dto.questions.length > 0) {
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

  async submit(assessmentId: string, studentId: string, dto: SubmitAssessmentDto) {
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

    const submission = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.assessmentSubmission.create({
        data: {
          assessmentId,
          studentId,
          submissionType: 'online',
          submissionContent: JSON.stringify(dto.answers),
          status: 'submitted',
        },
      });

      const gradeData = dto.answers
        .map((answer) => {
          const question = assessment.questions.find(q => q.id === answer.questionId);
          if (!question) return null;
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
      where: { assessmentId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
        grades: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
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

    let submission = await this.prisma.assessmentSubmission.findFirst({
      where: { assessmentId, studentId },
    });

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

      const submissions = await this.prisma.assessmentSubmission.findMany({
        where: { assessmentId },
        include: { grades: true },
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
}

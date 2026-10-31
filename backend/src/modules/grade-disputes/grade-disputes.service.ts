import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';
import { AccessScopeService } from '../../common/access-scope.service';

/** `reason` and `response` are VarChar(500) columns. */
const MAX_TEXT = 500;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new BadRequestException(`${field} is required`);
  if (value.length > MAX_TEXT) throw new BadRequestException(`${field} must be at most ${MAX_TEXT} characters`);
  return value;
}

@Injectable()
export class GradeDisputesService {
  private readonly logger = new Logger(GradeDisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentNotifications: StudentNotificationsService,
    private readonly access: AccessScopeService,
  ) {}

  /** `user` is the caller (`req.user`); the submission must be one of their school's and their students'. */
  async createDispute(data: { user: any; submissionId: string; reason: string }) {
    const reason = requiredText(data.reason, 'reason');
    const actor = await this.access.loadActor(data.user);

    const submission = await this.prisma.assessmentSubmission.findUnique({
      where: { id: data.submissionId },
      include: { grades: true, student: true, assessment: { select: { schoolId: true } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    // Another school's submission, or a student outside the caller's group, does not exist for them.
    this.access.assertInSchool(actor, submission.assessment, 'Submission');
    await this.access.assertStudent(actor, submission.studentId);

    // Access control: students can only dispute their own submissions
    const requester = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: { userRoles: { select: { role: { select: { name: true } } } } },
    });
    const isStudent = requester?.userRoles?.some((ur: any) => ur.role?.name === 'student');
    if (isStudent && submission.studentId !== actor.id) {
      throw new ForbiddenException('You can only dispute your own submissions');
    }

    const grade = submission.grades[0];
    if (!grade) throw new BadRequestException('No grade found for this submission');

    // Duplicate prevention: block if there's already a pending dispute for this submission
    const existingDispute = await this.prisma.gradeDispute.findFirst({
      where: { submissionId: data.submissionId, status: 'pending' },
    });
    if (existingDispute) {
      throw new BadRequestException('A pending dispute already exists for this submission');
    }

    return this.prisma.gradeDispute.create({
      data: {
        schoolId: submission.assessment.schoolId,
        submissionId: data.submissionId,
        gradeId: grade.id,
        requestedById: actor.id,
        reason,
      },
      include: {
        submission: { include: { student: true, assessment: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listDisputes(user: any, opts?: { status?: string; requestedById?: string; limit?: number }) {
    const actor = await this.access.loadActor(user);
    const take = Math.min(Math.max(Number(opts?.limit) || 50, 1), 100);
    return this.prisma.gradeDispute.findMany({
      where: {
        ...this.disputeScope(actor),
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.requestedById ? { requestedById: opts.requestedById } : {}),
      },
      include: {
        submission: { include: { student: true, assessment: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        respondedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async respondToDispute(id: string, data: { user: any; response: string; newScore?: number }) {
    const response = requiredText(data.response, 'response');
    const actor = await this.access.loadActor(data.user);

    const dispute = await this.prisma.gradeDispute.findUnique({
      where: { id },
      include: { submission: { include: { student: true, grades: true } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    this.access.assertInSchool(actor, dispute, 'Dispute');
    await this.access.assertStudent(actor, dispute.submission.studentId);
    if (dispute.status === 'responded') throw new BadRequestException('Dispute already responded to');

    // The grade this dispute is about, and the most it can be raised to.
    const grade = dispute.submission.grades.find((g) => g.id === dispute.gradeId) ?? dispute.submission.grades[0];
    let newScore: number | undefined;
    if (data.newScore !== undefined && data.newScore !== null) {
      newScore = Number(data.newScore);
      const max = grade ? Number(grade.maxScore.toString()) : 0;
      if (!Number.isFinite(newScore) || newScore < 0 || newScore > max) {
        throw new BadRequestException(`newScore must be between 0 and ${max}`);
      }
    }

    // Atomic: update dispute + apply new grade in one transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const d = await tx.gradeDispute.update({
        where: { id },
        data: {
          status: 'responded',
          respondedById: actor.id,
          response,
          newScore: newScore ?? undefined,
          respondedAt: new Date(),
        },
        include: {
          submission: { include: { student: true } },
          respondedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Apply new score to the Grade record if provided
      if (newScore !== undefined && grade) {
        await tx.grade.update({
          where: { id: grade.id },
          data: { score: newScore },
        });
      }

      return d;
    });

    // Notify the student that their dispute was responded to
    if (dispute.submission.studentId) {
      await this.studentNotifications.notify({
        studentId: dispute.submission.studentId,
        type: 'grade_dispute_responded',
        title: 'Your grade dispute was reviewed',
        titleAr: 'تمت مراجعة اعتراضك على الدرجة',
        body: response,
        bodyAr: response,
        linkPath: '?tab=assessments',
        referenceType: 'grade_dispute',
        referenceId: id,
      }).catch(() => {});
    }

    return updated;
  }

  async getPendingCount(user: any): Promise<number> {
    const actor = await this.access.loadActor(user);
    return this.prisma.gradeDispute.count({ where: { ...this.disputeScope(actor), status: 'pending' } });
  }

  /** The caller's school, and for an assigned servant only disputes about their own students. */
  private disputeScope(actor: Awaited<ReturnType<AccessScopeService['loadActor']>>) {
    return {
      ...this.access.schoolWhere(actor),
      ...(Object.keys(actor.scope).length > 0 ? { submission: { student: this.access.studentWhere(actor) } } : {}),
    };
  }
}

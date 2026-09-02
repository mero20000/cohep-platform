import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';

@Injectable()
export class GradeDisputesService {
  private readonly logger = new Logger(GradeDisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentNotifications: StudentNotificationsService,
  ) {}

  async createDispute(data: {
    schoolId: string;
    submissionId: string;
    requestedById: string;
    reason: string;
  }) {
    const submission = await this.prisma.assessmentSubmission.findUnique({
      where: { id: data.submissionId },
      include: { grades: true, student: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    // Access control: students can only dispute their own submissions
    const requester = await this.prisma.user.findUnique({ where: { id: data.requestedById }, select: { roles: true } });
    const isStudent = requester?.roles?.includes('student');
    if (isStudent && submission.studentId !== data.requestedById) {
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
        schoolId: data.schoolId,
        submissionId: data.submissionId,
        gradeId: grade.id,
        requestedById: data.requestedById,
        reason: data.reason,
      },
      include: {
        submission: { include: { student: true, assessment: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listDisputes(schoolId: string, opts?: { status?: string; requestedById?: string; limit?: number }) {
    const take = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    return this.prisma.gradeDispute.findMany({
      where: {
        schoolId,
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

  async respondToDispute(id: string, data: { respondedById: string; response: string; newScore?: number }) {
    const dispute = await this.prisma.gradeDispute.findUnique({
      where: { id },
      include: { submission: { include: { student: true, grades: true } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.status === 'responded') throw new BadRequestException('Dispute already responded to');

    // Atomic: update dispute + apply new grade in one transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      const d = await tx.gradeDispute.update({
        where: { id },
        data: {
          status: 'responded',
          respondedById: data.respondedById,
          response: data.response,
          newScore: data.newScore ?? undefined,
          respondedAt: new Date(),
        },
        include: {
          submission: { include: { student: true } },
          respondedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Apply new score to the Grade record if provided
      if (data.newScore !== undefined && dispute.submission.grades[0]) {
        await tx.grade.update({
          where: { id: dispute.submission.grades[0].id },
          data: { score: data.newScore },
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
        body: data.response,
        bodyAr: data.response,
        linkPath: '?tab=assessments',
        referenceType: 'grade_dispute',
        referenceId: id,
      }).catch(() => {});
    }

    return updated;
  }

  async getPendingCount(schoolId: string): Promise<number> {
    return this.prisma.gradeDispute.count({
      where: { schoolId, status: 'pending' },
    });
  }
}

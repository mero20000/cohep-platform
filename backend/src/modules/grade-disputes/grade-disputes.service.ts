import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GradeDisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async createDispute(data: {
    schoolId: string;
    submissionId: string;
    requestedById: string;
    reason: string;
  }) {
    const submission = await this.prisma.assessmentSubmission.findUnique({
      where: { id: data.submissionId },
      include: { grades: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const grade = submission.grades[0];
    if (!grade) throw new BadRequestException('No grade found for this submission');

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
    const dispute = await this.prisma.gradeDispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');

    return this.prisma.gradeDispute.update({
      where: { id },
      data: {
        status: 'responded',
        respondedById: data.respondedById,
        response: data.response,
        newScore: data.newScore ? data.newScore : undefined,
        respondedAt: new Date(),
      },
      include: {
        submission: { include: { student: true } },
        respondedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getPendingCount(schoolId: string): Promise<number> {
    return this.prisma.gradeDispute.count({
      where: { schoolId, status: 'pending' },
    });
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StudentLiturgyAppealsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAppeal(data: {
    schoolId: string;
    studentId: string;
    familyLiturgyId: string;
    appealReason: string;
  }) {
    const liturgy = await this.prisma.familyLiturgy.findUnique({
      where: { id: data.familyLiturgyId },
    });
    if (!liturgy) throw new NotFoundException('Liturgy record not found');

    if (liturgy.status !== 'rejected') {
      throw new BadRequestException('Can only appeal rejected liturgy claims');
    }

    return this.prisma.studentLiturgyAppeal.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        familyLiturgyId: data.familyLiturgyId,
        appealReason: data.appealReason,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        familyLiturgy: true,
      },
    });
  }

  async listAppeals(schoolId: string, opts?: { status?: string; studentId?: string; limit?: number }) {
    const take = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    return this.prisma.studentLiturgyAppeal.findMany({
      where: {
        schoolId,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.studentId ? { studentId: opts.studentId } : {}),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        familyLiturgy: true,
        respondedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async respondToAppeal(id: string, data: { respondedById: string; response: string; newStatus?: string }) {
    const appeal = await this.prisma.studentLiturgyAppeal.findUnique({ where: { id } });
    if (!appeal) throw new NotFoundException('Appeal not found');

    // Update the appeal
    const updated = await this.prisma.studentLiturgyAppeal.update({
      where: { id },
      data: {
        status: 'responded',
        respondedById: data.respondedById,
        response: data.response,
        newStatus: data.newStatus,
        respondedAt: new Date(),
      },
      include: {
        familyLiturgy: true,
        respondedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // If newStatus is set, update the liturgy status
    if (data.newStatus && data.newStatus !== updated.familyLiturgy.status) {
      await this.prisma.familyLiturgy.update({
        where: { id: updated.familyLiturgyId },
        data: { status: data.newStatus },
      });
    }

    return updated;
  }

  async getPendingCount(schoolId: string): Promise<number> {
    return this.prisma.studentLiturgyAppeal.count({
      where: { schoolId, status: 'pending' },
    });
  }
}

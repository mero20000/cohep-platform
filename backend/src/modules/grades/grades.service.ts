import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { CreateGradeDto, UpdateGradeDto } from './dto/grades.dto';

type GradeWithRelations = {
  id: string;
  name: string;
  nameAr: string | null;
  groupId: string;
  orderIndex: number;
  status: string;
  group: { name: string };
  _count: { students: number };
};

@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolResolver: SchoolResolver,
    private readonly audit: AuditService,
  ) {}

  async getGrades(schoolIdentifier: string) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const grades = await this.prisma.schoolGrade.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        group: { select: { id: true, name: true, nameAr: true } },
        _count: { select: { students: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });
    return grades.map((g) => this.toGrade(g));
  }

  async createGrade(schoolIdentifier: string, dto: CreateGradeDto) {
    const schoolId = await this.schoolResolver.resolve(schoolIdentifier);
    const existing = await this.prisma.schoolGrade.findFirst({
      where: { schoolId, name: dto.name.trim(), deletedAt: null },
    });
    if (existing) throw new ConflictException(`Grade "${dto.name}" already exists`);
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw new BadRequestException('Group not found in this school');
    const maxOrder = await this.prisma.schoolGrade.findFirst({
      where: { schoolId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    const grade = await this.prisma.schoolGrade.create({
      data: {
        schoolId,
        name: dto.name.trim(),
        nameAr: dto.nameAr || null,
        groupId: dto.groupId,
        orderIndex: maxOrder ? maxOrder.orderIndex + 1 : 1,
      },
      include: {
        group: { select: { id: true, name: true, nameAr: true } },
        _count: { select: { students: true } },
      },
    });
    await this.audit.log({
      schoolId,
      action: 'CREATE',
      entityType: 'grade',
      entityId: grade.id,
      newValues: { name: grade.name, groupId: grade.groupId, orderIndex: grade.orderIndex },
    });
    return this.toGrade(grade);
  }

  async updateGrade(id: string, dto: UpdateGradeDto) {
    const grade = await this.prisma.schoolGrade.findUnique({ where: { id } });
    if (!grade) throw new NotFoundException('Grade not found');
    if (dto.name !== undefined) {
      const existing = await this.prisma.schoolGrade.findFirst({
        where: { schoolId: grade.schoolId, name: dto.name.trim(), deletedAt: null, id: { not: id } },
      });
      if (existing) throw new ConflictException(`Grade "${dto.name}" already exists`);
    }
    if (dto.groupId !== undefined) {
      const group = await this.prisma.group.findFirst({
        where: { id: dto.groupId, schoolId: grade.schoolId, deletedAt: null },
        select: { id: true },
      });
      if (!group) throw new BadRequestException('Group not found in this school');
    }
    const updated = await this.prisma.schoolGrade.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.groupId !== undefined && { groupId: dto.groupId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        group: { select: { id: true, name: true, nameAr: true } },
        _count: { select: { students: true } },
      },
    });
    if (dto.groupId !== undefined && updated.groupId !== grade.groupId) {
      await this.prisma.student.updateMany({
        where: { gradeId: id, deletedAt: null },
        data: { groupId: updated.groupId },
      });
    }
    await this.audit.log({
      action: 'UPDATE',
      entityType: 'grade',
      entityId: id,
      oldValues: { name: grade.name, groupId: grade.groupId, status: grade.status },
      newValues: { name: updated.name, groupId: updated.groupId, status: updated.status },
    });
    return this.toGrade(updated);
  }

  async deleteGrade(id: string) {
    const grade = await this.prisma.schoolGrade.findUnique({ where: { id } });
    if (!grade) throw new NotFoundException('Grade not found');
    const studentCount = await this.prisma.student.count({
      where: { gradeId: id, deletedAt: null },
    });
    if (studentCount > 0) {
      throw new BadRequestException(
        `Cannot delete grade "${grade.name}": ${studentCount} active student(s) are enrolled`,
      );
    }
    await this.prisma.schoolGrade.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      schoolId: grade.schoolId,
      action: 'DELETE',
      entityType: 'grade',
      entityId: id,
      oldValues: { name: grade.name },
    });
    return { success: true };
  }

  private toGrade(g: GradeWithRelations) {
    return {
      id: g.id,
      name: g.name,
      nameAr: g.nameAr,
      groupId: g.groupId,
      groupName: g.group.name,
      orderIndex: g.orderIndex,
      status: g.status,
      studentCount: g._count.students,
    };
  }
}

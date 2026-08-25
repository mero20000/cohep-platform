import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';

const ctx = (user: any) => ({
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
  getHandler: () => undefined,
  getClass: () => undefined,
} as any);

describe('CurriculumService - destructive routes (security)', () => {
  let svc: CurriculumService;
  let prisma: any;

  const prismaMock = {
    level: { findUnique: jest.fn(), update: jest.fn() },
    academicYear: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    lesson: { findUnique: jest.fn(), update: jest.fn() },
    curriculumAllocation: { count: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue('school-1') } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    svc = module.get<CurriculumService>(CurriculumService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('servant cannot delete academic-year or lesson (RolesGuard)', () => {
    for (const roles of [['servant'], ['group_leader'], ['level_leader']]) {
      const guard = new RolesGuard({
        getAllAndOverride: jest.fn().mockReturnValue(['curriculum_manager', 'principal', 'admin', 'super_admin']),
      } as any);
      expect(guard.canActivate(ctx({ roles }))).toBe(false);
    }
  });

  it('cross-school deleteAcademicYear → NotFound', async () => {
    prisma.academicYear.findUnique.mockResolvedValue({ id: 'ay1', schoolId: 'school-2', name: 'Y', deletedAt: null });
    await expect(
      svc.deleteAcademicYear('ay1', { schoolId: 'school-1', roles: ['admin'] }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.academicYear.update).not.toHaveBeenCalled();
  });

  it('same-school deleteAcademicYear soft-deletes', async () => {
    prisma.academicYear.findUnique.mockResolvedValue({ id: 'ay1', schoolId: 'school-1', name: 'Y', deletedAt: null });
    prisma.academicYear.update.mockResolvedValue({ id: 'ay1' });
    await svc.deleteAcademicYear('ay1', { schoolId: 'school-1', roles: ['admin'] });
    expect(prisma.academicYear.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ay1' },
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    }));
  });

  it('lesson with allocations → BadRequest "Unlink allocations first"', async () => {
    prisma.lesson.findUnique.mockResolvedValue({ id: 'l1', schoolId: 'school-1', title: 'L', deletedAt: null });
    prisma.curriculumAllocation.count.mockResolvedValue(2);
    await expect(
      svc.deleteLesson('l1', { schoolId: 'school-1', roles: ['admin'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cross-school deleteLesson → NotFound', async () => {
    prisma.lesson.findUnique.mockResolvedValue({ id: 'l1', schoolId: 'school-2', title: 'L', deletedAt: null });
    await expect(
      svc.deleteLesson('l1', { schoolId: 'school-1', roles: ['curriculum_manager'] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('deleteLevel cross-school → NotFound; super_admin allowed anywhere', async () => {
    prisma.level.findUnique.mockResolvedValue({ id: 'lv1', schoolId: 'school-2', name: 'L', number: 1 });
    prisma.level.update.mockResolvedValue({ id: 'lv1' });
    await expect(svc.deleteLevel('lv1', { schoolId: 'school-1', roles: ['admin'] })).rejects.toThrow(NotFoundException);
    await expect(svc.deleteLevel('lv1', { schoolId: null, roles: ['super_admin'] })).resolves.toEqual({ success: true });
  });

  it('reorderAllocations rejects allocations outside caller school', async () => {
    prisma.curriculumAllocation.findMany.mockResolvedValue([{ id: 'al1', academicYear: { schoolId: 'school-2' } }]);
    await expect(
      svc.reorderAllocations([{ allocationId: 'al1', newOrderIndex: 0, newTerm: 1 }], { schoolId: 'school-1', roles: ['admin'] }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CurriculumService - subject item recording', () => {
  let svc: CurriculumService;
  let prisma: any;

  const prismaMock = {
    subjectItem: { update: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue('school-1') } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    svc = module.get<CurriculumService>(CurriculumService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('setItemRecording stores url and meta', async () => {
    prisma.subjectItem.update = jest.fn().mockResolvedValue({ id: 'i1', recordingUrl: 'u', recordingMeta: { a: 1 } });
    const res = await svc.setItemRecording('i1', 'u', { a: 1 });
    expect(prisma.subjectItem.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { recordingUrl: 'u', recordingMeta: { a: 1 } } });
    expect(res.recordingUrl).toBe('u');
  });
});

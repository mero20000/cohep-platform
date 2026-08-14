import { Test, TestingModule } from '@nestjs/testing';
import { CurriculumService } from './curriculum.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';

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

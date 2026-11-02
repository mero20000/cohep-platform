import { Test } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ParentsService } from './parents.service';
import { ChildLinkThrottleService } from './child-link-throttle.service';
import { LinkChildDto } from './dto/link-child.dto';
import { PrismaService } from '../../database/prisma.service';
import { HymnLearningService } from '../curriculum/hymn-learning.service';
import { AuditService } from '../audit/audit.service';

describe('ParentsService.linkChild', () => {
  let service: ParentsService;
  let prisma: any;
  let audit: { log: jest.Mock };

  const parent = { schoolId: 'school-1', firstName: 'Mina', lastName: 'Parent', email: 'mina@example.com' };
  const student = {
    id: 'stu-1',
    schoolId: 'school-1',
    firstName: 'Kirollos',
    lastName: 'Child',
    studentCode: 'STU-00001',
    dateOfBirth: new Date('2015-04-23T00:00:00Z'),
    parentEmail: null as string | null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(parent),
        findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]),
      },
      student: {
        findFirst: jest.fn().mockResolvedValue(student),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      studentParent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ parentId: 'parent-0' }]),
      },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    const module = await Test.createTestingModule({
      providers: [
        ParentsService,
        ChildLinkThrottleService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: HymnLearningService, useValue: {} },
      ],
    }).compile();
    service = module.get(ParentsService);
    jest.spyOn(service, 'getChildren').mockResolvedValue([] as any);
  });

  it('links with the right code and date of birth', async () => {
    await service.linkChild('STU-00001', '2015-04-23', 'parent-1', 'mother');
    expect(prisma.studentParent.create).toHaveBeenCalledWith({
      data: { studentId: 'stu-1', parentId: 'parent-1', relationship: 'mother', isPrimary: false },
    });
  });

  it('fails a wrong date of birth with the same message as a wrong code', async () => {
    prisma.student.findFirst.mockResolvedValueOnce(null);
    const wrongCode = await service.linkChild('STU-99999', '2015-04-23', 'parent-1').catch((e) => e);
    const wrongDob = await service.linkChild('STU-00001', '2014-01-01', 'parent-1').catch((e) => e);
    expect(wrongCode).toBeInstanceOf(NotFoundException);
    expect(wrongDob).toBeInstanceOf(NotFoundException);
    expect(wrongDob.message).toBe(wrongCode.message);
    expect(prisma.studentParent.create).not.toHaveBeenCalled();
  });

  it('looks the student up inside the parent’s own school only', async () => {
    await service.linkChild('STU-00001', '2015-04-23', 'parent-1');
    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { studentCode: 'STU-00001', schoolId: 'school-1', deletedAt: null },
    });
  });

  it('answers the sixth attempt within an hour with 429, even if it would have matched', async () => {
    for (let i = 0; i < 5; i++) {
      await service.linkChild('STU-00001', '2000-01-01', 'parent-1').catch(() => undefined);
    }
    const sixth = await service.linkChild('STU-00001', '2015-04-23', 'parent-1').catch((e) => e);
    expect(sixth).toBeInstanceOf(HttpException);
    expect(sixth.getStatus()).toBe(429);
    expect(prisma.studentParent.create).not.toHaveBeenCalled();
  });

  it('counts attempts per parent account, not across parents', async () => {
    for (let i = 0; i < 5; i++) {
      await service.linkChild('STU-00001', '2000-01-01', 'parent-1').catch(() => undefined);
    }
    await expect(service.linkChild('STU-00001', '2015-04-23', 'parent-2')).resolves.toBeDefined();
  });

  it('locks a school after 20 wrong guesses in a day, across parents', async () => {
    for (let i = 0; i < 20; i++) {
      await service.linkChild('STU-00001', '2000-01-01', `parent-${i}`).catch(() => undefined);
    }
    const next = await service.linkChild('STU-00001', '2015-04-23', 'parent-fresh').catch((e) => e);
    expect(next.getStatus()).toBe(429);
  });

  it('does not count successful links toward the school limit', async () => {
    for (let i = 0; i < 25; i++) {
      await service.linkChild('STU-00001', '2015-04-23', `parent-${i}`);
    }
    expect(prisma.studentParent.create).toHaveBeenCalledTimes(25);
  });

  it('leaves student.parentEmail alone, including when it is empty', async () => {
    await service.linkChild('STU-00001', '2015-04-23', 'parent-1');
    expect(prisma.student.update).not.toHaveBeenCalled();
    expect(prisma.student.updateMany).not.toHaveBeenCalled();
  });

  it('notifies school admins and existing linked parents, never the new parent', async () => {
    await service.linkChild('STU-00001', '2015-04-23', 'parent-1', 'father');
    const { data, skipDuplicates } = prisma.notification.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data.map((n: any) => n.userId).sort()).toEqual(['admin-1', 'parent-0']);
    expect(data[0]).toEqual(expect.objectContaining({ type: 'parent_linked', studentId: 'stu-1', schoolId: 'school-1' }));
    expect(prisma.studentParent.findMany).toHaveBeenCalledWith({
      where: { studentId: 'stu-1', parentId: { not: 'parent-1' } },
      select: { parentId: true },
    });
  });

  it('writes an audit entry for the new link', async () => {
    await service.linkChild('STU-00001', '2015-04-23', 'parent-1', 'father');
    expect(audit.log).toHaveBeenCalledWith({
      schoolId: 'school-1',
      userId: 'parent-1',
      action: 'parent.link_child',
      entityType: 'student',
      entityId: 'stu-1',
      metadata: { relationship: 'father' },
    });
  });

  it('is quiet when the parent is already linked', async () => {
    prisma.studentParent.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await service.linkChild('STU-00001', '2015-04-23', 'parent-1');
    expect(prisma.studentParent.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('still links when the audit or notification write fails', async () => {
    audit.log.mockRejectedValueOnce(new Error('db down'));
    await expect(service.linkChild('STU-00001', '2015-04-23', 'parent-1')).resolves.toBeDefined();
    expect(prisma.studentParent.create).toHaveBeenCalled();
  });
});

describe('LinkChildDto', () => {
  const check = (body: object) => validate(plainToInstance(LinkChildDto, body));

  it('accepts a code with a YYYY-MM-DD date of birth', async () => {
    expect(await check({ studentCode: 'STU-00001', dateOfBirth: '2015-04-23' })).toHaveLength(0);
  });

  it.each([{ studentCode: 'STU-00001' }, { studentCode: 'STU-00001', dateOfBirth: '23/04/2015' }, { studentCode: 'STU-00001', dateOfBirth: '' }])(
    'rejects %j',
    async (body) => {
      expect((await check(body)).length).toBeGreaterThan(0);
    },
  );
});

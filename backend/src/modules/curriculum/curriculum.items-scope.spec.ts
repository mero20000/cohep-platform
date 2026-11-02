import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { resolve as resolvePath } from 'path';
import * as fsp from 'fs/promises';
import { CurriculumService } from './curriculum.service';
import { CurriculumController } from './curriculum.controller';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { AuditService } from '../audit/audit.service';

jest.mock('fs/promises', () => ({
  access: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('Curriculum subject items and lesson audio: tenant scope', () => {
  let svc: CurriculumService;
  let prisma: any;

  const prismaMock = {
    subject: { findFirst: jest.fn() },
    subjectItem: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), create: jest.fn() },
    subjectItemLevel: { deleteMany: jest.fn(), createMany: jest.fn() },
    lesson: { findUnique: jest.fn(), update: jest.fn() },
  };

  const itemIn = (schoolId: string) => ({ id: 'item-1', subject: { schoolId } });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue('school-1') } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    svc = module.get(CurriculumService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('listing', () => {
    it('getAllItems only returns items whose subject is in the caller\'s school', async () => {
      prisma.subjectItem.findMany.mockResolvedValue([]);

      await svc.getAllItems('school-1');

      expect(prisma.subjectItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { subject: { schoolId: 'school-1' } } }),
      );
    });

    it('getAllItems keeps the level filter alongside the school filter', async () => {
      prisma.subjectItem.findMany.mockResolvedValue([]);

      await svc.getAllItems('school-1', 2);

      expect(prisma.subjectItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { subject: { schoolId: 'school-1' }, levels: { some: { levelNumber: 2 } } } }),
      );
    });

    it('getSubjectItems is scoped to the school as well as the subject', async () => {
      prisma.subjectItem.findMany.mockResolvedValue([]);

      await svc.getSubjectItems('school-1', 'subj-1');

      expect(prisma.subjectItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { subjectId: 'subj-1', subject: { schoolId: 'school-1' } } }),
      );
    });

    it('createSubjectItem refuses a subject from another school', async () => {
      prisma.subject.findFirst.mockResolvedValue(null);

      await expect(svc.createSubjectItem('school-1', 'subj-other', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(prisma.subjectItem.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSubjectItem', () => {
    it('returns 404 and changes nothing for an item in another school', async () => {
      prisma.subjectItem.findUnique.mockResolvedValue(itemIn('school-2'));

      await expect(svc.updateSubjectItem('school-1', 'item-1', { name: 'Hijacked' })).rejects.toThrow(NotFoundException);
      expect(prisma.subjectItem.update).not.toHaveBeenCalled();
      expect(prisma.subjectItemLevel.deleteMany).not.toHaveBeenCalled();
    });

    it('never writes subjectId or recordingUrl from the request body', async () => {
      prisma.subjectItem.findUnique.mockResolvedValue(itemIn('school-1'));
      prisma.subjectItem.update.mockResolvedValue({ id: 'item-1' });

      await svc.updateSubjectItem('school-1', 'item-1', {
        name: 'Renamed',
        active: false,
        subjectId: 'subject-in-school-2',
        recordingUrl: 'https://evil.example/x.mp3',
        status: 'completed',
        id: 'other-id',
      });

      const { data } = prisma.subjectItem.update.mock.calls[0][0];
      expect(data).toEqual({ name: 'Renamed', active: false, status: 'completed' });
    });

    it('still replaces level links when levels are sent', async () => {
      prisma.subjectItem.findUnique.mockResolvedValue(itemIn('school-1'));
      prisma.subjectItem.update.mockResolvedValue({ id: 'item-1' });

      await svc.updateSubjectItem('school-1', 'item-1', { levels: [1, 2] });

      expect(prisma.subjectItemLevel.createMany).toHaveBeenCalledWith({
        data: [{ subjectItemId: 'item-1', levelNumber: 1 }, { subjectItemId: 'item-1', levelNumber: 2 }],
      });
    });
  });

  describe('other item routes', () => {
    it('deleteSubjectItem returns 404 for another school\'s item', async () => {
      prisma.subjectItem.findUnique.mockResolvedValue(itemIn('school-2'));

      await expect(svc.deleteSubjectItem('school-1', 'item-1')).rejects.toThrow(NotFoundException);
      expect(prisma.subjectItem.delete).not.toHaveBeenCalled();
    });

    it.each([
      ['setItemRecording', (s: CurriculumService) => s.setItemRecording('item-1', 'https://r2/x.mp3', {}, 'school-1')],
      ['clearItemRecording', (s: CurriculumService) => s.clearItemRecording('item-1', 'school-1')],
      ['updateItemStatus', (s: CurriculumService) => s.updateItemStatus('item-1', 'completed', 'school-1')],
    ])('%s returns 404 for another school\'s item', async (_name, call) => {
      prisma.subjectItem.findUnique.mockResolvedValue(itemIn('school-2'));

      await expect(call(svc)).rejects.toThrow(NotFoundException);
      expect(prisma.subjectItem.update).not.toHaveBeenCalled();
    });

    it('a super admin (no school filter) can still update a recording', async () => {
      prisma.subjectItem.findUnique.mockResolvedValue(itemIn('school-2'));
      prisma.subjectItem.update.mockResolvedValue({ id: 'item-1' });

      await svc.setItemRecording('item-1', 'https://r2/x.mp3', {}, undefined);

      expect(prisma.subjectItem.update).toHaveBeenCalled();
    });
  });

  describe('updateLesson audio clean-up', () => {
    const unlink = fsp.unlink as jest.Mock;
    const lesson = (audioUrl: string | null, schoolId = 'school-1') => ({ schoolId, title: 'L', audioUrl });

    beforeEach(() => prisma.lesson.update.mockResolvedValue({ title: 'L' }));

    it('does not delete anything outside uploads/audio when the stored path climbs out of it', async () => {
      prisma.lesson.findUnique.mockResolvedValue(lesson('/uploads/audio/../../secret.txt'));

      await svc.updateLesson('l1', { audioUrl: '/uploads/audio/new.mp3' });

      expect(unlink).not.toHaveBeenCalled();
    });

    it('ignores a stored value that is not under /uploads/audio/', async () => {
      prisma.lesson.findUnique.mockResolvedValue(lesson('/../../etc/hosts'));

      await svc.updateLesson('l1', { audioUrl: '/uploads/audio/new.mp3' });

      expect(unlink).not.toHaveBeenCalled();
    });

    it('still removes the previous local file when audio is replaced', async () => {
      prisma.lesson.findUnique.mockResolvedValue(lesson('/uploads/audio/old.mp3'));

      await svc.updateLesson('l1', { audioUrl: '/uploads/audio/new.mp3' });

      expect(unlink).toHaveBeenCalledWith(resolvePath(process.cwd(), 'uploads', 'audio', 'old.mp3'));
    });

    it('returns 404 for a lesson in another school', async () => {
      prisma.lesson.findUnique.mockResolvedValue(lesson('/uploads/audio/old.mp3', 'school-2'));

      await expect(
        svc.updateLesson('l1', { title: 'x' }, { schoolId: 'school-1', roles: ['servant'] }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.lesson.update).not.toHaveBeenCalled();
    });
  });

  describe('PUT lessons/:id', () => {
    it('does not pass audioUrl or audioOriginalName from the request to the service', async () => {
      const updateLesson = jest.fn().mockResolvedValue({});
      const controller = new CurriculumController({ updateLesson } as any);
      const user = { schoolId: 'school-1', roles: ['servant'] };

      await controller.updateLesson(
        'l1',
        { title: 'T', audioUrl: '/uploads/audio/../../x', audioOriginalName: 'x' } as any,
        user,
      );

      expect(updateLesson).toHaveBeenCalledWith('l1', { title: 'T' }, user);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { MailService } from '../mail/mail.service';
import { NewsletterService } from '../newsletter/newsletter.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: any;
  let resolver: any;

  const schoolId = 'school-1';
  const userId = 'user-1';
  const mockDate = new Date('2026-08-01T10:00:00Z');

  const row = {
    id: 'ann-1',
    schoolId,
    title: 'Hello',
    titleAr: 'مرحبا',
    content: 'Body text',
    contentAr: 'نص',
    targetAudience: 'all',
    targetLevelIds: null,
    targetGroupIds: null,
    priority: 'normal',
    isPinned: false,
    publishAt: mockDate,
    expiresAt: null,
    status: 'published',
    attachments: { targetRoles: ['parent'] },
    createdBy: userId,
    createdAt: mockDate,
    updatedAt: mockDate,
    deletedAt: null,
    creator: { id: userId, firstName: 'Amir', lastName: 'A' },
  };

  const prismaMock = {
    announcement: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchoolResolver, useValue: { resolve: jest.fn().mockResolvedValue(schoolId) } },
        { provide: MailService, useValue: { sendAnnouncementEmail: jest.fn() } },
        { provide: NewsletterService, useValue: { broadcast: jest.fn() } },
      ],
    }).compile();

    service = module.get(AnnouncementsService);
    prisma = prismaMock;
    resolver = module.get(SchoolResolver);
  });

  describe('findAll', () => {
    it('returns paginated announcements mapped to the frontend shape', async () => {
      prisma.announcement.findMany.mockResolvedValue([row]);
      prisma.announcement.count.mockResolvedValue(1);

      const result = await service.findAll(schoolId, { page: 1, limit: 20 });

      expect(result.pagination.total).toBe(1);
      expect(result.data[0]).toMatchObject({
        id: 'ann-1',
        title: 'Hello',
        titleAr: 'مرحبا',
        body: 'Body text',
        bodyAr: 'نص',
        priority: 'normal',
        targetRoles: ['parent'],
        publishedAt: mockDate.toISOString(),
        createdBy: { id: userId, firstName: 'Amir', lastName: 'A' },
      });
      expect(prisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ schoolId, deletedAt: null }) }),
      );
    });

    it('filters by status and priority', async () => {
      prisma.announcement.findMany.mockResolvedValue([]);
      prisma.announcement.count.mockResolvedValue(0);

      await service.findAll(schoolId, { page: 1, limit: 20, status: 'published', priority: 'urgent' });

      const call = prisma.announcement.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('published');
      expect(call.where.priority).toBe('urgent');
    });

    it('exposes publishedAt as undefined for draft announcements', async () => {
      prisma.announcement.findMany.mockResolvedValue([{ ...row, status: 'draft', publishAt: mockDate }]);
      prisma.announcement.count.mockResolvedValue(1);

      const result = await service.findAll(schoolId, { page: 1, limit: 20 });

      expect(result.data[0].publishedAt).toBeUndefined();
    });

    it('returns a raw array when banner=true', async () => {
      prisma.announcement.findMany.mockResolvedValue([row]);
      prisma.announcement.count.mockResolvedValue(1);

      const result = await service.findAll(schoolId, { page: 1, limit: 1, banner: true });

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe('ann-1');
    });
  });

  describe('findOne', () => {
    it('returns a mapped announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(row);

      const result = await service.findOne('ann-1');

      expect(result.body).toBe('Body text');
      expect(result.createdBy.firstName).toBe('Amir');
    });

    it('throws NotFoundException for a soft-deleted announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ ...row, deletedAt: new Date() });

      await expect(service.findOne('ann-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll — parent scoping', () => {
    it('forces published status and excludes drafts for non-staff callers', async () => {
      prisma.announcement.findMany.mockResolvedValue([row]);
      prisma.announcement.count.mockResolvedValue(1);

      await service.findAll(schoolId, { page: 1, limit: 20 }, { id: 'p1', roles: ['parent'] });

      const call = prisma.announcement.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('published');
    });

    it('excludes announcements targeting other roles', async () => {
      const targeted = { ...row, targetAudience: 'roles', attachments: { targetRoles: ['servant'] } };
      prisma.announcement.findMany.mockResolvedValue([row, targeted]);
      prisma.announcement.count.mockResolvedValue(2);

      const result = await service.findAll(schoolId, { page: 1, limit: 20 }, { id: 'p1', roles: ['parent'] });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('ann-1');
    });

    it('staff see drafts and all audiences', async () => {
      const draft = { ...row, id: 'ann-2', status: 'draft' };
      prisma.announcement.findMany.mockResolvedValue([draft]);
      prisma.announcement.count.mockResolvedValue(1);

      const result = await service.findAll(schoolId, { page: 1, limit: 20 }, { id: 's1', roles: ['servant'] });

      const call = prisma.announcement.findMany.mock.calls[0][0];
      expect(call.where.status).toBeUndefined();
      expect(result.data[0].id).toBe('ann-2');
    });
  });

  describe('findOne — parent scoping', () => {
    it('throws NotFoundException for a draft announcement requested by a parent', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ ...row, status: 'draft' });

      await expect(service.findOne('ann-1', { id: 'p1', roles: ['parent'] })).rejects.toThrow(NotFoundException);
    });

    it('allows staff to view drafts', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ ...row, status: 'draft' });

      const result = await service.findOne('ann-1', { id: 's1', roles: ['servant'] });

      expect(result.id).toBe('ann-1');
    });
  });

  describe('create', () => {
    it('persists a draft announcement by default', async () => {
      prisma.announcement.create.mockResolvedValue({ ...row, status: 'draft' });

      await service.create(
        schoolId,
        { title: 'Hello', titleAr: 'مرحبا', body: 'Body text', bodyAr: 'نص', priority: 'normal', targetRoles: ['parent'] },
        userId,
      );

      const data = prisma.announcement.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        schoolId,
        title: 'Hello',
        content: 'Body text',
        contentAr: 'نص',
        status: 'draft',
        createdBy: userId,
        priority: 'normal',
      });
      expect(data.attachments).toEqual({ targetRoles: ['parent'], targetSubscribers: false });
    });

    it('sets status published and publishAt when publishedAt provided', async () => {
      prisma.announcement.create.mockResolvedValue(row);

      await service.create(schoolId, { title: 'Hello', body: 'x', publishedAt: '2026-08-02T00:00:00Z' }, userId);

      const data = prisma.announcement.create.mock.calls[0][0].data;
      expect(data.status).toBe('published');
      expect(data.publishAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('updates fields and keeps draft status when no publishedAt', async () => {
      prisma.announcement.findUnique.mockResolvedValue({ ...row, status: 'draft' });
      prisma.announcement.update.mockResolvedValue({ ...row, status: 'draft', content: 'New' });

      const result = await service.update('ann-1', { body: 'New', priority: 'urgent' });

      const data = prisma.announcement.update.mock.calls[0][0].data;
      expect(data.content).toBe('New');
      expect(data.priority).toBe('urgent');
      expect(data.status).toBeUndefined();
      expect(result.body).toBe('New');
    });

    it('throws NotFoundException when updating a deleted announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);

      await expect(service.update('ann-1', { body: 'New' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('sets status published and publishAt to now', async () => {
      prisma.announcement.findUnique.mockResolvedValue(row);
      prisma.announcement.update.mockResolvedValue({ ...row, status: 'published' });

      const result = await service.publish('ann-1');

      const data = prisma.announcement.update.mock.calls[0][0].data;
      expect(data.status).toBe('published');
      expect(data.publishAt).toBeInstanceOf(Date);
      expect(result.publishedAt).toBeDefined();
    });
  });

  describe('remove', () => {
    it('soft-deletes the announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(row);
      prisma.announcement.update.mockResolvedValue({ ...row, deletedAt: new Date() });

      const result = await service.remove('ann-1');

      expect(prisma.announcement.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException for unknown announcement', async () => {
      prisma.announcement.findUnique.mockResolvedValue(null);

      await expect(service.remove('ann-1')).rejects.toThrow(NotFoundException);
    });
  });
});

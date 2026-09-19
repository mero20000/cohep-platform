import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChurchesService } from './churches.service';
import { PrismaService } from '../../database/prisma.service';

describe('ChurchesService', () => {
  let service: ChurchesService;
  let prisma: any;

  const prismaMock = {
    church: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChurchesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ChurchesService>(ChurchesService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('returns non-deleted churches ordered by name with school count', async () => {
      const churches = [
        { id: '1', name: 'Alpha Church', _count: { schools: 3 } },
        { id: '2', name: 'Beta Church', _count: { schools: 1 } },
      ];
      prisma.church.findMany.mockResolvedValue(churches);

      const result = await service.findAll();

      expect(result).toEqual(churches);
      expect(prisma.church.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: { _count: { select: { schools: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns church with schools when found', async () => {
      const church = {
        id: 'c1',
        name: 'St. Mark',
        schools: [{ id: 's1', name: 'School A', slug: 'school-a', isActive: true }],
      };
      prisma.church.findFirst.mockResolvedValue(church);

      const result = await service.findOne('c1');

      expect(result).toEqual(church);
      expect(prisma.church.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', deletedAt: null },
        include: {
          schools: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
        },
      });
    });

    it('throws NotFoundException when church is not found', async () => {
      prisma.church.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates church with auto-generated slug from name', async () => {
      const dto = { name: 'St. George Church', nameAr: 'كنيسة مارجرجس' };
      const created = { id: 'new-id', ...dto, slug: 'st-george-church' };
      prisma.church.create.mockResolvedValue(created);

      const result = await service.create(dto as any);

      expect(result).toEqual(created);
      expect(prisma.church.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'St. George Church',
          nameAr: 'كنيسة مارجرجس',
          slug: 'st-george-church',
          locale: 'en',
          timezone: 'UTC',
        }),
      });
    });

    it('uses explicit slug when provided', async () => {
      const dto = { name: 'St. George Church', nameAr: 'كنيسة مارجرجس', slug: 'custom-slug' };
      prisma.church.create.mockResolvedValue({ id: 'new-id', ...dto });

      await service.create(dto as any);

      expect(prisma.church.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: 'custom-slug' }),
      });
    });

    it('creates church with all provided fields', async () => {
      const dto = {
        name: 'Full Church',
        nameAr: 'كنيسة كاملة',
        slug: 'full-church',
        logoUrl: 'https://example.com/logo.png',
        schoolLogoUrl: 'https://example.com/school-logo.png',
        schoolNameEn: 'School EN',
        schoolNameAr: 'School AR',
        schoolNameCoptic: 'School Coptic',
        country: 'EG',
        city: 'Cairo',
        address: '123 Main St',
        responsiblePriest: 'Fr. John',
        priestPhone: '+201234567890',
        defaultLanguage: 'ar',
        timezone: 'Africa/Cairo',
      };
      prisma.church.create.mockResolvedValue({ id: 'id', ...dto });

      await service.create(dto as any);

      expect(prisma.church.create).toHaveBeenCalledWith({
        data: {
          name: 'Full Church',
          nameAr: 'كنيسة كاملة',
          slug: 'full-church',
          logoUrl: 'https://example.com/logo.png',
          schoolLogoUrl: 'https://example.com/school-logo.png',
          schoolNameEn: 'School EN',
          schoolNameAr: 'School AR',
          schoolNameCoptic: 'School Coptic',
          country: 'EG',
          city: 'Cairo',
          address: '123 Main St',
          responsiblePriest: 'Fr. John',
          priestPhone: '+201234567890',
          locale: 'ar',
          timezone: 'Africa/Cairo',
        },
      });
    });
  });

  describe('update', () => {
    it('updates only provided fields', async () => {
      const existing = { id: 'c1', name: 'Old Name', schools: [] };
      prisma.church.findFirst.mockResolvedValue(existing);
      prisma.church.update.mockResolvedValue({ ...existing, name: 'New Name' });

      const result = await service.update('c1', { name: 'New Name' } as any);

      expect(result.name).toBe('New Name');
      expect(prisma.church.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'New Name' },
      });
    });

    it('throws NotFoundException when church does not exist', async () => {
      prisma.church.findFirst.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.church.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting deletedAt', async () => {
      const existing = { id: 'c1', name: 'Church', schools: [] };
      prisma.church.findFirst.mockResolvedValue(existing);
      prisma.church.update.mockResolvedValue({ ...existing, deletedAt: new Date() });

      const result = await service.remove('c1');

      expect(result).toEqual({ success: true });
      expect(prisma.church.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('throws NotFoundException when church does not exist', async () => {
      prisma.church.findFirst.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.church.update).not.toHaveBeenCalled();
    });
  });
});

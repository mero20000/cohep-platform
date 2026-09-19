import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let prisma: any;

  const schoolId = 'school-1';
  const schoolSlug = 'st-mark';
  const mockSchool = {
    id: schoolId,
    name: 'St Mark',
    nameAr: 'مارمرقس',
    slug: schoolSlug,
    logoUrl: null,
    church: { name: 'St Mark Church', nameAr: 'كنيسة مارمرقس', logoUrl: null },
  };

  const prismaMock = {
    school: { findFirst: jest.fn(), findUnique: jest.fn() },
    level: { findMany: jest.fn(), findFirst: jest.fn() },
    group: { findMany: jest.fn(), findFirst: jest.fn() },
    schoolGrade: { findMany: jest.fn(), findFirst: jest.fn() },
    registrationApplication: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    student: { findMany: jest.fn(), create: jest.fn() },
    academicYear: { findFirst: jest.fn() },
    studentProgress: { create: jest.fn() },
    user: { findMany: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: { sendMail: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: { createNotification: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getMeta
  // ---------------------------------------------------------------------------
  describe('getMeta', () => {
    it('should return school info with levels, groups, and grades', async () => {
      const mockLevels = [{ id: 'lvl-1', name: 'Level 1', number: 1 }];
      const mockGroups = [{ id: 'grp-1', name: 'Group A' }];
      const mockGrades = [{ id: 'grd-1', name: 'Grade 1', groupId: 'grp-1' }];

      prismaMock.school.findFirst.mockResolvedValue(mockSchool);
      prismaMock.level.findMany.mockResolvedValue(mockLevels);
      prismaMock.group.findMany.mockResolvedValue(mockGroups);
      prismaMock.schoolGrade.findMany.mockResolvedValue(mockGrades);

      const result = await service.getMeta(schoolSlug);

      expect(result.school).toEqual({
        id: schoolId,
        name: 'St Mark',
        nameAr: 'مارمرقس',
        slug: schoolSlug,
        logoUrl: null,
      });
      expect(result.church).toEqual({
        name: 'St Mark Church',
        nameAr: 'كنيسة مارمرقس',
        logoUrl: null,
      });
      expect(result.levels).toEqual(mockLevels);
      expect(result.groups).toEqual(mockGroups);
      expect(result.grades).toEqual(mockGrades);
      expect(prismaMock.school.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: schoolSlug, deletedAt: null } }),
      );
    });

    it('should throw NotFoundException for unknown school slug', async () => {
      prismaMock.school.findFirst.mockResolvedValue(null);

      await expect(service.getMeta('unknown-slug')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  describe('list', () => {
    const mockApplications = [
      { id: 'app-1', schoolId, status: 'pending', studentData: {}, createdAt: new Date() },
      { id: 'app-2', schoolId, status: 'pending', studentData: {}, createdAt: new Date() },
    ];

    it('should return applications for a school by UUID', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      prismaMock.registrationApplication.findMany.mockResolvedValue(mockApplications);

      const user = { schoolId: uuid, roles: ['admin'] };
      const result = await service.list(uuid, undefined, user);

      expect(result).toEqual(mockApplications);
      expect(prismaMock.registrationApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId: uuid },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      );
    });

    it('should resolve a slug to schoolId before listing', async () => {
      prismaMock.school.findFirst.mockResolvedValue(mockSchool);
      prismaMock.registrationApplication.findMany.mockResolvedValue(mockApplications);

      const user = { roles: ['admin'] };
      const result = await service.list(schoolSlug, undefined, user);

      expect(result).toEqual(mockApplications);
      expect(prismaMock.school.findFirst).toHaveBeenCalled();
      expect(prismaMock.registrationApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { schoolId } }),
      );
    });

    it('should throw BadRequestException when no schoolId can be determined', async () => {
      await expect(service.list('', undefined, {})).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // getOne
  // ---------------------------------------------------------------------------
  describe('getOne', () => {
    const mockApp = { id: 'app-1', schoolId, status: 'pending', studentData: {} };

    it('should return the application when found', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(mockApp);

      const result = await service.getOne('app-1');

      expect(result).toEqual(mockApp);
      expect(prismaMock.registrationApplication.findUnique).toHaveBeenCalledWith({
        where: { id: 'app-1' },
      });
    });

    it('should throw NotFoundException when application is not found', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(null);

      await expect(service.getOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    const pendingApp = { id: 'app-1', schoolId, status: 'pending', studentData: {} };
    const user = { id: 'user-1', schoolId, roles: ['admin'] };

    it('should update a pending application', async () => {
      const updatedApp = { ...pendingApp, hymnChoice: 'amen_be_mawteka' };
      prismaMock.registrationApplication.findUnique.mockResolvedValue(pendingApp);
      prismaMock.registrationApplication.update.mockResolvedValue(updatedApp);

      const result = await service.update('app-1', { hymnChoice: 'amen_be_mawteka' }, user);

      expect(result).toEqual(updatedApp);
      expect(prismaMock.registrationApplication.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { hymnChoice: 'amen_be_mawteka' },
      });
    });

    it('should throw NotFoundException for missing application', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { hymnChoice: 'amen_be_mawteka' }, user),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-pending application', async () => {
      const approvedApp = { ...pendingApp, status: 'approved' };
      prismaMock.registrationApplication.findUnique.mockResolvedValue(approvedApp);

      await expect(
        service.update('app-1', { hymnChoice: 'amen_be_mawteka' }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user belongs to a different school', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(pendingApp);
      const otherUser = { id: 'user-2', schoolId: 'other-school', roles: ['admin'] };

      await expect(
        service.update('app-1', { hymnChoice: 'amen_be_mawteka' }, otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    const mockApp = { id: 'app-1', schoolId, status: 'pending', studentData: {} };
    const user = { id: 'user-1', schoolId, roles: ['admin'] };

    it('should delete the application and return success', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(mockApp);
      prismaMock.registrationApplication.delete.mockResolvedValue(mockApp);

      const result = await service.remove('app-1', user);

      expect(result).toEqual({ success: true });
      expect(prismaMock.registrationApplication.delete).toHaveBeenCalledWith({
        where: { id: 'app-1' },
      });
    });

    it('should throw NotFoundException for missing application', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', user)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // reject
  // ---------------------------------------------------------------------------
  describe('reject', () => {
    const pendingApp = {
      id: 'app-1',
      schoolId,
      status: 'pending',
      studentData: { name: 'John', parentEmail: 'parent@example.com' },
      submittedByEmail: 'parent@example.com',
    };
    const user = { id: 'user-1', schoolId, roles: ['admin'] };

    it('should reject a pending application', async () => {
      const rejectedApp = { ...pendingApp, status: 'rejected', reviewedBy: user.id, reviewNote: 'Age requirement' };
      prismaMock.registrationApplication.findUnique.mockResolvedValue(pendingApp);
      prismaMock.registrationApplication.update.mockResolvedValue(rejectedApp);

      const result = await service.reject('app-1', user, 'Age requirement');

      expect(result).toEqual(rejectedApp);
      expect(prismaMock.registrationApplication.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'rejected', reviewedBy: user.id, reviewNote: 'Age requirement' },
      });
    });

    it('should throw NotFoundException for missing application', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(null);

      await expect(service.reject('nonexistent', user)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already-reviewed application', async () => {
      const approvedApp = { ...pendingApp, status: 'approved' };
      prismaMock.registrationApplication.findUnique.mockResolvedValue(approvedApp);

      await expect(service.reject('app-1', user)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // approve
  // ---------------------------------------------------------------------------
  describe('approve', () => {
    const pendingApp = {
      id: 'app-1',
      schoolId,
      status: 'pending',
      hymnChoice: 'amen_be_mawteka',
      studentData: {
        name: 'John Doe',
        dateOfBirth: '2015-06-15',
        parentEmail: 'parent@example.com',
      },
      submittedByEmail: 'parent@example.com',
    };
    const user = { id: 'user-1', schoolId, roles: ['admin'] };
    const mockYear = { id: 'year-1', name: '2025-2026', schoolId, isCurrent: true };
    const mockLevel = { id: 'lvl-1', name: 'Level 1', number: 1 };
    const mockGroup = { id: 'grp-1', name: 'Group A' };
    const createdStudent = {
      id: 'student-1',
      firstName: 'John',
      lastName: 'Doe',
      schoolId,
      studentCode: 'STU-00001',
    };

    it('should approve a pending application and create a student', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(pendingApp);
      prismaMock.academicYear.findFirst.mockResolvedValue(mockYear);
      prismaMock.level.findFirst.mockResolvedValue(mockLevel);
      prismaMock.group.findFirst.mockResolvedValue(mockGroup);
      prismaMock.student.findMany.mockResolvedValue([]);

      // The $transaction callback receives the prisma client — use prismaMock itself
      prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
      prismaMock.student.create.mockResolvedValue(createdStudent);
      prismaMock.registrationApplication.update.mockResolvedValue({
        ...pendingApp,
        status: 'approved',
        reviewedBy: user.id,
      });
      prismaMock.studentProgress.create.mockResolvedValue({});

      // Also mock the school lookup for the notifyStaff call
      prismaMock.school.findUnique.mockResolvedValue({ email: null, name: 'St Mark' });
      prismaMock.user.findMany.mockResolvedValue([]);

      const result = await service.approve('app-1', user);

      expect(result.student).toEqual(createdStudent);
      expect(result.application).toEqual(pendingApp);
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
            schoolId,
            studentCode: 'STU-00001',
            academicYearId: mockYear.id,
            levelId: mockLevel.id,
            groupId: mockGroup.id,
            status: 'active',
          }),
        }),
      );
    });

    it('should throw NotFoundException for missing application', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(null);

      await expect(service.approve('nonexistent', user)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already-reviewed application', async () => {
      const approvedApp = { ...pendingApp, status: 'approved' };
      prismaMock.registrationApplication.findUnique.mockResolvedValue(approvedApp);

      await expect(service.approve('app-1', user)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when no academic year exists', async () => {
      prismaMock.registrationApplication.findUnique.mockResolvedValue(pendingApp);
      prismaMock.academicYear.findFirst.mockResolvedValue(null);

      await expect(service.approve('app-1', user)).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let mail: any;

  const schoolRow = {
    id: 'school-1', name: 'St. Mark Church', nameAr: '', slug: 'st-mark', churchId: 'church-1',
    country: 'Egypt', city: 'Cairo', educationLanguage: 'en',
    registrationStatus: 'pending', isActive: false, createdAt: new Date('2026-01-01'),
    church: { name: 'St. Mark Church' },
    users: [{ id: 'u1', firstName: 'John', lastName: 'Doe', email: 'a@b.com', phone: '+20', isActive: false }],
  };
  const listShape = {
    id: 'school-1', schoolName: 'St. Mark Church', churchName: 'St. Mark Church',
    country: 'Egypt', city: 'Cairo', educationLanguage: 'en',
    registrationStatus: 'pending', isActive: false, createdAt: schoolRow.createdAt,
    users: [{ id: 'u1', firstName: 'John', lastName: 'Doe', email: 'a@b.com', phone: '+20', isActive: false }],
  };

  const prismaMock = {
    school: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    church: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: { sendMail: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = module.get<AdminService>(AdminService);
    prisma = module.get(PrismaService);
    mail = module.get(MailService);
    jest.clearAllMocks();
  });

  it('lists registrations filtered by status, excluding deleted', async () => {
    prisma.school.findMany.mockResolvedValue([schoolRow]);
    const result = await service.listAllRegistrations('pending');
    expect(prisma.school.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, registrationStatus: 'pending' } }),
    );
    expect(result).toEqual([listShape]);
  });

  it('lists all registrations when status omitted', async () => {
    prisma.school.findMany.mockResolvedValue([schoolRow]);
    await service.listAllRegistrations();
    expect(prisma.school.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });

  it('updates school, church, and admin user in one transaction', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolRow);
    prisma.$transaction.mockImplementation(async (cb: any) => cb({
      school: { update: jest.fn().mockResolvedValue(schoolRow) },
      church: { update: jest.fn().mockResolvedValue({}) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1' }), update: jest.fn().mockResolvedValue({}) },
    }));

    const result = await service.updateRegistration('school-1', {
      churchName: 'New Name', country: 'USA', admin: { email: 'new@b.com' },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.schoolName).toBe('St. Mark Church');
  });

  it('throws when editing a registration that does not exist', async () => {
    prisma.school.findUnique.mockResolvedValue(null);
    await expect(service.updateRegistration('x', { country: 'USA' }))
      .rejects.toThrow(NotFoundException);
  });

  it('approve sets school+user active and emails the current email', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolRow);
    prisma.school.update.mockResolvedValue({ ...schoolRow, registrationStatus: 'approved', isActive: true });
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'edited@b.com', isActive: true });

    const result = await service.approveRegistration('school-1');

    expect(prisma.school.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ registrationStatus: 'approved', isActive: true }),
    }));
    expect(mail.sendMail).toHaveBeenCalledWith('edited@b.com', expect.any(String), expect.any(String));
    expect(result.message).toBe('Registration approved');
  });

  it('approve raises NotFoundException when school does not exist', async () => {
    prisma.school.findUnique.mockResolvedValue(null);
    await expect(service.approveRegistration('x')).rejects.toThrow(NotFoundException);
  });

  it('reject sets school and user inactive, sends rejection email', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolRow);
    prisma.school.update.mockResolvedValue({ ...schoolRow, registrationStatus: 'rejected', isActive: false });
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    const result = await service.rejectRegistration('school-1');

    expect(prisma.school.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ registrationStatus: 'rejected', isActive: false }),
    }));
    expect(mail.sendMail).toHaveBeenCalledWith('a@b.com', expect.any(String), expect.any(String));
    expect(result.message).toBe('Registration rejected');
  });

  it('reject updates user isActive to false', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolRow);
    prisma.school.update.mockResolvedValue({ ...schoolRow, registrationStatus: 'rejected', isActive: false });

    const userUpdate = jest.fn().mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    prisma.user.update = userUpdate;

    await service.rejectRegistration('school-1');
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
  });

  it('soft delete sets deletedAt on school, church, and user', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolRow);
    prisma.$transaction.mockImplementation(async (cb: any) => cb({
      church: { update: jest.fn().mockResolvedValue({}) },
      school: { update: jest.fn().mockResolvedValue({}) },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    }));

    const result = await service.softDeleteRegistration('school-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ message: expect.any(String) });
  });

  it('soft delete raises NotFoundException for unknown school', async () => {
    prisma.school.findUnique.mockResolvedValue(null);
    await expect(service.softDeleteRegistration('nope')).rejects.toThrow(NotFoundException);
  });
});

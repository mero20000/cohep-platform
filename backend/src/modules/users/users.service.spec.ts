import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';

describe('UsersService roles', () => {
  let service: UsersService;
  let prisma: any;

  const prismaMock = {
    role: { findFirst: jest.fn() },
    rolePermission: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    permission: { findMany: jest.fn(), create: jest.fn() },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('setRolePermissions', () => {
    it('rejects non-admin callers', async () => {
      await expect(
        service.setRolePermissions('servant', ['student:view'], { roles: ['parent'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-creates unknown permission names', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1' });
      prisma.permission.findMany.mockResolvedValue([{ id: 'p-1', name: 'student:view' }]);
      prisma.permission.create.mockResolvedValue({ id: 'p-2', name: 'nope:missing' });
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.setRolePermissions('servant', ['student:view', 'nope:missing'], { roles: ['admin'] });

      expect(prisma.permission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'nope:missing' }),
        select: { id: true, name: true },
      });
      expect(result.permissions).toEqual(['student:view', 'nope:missing']);
    });

    it('replaces role permissions for admin callers', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1' });
      prisma.permission.findMany.mockResolvedValue([{ id: 'p-1', name: 'student:view' }]);
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.setRolePermissions('servant', ['student:view'], { roles: ['admin'] });

      expect(result.permissions).toEqual(['student:view']);
      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' } });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('blocks role change by non-super-admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', userRoles: [] });
      prisma.user.update.mockResolvedValue({ id: 'user-1' });
      prisma.role.findFirst.mockResolvedValue(null); // target user has no roles

      await expect(
        service.updateUser('user-1', { roleName: 'admin' }, { id: 'caller-1', roles: ['servant'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
    });

    it('allows role change by super admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', userRoles: [] });
      prisma.user.update.mockResolvedValue({ id: 'user-1' });
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1', name: 'admin' });

      const result = await service.updateUser('user-1', { roleName: 'admin' }, { id: 'caller-1', roles: ['super_admin'] });

      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(prisma.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ roleId: 'role-1' }) }),
      );
      expect(result.id).toBe('user-1');
    });
  });

  describe('createUser', () => {
    const baseData = {
      email: 'user@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };
    const requester = { id: 'caller-1', schoolId: 'school-1', roles: ['servant'] };

    it('persists gender when provided', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1' });

      await service.createUser(requester, undefined, { ...baseData, gender: 'female' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ gender: 'female' }) }),
      );
    });

    it('creates a user without gender, relying on the Prisma-side default', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1' });

      await expect(service.createUser(requester, undefined, baseData)).resolves.toEqual({ id: 'user-1' });

      const args = prisma.user.create.mock.calls[0][0];
      expect(args.data.gender).toBeUndefined();
    });
  });

  describe('bulkDeleteUsers', () => {
    it('rejects non-array / empty ids', async () => {
      await expect(service.bulkDeleteUsers([], { schoolId: 's1', roles: ['admin'] })).rejects.toThrow(BadRequestException);
      await expect(service.bulkDeleteUsers(undefined as any, { schoolId: 's1', roles: ['admin'] })).rejects.toThrow(BadRequestException);
    });

    it('soft-deletes given users within the requester school', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 2 });
      prisma.role.findFirst.mockResolvedValue({ id: 'sa-role' });
      prisma.userRole.findMany.mockResolvedValue([]);

      const res = await service.bulkDeleteUsers(['u1', 'u2'], { schoolId: 's1', roles: ['admin'] });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2'] }, schoolId: 's1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(res).toEqual({ deleted: 2 });
    });

    it('excludes super_admin users from deletion', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'sa-role' });
      // u2 is a super admin
      prisma.userRole.findUnique.mockImplementation((args: any) =>
        Promise.resolve(args.where.userId_roleId.userId === 'u2' ? { userId: 'u2' } : null),
      );
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.bulkDeleteUsers(['u1', 'u2'], { schoolId: 's1', roles: ['admin'] });

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1'] }, schoolId: 's1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expect(res).toEqual({ deleted: 1 });
    });
  });

  describe('school CRUD tenancy', () => {
    const schoolB = { id: 'school-2' };

    it('blocks admin of school A from getting school B', async () => {
      prisma.school = { findUnique: jest.fn().mockResolvedValue(schoolB) };
      await expect(
        service.getSchool('school-2', { id: 'u1', schoolId: 'school-1', roles: ['admin'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows admin to get their own school', async () => {
      prisma.school = { findUnique: jest.fn().mockResolvedValue({ id: 'school-1' }) };
      const res = await service.getSchool('school-1', { id: 'u1', schoolId: 'school-1', roles: ['admin'] });
      expect(res.id).toBe('school-1');
    });

    it('blocks cross-school update', async () => {
      prisma.school = { findUnique: jest.fn().mockResolvedValue(schoolB), update: jest.fn() };
      await expect(
        service.updateSchool('school-2', { name: 'X' }, { id: 'u1', schoolId: 'school-1', roles: ['admin'] }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.school.update).not.toHaveBeenCalled();
    });

    it('blocks cross-school delete', async () => {
      prisma.school = { findUnique: jest.fn().mockResolvedValue(schoolB), update: jest.fn() };
      await expect(
        service.deleteSchool('school-2', { id: 'u1', schoolId: 'school-1', roles: ['admin'] }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.school.update).not.toHaveBeenCalled();
    });

    it('allows super_admin to access any school', async () => {
      prisma.school = {
        findUnique: jest.fn().mockResolvedValue(schoolB),
        update: jest.fn().mockResolvedValue({ ...schoolB, deletedAt: new Date() }),
      };
      await expect(
        service.deleteSchool('school-2', { id: 'u1', roles: ['super_admin'] }),
      ).resolves.toEqual({ success: true });
    });
  });
  describe('granting privileged roles', () => {
    const principal = { id: 'p1', schoolId: 'school-1', roles: ['principal'] };
    const superAdmin = { id: 's1', schoolId: 'school-1', roles: ['super_admin'] };
    const existingUser = { id: 'u-existing', email: 'a@x.org', schoolId: 'school-1' };

    beforeEach(() => {
      prisma.role.findFirst.mockImplementation(({ where }: any) => Promise.resolve({ id: `role-${where.name}`, name: where.name }));
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u-new' });
    });

    const row = (roleName: string, email = 'a@x.org') => ({
      email, firstName: 'A', lastName: 'B', gender: 'male', password: 'Aaaaaaa1', roleName,
    });

    describe('bulkImportUsers', () => {
      it.each(['super_admin', 'admin'])('refuses %s for an existing user when the caller is a principal', async (roleName) => {
        prisma.user.findFirst.mockResolvedValue(existingUser);

        const result = await service.bulkImportUsers(principal, undefined, [row(roleName)]);

        expect(result.failed).toBe(1);
        expect(result.created).toBe(0);
        expect(result.errors[0].reason).toBe('Insufficient permissions for role');
        expect(prisma.userRole.create).not.toHaveBeenCalled();
      });

      it('refuses super_admin for a new user and creates no user row', async () => {
        const result = await service.bulkImportUsers(principal, undefined, [row('super_admin')]);

        expect(result.failed).toBe(1);
        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(prisma.userRole.create).not.toHaveBeenCalled();
      });

      it('still lets a principal attach an ordinary role to an existing user', async () => {
        prisma.user.findFirst.mockResolvedValue(existingUser);

        const result = await service.bulkImportUsers(principal, undefined, [row('servant')]);

        expect(result.failed).toBe(0);
        expect(prisma.userRole.create).toHaveBeenCalledWith({
          data: { userId: 'u-existing', roleId: 'role-servant', assignedBy: 'p1' },
        });
      });

      it('lets a super admin attach super_admin to an existing user', async () => {
        prisma.user.findFirst.mockResolvedValue(existingUser);
        prisma.school = { findFirst: jest.fn().mockResolvedValue({ id: 'school-1' }) };

        const result = await service.bulkImportUsers(superAdmin, 'school-1', [row('super_admin')]);

        expect(result.failed).toBe(0);
        expect(prisma.userRole.create).toHaveBeenCalledTimes(1);
      });
    });

    describe('createUser', () => {
      it('rejects a privileged role before any user row is written', async () => {
        await expect(
          service.createUser(principal, undefined, { email: 'n@x.org', firstName: 'N', lastName: 'M', gender: 'male', roleName: 'admin' }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.user.create).not.toHaveBeenCalled();
      });
    });

    describe('assignRole', () => {
      it('rejects super_admin when the caller is a principal', async () => {
        prisma.user.findUnique.mockResolvedValue(existingUser);

        await expect(service.assignRole('u-existing', 'super_admin', principal)).rejects.toThrow(BadRequestException);
        expect(prisma.userRole.create).not.toHaveBeenCalled();
      });
    });
  });
});

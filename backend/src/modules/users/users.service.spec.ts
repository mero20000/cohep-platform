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
    permission: { findMany: jest.fn() },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userRole: {
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

    it('rejects unknown permission names', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: 'role-1' });
      prisma.permission.findMany.mockResolvedValue([{ id: 'p-1', name: 'student:view' }]);

      await expect(
        service.setRolePermissions('servant', ['student:view', 'nope:missing'], { roles: ['admin'] }),
      ).rejects.toThrow(NotFoundException);
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
});

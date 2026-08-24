import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';

const VALID_TEACHING_SUBJECTS = ['coptic_hymns', 'coptic_rites', 'coptic_language'] as const;
const TEACHING_SUBJECT_ALIASES: Record<string, string> = {
  'Coptic Hymns': 'coptic_hymns',
  'Coptic Rites': 'coptic_rites',
  'Coptic Language': 'coptic_language',
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveSchoolId(schoolIdentifier: string): Promise<string> {
    const school = await this.prisma.school.findFirst({
      where: { OR: [{ id: schoolIdentifier }, { slug: schoolIdentifier }], deletedAt: null },
      select: { id: true },
    });
    if (!school) throw new NotFoundException('School not found');
    return school.id;
  }

  private async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const role = await this.prisma.role.findFirst({ where: { name: roleName } });
    if (!role) return false;
    const userRole = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    });
    return !!userRole;
  }

  // Tenancy guard: non-super-admin callers may only operate on users within
  // their own school. Super admin spans all schools.
  private async requireSameSchool(requestingUser: any, targetUser: { schoolId?: string | null }): Promise<void> {
    if (!requestingUser) return;
    if (requestingUser.roles?.includes('super_admin')) return;
    if (requestingUser.schoolId && targetUser.schoolId !== requestingUser.schoolId) {
      throw new NotFoundException('User not found');
    }
  }

  private normalizeTeachingSubjects(raw: any): string[] {
    if (!Array.isArray(raw)) return [];
    const out = new Set<string>();
    for (const v of raw) {
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      const normalized = TEACHING_SUBJECT_ALIASES[trimmed] ?? trimmed.toLowerCase().replace(/\s+/g, '_');
      if ((VALID_TEACHING_SUBJECTS as readonly string[]).includes(normalized)) out.add(normalized);
    }
    return [...out];
  }

  private async validateMetadata(metadata: any, schoolId: string): Promise<Record<string, any>> {
    if (!metadata || typeof metadata !== 'object') return metadata;
    const next = { ...metadata };
    // teachingSubjects: normalize + validate
    if (next.teachingSubjects !== undefined) {
      const normalized = this.normalizeTeachingSubjects(next.teachingSubjects);
      // If input had values but none survived, it contained only invalid entries
      if (Array.isArray(next.teachingSubjects) && next.teachingSubjects.length > 0 && normalized.length === 0) {
        throw new BadRequestException(`Invalid teachingSubjects — allowed: ${VALID_TEACHING_SUBJECTS.join(', ')}`);
      }
      next.teachingSubjects = normalized;
    }
    // levelId: must exist, active, same school
    if (next.levelId) {
      const level = await this.prisma.level.findFirst({ where: { id: next.levelId, deletedAt: null } });
      if (!level) throw new BadRequestException(`Invalid levelId: ${next.levelId}`);
      if (level.schoolId !== schoolId) throw new BadRequestException('levelId does not belong to this school');
    }
    // groupId: must exist, active, same school
    if (next.groupId) {
      const group = await this.prisma.group.findFirst({ where: { id: next.groupId, deletedAt: null } });
      if (!group) throw new BadRequestException(`Invalid groupId: ${next.groupId}`);
      if (group.schoolId !== schoolId) throw new BadRequestException('groupId does not belong to this school');
    }
    // grade: if present, check SchoolGrade exists for the resolved group or at least for school
    // (soft validation — grade names are free-form, so we only warn on mismatch)
    return next;
  }

  async listUsers(
    requestingUser: any,
    schoolIdentifier?: string,
    query?: { role?: string; roleIn?: string; groupId?: string; levelId?: string; search?: string; isActive?: string },
  ) {
    const isSuperAdmin = requestingUser?.roles?.includes('super_admin');
    let schoolId: string | undefined;

    if (schoolIdentifier) {
      schoolId = await this.resolveSchoolId(schoolIdentifier);
    } else if (!isSuperAdmin) {
      schoolId = requestingUser?.schoolId;
    }

    const where: any = { deletedAt: null };
    const and: any[] = [];
    if (schoolId) where.schoolId = schoolId;
    if (!isSuperAdmin) {
      const superAdminRole = await this.prisma.role.findFirst({ where: { name: 'super_admin' } });
      if (superAdminRole) {
        and.push({ userRoles: { none: { roleId: superAdminRole.id } } });
      }
    }
    if (query?.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query?.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const roleNames = query?.roleIn
      ? query.roleIn.split(',').map(r => r.trim()).filter(Boolean)
      : query?.role ? [query.role] : [];
    if (roleNames.length > 0) {
      and.push({ userRoles: { some: { role: { name: { in: roleNames } } } } });
    }
    if (query?.groupId) and.push({ metadata: { path: ['groupId'], equals: query.groupId } });
    if (query?.levelId) and.push({ metadata: { path: ['levelId'], equals: query.levelId } });
    if (and.length) where.AND = and;
    return this.prisma.user.findMany({
      where,
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true,
        avatarUrl: true, locale: true, timezone: true,
        isActive: true, lastLoginAt: true, createdAt: true, schoolId: true,
        userRoles: { include: { role: { select: { id: true, name: true, displayName: true } } } },
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUser(id: string, requestingUser?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true,
        avatarUrl: true, locale: true, timezone: true,
        isActive: true, lastLoginAt: true, createdAt: true, schoolId: true,
        metadata: true,
        userRoles: { include: { role: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (requestingUser && !requestingUser.roles?.includes('super_admin') && await this.userHasRole(id, 'super_admin')) {
      throw new NotFoundException('User not found');
    }
    return { ...user, roles: user.userRoles.map(ur => ur.role) };
  }

  async updateUser(id: string, data: any, requestingUser?: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.requireSameSchool(requestingUser, user);
    if (requestingUser && !requestingUser.roles?.includes('super_admin') && await this.userHasRole(id, 'super_admin')) {
      throw new BadRequestException('Cannot modify a super admin user');
    }
    const isSuperAdmin = requestingUser?.roles?.includes('super_admin');
    // Validate metadata FKs before write
    let validatedMetadata = data.metadata;
    if (data.metadata !== undefined) {
      const effectiveSchoolId = (isSuperAdmin && data.schoolId) ? await this.resolveSchoolId(data.schoolId) : (user.schoolId as string);
      validatedMetadata = await this.validateMetadata(data.metadata, effectiveSchoolId);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.firstNameAr !== undefined && { firstNameAr: data.firstNameAr }),
        ...(data.lastNameAr !== undefined && { lastNameAr: data.lastNameAr }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.locale !== undefined && { locale: data.locale }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(isSuperAdmin && data.schoolId !== undefined && { schoolId: data.schoolId }),
        ...(validatedMetadata !== undefined && { metadata: validatedMetadata }),
      },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true,
        avatarUrl: true, locale: true, timezone: true, isActive: true, schoolId: true,
        metadata: true,
      },
    });
    if (data.roleName) {
      if (!requestingUser?.roles?.includes('super_admin')) {
        throw new BadRequestException('Only super admin can change a user roles');
      }
      const role = await this.prisma.role.findFirst({ where: { name: data.roleName } });
      if (role) {
        await this.prisma.userRole.deleteMany({ where: { userId: id } });
        await this.prisma.userRole.create({
          data: { userId: id, roleId: role.id, assignedBy: requestingUser.id },
        });
      }
    }
    return updated;
  }

  async deactivateUser(id: string) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  async activateUser(id: string) {
    return this.prisma.user.update({ where: { id }, data: { isActive: true } });
  }

  async deleteUser(id: string, requestingUser?: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.requireSameSchool(requestingUser, user);
    if (requestingUser && !requestingUser.roles?.includes('super_admin') && await this.userHasRole(id, 'super_admin')) {
      throw new BadRequestException('Cannot delete a super admin user');
    }
    return this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async bulkDeleteUsers(ids: string[], requestingUser?: any): Promise<{ deleted: number }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids are required');
    }
    const uniqueIds = [...new Set(ids)];
    const isSuperAdmin = !!requestingUser?.roles?.includes('super_admin');

    // Filter out accounts the caller may not delete: other-school users (implicitly
    // via the schoolId below) and super_admin accounts (non-super-admin callers).
    const deletable: string[] = [];
    for (const id of uniqueIds) {
      if (!isSuperAdmin && (await this.userHasRole(id, 'super_admin'))) continue;
      deletable.push(id);
    }
    if (deletable.length === 0) return { deleted: 0 };

    const where: any = { id: { in: deletable }, deletedAt: null };
    if (!isSuperAdmin) where.schoolId = requestingUser?.schoolId;

    const result = await this.prisma.user.updateMany({ where, data: { deletedAt: new Date() } });
    return { deleted: result.count };
  }

  async assignRole(userId: string, roleName: string, requestingUser?: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.requireSameSchool(requestingUser, user);
    if (requestingUser && !requestingUser.roles?.includes('super_admin') && (roleName === 'super_admin' || roleName === 'admin')) {
      throw new BadRequestException('Only super admin can assign super_admin or admin roles');
    }
    const role = await this.prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role "${roleName}" not found`);
    const existing = await this.prisma.userRole.findUnique({ where: { userId_roleId: { userId, roleId: role.id } } });
    if (existing) throw new ConflictException('User already has this role');
    return this.prisma.userRole.create({ data: { userId, roleId: role.id } });
  }

  async removeRole(userId: string, roleName: string, requestingUser?: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.requireSameSchool(requestingUser, user);
    if (requestingUser && !requestingUser.roles?.includes('super_admin') && (roleName === 'super_admin' || roleName === 'admin')) {
      throw new BadRequestException('Only super admin can remove super_admin or admin roles');
    }
    const role = await this.prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role "${roleName}" not found`);
    return this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
  }

  async createUser(requestingUser: any, schoolIdentifier?: string, data?: any) {
    if (!data) throw new BadRequestException('User data is required');
    const isSuperAdmin = requestingUser?.roles?.includes('super_admin');
    let schoolId: string;

    if (isSuperAdmin && data.schoolId) {
      schoolId = await this.resolveSchoolId(data.schoolId);
    } else if (schoolIdentifier) {
      schoolId = await this.resolveSchoolId(schoolIdentifier);
    } else if (isSuperAdmin) {
      throw new BadRequestException('schoolId is required for super admin');
    } else {
      schoolId = requestingUser?.schoolId;
      if (!schoolId) throw new BadRequestException('Unable to determine school');
    }

    const existing = await this.prisma.user.findFirst({ where: { email: data.email, schoolId, deletedAt: null } });
    if (existing) throw new ConflictException('User with this email already exists');
    // Validate metadata FKs
    let validatedMetadata = data.metadata;
    if (validatedMetadata !== undefined) validatedMetadata = await this.validateMetadata(validatedMetadata, schoolId);
    const passwordHash = await bcrypt.hash(data.password || 'Password123!', 12);
    const user = await this.prisma.user.create({
      data: {
        email: data.email, passwordHash,
        firstName: data.firstName, lastName: data.lastName,
        gender: data.gender,
        firstNameAr: data.firstNameAr, lastNameAr: data.lastNameAr,
        phone: data.phone, schoolId, locale: 'en', timezone: 'UTC',
        ...(validatedMetadata !== undefined && { metadata: validatedMetadata }),
      },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
    });
    if (data.roleName) {
      if (!isSuperAdmin && (data.roleName === 'super_admin' || data.roleName === 'admin')) {
        throw new BadRequestException('Only super admin can assign super_admin or admin roles');
      }
      const role = await this.prisma.role.findFirst({ where: { name: data.roleName } });
      if (role) await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }
    return user;
  }

  async listRoles() {
    return this.prisma.role.findMany({ orderBy: { level: 'asc' } });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  async getRolePermissions(roleName: string) {
    const role = await this.prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role "${roleName}" not found`);
    const links = await this.prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: { select: { name: true } } },
    });
    return links.map(l => l.permission.name);
  }

  async setRolePermissions(roleName: string, permissionNames: string[], requestingUser?: any) {
    if (!requestingUser?.roles?.includes('super_admin') && !requestingUser?.roles?.includes('admin')) {
      throw new BadRequestException('Only admin or super admin can change role permissions');
    }
    const role = await this.prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role "${roleName}" not found`);

    // Auto-create any missing permissions so the frontend can save freely
    const existingPerms = await this.prisma.permission.findMany({
      where: { name: { in: permissionNames } },
      select: { id: true, name: true },
    });
    const existingNames = new Set(existingPerms.map(p => p.name));
    const missingNames = permissionNames.filter(n => !existingNames.has(n));

    let createdPerms: { id: string; name: string }[] = [];
    if (missingNames.length > 0) {
      createdPerms = await Promise.all(
        missingNames.map(name => {
          const [resource, action] = name.split(':');
          const displayName = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
          return this.prisma.permission.create({
            data: { name, displayName, resource, action },
            select: { id: true, name: true },
          });
        }),
      );
    }

    const allPerms = [...existingPerms, ...createdPerms];
    const permissionIds = allPerms.map(p => p.id);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      ...permissionIds.map(permissionId =>
        this.prisma.rolePermission.create({ data: { roleId: role.id, permissionId } }),
      ),
    ]);

    return { role: roleName, permissions: permissionNames };
  }

  async listSchools(requestingUser?: any) {
    const canViewAll = requestingUser?.roles?.includes('super_admin') || requestingUser?.roles?.includes('admin');
    if (canViewAll) {
      return this.prisma.school.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
    }
    return this.prisma.school.findMany({
      where: { id: requestingUser?.schoolId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createSchool(data: { name: string; nameAr?: string; slug?: string; churchId?: string; address?: string; phone?: string; email?: string; timezone?: string; locale?: string; logoUrl?: string }) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let churchId = data.churchId;
    if (!churchId) {
      const church = await this.prisma.church.findFirst({ where: { deletedAt: null } });
      if (church) {
        churchId = church.id;
      } else {
        const newChurch = await this.prisma.church.create({ data: { name: data.name, slug } });
        churchId = newChurch.id;
      }
    }
    return this.prisma.school.create({
      data: {
        name: data.name,
        nameAr: data.nameAr,
        slug,
        churchId,
        address: data.address,
        phone: data.phone,
        email: data.email,
        timezone: data.timezone || 'UTC',
        locale: data.locale || 'en',
        logoUrl: data.logoUrl || null,
        isActive: true,
      },
    });
  }

  async getSchool(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { church: { select: { id: true, name: true, nameAr: true, logoUrl: true, schoolNameEn: true, schoolNameAr: true } } },
    });
    if (!school) throw new NotFoundException('School not found');
    return school;
  }

  async updateSchool(id: string, data: any) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    return this.prisma.school.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.locale !== undefined && { locale: data.locale }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
        ...(data.churchId !== undefined && { churchId: data.churchId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async deleteSchool(id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    await this.prisma.school.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async getSystemConfig(schoolId: string, key?: string) {
    const where: any = { schoolId };
    if (key) where.key = key;
    const configs = await this.prisma.systemConfig.findMany({ where });
    if (key) return configs[0] || null;
    return configs;
  }

  async setSystemConfig(schoolId: string, key: string, value: any, description?: string) {
    return this.prisma.systemConfig.upsert({
      where: { schoolId_key: { schoolId, key } },
      update: { value, description },
      create: { schoolId, key, value, description },
    });
  }
}

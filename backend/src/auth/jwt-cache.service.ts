import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class JwtCacheService {
  private readonly TTL = 900; // 15 minutes, match JWT expiry

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private prisma: PrismaService,
  ) {}

  async getCachedUserContext(userId: string): Promise<any | null> {
    const cacheKey = `user:${userId}:context`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        schoolId: true,
        userRoles: {
          where: { deletedAt: null },
          select: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: {
                  where: { deletedAt: null },
                  select: { permission: { select: { id: true, code: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const context = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      schoolId: user.schoolId,
      roles: user.userRoles.map(ur => ur.role.name),
      permissions: Array.from(
        new Set(
          user.userRoles
            .flatMap(ur => ur.role.permissions)
            .map(rp => rp.permission.code),
        ),
      ),
    };

    await this.cacheManager.set(cacheKey, context, this.TTL);
    return context;
  }

  async invalidateUserContext(userId: string): Promise<void> {
    const cacheKey = `user:${userId}:context`;
    await this.cacheManager.del(cacheKey);
  }
}

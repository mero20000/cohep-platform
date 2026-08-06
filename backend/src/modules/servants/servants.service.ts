import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

const SERVANT_ROLE_NAMES = ['servant', 'group_leader', 'level_leader'] as const;

@Injectable()
export class ServantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async listServants(
    user: { id: string; schoolId?: string; roles: string[] },
    query: { search?: string; role?: string; levelId?: string; groupId?: string; teachingSubject?: string } = {},
  ) {
    const isSuperAdmin = user.roles?.includes('super_admin');
    const where: any = {
      deletedAt: null,
      userRoles: {
        some: { role: { name: { in: [...SERVANT_ROLE_NAMES] } } },
      },
    };
    if (!isSuperAdmin && user.schoolId) where.schoolId = user.schoolId;

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) {
      where.userRoles = {
        some: {
          role: {
            name: { in: [...SERVANT_ROLE_NAMES].filter(r => r === query.role) },
          },
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true,
        email: true, phone: true, avatarUrl: true, isActive: true, lastLoginAt: true,
        userRoles: { select: { role: { select: { id: true, name: true, displayName: true } } } },
        metadata: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return users
      .filter((u: any) => !u.deletedAt)
      .map((u: any) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName, firstNameAr: u.firstNameAr,
        lastNameAr: u.lastNameAr, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl,
        isActive: u.isActive, lastLoginAt: u.lastLoginAt,
        userRoles: u.userRoles,
        metadata: (u.metadata as any) || undefined,
      }))
      .filter((u: any) => {
        if (query.levelId && (u.metadata?.levelId ?? '') !== query.levelId) return false;
        if (query.groupId && (u.metadata?.groupId ?? '') !== query.groupId) return false;
        if (query.teachingSubject && !(u.metadata?.teachingSubjects ?? []).includes(query.teachingSubject)) return false;
        return true;
      });
  }

  async getPendingLiturgies(userId: string) {
    const servant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (!servant) throw new NotFoundException('User not found');

    const records = await this.prisma.familyLiturgy.findMany({
      where: { status: 'pending', student: { schoolId: servant.schoolId } },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });

    const userIds = [...new Set(records.map(r => r.notedBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return records.map(r => ({
      id: r.id,
      student: r.student,
      parent: userMap.get(r.notedBy) || null,
      date: r.date,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  }

  async verifyLiturgy(id: string, userId: string) {
    const record = await this.prisma.familyLiturgy.findUnique({
      where: { id },
      include: { student: { select: { schoolId: true } } },
    });
    if (!record) throw new NotFoundException('Liturgy record not found');

    const servant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (record.student.schoolId !== servant?.schoolId) {
      throw new ForbiddenException('Cannot verify liturgy from another school');
    }

    const updated = await this.prisma.familyLiturgy.update({
      where: { id },
      data: { status: 'verified', verifiedBy: userId, verifiedAt: new Date() },
    });

    const xpCfg = await this.prisma.systemConfig.findUnique({
      where: { schoolId_key: { schoolId: record.student.schoolId, key: 'liturgy_xp_reward' } },
    });
    const xpReward = (xpCfg?.value as number) ?? 30;
    try {
      await this.gamification.addXp(record.studentId, xpReward, 'liturgy', 'Liturgy attendance verified');
    } catch {
      // XP is best-effort
    }

    let badgeAwarded = false;
    const thresholdCfg = await this.prisma.systemConfig.findUnique({
      where: { schoolId_key: { schoolId: record.student.schoolId, key: 'liturgy_badge_threshold' } },
    });
    const threshold = (thresholdCfg?.value as number) ?? 10;

    const verifiedCount = await this.prisma.familyLiturgy.count({
      where: { studentId: record.studentId, status: 'verified' },
    });

    if (verifiedCount >= threshold) {
      const badge = await this.prisma.badge.findFirst({
        where: {
          schoolId: record.student.schoolId,
          criteria: { path: ['rule'], equals: 'liturgy_total' },
        },
      });
      if (badge) {
        try {
          await this.gamification.awardBadge(record.studentId, badge.id);
          badgeAwarded = true;
        } catch {
          // Badge may already be awarded
        }
      }
    }

    return { id: updated.id, status: updated.status, badgeAwarded };
  }

  async rejectLiturgy(id: string, userId: string) {
    const record = await this.prisma.familyLiturgy.findUnique({
      where: { id },
      include: { student: { select: { schoolId: true } } },
    });
    if (!record) throw new NotFoundException('Liturgy record not found');

    const servant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (record.student.schoolId !== servant?.schoolId) {
      throw new ForbiddenException('Cannot reject liturgy from another school');
    }

    await this.prisma.familyLiturgy.delete({ where: { id } });
    return { deleted: true };
  }
}

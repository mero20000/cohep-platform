import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { GamificationService } from '../gamification/gamification.service';

const SERVANT_ROLE_NAMES = ['servant', 'group_leader', 'level_leader'] as const;

export interface ServantProfileData {
  userId: string
  name: string
  photoUrl: string | null
  roles: string[]
  assignedLevel: string | null
  assignedGroup: string | null
  teachingSubjects: string[]
  yearsOfService: number
  dateJoined: string | null
  totalStudents: number
  totalSessions: number
  totalHymns: number
  totalReviews: number
  lastCalculatedAt: Date
}

export interface ServantMilestoneData {
  type: string
  threshold: number
  label: string
  reachedAt: Date
}

const MILESTONE_THRESHOLDS = {
  years_of_service: [1, 3, 5, 10, 15, 20],
  students_taught: [10, 50, 100, 500],
  sessions_taught: [25, 50, 100, 250, 500],
  hymns_covered: [10, 25, 50, 100],
}

@Injectable()
export class ServantsService {
  private readonly logger = new Logger(ServantsService.name);

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
        email: true, phone: true, avatarUrl: true, isActive: true, lastLoginAt: true, deletedAt: true,
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

  async getServantProfile(userId: string, viewerId: string): Promise<ServantProfileData | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        servantProfile: true,
      },
    })
    if (!user || user.deletedAt) return null

    // Check viewer is in same school
    const viewer = await this.prisma.user.findUnique({ where: { id: viewerId } })
    if (!viewer || viewer.schoolId !== user.schoolId) return null

    const roles = user.userRoles.map(ur => ur.role.name)
    const metadata = (user.metadata as any) || {}

    const profile = user.servantProfile

    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      photoUrl: user.avatarUrl,
      roles,
      assignedLevel: profile?.currentLevelName || null,
      assignedGroup: profile?.currentGroupName || null,
      teachingSubjects: metadata.teachingSubjects || [],
      yearsOfService: profile?.yearsOfService || 0,
      dateJoined: metadata.dateJoined || user.createdAt.toISOString(),
      totalStudents: profile?.totalStudents || 0,
      totalSessions: profile?.totalSessions || 0,
      totalHymns: profile?.totalHymns || 0,
      totalReviews: profile?.totalReviews || 0,
      lastCalculatedAt: profile?.lastCalculatedAt || new Date(0),
    }
  }

  async getServantTimeline(userId: string, viewerId: string): Promise<ServantMilestoneData[]> {
    // Only the servant themselves can view their timeline
    if (userId !== viewerId) return []

    const milestones = await this.prisma.servantMilestone.findMany({
      where: { userId },
      orderBy: { reachedAt: 'asc' },
      select: {
        type: true,
        threshold: true,
        label: true,
        reachedAt: true,
      },
    })

    return milestones
  }

  async getMyServantProfile(userId: string): Promise<ServantProfileData | null> {
    return this.getServantProfile(userId, userId)
  }

  async getSchoolServantSummary(schoolId: string): Promise<ServantProfileData[]> {
    const servants = await this.prisma.user.findMany({
      where: {
        schoolId,
        deletedAt: null,
        userRoles: { some: { role: { name: { in: ['servant', 'group_leader', 'level_leader'] } } } },
      },
      include: {
        userRoles: { include: { role: true } },
        servantProfile: true,
      },
    })

    return servants.map(user => {
      const roles = user.userRoles.map(ur => ur.role.name)
      const metadata = (user.metadata as any) || {}
      const profile = user.servantProfile

      return {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        photoUrl: user.avatarUrl,
        roles,
        assignedLevel: profile?.currentLevelName || null,
        assignedGroup: profile?.currentGroupName || null,
        teachingSubjects: metadata.teachingSubjects || [],
        yearsOfService: profile?.yearsOfService || 0,
        dateJoined: metadata.dateJoined || user.createdAt.toISOString(),
        totalStudents: profile?.totalStudents || 0,
        totalSessions: profile?.totalSessions || 0,
        totalHymns: profile?.totalHymns || 0,
        totalReviews: profile?.totalReviews || 0,
        lastCalculatedAt: profile?.lastCalculatedAt || new Date(0),
      }
    })
  }

  private async computeServantStats(userId: string, schoolId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return null

    const now = new Date()
    const metadata = (user.metadata as any) || {}
    
    // Use dateJoined from metadata if available, otherwise fall back to createdAt
    const joinDate = metadata.dateJoined ? new Date(metadata.dateJoined) : user.createdAt
    const yearsOfService = Math.floor((now.getTime() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

    const totalSessions = await this.prisma.attendanceSession.count({
      where: { servantId: userId, deletedAt: null },
    })

    // Calculate students based on current metadata assignment
    let totalStudents = 0
    const studentWhere: any = { schoolId, deletedAt: null, status: 'active' }
    
    if (metadata.groupId) {
      // If assigned to a group, count students in that group
      studentWhere.groupId = metadata.groupId
      if (metadata.levelId) {
        studentWhere.levelId = metadata.levelId
      }
      if (metadata.gradeId) {
        studentWhere.gradeId = metadata.gradeId
      }
      totalStudents = await this.prisma.student.count({ where: studentWhere })
    } else {
      // Fallback: count students from attendance records
      totalStudents = await this.prisma.attendanceRecord.groupBy({
        by: ['studentId'],
        where: {
          attendanceSession: { servantId: userId, deletedAt: null },
        },
      }).then(records => records.length)
    }

    const totalHymns = await this.prisma.subjectItem.count({
      where: {
        lessons: { some: { schoolId: user.schoolId } },
      },
    })

    const totalReviews = await this.prisma.hymnPracticeSession.count({
      where: { reviewedBy: userId },
    })

    let currentLevelName: string | null = null
    let currentGroupName: string | null = null

    if (metadata.levelId) {
      const level = await this.prisma.level.findUnique({ where: { id: metadata.levelId }, select: { name: true } })
      currentLevelName = level?.name || null
    }
    if (metadata.groupId) {
      const group = await this.prisma.group.findUnique({ where: { id: metadata.groupId }, select: { name: true } })
      currentGroupName = group?.name || null
    }

    return {
      yearsOfService,
      totalStudents,
      totalSessions,
      totalHymns,
      totalReviews,
      currentLevelName,
      currentGroupName,
    }
  }

  private async checkAndLogMilestones(profileId: string, userId: string, stats: {
    yearsOfService: number
    totalStudents: number
    totalSessions: number
    totalHymns: number
  }) {
    const checks = [
      { type: 'years_of_service', value: stats.yearsOfService, labelFn: (t: number) => `${t} year${t > 1 ? 's' : ''} of service` },
      { type: 'students_taught', value: stats.totalStudents, labelFn: (t: number) => `${t}th student taught` },
      { type: 'sessions_taught', value: stats.totalSessions, labelFn: (t: number) => `${t}th session taught` },
      { type: 'hymns_covered', value: stats.totalHymns, labelFn: (t: number) => `${t}th hymn covered` },
    ]

    for (const check of checks) {
      const thresholds = MILESTONE_THRESHOLDS[check.type as keyof typeof MILESTONE_THRESHOLDS] || []
      for (const threshold of thresholds) {
        if (check.value >= threshold) {
          await this.prisma.servantMilestone.upsert({
            where: {
              userId_type_threshold: { userId, type: check.type, threshold },
            },
            create: {
              userId,
              profileId,
              type: check.type,
              threshold,
              label: check.labelFn(threshold),
            },
            update: {},
          })
        }
      }
    }
  }

  @Cron('0 3 * * *')
  async updateServantProfiles() {
    const servants = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        userRoles: { some: { role: { name: { in: ['servant', 'group_leader', 'level_leader'] } } } },
      },
    })

    for (const servant of servants) {
      try {
        const stats = await this.computeServantStats(servant.id, servant.schoolId)
        if (!stats) continue

        const profile = await this.prisma.servantProfile.upsert({
          where: { userId: servant.id },
          create: {
            userId: servant.id,
            schoolId: servant.schoolId,
            ...stats,
            lastCalculatedAt: new Date(),
          },
          update: {
            ...stats,
            lastCalculatedAt: new Date(),
          },
        })

        await this.checkAndLogMilestones(profile.id, servant.id, stats)

        // Role change detection
        const roles = await this.prisma.userRole.findMany({
          where: { userId: servant.id },
          include: { role: true },
        })
        const currentRoles = roles.map(ur => ur.role.name)
        const previousRoles = profile.previousRoles || []
        const newRoles = currentRoles.filter(r => !previousRoles.includes(r))

        if (newRoles.length > 0) {
          const ROLE_LABELS: Record<string, string> = {
            servant: 'Joined as servant',
            group_leader: 'Promoted to Group Leader',
            level_leader: 'Promoted to Level Leader',
          }
          const ROLE_HIERARCHY = ['servant', 'group_leader', 'level_leader']

          for (const newRole of newRoles) {
            const existing = await this.prisma.servantMilestone.findFirst({
              where: { userId: servant.id, type: 'role_change', label: ROLE_LABELS[newRole] },
            })
            if (!existing) {
              await this.prisma.servantMilestone.create({
                data: {
                  userId: servant.id,
                  profileId: profile.id,
                  type: 'role_change',
                  threshold: ROLE_HIERARCHY.indexOf(newRole),
                  label: ROLE_LABELS[newRole],
                },
              })
            }
          }

          await this.prisma.servantProfile.update({
            where: { userId: servant.id },
            data: { previousRoles: currentRoles },
          })
        }
      } catch (error) {
        this.logger.error(`Failed to update servant ${servant.id}: ${error}`)
      }
    }

    this.logger.log(`Updated ${servants.length} servant profiles`)
  }
}

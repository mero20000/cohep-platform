import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { StudentNotificationsService } from '../student-notifications/student-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

const SERVANT_ROLE_NAMES = ['servant', 'group_leader', 'level_leader'] as const;

// Roles (besides the servant themselves) that may open another servant's profile.
const PROFILE_VIEWER_ROLES = ['super_admin', 'admin', 'principal', 'level_leader'];

export interface ServantProfileData {
  userId: string
  name: string
  photoUrl: string | null
  roles: string[]
  assignedLevel: string | null
  assignedGroup: string | null
  teachingSubjects: string[]
  teachingGender: string | null
  yearsOfService: number
  dateJoined: string | null
  totalStudents: number
  totalSessions: number
  totalHymns: number
  totalReviews: number
  lastCalculatedAt: Date
  nextMilestone: NextMilestone | null
  /** Milestones the servant has not yet seen. Only populated when viewing your own profile. */
  newMilestones?: ServantMilestoneData[]
}

export interface ServantMilestoneData {
  type: string
  threshold: number
  label: string
  labelAr?: string | null
  reachedAt: Date
}

export interface NextMilestone {
  type: string
  current: number
  target: number
  remaining: number
  label: string
  labelAr: string
}

export interface GroupMate {
  id: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  avatarUrl: string | null;
  phone: string | null;
}

const MILESTONE_THRESHOLDS = {
  years_of_service: [1, 3, 5, 10, 15, 20, 25, 30],
  students_taught: [10, 50, 100, 250, 500, 1000],
  sessions_taught: [25, 50, 100, 250, 500, 1000],
  hymns_covered: [10, 25, 50, 100, 150, 200],
}

type MilestoneMetric = keyof typeof MILESTONE_THRESHOLDS

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}

const MILESTONE_LABELS: Record<MilestoneMetric, { en: (t: number) => string; ar: (t: number) => string }> = {
  years_of_service: {
    en: (t) => `${t} year${t > 1 ? 's' : ''} of service`,
    ar: (t) => `${t} ${t === 1 ? 'سنة' : t === 2 ? 'سنتان' : t <= 10 ? 'سنوات' : 'سنة'} من الخدمة`,
  },
  students_taught: { en: (t) => `${ordinal(t)} student taught`, ar: (t) => `الطالب رقم ${t}` },
  sessions_taught: { en: (t) => `${ordinal(t)} session taught`, ar: (t) => `الحصة رقم ${t}` },
  hymns_covered: { en: (t) => `${ordinal(t)} hymn covered`, ar: (t) => `التسبحة رقم ${t}` },
}

const MILESTONE_VALUE_KEY: Record<MilestoneMetric, 'yearsOfService' | 'totalStudents' | 'totalSessions' | 'totalHymns'> = {
  years_of_service: 'yearsOfService',
  students_taught: 'totalStudents',
  sessions_taught: 'totalSessions',
  hymns_covered: 'totalHymns',
}

/** Arabic label for a threshold milestone; null for types without a template (e.g. role_change). */
function milestoneLabelAr(type: string, threshold: number): string | null {
  return MILESTONE_LABELS[type as MilestoneMetric]?.ar(threshold) ?? null
}

/** The milestone the servant is closest to (highest progress toward the next threshold). */
function computeNextMilestone(stats: { yearsOfService: number; totalStudents: number; totalSessions: number; totalHymns: number }): NextMilestone | null {
  let best: (NextMilestone & { progress: number }) | null = null
  for (const type of Object.keys(MILESTONE_THRESHOLDS) as MilestoneMetric[]) {
    const current = stats[MILESTONE_VALUE_KEY[type]]
    const target = MILESTONE_THRESHOLDS[type].find((t) => t > current)
    if (target === undefined) continue
    const progress = current / target
    if (!best || progress > best.progress) {
      best = {
        type, current, target, remaining: target - current, progress,
        label: MILESTONE_LABELS[type].en(target), labelAr: MILESTONE_LABELS[type].ar(target),
      }
    }
  }
  if (!best) return null
  const { progress: _progress, ...next } = best
  return next
}

@Injectable()
export class ServantsService {
  private readonly logger = new Logger(ServantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly studentNotifications: StudentNotificationsService,
    private readonly notifications: NotificationsService,
  ) {}

  async listServants(
    user: { id: string; schoolId?: string; roles: string[]; metadata?: any },
    query: { search?: string; role?: string; levelId?: string; groupId?: string; teachingSubject?: string; excludeSelf?: boolean } = {},
  ) {
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isAdmin = user.roles?.includes('admin') || user.roles?.includes('principal');
    const isLevelLeader = user.roles?.includes('level_leader');
    const isGroupLeader = user.roles?.includes('group_leader');
    const isServant = user.roles?.includes('servant');

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
        gender: true,
        school: {
          select: {
            id: true, name: true, nameAr: true, logoUrl: true,
            church: { select: { id: true, name: true, nameAr: true, logoUrl: true } },
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    const userMeta = (user.metadata as any) || {};
    const userGroupId = userMeta.groupId as string | undefined;
    const userLevelId = userMeta.levelId as string | undefined;

    const filtered = users
      .filter((u: any) => !u.deletedAt)
      .filter((u: any) => !query.excludeSelf || u.id !== user.id)
      .filter((u: any) => {
        const uMeta = (u.metadata as any) || {};

        // Scope by role: servants/group leaders only see their own group, level leaders see their level
        if (!isSuperAdmin && !isAdmin) {
          if (isServant && userGroupId) {
            // Servants only see other servants in their group
            if (uMeta.groupId !== userGroupId) return false;
          } else if (isGroupLeader && userGroupId) {
            // Group leaders only see other servants in their group
            if (uMeta.groupId !== userGroupId) return false;
          } else if (isLevelLeader && userLevelId) {
            // Level leaders only see servants in their level
            if (uMeta.levelId !== userLevelId) return false;
          }
        }

        // Apply explicit query filters on top
        if (query.levelId && uMeta.levelId !== query.levelId) return false;
        if (query.groupId && uMeta.groupId !== query.groupId) return false;
        if (query.teachingSubject) {
          const want = query.teachingSubject.toLowerCase().replace(/\s+/g, '_');
          const have = ((uMeta.teachingSubjects ?? []) as string[]).map((s: string) => s.toLowerCase().replace(/\s+/g, '_'));
          if (!have.includes(want)) return false;
        }
        return true;
      });

    // Enrich with group/level names
    const groupIds = [...new Set(filtered.map(u => (u.metadata as any)?.groupId).filter(Boolean))] as string[];
    const levelIds = [...new Set(filtered.map(u => (u.metadata as any)?.levelId).filter(Boolean))] as string[];

    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds }, deletedAt: null },
      select: { id: true, name: true, nameAr: true },
    });
    const levels = await this.prisma.level.findMany({
      where: { id: { in: levelIds }, deletedAt: null },
      select: { id: true, name: true, nameAr: true },
    });

    const groupMap = new Map(groups.map(g => [g.id, g]));
    const levelMap = new Map(levels.map(l => [l.id, l]));

    return filtered.map((u: any) => {
      const meta = (u.metadata as any) || {};
      const group = meta.groupId ? groupMap.get(meta.groupId) : null;
      const level = meta.levelId ? levelMap.get(meta.levelId) : null;

      return {
        id: u.id, firstName: u.firstName, lastName: u.lastName, firstNameAr: u.firstNameAr,
        lastNameAr: u.lastNameAr, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl,
        isActive: u.isActive, lastLoginAt: u.lastLoginAt,
        gender: (u as any).gender,
        school: (u as any).school,
        userRoles: u.userRoles,
        metadata: meta,
        groupId: meta.groupId,
        groupName: group?.name,
        groupNameAr: group?.nameAr,
        levelId: meta.levelId,
        levelName: level?.name,
        levelNameAr: level?.nameAr,
        attendanceRate: 80, // Placeholder: can be calculated from attendance sessions later
        studentsManaged: 0, // Placeholder: calculated from group students
        role: u.userRoles?.[0]?.role?.name,
      };
    });
  }

  async getGroupMates(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true, schoolId: true },
    });
    const meta = (me?.metadata as any) || {};
    const groupId = meta.groupId as string | undefined;
    if (!groupId) return [];

    const mates = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        schoolId: me?.schoolId,
        deletedAt: null,
        userRoles: { some: { role: { name: { in: [...SERVANT_ROLE_NAMES] } } } },
      },
      select: {
        id: true, firstName: true, lastName: true,
        firstNameAr: true, lastNameAr: true, avatarUrl: true, phone: true,
        metadata: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return mates
      .filter((u: any) => ((u.metadata as any) || {}).groupId === groupId)
      .map((u: any) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName,
        firstNameAr: u.firstNameAr, lastNameAr: u.lastNameAr,
        avatarUrl: u.avatarUrl, phone: u.phone,
      }));
  }

  async getPendingLiturgies(userId: string) {
    const servant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (!servant) throw new NotFoundException('User not found');

    const records = await this.prisma.familyLiturgy.findMany({
      // A claim this servant logged themselves (e.g. an admin who also has parent
      // access) is excluded here rather than just blocked on verify/reject — otherwise
      // it shows up as an actionable row that always 403s when clicked.
      where: { status: 'pending', notedBy: { not: userId }, student: { schoolId: servant.schoolId } },
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
    if (record.notedBy === userId) {
      throw new ForbiddenException('Cannot verify a liturgy claim you logged yourself');
    }

    const updated = await this.prisma.familyLiturgy.update({
      where: { id },
      data: {
        status: 'verified',
        verifiedBy: userId,
        verifiedAt: new Date(),
        // Verifying supersedes any earlier rejection of the same claim.
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    });

    await this.studentNotifications.notifyOrRefresh({
      studentId: record.studentId,
      type: 'liturgy_verified',
      title: 'Your liturgy attendance was confirmed',
      titleAr: 'تم تأكيد حضورك القداس',
      body: new Date(updated.date).toLocaleDateString('en-GB'),
      bodyAr: new Date(updated.date).toLocaleDateString('en-GB'),
      linkPath: '?tab=liturgy',
      referenceType: 'family_liturgy',
      referenceId: updated.id,
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

    // Route through the standard badge-computation engine rather than re-deriving a
    // separate threshold here — that engine is the single source of truth for every
    // badge's own configured criteria.count, and it already counts this verification
    // (see GamificationService.checkLiturgyTotal, which combines verified FamilyLiturgy
    // claims with servant roll-call attendance into one canonical total).
    const { awarded } = await this.gamification.computeBadgesForStudent(record.studentId);
    const badgeAwarded = awarded > 0;

    return { id: updated.id, status: updated.status, badgeAwarded };
  }

  /**
   * Refuse a liturgy attendance claim.
   *
   * This was a hard row delete: no reason was recorded and no one was told, so the claim
   * silently vanished for both the student and the parent who filed it. It is now a status
   * change carrying a reason, which makes the rejection answerable — and, because the
   * (studentId, date) pair is unique, means logLiturgy has to be able to re-open a
   * rejected claim rather than being permanently blocked by it.
   */
  async rejectLiturgy(id: string, userId: string, reason?: string) {
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
    if (record.notedBy === userId) {
      throw new ForbiddenException('Cannot reject a liturgy claim you logged yourself');
    }

    const trimmed = reason?.trim() || null;
    const updated = await this.prisma.familyLiturgy.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: trimmed,
        // A rejection undoes any earlier verification, so the two cannot both stand.
        verifiedBy: null,
        verifiedAt: null,
      },
    });

    // Keeping the row was only half the fix — without this the student still has to go
    // looking to discover the claim was refused.
    await this.studentNotifications.notifyOrRefresh({
      studentId: record.studentId,
      type: 'liturgy_rejected',
      title: 'A liturgy attendance record was not approved',
      titleAr: 'لم يتم اعتماد حضور قداس',
      body: trimmed
        ? `${new Date(updated.date).toLocaleDateString('en-GB')} — ${trimmed}`
        : `${new Date(updated.date).toLocaleDateString('en-GB')} — no reason was given.`,
      bodyAr: trimmed
        ? `${new Date(updated.date).toLocaleDateString('en-GB')} — ${trimmed}`
        : `${new Date(updated.date).toLocaleDateString('en-GB')} — لم يُذكر سبب.`,
      linkPath: '?tab=liturgy',
      referenceType: 'family_liturgy',
      referenceId: updated.id,
    });

    return {
      id: updated.id,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      rejectedAt: updated.rejectedAt,
    };
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

    // A ministry profile is private: the servant themselves, school leadership, and level
    // leaders (who oversee servants via My Servants) may open it, always within one school.
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      include: { userRoles: { include: { role: true } } },
    })
    if (!viewer || viewer.schoolId !== user.schoolId) return null
    const isSelf = viewerId === userId
    const viewerRoles = (viewer.userRoles ?? []).map((ur: any) => ur.role.name)
    if (!isSelf && !viewerRoles.some((r: string) => PROFILE_VIEWER_ROLES.includes(r))) return null

    const roles = user.userRoles.map(ur => ur.role.name)
    const metadata = (user.metadata as any) || {}

    const profile = user.servantProfile
    const stats = {
      yearsOfService: profile?.yearsOfService || 0,
      totalStudents: profile?.totalStudents || 0,
      totalSessions: profile?.totalSessions || 0,
      totalHymns: profile?.totalHymns || 0,
    }

    const result: ServantProfileData = {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      photoUrl: user.avatarUrl,
      roles,
      assignedLevel: profile?.currentLevelName || null,
      assignedGroup: profile?.currentGroupName || null,
      teachingSubjects: metadata.teachingSubjects || [],
      teachingGender: metadata.teachingGender || null,
      ...stats,
      dateJoined: metadata.dateJoined || user.createdAt.toISOString(),
      totalReviews: profile?.totalReviews || 0,
      lastCalculatedAt: profile?.lastCalculatedAt || new Date(0),
      nextMilestone: computeNextMilestone(stats),
    }

    if (isSelf) {
      const unseen = await this.prisma.servantMilestone.findMany({
        where: { userId, seenAt: null },
        orderBy: { reachedAt: 'asc' },
        select: { type: true, threshold: true, label: true, reachedAt: true },
      })
      result.newMilestones = unseen.map((m) => ({ ...m, labelAr: milestoneLabelAr(m.type, m.threshold) }))
    }

    return result
  }

  /** Marks every pending milestone as celebrated so the banner stops showing. */
  async markMilestonesSeen(userId: string) {
    const { count } = await this.prisma.servantMilestone.updateMany({
      where: { userId, seenAt: null },
      data: { seenAt: new Date() },
    })
    return { marked: count }
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

    return milestones.map((m) => ({ ...m, labelAr: milestoneLabelAr(m.type, m.threshold) }))
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
        teachingGender: metadata.teachingGender || null,
        yearsOfService: profile?.yearsOfService || 0,
        dateJoined: metadata.dateJoined || user.createdAt.toISOString(),
        totalStudents: profile?.totalStudents || 0,
        totalSessions: profile?.totalSessions || 0,
        totalHymns: profile?.totalHymns || 0,
        totalReviews: profile?.totalReviews || 0,
        lastCalculatedAt: profile?.lastCalculatedAt || new Date(0),
        nextMilestone: computeNextMilestone({
          yearsOfService: profile?.yearsOfService || 0,
          totalStudents: profile?.totalStudents || 0,
          totalSessions: profile?.totalSessions || 0,
          totalHymns: profile?.totalHymns || 0,
        }),
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
      studentWhere.groupId = metadata.groupId
      if (metadata.levelId) {
        studentWhere.levelId = metadata.levelId
      }
      if (metadata.gradeId) {
        studentWhere.gradeId = metadata.gradeId
      }
      if (metadata.teachingGender && metadata.teachingGender !== 'both') {
        studentWhere.gender = metadata.teachingGender
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

    // Hymns the servant actually taught: distinct curriculum subject items
    // linked to their own sessions (never the global catalog count).
    const taughtItems = await this.prisma.attendanceSession.findMany({
      where: { servantId: userId, deletedAt: null, subjectItemId: { not: null } },
      select: { subjectItemId: true },
    });
    const totalHymns = new Set(
      taughtItems.map((s: any) => s.subjectItemId).filter((id: any) => id != null),
    ).size;

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

  /**
   * Logs every newly crossed milestone. A first-ever run for a servant is a silent
   * backfill (already seen, no notification) so history doesn't arrive as a flood.
   */
  private async checkAndLogMilestones(
    profileId: string,
    userId: string,
    stats: {
      yearsOfService: number
      totalStudents: number
      totalSessions: number
      totalHymns: number
    },
    opts: { schoolId?: string; silent?: boolean } = {},
  ) {
    const existing = await this.prisma.servantMilestone.findMany({
      where: { userId },
      select: { type: true, threshold: true },
    })
    const known = new Set(existing.map((m) => `${m.type}:${m.threshold}`))

    for (const type of Object.keys(MILESTONE_THRESHOLDS) as MilestoneMetric[]) {
      const value = stats[MILESTONE_VALUE_KEY[type]]
      for (const threshold of MILESTONE_THRESHOLDS[type]) {
        if (value < threshold || known.has(`${type}:${threshold}`)) continue

        const label = MILESTONE_LABELS[type].en(threshold)
        await this.prisma.servantMilestone.upsert({
          where: { userId_type_threshold: { userId, type, threshold } },
          create: { userId, profileId, type, threshold, label, seenAt: opts.silent ? new Date() : null },
          update: {},
        })

        if (!opts.silent && opts.schoolId) {
          await this.notifications.createNotification({
            schoolId: opts.schoolId,
            userId,
            type: 'servant_milestone',
            title: 'A milestone in your ministry',
            titleAr: 'محطة جديدة في خدمتك',
            body: `${label} — thank you for your service.`,
            bodyAr: `${MILESTONE_LABELS[type].ar(threshold)} — شكراً لخدمتك.`,
            linkPath: `/dashboard/servants/${userId}/profile`,
            referenceType: 'servant_milestone',
          })
        }
      }
    }
  }

  async toggleActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, firstName: true, lastName: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException('Servant not found');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true, firstName: true, lastName: true },
    });
    return updated;
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

        const isFirstRun = !(await this.prisma.servantProfile.findUnique({
          where: { userId: servant.id },
          select: { id: true },
        }))

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

        await this.checkAndLogMilestones(profile.id, servant.id, stats, { schoolId: servant.schoolId, silent: isFirstRun })

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
                  seenAt: isFirstRun ? new Date() : null,
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
    return { updated: servants.length }
  }
}

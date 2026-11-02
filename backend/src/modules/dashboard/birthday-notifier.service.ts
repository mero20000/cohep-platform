import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { localHour, localToday, studentBirthdayWindow } from '../../common/utils/birthday';

const NOTIFY_HOUR = 7;
const SERVANT_ROLE_NAMES = ['servant', 'group_leader', 'level_leader'];

/**
 * Tells each servant, on the morning of a student's birthday, who is celebrating in their class.
 * Runs hourly and acts only for schools whose local time is 07:00, so each school gets it at the
 * right hour. A servant's class comes from the group/level on their profile.
 */
@Injectable()
export class BirthdayNotifier {
  private readonly logger = new Logger(BirthdayNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 * * * *')
  async run(now: Date = new Date()) {
    const schools = await this.prisma.school.findMany({ select: { id: true, timezone: true } });
    let sent = 0;
    for (const school of schools) {
      try {
        if (localHour(now, school.timezone || 'UTC') !== NOTIFY_HOUR) continue;
        sent += await this.notifySchool(school.id, localToday(now, school.timezone || 'UTC'));
      } catch (err: any) {
        this.logger.error(`Birthday notifications failed for school ${school.id}: ${err?.message}`);
      }
    }
    return { sent };
  }

  private async notifySchool(schoolId: string, today: Date): Promise<number> {
    const students = await this.prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, groupId: true, levelId: true, gender: true, dateOfBirth: true },
    });
    const celebrating = students
      .map((s: any) => ({ s, b: studentBirthdayWindow(new Date(s.dateOfBirth), today) }))
      .filter((x): x is { s: any; b: NonNullable<typeof x.b> } => !!x.b && x.b.daysAway === 0);
    if (celebrating.length === 0) return 0;

    const servants = await this.prisma.user.findMany({
      where: {
        schoolId, deletedAt: null, isActive: true,
        userRoles: { some: { role: { name: { in: SERVANT_ROLE_NAMES } } } },
      },
      select: { id: true, metadata: true },
    });

    const day = today.toISOString().slice(0, 10);
    let sent = 0;
    for (const servant of servants) {
      const meta = (servant.metadata as any) || {};
      const mine = celebrating.filter(({ s }) => {
        const inClass = meta.groupId ? s.groupId === meta.groupId : meta.levelId ? s.levelId === meta.levelId : false;
        const genderOk = !meta.teachingGender || meta.teachingGender === 'both' || s.gender === meta.teachingGender;
        return inClass && genderOk;
      });
      if (mine.length === 0) continue;

      const already = await this.prisma.notification.findFirst({
        where: { userId: servant.id, type: 'birthday', referenceId: day },
        select: { id: true },
      });
      if (already) continue;

      const names = mine.map(({ s, b }) => `${s.firstName} (${b.turningAge})`).join(', ');
      await this.notifications.createNotification({
        schoolId,
        userId: servant.id,
        type: 'birthday',
        title: mine.length === 1 ? `Birthday today: ${mine[0].s.firstName} 🎂` : `${mine.length} birthdays today 🎂`,
        body: `Celebrating today: ${names}. Send a greeting from your briefing.`,
        linkPath: '/dashboard/briefing',
        referenceType: 'birthday',
        referenceId: day,
      });
      sent++;
    }
    return sent;
  }
}

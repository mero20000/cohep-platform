import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type StudentNotificationType =
  | 'practice_reviewed'
  | 'assessment_graded'
  | 'liturgy_verified'
  | 'liturgy_rejected'
  | 'liturgy_clearance'
  | 'badge_awarded';

export interface NotifyInput {
  studentId: string;
  type: StudentNotificationType;
  title: string;
  titleAr?: string | null;
  body?: string | null;
  bodyAr?: string | null;
  /**
   * Portal-relative only — a query string or path fragment, never an absolute URL.
   * Enforced in `notify`, so a caller cannot accidentally point a student off-site.
   */
  linkPath?: string | null;
  referenceType?: string | null;
  /** Supplying this makes the emit idempotent for that (student, type, reference). */
  referenceId?: string | null;
}

/**
 * The student's own notification feed.
 *
 * Every event that lands on a student — a review posted, a badge awarded, a liturgy
 * verified or rejected, an assessment graded, clearance to sing granted — was previously
 * discoverable only by the student opening the right screen and noticing a change.
 *
 * Emitting is deliberately best-effort: a notification must never be the reason a review,
 * a grade or a verification fails. Every caller wraps in this service's own try/catch, so
 * callers do not each have to remember to.
 */
@Injectable()
export class StudentNotificationsService {
  private readonly logger = new Logger(StudentNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private static readonly MAX_BODY = 500;

  /** Reject anything that could navigate away from the portal. */
  private safeLinkPath(raw?: string | null): string | null {
    if (!raw) return null;
    const v = raw.trim();
    if (!v) return null;
    // No scheme, no protocol-relative, no backslash tricks.
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//') || v.includes('\\')) return null;
    return v.slice(0, 512);
  }

  /**
   * Record a notification. Never throws — see the class comment.
   * Returns the row when written, or null when it was a duplicate or failed.
   */
  async notify(input: NotifyInput) {
    try {
      return await this.prisma.studentNotification.create({
        data: {
          studentId: input.studentId,
          type: input.type,
          title: input.title,
          titleAr: input.titleAr ?? null,
          body: input.body?.slice(0, StudentNotificationsService.MAX_BODY) ?? null,
          bodyAr: input.bodyAr?.slice(0, StudentNotificationsService.MAX_BODY) ?? null,
          linkPath: this.safeLinkPath(input.linkPath),
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
        },
      });
    } catch (err: any) {
      // P2002 is the unique constraint: this event was already recorded, which is a
      // success from the caller's point of view rather than something to report.
      if (err?.code !== 'P2002') {
        this.logger.warn(`Failed to record ${input.type} for student ${input.studentId}: ${err?.message}`);
      }
      return null;
    }
  }

  /**
   * Re-notify for an event that can legitimately happen twice — a servant changing a
   * rating, or a re-grade. Replaces the existing row's content and marks it unread again,
   * so the student sees the correction rather than a stale first version.
   */
  async notifyOrRefresh(input: NotifyInput) {
    if (!input.referenceId) return this.notify(input);
    try {
      return await this.prisma.studentNotification.upsert({
        where: {
          studentId_type_referenceId: {
            studentId: input.studentId,
            type: input.type,
            referenceId: input.referenceId,
          },
        },
        create: {
          studentId: input.studentId,
          type: input.type,
          title: input.title,
          titleAr: input.titleAr ?? null,
          body: input.body?.slice(0, StudentNotificationsService.MAX_BODY) ?? null,
          bodyAr: input.bodyAr?.slice(0, StudentNotificationsService.MAX_BODY) ?? null,
          linkPath: this.safeLinkPath(input.linkPath),
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId,
        },
        update: {
          title: input.title,
          titleAr: input.titleAr ?? null,
          body: input.body?.slice(0, StudentNotificationsService.MAX_BODY) ?? null,
          bodyAr: input.bodyAr?.slice(0, StudentNotificationsService.MAX_BODY) ?? null,
          linkPath: this.safeLinkPath(input.linkPath),
          readAt: null,
          createdAt: new Date(),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to refresh ${input.type} for student ${input.studentId}: ${err?.message}`);
      return null;
    }
  }

  async list(studentId: string, opts?: { unreadOnly?: boolean; limit?: number }) {
    const take = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
    const rows = await this.prisma.studentNotification.findMany({
      where: {
        studentId,
        ...(opts?.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      titleAr: r.titleAr,
      body: r.body,
      bodyAr: r.bodyAr,
      linkPath: r.linkPath,
      read: r.readAt !== null,
      createdAt: r.createdAt,
    }));
  }

  async unreadCount(studentId: string) {
    const count = await this.prisma.studentNotification.count({
      where: { studentId, readAt: null },
    });
    return { unread: count };
  }

  /** Scoped by studentId as well as id, so one student cannot mark another's as read. */
  async markRead(studentId: string, id: string) {
    const res = await this.prisma.studentNotification.updateMany({
      where: { id, studentId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async markAllRead(studentId: string) {
    const res = await this.prisma.studentNotification.updateMany({
      where: { studentId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }
}

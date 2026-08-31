import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface EventInput {
  name: string;
  category?: string;
  userId?: string;
  schoolId?: string;
  locale?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Server-side instrumentation. Fire-and-forget: analytics must never break
   * an application flow, so failures are logged and swallowed.
   */
  async record(input: EventInput) {
    try {
      // Derive schoolId from userId if not provided
      let schoolId = input.schoolId;
      if (!schoolId && input.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: input.userId },
          select: { schoolId: true },
        });
        schoolId = user?.schoolId;
      }
      if (!schoolId) return; // Skip if no school context

      await this.prisma.analyticsEvent.create({
        data: {
          sessionId: input.sessionId || undefined,
          userId: input.userId || undefined,
          schoolId,
          name: input.name.slice(0, 100),
          category: input.category || undefined,
          locale: input.locale || undefined,
          properties: (input.properties as any) || undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`analytics.record failed for "${input.name}": ${(e as Error).message}`);
    }
  }

  /**
   * Batch entry point used by the client tracker (session heartbeat + events).
   * Upserts the session row and bulk-inserts events atomically-per-call.
   */
  async recordBatch(input: {
    sessionId: string;
    userId?: string;
    schoolId?: string;
    locale?: string;
    entryPage?: string;
    userAgent?: string;
    start?: boolean;
    end?: boolean;
    durationSec?: number;
    actionCount?: number;
    events: Array<{ name: string; category?: string; properties?: Record<string, unknown> }>;
  }) {
    if (!input.sessionId) return;
    const now = new Date();

    // Derive schoolId from userId if not provided
    let schoolId = input.schoolId;
    if (!schoolId && input.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { schoolId: true },
      });
      schoolId = user?.schoolId;
    }
    if (!schoolId) return; // Skip if no school context

    const session = await this.prisma.appSession.upsert({
      where: { id: input.sessionId },
      create: {
        id: input.sessionId,
        userId: input.userId || undefined,
        schoolId,
        locale: input.locale || undefined,
        entryPage: input.entryPage || undefined,
        userAgent: input.userAgent ? input.userAgent.slice(0, 255) : undefined,
      },
      update: {
        lastActiveAt: now,
        ...(input.end ? { endedAt: now, durationSec: input.durationSec ?? null } : {}),
        ...(input.actionCount ? { actionCount: { increment: input.actionCount } } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.locale ? { locale: input.locale } : {}),
      },
    });

    if (input.events && input.events.length > 0) {
      // Honor server-computed duration when ending so the session lifetime is
      // measured from the actual start, not a client-supplied estimate.
      if (input.end) {
        const dur = Math.max(0, Math.round((now.getTime() - session.startedAt.getTime()) / 1000));
        await this.prisma.appSession.update({
          where: { id: input.sessionId },
          data: { endedAt: now, durationSec: dur },
        });
      }
      await this.prisma.analyticsEvent.createMany({
        data: input.events.map((e) => ({
          sessionId: input.sessionId,
          userId: input.userId || undefined,
          schoolId,
          name: e.name.slice(0, 100),
          category: e.category || undefined,
          locale: input.locale || undefined,
          properties: (e.properties as any) || undefined,
        })),
      });
    }
  }

  /**
   * Computes the MEASURE KPIs (C1–C4). Read-only aggregation over the last
   * rolling windows; safe to call from a dashboard.
   */
  async getMetrics() {
    const [session, settings, activation, arLocale] = await Promise.all([
      this.prisma.$queryRaw<Array<{
        sessions: number;
        active_users: number;
        avg_length_sec: number;
        actions_per_session: number;
      }>>`
        SELECT
          COUNT(*)::int AS sessions,
          COUNT(DISTINCT user_id)::int AS active_users,
          COALESCE(AVG(duration_sec), 0)::int AS avg_length_sec,
          COALESCE(AVG(action_count), 0)::int AS actions_per_session
        FROM app_sessions
        WHERE started_at > now() - interval '30 days'
      `,
      this.prisma.$queryRaw<Array<{ cur: number; prev: number }>>`
        SELECT
          (SELECT COUNT(*)::int FROM analytics_events
            WHERE name = 'settings.task_completed' AND created_at > now() - interval '30 days') AS cur,
          (SELECT COUNT(*)::int FROM analytics_events
            WHERE name = 'settings.task_completed'
              AND created_at > now() - interval '60 days' AND created_at <= now() - interval '30 days') AS prev
      `,
      this.prisma.$queryRaw<Array<{ recruits: number; activated: number }>>`
        SELECT
          (SELECT COUNT(*)::int FROM users
            WHERE created_at > now() - interval '90 days') AS recruits,
          (SELECT COUNT(DISTINCT ar.recorded_by)::int
            FROM attendance_records ar
            JOIN users u ON u.id = ar.recorded_by
            WHERE u.created_at > now() - interval '90 days'
              AND ar.recorded_at <= u.created_at + interval '7 days') AS activated
      `,
      this.prisma.$queryRaw<Array<{ ar_sessions: number; ar_completed: number }>>`
        SELECT
          (SELECT COUNT(DISTINCT session_id)::int FROM analytics_events
            WHERE locale = 'ar' AND session_id IS NOT NULL
              AND created_at > now() - interval '30 days') AS ar_sessions,
          (SELECT COUNT(DISTINCT session_id)::int FROM analytics_events
            WHERE locale = 'ar' AND session_id IS NOT NULL
              AND created_at > now() - interval '30 days'
              AND name IN ('attendance.marked','settings.task_completed','onboarding.completed','student.created','bulk.action')) AS ar_completed
      `,
    ]);

    const s = session[0] || {};
    const sets = settings[0] || { cur: 0, prev: 0 };
    const act = activation[0] || { recruits: 0, activated: 0 };
    const ar = arLocale[0] || { ar_sessions: 0, ar_completed: 0 };

    return {
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      sessions30d: s.sessions || 0,
      activeUsers30d: s.active_users || 0,
      avgSessionLengthSec: s.avg_length_sec || 0,
      actionsPerSession: s.actions_per_session || 0,
      settingsTaskCompletions30d: sets.cur || 0,
      settingsTaskCompletionsPrior30d: sets.prev || 0,
      settingsCompletionDelta: (sets.cur || 0) - (sets.prev || 0),
      recruits90d: act.recruits || 0,
      activatedRecruits: act.activated || 0,
      activationRate7d: act.recruits ? (act.activated || 0) / act.recruits : 0,
      arSessions30d: ar.ar_sessions || 0,
      arCompletedSessions30d: ar.ar_completed || 0,
      arLocaleCompletionRate: ar.ar_sessions ? (ar.ar_completed || 0) / ar.ar_sessions : 0,
    };
  }
}
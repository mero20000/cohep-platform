import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  softDeleteModel = {
    student: true,
    level: true,
    lesson: true,
    user: true,
    church: true,
    school: true,
    assessment: true,
    attendanceSession: true,
  } as const;

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    // Clean all tables in reverse order of dependencies
    const tables = [
      'file_uploads',
      'system_configs',
      'audit_logs',
      'events',
      'notifications',
      'messages',
      'announcements',
      'xp_transactions',
      'certificates',
      'achievements',
      'student_badges',
      'badges',
      'promotion_records',
      'student_progress',
      'lesson_progress',
      'grades',
      'assessment_submissions',
      'assessment_questions',
      'assessments',
      'attendance_records',
      'attendance_sessions',
      'resources',
      'sessions',
      'lessons',
      'level_subjects',
      'subjects',
      'groups',
      'levels',
      'medical_notes',
      'student_parents',
      'student_profiles',
      'students',
      'academic_years',
      'role_permissions',
      'permissions',
      'user_roles',
      'users',
      'roles',
      'schools',
      'churches',
    ];

    for (const table of tables) {
      await this.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
  }
}

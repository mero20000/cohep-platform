import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { ChurchesModule } from './modules/churches/churches.module';
import { UploadModule } from './modules/upload/upload.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ParentsModule } from './modules/parents/parents.module';
import { AuditModule } from './modules/audit/audit.module';
import { MailModule } from './modules/mail/mail.module';
import { AdminModule } from './modules/admin/admin.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 200 }],
    }),

    // Database
    DatabaseModule,

    // Shared utilities
    CommonModule,

    // Feature modules
    AuthModule,
    UsersModule,
    StudentsModule,
    CurriculumModule,
    AttendanceModule,
    AssessmentsModule,
    GamificationModule,
    ChurchesModule,
    UploadModule,
    DashboardModule,
    NotificationsModule,
    ParentsModule,
    AuditModule,
    MailModule,
    AdminModule,
    NewsletterModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

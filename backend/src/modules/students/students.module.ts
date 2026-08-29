import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalAuthGuard } from './student-portal-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { AssessmentsModule } from '../assessments/assessments.module';
// The student's own aggregate routes reuse ParentsService rather than reimplementing the
// same aggregations. ParentsModule does not import StudentsModule, so there is no cycle.
import { ParentsModule } from '../parents/parents.module';
import { StudentNotificationsModule } from '../student-notifications/student-notifications.module';

@Module({
  imports: [
    AuditModule,
    AnalyticsModule,
    CurriculumModule,
    AssessmentsModule,
    ParentsModule,
    StudentNotificationsModule,
    // Secret is supplied per-call (process.env.JWT_SECRET) to match auth module config.
    JwtModule.register({}),
  ],
  controllers: [StudentsController, StudentPortalController],
  providers: [StudentsService, StudentPortalAuthGuard],
  exports: [StudentsService],
})
export class StudentsModule {}

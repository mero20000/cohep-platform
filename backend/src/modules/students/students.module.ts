import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentPortalController } from './student-portal.controller';
import { AuditModule } from '../audit/audit.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { AssessmentsModule } from '../assessments/assessments.module';

@Module({
  imports: [AuditModule, AnalyticsModule, CurriculumModule, AssessmentsModule],
  controllers: [StudentsController, StudentPortalController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}

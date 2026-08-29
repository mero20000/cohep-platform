import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { AuditModule } from '../audit/audit.module';
import { StudentNotificationsModule } from '../student-notifications/student-notifications.module';

@Module({
  imports: [AuditModule, StudentNotificationsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}

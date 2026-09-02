import { Module } from '@nestjs/common';
import { GradeDisputesService } from './grade-disputes.service';
import { GradeDisputesController } from './grade-disputes.controller';
import { DatabaseModule } from '../../database/database.module';
import { StudentNotificationsModule } from '../student-notifications/student-notifications.module';

@Module({
  imports: [DatabaseModule, StudentNotificationsModule],
  providers: [GradeDisputesService],
  controllers: [GradeDisputesController],
  exports: [GradeDisputesService],
})
export class GradeDisputesModule {}

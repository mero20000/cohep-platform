import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { ServantsController } from './servants.controller';
import { ServantsService } from './servants.service';
import { GamificationModule } from '../gamification/gamification.module';
import { StudentNotificationsModule } from '../student-notifications/student-notifications.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, GamificationModule, StudentNotificationsModule],
  controllers: [ServantsController],
  providers: [ServantsService],
  exports: [ServantsService],
})
export class ServantsModule {}

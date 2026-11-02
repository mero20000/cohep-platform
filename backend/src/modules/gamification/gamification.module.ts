import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { StudentNotificationsModule } from '../student-notifications/student-notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StudentNotificationsModule, AuditModule],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}

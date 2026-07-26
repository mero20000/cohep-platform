import { Module, forwardRef } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AuditModule } from '../audit/audit.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [AuditModule, forwardRef(() => GamificationModule)],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}

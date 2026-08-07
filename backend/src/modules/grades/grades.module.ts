import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [GradesController],
  providers: [GradesService],
})
export class GradesModule {}

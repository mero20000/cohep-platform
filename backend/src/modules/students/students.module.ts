import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentPortalController } from './student-portal.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [StudentsController, StudentPortalController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}

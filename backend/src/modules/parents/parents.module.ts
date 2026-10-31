import { Module } from '@nestjs/common';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { AuditModule } from '../audit/audit.module';
import { ChildLinkThrottleService } from './child-link-throttle.service';

@Module({
  imports: [CurriculumModule, AuditModule],
  controllers: [ParentsController],
  providers: [ParentsService, ChildLinkThrottleService],
  exports: [ParentsService],
})
export class ParentsModule {}

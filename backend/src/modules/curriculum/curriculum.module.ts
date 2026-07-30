import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import { HymnLearningController } from './hymn-learning.controller';
import { HymnLearningService } from './hymn-learning.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CurriculumController, HymnLearningController],
  providers: [CurriculumService, HymnLearningService],
  exports: [HymnLearningService],
})
export class CurriculumModule {}

import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import { HymnLearningController } from './hymn-learning.controller';
import { HymnLearningService } from './hymn-learning.service';
import { RecordingStreamController } from './recording-stream.controller';
import { DatabaseModule } from '../../database/database.module';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { StudentNotificationsModule } from '../student-notifications/student-notifications.module';

@Module({
  imports: [DatabaseModule, AuditModule, StudentNotificationsModule, JwtModule.register({})],
  controllers: [CurriculumController, HymnLearningController, RecordingStreamController],
  providers: [CurriculumService, HymnLearningService],
  exports: [HymnLearningService],
})
export class CurriculumModule {}

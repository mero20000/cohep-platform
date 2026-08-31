import { Module } from '@nestjs/common';
import { GradeDisputesService } from './grade-disputes.service';
import { GradeDisputesController } from './grade-disputes.controller';

@Module({
  providers: [GradeDisputesService],
  controllers: [GradeDisputesController],
  exports: [GradeDisputesService],
})
export class GradeDisputesModule {}

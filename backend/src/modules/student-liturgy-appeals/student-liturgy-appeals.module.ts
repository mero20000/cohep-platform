import { Module } from '@nestjs/common';
import { StudentLiturgyAppealsService } from './student-liturgy-appeals.service';
import { StudentLiturgyAppealsController } from './student-liturgy-appeals.controller';

@Module({
  providers: [StudentLiturgyAppealsService],
  controllers: [StudentLiturgyAppealsController],
  exports: [StudentLiturgyAppealsService],
})
export class StudentLiturgyAppealsModule {}

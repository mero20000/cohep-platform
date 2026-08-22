import { Module } from '@nestjs/common';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { CurriculumModule } from '../curriculum/curriculum.module';

@Module({
  imports: [CurriculumModule],
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}

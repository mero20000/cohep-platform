import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ServantsController } from './servants.controller';
import { ServantsService } from './servants.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [DatabaseModule, GamificationModule],
  controllers: [ServantsController],
  providers: [ServantsService],
  exports: [ServantsService],
})
export class ServantsModule {}

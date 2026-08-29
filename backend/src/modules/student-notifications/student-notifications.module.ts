import { Module } from '@nestjs/common';
import { StudentNotificationsService } from './student-notifications.service';

/**
 * Deliberately a leaf: it depends on nothing but Prisma (provided globally by
 * DatabaseModule). Every module that emits notifications imports this one, so keeping it
 * dependency-free is what stops those imports forming a cycle.
 */
@Module({
  providers: [StudentNotificationsService],
  exports: [StudentNotificationsService],
})
export class StudentNotificationsModule {}

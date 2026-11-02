import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { BirthdayNotifier } from './birthday-notifier.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DashboardController],
  providers: [DashboardService, BirthdayNotifier, PrismaService],
})
export class DashboardModule {}

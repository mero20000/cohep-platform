import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushModule } from '../push/push.module';
import { WhatsAppService } from '../../common/whatsapp/whatsapp.service';

@Module({
  imports: [PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, WhatsAppService],
  exports: [NotificationsService, WhatsAppService],
})
export class NotificationsModule {}

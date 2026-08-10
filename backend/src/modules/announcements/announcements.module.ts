import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolResolver } from '../../common/utils/school-resolver';
import { MailService } from '../mail/mail.service';
import { NewsletterModule } from '../newsletter/newsletter.module';

@Module({
  imports: [NewsletterModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, PrismaService, SchoolResolver, MailService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}

import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';

@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService, PrismaService, MailService],
  exports: [NewsletterService],
})
export class NewsletterModule {}

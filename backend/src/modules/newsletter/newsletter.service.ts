import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { emailTemplate, emailKeyValueRow, emailParagraph } from '../mail/email-template';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async subscribe(email: string) {
    const appUrl = this.configService.get('FRONTEND_URL', 'https://cohep-platform.vercel.app');

    // Save subscriber to database (upsert to handle re-subscription)
    try {
      await this.prisma.newsletterSubscriber.upsert({
        where: { email },
        update: { isActive: true },
        create: { email },
      });
    } catch (err) {
      console.error('[newsletter] Failed to save subscriber', err);
    }

    // Send confirmation email to the subscriber
    try {
      const html = emailTemplate({
        title: 'Welcome to COHEP',
        content: `
          ${emailParagraph('Thank you for subscribing to the COHEP newsletter!')}
          ${emailParagraph('You\'ll receive updates about new hymns, platform improvements, and community news from the Coptic Orthodox Hymn Education Platform.')}
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            ${emailKeyValueRow('Platform', 'COHEP — Coptic Orthodox Hymn Education Platform')}
            ${emailKeyValueRow('Website', '<a href="' + appUrl + '" style="color:#D4A843;">' + appUrl + '</a>')}
          </table>
          ${emailParagraph('If you have any questions, feel free to reach out to us at any time.')}
        `,
        cta: { text: 'Visit COHEP', url: appUrl },
        footer: 'You are receiving this because you subscribed at ' + appUrl,
      });
      await this.mailService.sendMail(email, 'Welcome to COHEP — You\'re Subscribed!', html);
    } catch (err) {
      console.error('[newsletter] Failed to send subscriber confirmation email', err);
    }

    // Notify admin
    const adminEmail = this.configService.get('MAIL_TO', '');
    if (adminEmail) {
      try {
        const html = emailTemplate({
          title: 'New Newsletter Subscriber',
          content: `
            ${emailParagraph('Someone subscribed to the newsletter:')}
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              ${emailKeyValueRow('Email', email)}
            </table>
          `,
        });
        await this.mailService.sendMail(adminEmail, 'New Newsletter Subscription', html);
      } catch (err) {
        console.error('[newsletter] Failed to send admin notification email', err);
      }
    }

    return { success: true };
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async unsubscribe(email: string) {
    await this.prisma.newsletterSubscriber.updateMany({
      where: { email },
      data: { isActive: false },
    });
    return { success: true };
  }

  async getActiveSubscriberEmails(): Promise<string[]> {
    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true },
    });
    return subscribers.map(s => s.email);
  }
}

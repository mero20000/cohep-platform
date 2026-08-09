import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { emailTemplate, emailKeyValueRow, emailParagraph } from '../mail/email-template';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async subscribe(email: string) {
    const appUrl = this.configService.get('FRONTEND_URL', 'https://cohep-platform.vercel.app');

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
}

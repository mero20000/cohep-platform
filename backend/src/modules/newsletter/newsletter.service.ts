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
        console.error('[newsletter] Failed to send notification email', err);
      }
    }
    return { success: true };
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { emailTemplate, emailKeyValueRow, emailParagraph } from './email-template';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get('MAIL_USER', ''),
        pass: this.configService.get('MAIL_PASS', ''),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    const from = this.configService.get('MAIL_FROM', 'noreply@niangelos.app');
    await this.transporter.sendMail({ from, to, subject, html });
  }

  async sendRegistrationNotification(adminEmail: string, data: {
    churchName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    city: string;
  }) {
    const html = emailTemplate({
      title: 'New Registration Request',
      content: `
        ${emailParagraph('A new church has submitted a registration request. Review the details below:')}
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${emailKeyValueRow('Church', data.churchName)}
          ${emailKeyValueRow('Contact', `${data.firstName} ${data.lastName}`)}
          ${emailKeyValueRow('Email', data.email)}
          ${emailKeyValueRow('Phone', data.phone)}
          ${emailKeyValueRow('Country', data.country)}
          ${emailKeyValueRow('City', data.city)}
        </table>
      `,
      cta: { text: 'Review Registration', url: '/dashboard/pending-registrations' },
    });
    await this.sendMail(adminEmail, `New Registration: ${data.churchName}`, html);
  }

  async sendAttendanceAlert(to: string, studentName: string, studentNameAr: string, groupName: string) {
    const html = emailTemplate({
      title: 'We Miss Your Child in Class',
      content: `
        ${emailParagraph(`We've noticed that ${studentName} hasn't attended ${groupName} for the past 3 weeks. We miss them and hope everything is okay!`)}
        ${emailParagraph(`لاحظنا أن ${studentNameAr || studentName} لم يحضر ${groupName} خلال الأسابيع الثلاثة الماضية. نحن نفتقدهم ونأمل أن يكون كل شيء على ما يرام!`)}
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${emailKeyValueRow('Student', studentName)}
          ${emailKeyValueRow('Group', groupName)}
        </table>
        ${emailParagraph('If there is anything we can help with, please reach out to your child\'s servant.')}
      `,
      cta: { text: 'View Attendance', url: '/portal' },
    });
    await this.sendMail(to, `We miss ${studentName} in class`, html);
  }
}

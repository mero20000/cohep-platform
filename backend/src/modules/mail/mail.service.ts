import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { createConnection } from 'node:net';
import { lookup } from 'node:dns/promises';
import { emailTemplate, emailKeyValueRow, emailParagraph } from './email-template';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  // Dedupe cache: key -> timestamp of last send. Prevents duplicate emails
  // (e.g. a re-submitted registration form) from spamming the same recipient.
  private readonly sentCache = new Map<string, number>();
  private static readonly DEDUPE_TTL_MS = 10 * 60_000;

  // Serializes sends so bursts of mail are dispatched sequentially instead
  // of piling up as concurrent socket connections.
  private sendChain: Promise<unknown> = Promise.resolve();

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
    const host = this.configService.get('MAIL_HOST', 'smtp.gmail.com');
    const user = this.configService.get('MAIL_USER', '');
    const pass = this.configService.get('MAIL_PASS', '');
    const to = this.configService.get('MAIL_TO', '');
    console.log(
      `[mail] config: host=${host} user=${user ? 'set' : 'MISSING'} pass=${pass ? 'set' : 'MISSING'} from=${this.configService.get('MAIL_FROM', 'noreply@niangelos.app')} to=${to ? 'set' : 'MISSING'}`,
    );
    if (!user || !pass) {
      console.error('[mail] MAIL_USER or MAIL_PASS is not configured — emails will fail.');
    }
    // Temporary diagnostic: probes outbound SMTP reachability so we can see
    // whether Render's container can connect to the mail host at all.
    if (process.env.NODE_ENV !== 'test') {
      this.probeSmtp().catch(() => undefined);
    }
  }

  private async probeSmtp() {
    const host = this.configService.get('MAIL_HOST', 'smtp.gmail.com');
    const port = Number(this.configService.get('MAIL_PORT', 587));
    try {
      const addrs = await lookup(host, { all: true });
      console.log(`[mail] probe: ${host} ->`, addrs.map((a) => `${a.address} (${a.family})`).join(', '));
    } catch (e) {
      console.log(`[mail] probe: DNS lookup of ${host} FAILED`, e instanceof Error ? e.message : e);
      return;
    }
    for (const p of [port, 465, 25]) {
      try {
        await new Promise<void>((resolve, reject) => {
          const s = createConnection({ host, port: p, family: 4, timeout: 8000 });
          s.once('connect', () => { s.destroy(); resolve(); });
          s.once('error', (e) => { s.destroy(); reject(e); });
          s.once('timeout', () => { s.destroy(); reject(new Error('timeout')); });
        });
        console.log(`[mail] probe: port ${p} OK`);
      } catch (e) {
        console.log(`[mail] probe: port ${p} FAILED (${e instanceof Error ? e.message : e})`);
      }
    }
  }

  async sendMail(to: string, subject: string, html: string) {
    const from = this.configService.get('MAIL_FROM', 'noreply@niangelos.app');
    try {
      await this.transporter.sendMail({ from, to, subject, html });
      console.log(`[mail] sent to=${to} subject="${subject}"`);
    } catch (err) {
      console.error(`[mail] FAILED to=${to} subject="${subject}"`, err instanceof Error ? err.message : err);
      throw err;
    }
  }

  /**
   * Queues `fn` behind any in-flight send so messages leave the process in
   * order. Returns true when the job was accepted into the queue.
   */
  private enqueue(fn: () => Promise<void>): Promise<boolean> {
    const run = this.sendChain.then(async () => {
      await fn();
    });
    // Swallow rejection so one failed send doesn't poison the chain.
    this.sendChain = run.catch(() => undefined);
    return run.then(() => true).catch(() => false);
  }

  /**
   * Sends `fn` only if no identical message (by `key`) was sent within the
   * dedupe window.
   */
  private async dedupe(key: string, fn: () => Promise<void>): Promise<boolean> {
    const now = Date.now();
    const lastSent = this.sentCache.get(key);
    if (lastSent && now - lastSent < MailService.DEDUPE_TTL_MS) {
      return false;
    }
    this.sentCache.set(key, now);
    // Opportunistic cleanup of expired keys.
    if (this.sentCache.size > 500) {
      for (const [k, ts] of this.sentCache) {
        if (now - ts >= MailService.DEDUPE_TTL_MS) this.sentCache.delete(k);
      }
    }
    return this.enqueue(fn);
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
    const key = `reg:${adminEmail.toLowerCase()}:${data.email.toLowerCase()}:${data.churchName.toLowerCase()}`;
    await this.dedupe(key, () =>
      this.sendMail(adminEmail, `New Registration: ${data.churchName}`, html),
    );
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

  async sendPasswordReset(to: string, resetUrl: string) {
    const html = emailTemplate({
      title: 'Reset Your Password',
      content: `
        ${emailParagraph('We received a request to reset your password. Click the button below to choose a new one.')}
        ${emailParagraph("If you didn't request this, you can safely ignore this email — your password will stay the same.")}
        ${emailParagraph('This link expires in 1 hour.')}
      `,
      cta: { text: 'Reset Password', url: resetUrl },
    });
    await this.sendMail(to, 'Reset your COHEP password', html);
  }
}

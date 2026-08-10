import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  emailTemplate,
  emailKeyValueRow,
  emailParagraph,
  emailDivider,
  emailHighlightBox,
} from "./email-template";

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

@Injectable()
export class MailService {
  private readonly apiKey: string;
  private readonly from: string;

  // Dedupe cache: key -> timestamp of last send. Prevents duplicate emails
  // (e.g. a re-submitted registration form) from spamming the same recipient.
  private readonly sentCache = new Map<string, number>();
  private static readonly DEDUPE_TTL_MS = 10 * 60_000;

  // Serializes sends so bursts of mail are dispatched sequentially instead
  // of piling up as concurrent requests.
  private sendChain: Promise<unknown> = Promise.resolve();

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get("SENDGRID_API_KEY", "");
    this.from = this.configService.get("MAIL_FROM", "noreply@niangelos.app");
    const to = this.configService.get("MAIL_TO", "");
    console.log(
      `[mail] config: provider=sendgrid apiKey=${this.apiKey ? "set" : "MISSING"} from=${this.from} to=${to ? "set" : "MISSING"}`,
    );
    if (!this.apiKey) {
      console.error(
        "[mail] SENDGRID_API_KEY is not configured — emails will fail.",
      );
    }
  }

  async sendMail(to: string, subject: string, html: string) {
    const safeSubject = subject.slice(0, 98);
    try {
      if (!this.apiKey) {
        throw new Error("SENDGRID_API_KEY is not configured");
      }
      const res = await fetch(SENDGRID_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: this.from },
          subject: safeSubject,
          content: [{ type: "text/html", value: html }],
        }),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        throw new Error(`SendGrid ${res.status}: ${detail}`);
      }
      console.log(`[mail] sent to=${to} subject="${subject}"`);
    } catch (err) {
      console.error(
        `[mail] FAILED to=${to} subject="${subject}"`,
        err instanceof Error ? err.message : err,
      );
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

  async sendRegistrationNotification(
    adminEmail: string,
    data: {
      churchName: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      country: string;
      city: string;
    },
  ) {
    const html = emailTemplate({
      title: "New Registration Request",
      variant: "gold",
      content: `
        ${emailParagraph("A new church has submitted a registration request. Please review the details below:")}
        ${emailHighlightBox(`
          <p style="margin:0;font-size:14px;color:#92400e;"><strong>${data.churchName}</strong></p>
          <p style="margin:4px 0 0;font-size:13px;color:#a16207;">${data.city}, ${data.country}</p>
        `, 'gold')}
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0;">
          ${emailKeyValueRow("Contact Person", `${data.firstName} ${data.lastName}`)}
          ${emailKeyValueRow("Email Address", data.email)}
          ${emailKeyValueRow("Phone Number", data.phone)}
          ${emailKeyValueRow("Country", data.country)}
          ${emailKeyValueRow("City", data.city)}
        </table>
        ${emailDivider()}
        ${emailParagraph("Click below to review this registration and approve or reject the request.")}
      `,
      cta: {
        text: "Review Registration",
        url: "/dashboard/pending-registrations",
      },
    });
    const key = `reg:${adminEmail.toLowerCase()}:${data.email.toLowerCase()}:${data.churchName.toLowerCase()}`;
    await this.dedupe(key, () =>
      this.sendMail(adminEmail, `New Registration: ${data.churchName}`, html),
    );
  }

  async sendAttendanceAlert(
    to: string,
    studentName: string,
    studentNameAr: string,
    groupName: string,
  ) {
    const html = emailTemplate({
      title: "We Miss Your Child in Class",
      variant: "red",
      content: `
        ${emailHighlightBox(`
          <p style="margin:0;font-size:14px;color:#991b1b;"><strong>${studentName}</strong></p>
          <p style="margin:4px 0 0;font-size:13px;color:#b91c1c;">${groupName}</p>
        `, 'red')}
        ${emailParagraph(`We've noticed that <strong>${studentName}</strong> hasn't attended <strong>${groupName}</strong> for the past 3 weeks. We miss them and hope everything is okay!`)}
        ${emailParagraph(`لاحظنا أن <strong>${studentNameAr || studentName}</strong> لم يحضر <strong>${groupName}</strong> خلال الأسابيع الثلاثة الماضية. نحن نفتقدهم ونأمل أن يكون كل شيء على ما يرام!`)}
        ${emailDivider()}
        ${emailParagraph("If there is anything we can help with, please don't hesitate to reach out to your child's servant or group leader.")}
      `,
      cta: { text: "View Attendance", url: "/portal" },
    });
    await this.sendMail(to, `We miss ${studentName} in class`, html);
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    const html = emailTemplate({
      title: "Reset Your Password",
      variant: "blue",
      content: `
        ${emailParagraph("We received a request to reset your password. Click the button below to choose a new one.")}
        ${emailHighlightBox(`
          <p style="margin:0;font-size:13px;color:#1e40af;">This link will expire in <strong>1 hour</strong>.</p>
        `, 'blue')}
        ${emailParagraph("If you didn't request this, you can safely ignore this email — your password will stay the same.")}
      `,
      cta: { text: "Reset Password", url: resetUrl },
    });
    await this.sendMail(to, "Reset your COHEP password", html);
  }
}

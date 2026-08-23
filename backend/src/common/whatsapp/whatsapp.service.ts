import { Injectable, Logger } from '@nestjs/common';

/**
 * WhatsApp parent-awareness notifications. Provider priority:
 *   1. Twilio (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM)
 *   2. Meta WhatsApp Cloud API (WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
 * When neither is configured, send() is a no-op reporting sent:false — callers
 * degrade to in-app notifications / wa.me deep links.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  get configured(): boolean {
    return !!(
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) ||
      (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
    );
  }

  async sendText(to: string, text: string): Promise<{ sent: boolean; error?: string; via?: 'twilio' | 'meta' }> {
    if (!to) return { sent: false, error: 'missing recipient' };
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
      return this.sendViaTwilio(to, text);
    }
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      return this.sendViaMeta(to, text);
    }
    return { sent: false, error: 'not configured' };
  }

  private async sendViaTwilio(to: string, text: string) {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const from = process.env.TWILIO_WHATSAPP_FROM!.replace(/[^\d+]/g, '');
    const phone = to.replace(/[^\d+]/g, '').replace(/^\+/, '');
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${from}`,
          To: `whatsapp:+${phone}`,
          Body: text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Twilio WhatsApp send failed (${res.status}): ${body.slice(0, 200)}`);
        return { sent: false, error: `HTTP ${res.status}`, via: 'twilio' as const };
      }
      return { sent: true, via: 'twilio' as const };
    } catch (e: any) {
      this.logger.warn(`Twilio WhatsApp send error: ${e?.message}`);
      return { sent: false, error: e?.message, via: 'twilio' as const };
    }
  }

  private async sendViaMeta(to: string, text: string) {
    const phone = to.replace(/[^\d+]/g, '').replace(/^\+/, '');
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { preview_url: false, body: text },
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Meta WhatsApp send failed (${res.status}): ${body.slice(0, 200)}`);
        return { sent: false, error: `HTTP ${res.status}`, via: 'meta' as const };
      }
      return { sent: true, via: 'meta' as const };
    } catch (e: any) {
      this.logger.warn(`Meta WhatsApp send error: ${e?.message}`);
      return { sent: false, error: e?.message, via: 'meta' as const };
    }
  }
}

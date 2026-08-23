import { Injectable, Logger } from '@nestjs/common';

/**
 * WhatsApp parent-awareness notifications via the Meta WhatsApp Cloud API.
 * Enabled when WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID are configured;
 * otherwise send() is a no-op that reports sent:false (callers degrade to
 * in-app notifications only).
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  get configured(): boolean {
    return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  async sendText(to: string, text: string): Promise<{ sent: boolean; error?: string }> {
    if (!this.configured || !to) return { sent: false, error: this.configured ? 'missing recipient' : 'not configured' };
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
        this.logger.warn(`WhatsApp send failed (${res.status}): ${body.slice(0, 200)}`);
        return { sent: false, error: `HTTP ${res.status}` };
      }
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(`WhatsApp send error: ${e?.message}`);
      return { sent: false, error: e?.message };
    }
  }
}

import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createTransportMock = nodemailer.createTransport as jest.Mock;

describe('MailService', () => {
  let service: MailService;
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ accepted: ['to@example.com'] });
    createTransportMock.mockImplementation(() => ({ sendMail: sendMailMock }));
    service = new MailService({
      get: jest.fn((key: string, def?: any) => {
        if (key === 'MAIL_USER') return 'sender@gmail.com';
        if (key === 'MAIL_PASS') return 'app-password';
        return def;
      }),
    } as unknown as ConfigService);
  });

  it('sends a password reset email with an absolute CTA link', async () => {
    await service.sendPasswordReset(
      'user@example.com',
      'https://cohep-platform.vercel.app/reset-password?token=abc123',
    );

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@niangelos.app',
        to: 'user@example.com',
        subject: 'Reset your COHEP password',
      }),
    );
    const sent = sendMailMock.mock.calls[0][0] as { html: string };
    expect(sent.html).toContain('https://cohep-platform.vercel.app/reset-password?token=abc123');
    expect(sent.html).toContain('Reset Your Password');
    expect(sent.html).toContain('expires in 1 hour');
  });

  it('uses MAIL_FROM when configured', async () => {
    service = new MailService({
      get: jest.fn((key: string, def?: any) => {
        if (key === 'MAIL_FROM') return 'custom@example.com';
        return def;
      }),
    } as unknown as ConfigService);

    await service.sendPasswordReset('user@example.com', 'https://x.example/reset?token=1');
    expect(sendMailMock.mock.calls[0][0].from).toBe('custom@example.com');
  });
});

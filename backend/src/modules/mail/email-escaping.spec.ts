import { emailTemplate, emailKeyValueRow, emailParagraph, escapeHtml } from './email-template';
import { MailService } from './mail.service';

const PAYLOAD = '<img src=x onerror=alert(1)>';
const LIVE_TAG = /<img\b/i;

describe('escapeHtml', () => {
  it('escapes the characters that can break out of text or a quoted attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
  it('treats null and undefined as empty and numbers as text', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('email template helpers', () => {
  it('escapes title, call-to-action, footer and key-value rows', () => {
    const html = emailTemplate({
      title: PAYLOAD,
      content: emailKeyValueRow(PAYLOAD, PAYLOAD),
      cta: { text: PAYLOAD, url: '/x?a="><img src=x onerror=alert(1)>' },
      footer: PAYLOAD,
    });
    expect(html).not.toMatch(LIVE_TAG);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('lets a key-value row carry markup only when the caller says so', () => {
    expect(emailKeyValueRow('Site', '<a href="https://x">x</a>', true)).toContain('<a href="https://x">x</a>');
    expect(emailKeyValueRow('Site', '<a href="https://x">x</a>')).not.toContain('<a href');
  });
});

describe('MailService templates', () => {
  let sent: Array<{ to: string; subject: string; html: string }>;
  let mail: MailService;

  beforeEach(() => {
    sent = [];
    mail = new MailService({ get: () => '' } as any);
    jest.spyOn(mail, 'sendMail').mockImplementation(async (to, subject, html) => {
      sent.push({ to, subject, html });
    });
  });

  it('escapes an applicant name in the new-registration email', async () => {
    await mail.sendRegistrationNotification('admin@example.com', {
      churchName: PAYLOAD,
      firstName: PAYLOAD,
      lastName: PAYLOAD,
      email: 'a@example.com',
      phone: PAYLOAD,
      country: PAYLOAD,
      city: PAYLOAD,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].html).not.toMatch(LIVE_TAG);
    expect(sent[0].html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes student and group names in the attendance alert', async () => {
    await mail.sendAttendanceAlert('p@example.com', PAYLOAD, PAYLOAD, PAYLOAD);
    expect(sent[0].html).not.toMatch(LIVE_TAG);
    expect(sent[0].html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('keeps ordinary names readable', async () => {
    await mail.sendAttendanceAlert('p@example.com', 'Mina Girgis', 'مينا', 'Level 3');
    expect(sent[0].html).toContain('<strong>Mina Girgis</strong>');
    expect(sent[0].html).toContain('مينا');
  });
});

describe('emailParagraph', () => {
  it('is a plain wrapper: callers escape what they put in it', () => {
    expect(emailParagraph(`Hello <strong>${escapeHtml(PAYLOAD)}</strong>`)).not.toMatch(LIVE_TAG);
  });
});

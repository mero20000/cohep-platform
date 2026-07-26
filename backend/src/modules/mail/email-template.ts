export interface EmailTemplateOptions {
  /** Header title text */
  title: string
  /** Body content HTML */
  content: string
  /** Color variant */
  variant?: 'gold' | 'red' | 'blue'
  /** Optional CTA button */
  cta?: { text: string; url: string }
  /** Optional footer text */
  footer?: string
}

const COLORS = {
  gold: { from: '#D4A843', to: '#B8912A' },
  red: { from: '#ef4444', to: '#dc2626' },
  blue: { from: '#2563EB', to: '#1D4ED8' },
} as const

export function emailTemplate({
  title,
  content,
  variant = 'gold',
  cta,
  footer,
}: EmailTemplateOptions): string {
  const colors = COLORS[variant]
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  const ctaHtml = cta
    ? `<div style="margin-top:24px;text-align:center;">
        <a href="${cta.url.startsWith('http') ? cta.url : `${appUrl}${cta.url}`}"
           style="display:inline-block;background:${colors.from};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          ${cta.text}
        </a>
      </div>`
    : ''

  const footerHtml = footer
    ? `<p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center;">${footer}</p>`
    : ''

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
      <div style="background:linear-gradient(135deg,${colors.from},${colors.to});padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">${title}</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
        ${content}
        ${ctaHtml}
        ${footerHtml}
      </div>
    </div>
  `
}

export function emailKeyValueRow(label: string, value: string): string {
  return `<tr><td style="padding:8px 0;color:#6b7280;">${label}</td><td style="padding:8px 0;font-weight:600;color:#111827;">${value}</td></tr>`
}

export function emailParagraph(text: string): string {
  return `<p style="color:#374151;font-size:15px;margin:0 0 16px;">${text}</p>`
}

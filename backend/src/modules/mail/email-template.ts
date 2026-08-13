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
  gold: { from: '#D4A843', to: '#B8912A', accent: '#F5E6C8', glow: 'rgba(212,168,67,0.15)' },
  red: { from: '#ef4444', to: '#dc2626', accent: '#FEE2E2', glow: 'rgba(239,68,68,0.15)' },
  blue: { from: '#2563EB', to: '#1D4ED8', accent: '#DBEAFE', glow: 'rgba(37,99,235,0.15)' },
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
    ? `<div style="margin:28px 0;text-align:center;">
        <a href="${cta.url.startsWith('http') ? cta.url : `${appUrl}${cta.url}`}"
           style="display:inline-block;background:linear-gradient(135deg,${colors.from},${colors.to});color:#fff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px;box-shadow:0 4px 14px ${colors.glow};transition:all 0.2s;">
          ${cta.text}
        </a>
      </div>`
    : ''

  const footerHtml = `
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0 0 6px;letter-spacing:0.5px;text-transform:uppercase;">COHEP Platform</p>
      <p style="color:#d1d5db;font-size:11px;margin:0;">Coptic Orthodox Holy Education Platform</p>
      ${footer ? `<p style="color:#9ca3af;font-size:11px;margin:12px 0 0;">${footer}</p>` : ''}
    </div>
  `

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background-color:#fafafa;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,${colors.from},${colors.to});padding:32px 24px;border-radius:16px 16px 0 0;text-align:center;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-40px;right:-40px;width:120px;height:120px;background:rgba(255,255,255,0.1);border-radius:50%;"></div>
        <div style="position:absolute;bottom:-30px;left:-30px;width:80px;height:80px;background:rgba(255,255,255,0.08);border-radius:50%;"></div>
        <div style="position:relative;z-index:1;">
          <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:20px;margin-bottom:12px;">
            <span style="color:#fff;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">COHEP</span>
          </div>
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.3px;">${title}</h1>
        </div>
      </div>

      <!-- Body -->
      <div style="background:#ffffff;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;">
        ${content}
        ${ctaHtml}
        ${footerHtml}
      </div>

      <!-- Bottom accent line -->
      <div style="height:4px;background:linear-gradient(90deg,${colors.from},${colors.to},${colors.from});border-radius:0 0 8px 8px;margin:0 20px;"></div>
    </div>
  `
}

export function emailKeyValueRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:12px 0;color:#6b7280;font-size:13px;vertical-align:top;width:40%;">${label}</td>
      <td style="padding:12px 0;font-weight:600;color:#111827;font-size:14px;">${value}</td>
    </tr>
  `
}

export function emailParagraph(text: string): string {
  return `<p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px;">${text}</p>`
}

export function emailDivider(): string {
  return `<hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">`
}

export function emailHighlightBox(content: string, variant: 'gold' | 'red' | 'blue' = 'gold'): string {
  const colors = COLORS[variant]
  return `
    <div style="background:${colors.accent};border-left:4px solid ${colors.from};padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;">
      ${content}
    </div>
  `
}

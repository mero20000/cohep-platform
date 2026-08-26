import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import { LangSync } from '@/components/lang-sync'
import InstallPromptProvider from '@/components/pwa/install-prompt-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'COHEP | Free Coptic Orthodox Hymn Education Platform',
    template: '%s | COHEP',
  },
  description: 'COHEP is a free, open-source platform for Coptic Orthodox hymn education. Structured curriculum, gamified learning, parent portals, and servant tools, built by the community for the Church.',
  icons: {
    icon: '/cohep-logo.png',
    apple: '/cohep-logo.png',
  },
  openGraph: {
    title: 'COHEP | Free Coptic Orthodox Hymn Education Platform',
    description: 'Teach hymns, preserve heritage, and help children belong to the Church. Free, open-source Coptic Orthodox hymn education platform.',
    siteName: 'COHEP',
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'ar_EG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'COHEP | Free Coptic Orthodox Hymn Education Platform',
    description: 'Teach hymns, preserve heritage, and help children belong to the Church. Free, open-source Coptic Orthodox hymn education platform.',
  },
}

/**
 * Root layout (server component).
 *
 * The nonce comes from middleware, which also sets the CSP header. Passing it
 * to our inline scripts is what allows them to execute under the strict,
 * nonce-based Content-Security-Policy — without it they would be blocked as
 * XSS-suspect inline code.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  // Site-wide structured data (moved from the landing page so it can carry the
  // CSP nonce; WebApplication schema is valid on every route).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'COHEP | Coptic Orthodox Hymn Education Platform',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: 'Free, open-source platform for Coptic hymn education.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Organization', name: 'COHEP Community' },
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Coptic:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#C89B3C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="COHEP" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-startup-image" href="/icons/apple-touch-icon.png" />
        <script nonce={nonce} dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.add('js');document.addEventListener('error',function(e){var t=e.target;if(t&&(t.tagName==='IMG'||t.tagName==='AUDIO'||t.tagName==='VIDEO')&&!t.dataset.retried){t.dataset.retried='1';var s=t.getAttribute('src');if(s){t.src=s+(s.indexOf('?')>-1?'&':'?')+'r='+Date.now()}}},true)`
        }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{
          __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}`
        }} />
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className={inter.className}><Providers><LangSync /><InstallPromptProvider />{children}</Providers></body>
    </html>
  )
}

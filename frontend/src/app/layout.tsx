import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'COHEP — Free Coptic Orthodox Hymn Education Platform',
    template: '%s | COHEP',
  },
  description: 'COHEP is a free, open-source platform for Coptic Orthodox hymn education. Structured curriculum, gamified learning, parent portals, and servant tools — built by the community for the Church.',
  icons: {},
  openGraph: {
    title: 'COHEP — Free Coptic Orthodox Hymn Education Platform',
    description: 'Teach hymns, preserve heritage, and help children belong to the Church. Free, open-source Coptic Orthodox hymn education platform.',
    siteName: 'COHEP',
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'ar_EG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'COHEP — Free Coptic Orthodox Hymn Education Platform',
    description: 'Teach hymns, preserve heritage, and help children belong to the Church. Free, open-source Coptic Orthodox hymn education platform.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Coptic:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A2744" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="COHEP" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <script dangerouslySetInnerHTML={{
          __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}`
        }} />
      </head>
      <body className={inter.className}><Providers>{children}</Providers></body>
    </html>
  )
}

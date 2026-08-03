import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to continue your Coptic Orthodox hymn education journey — access your classes, track XP and badges, and keep mastering Coptic hymns.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

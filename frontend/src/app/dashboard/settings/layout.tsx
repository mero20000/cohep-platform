import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings - Coptic Orthodox Hymn Education Platform (COHEP)',
  description: 'Manage school, church, and account settings',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

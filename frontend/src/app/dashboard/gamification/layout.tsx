import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gamification - Coptic Orthodox Hymn Education Platform (COHEP)',
  description: 'Leaderboards, XP tracking, and student rewards',
}

export default function GamificationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

import { DashboardShell } from '@/components/dashboard-shell'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export const metadata = {
  title: 'Dashboard - Coptic Orthodox Hymn Education Platform (COHEP)',
  description: 'Main dashboard for school management',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DashboardShell>
  )
}

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { InsightsClient } from '../insights-client'
vi.mock('@/lib/http-client', () => ({ http: { get: async (u:string) => u.endsWith('/attendance/stats') ? { totalSessions: 10, averageAttendanceRate: 90 } : [] } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/lib/use-language', () => ({ useLanguage: () => 'en' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
describe('Insights', () => {
  it('shows average rate', async () => { render(<InsightsClient />); await waitFor(()=>expect(screen.getByText(/90/)).toBeInTheDocument()) })
  it('student search input has an accessible name', async () => {
    render(<InsightsClient />)
    await waitFor(() => expect(screen.getByRole('textbox', { name: /search student/i })).toBeInTheDocument())
  })
})

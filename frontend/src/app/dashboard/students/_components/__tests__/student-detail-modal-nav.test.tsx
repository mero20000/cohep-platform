import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StudentDetailModal } from '../student-detail-modal'

vi.mock('next/image', () => ({
  // Test double for next/image: a plain <img> is intentional here.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ unoptimized, ...rest }: any) => <img {...rest} />,
}))
vi.mock('lucide-react', async () => (await import('@/test/lucide-mock')).lucideMock())
vi.mock('@/lib/http-client', () => ({ http: { get: vi.fn().mockResolvedValue([]), post: vi.fn() } }))
vi.mock('@/lib/school', () => ({ getSchoolId: () => 'school-1' }))
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/qr/qr-code-card', () => ({ StudentQrCard: () => null }))
vi.mock('../student-subject-items', () => ({ StudentSubjectItemsPanel: () => null }))
vi.mock('../student-tags', () => ({ StudentTagEditor: () => null }))

const student: any = {
  id: '2', studentCode: 'STU-00002', firstName: 'John', lastName: 'Doe',
  dateOfBirth: '2014-03-20T00:00:00Z', gender: 'male', status: 'active',
  enrollmentDate: '2026-01-15T00:00:00Z', metadata: { phone: '01000000000' },
}

function setup(props: Partial<React.ComponentProps<typeof StudentDetailModal>> = {}) {
  const onPrev = vi.fn()
  const onNext = vi.fn()
  render(
    <StudentDetailModal student={student} onClose={vi.fn()} onEdit={vi.fn()} onPreviewPhoto={vi.fn()}
      lang="en" onPrev={onPrev} onNext={onNext} position={{ index: 2, total: 5 }} {...props} />,
  )
  return { onPrev, onNext }
}

describe('StudentDetailModal previous/next navigation', () => {
  it('shows the position and calls the handlers on click', async () => {
    const user = userEvent.setup()
    const { onPrev, onNext } = setup()
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous student' }))
    await user.click(screen.getByRole('button', { name: 'Next student' }))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('disables a direction that has no handler', () => {
    setup({ onPrev: undefined })
    expect(screen.getByRole('button', { name: 'Previous student' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next student' })).toBeEnabled()
  })

  it('disables both buttons and ignores keys while the next page is loading', async () => {
    const user = userEvent.setup()
    const { onNext } = setup({ navBusy: true })
    expect(screen.getByRole('button', { name: 'Next student' })).toBeDisabled()
    await user.keyboard('{ArrowRight}')
    expect(onNext).not.toHaveBeenCalled()
  })

  it('moves with the arrow keys', async () => {
    const user = userEvent.setup()
    const { onPrev, onNext } = setup()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{ArrowLeft}')
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('flips the arrow keys in Arabic (RTL)', async () => {
    const user = userEvent.setup()
    const { onPrev, onNext } = setup({ lang: 'ar' })
    await user.keyboard('{ArrowLeft}')
    expect(onNext).toHaveBeenCalledTimes(1)
    await user.keyboard('{ArrowRight}')
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('renders no navigation when neither handler is provided', () => {
    setup({ onPrev: undefined, onNext: undefined, position: undefined })
    expect(screen.queryByRole('button', { name: 'Next student' })).not.toBeInTheDocument()
  })
})

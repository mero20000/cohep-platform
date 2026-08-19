import { render, screen, waitFor, within } from '@testing-library/react'
import { it, expect, vi, beforeEach } from 'vitest'
import { MinistryDashboard } from '../dashboard-client'

const mockGet = vi.fn()
vi.mock('@/lib/http-client', () => ({
  http: { get: (...a: any[]) => mockGet(...a), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('next/image', () => ({
  default: (props: any) => {
    const { unoptimized, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />
  },
}))

vi.mock('next/link', () => ({
  default: ({ children, ...rest }: any) => <a {...rest}>{children}</a>,
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>()
  const icons: Record<string, any> = {}
  const iconNames = ['Users', 'UserCog', 'UserCheck', 'CalendarClock', 'Phone', 'Info']
  for (const name of iconNames) icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  return { ...actual, ...icons }
})

vi.mock('motion/react', () => ({
  motion: { div: ({ children }: any) => <div>{children}</div> },
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
}))

vi.mock('../hero', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}))

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockImplementation((path: string) => {
    if (path === '/servants/group-mates') return Promise.resolve([])
    return Promise.resolve({ students: [], weeks: [], data: [], absenceAlerts: [] })
  })
})

const renderDashboard = () =>
  render(<MinistryDashboard data={{}} loading={false} error={false} onRetry={vi.fn()} />)

it('shows the group-mates heading and count badge', async () => {
  renderDashboard()
  const heading = await screen.findByText('My Group · Servants')
  const header = heading.parentElement as HTMLElement
  expect(within(header).getByText('0')).toBeTruthy()
})

it('shows an empty message when there are no group mates', async () => {
  renderDashboard()
  expect(await screen.findByText('No other servants in your group')).toBeTruthy()
})

it('lists group mates with their names and phone links', async () => {
  mockGet.mockImplementation((path: string) => {
    if (path === '/servants/group-mates') {
      return Promise.resolve([
        { id: 'm1', firstName: 'John', lastName: 'Doe', firstNameAr: null, lastNameAr: null, avatarUrl: null, phone: '+201000000001' },
        { id: 'm2', firstName: 'Jane', lastName: 'Smith', firstNameAr: null, lastNameAr: null, avatarUrl: null, phone: null },
      ])
    }
    return Promise.resolve({ students: [], weeks: [], data: [], absenceAlerts: [] })
  })

  renderDashboard()

  expect(await screen.findByText('John Doe')).toBeTruthy()
  expect(screen.getByText('Jane Smith')).toBeTruthy()
  await waitFor(() => {
    expect(screen.getByText('My Group · Servants')).toBeTruthy()
  })
})
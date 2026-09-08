import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from '../page'
import { DemoBanner } from '@/components/demo/demo-banner'
import { DemoBannerHost } from '@/components/demo/demo-banner-host'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test stub for next/image, not real markup
  default: (props: any) => <img {...props} alt={props.alt || ''} />,
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

vi.mock('@/hooks/use-form-validation', () => ({
  useFormValidation: () => ({
    fieldErrors: {},
    handleBlur: vi.fn(),
    validate: () => true,
    register: () => ({ ref: vi.fn() }),
  }),
}))

vi.mock('@/components/ui/form-field', () => ({
  FormField: (props: any) => <input aria-label={props.label} />,
}))

vi.mock('@/components/auth/forgot-password-panel', () => ({
  default: () => null,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('lucide-react', async () => {
  const actual: any = await vi.importActual('lucide-react')
  const stub = (props: any) => <span {...props} />
  const icons: Record<string, any> = {}
  for (const k of Object.keys(actual)) icons[k] = stub
  // ensure needed icons exist even if not in actual
  for (const name of ['Eye','EyeOff','Loader2','BookOpen','Trophy','Calendar','Search','Users','Music','Globe','ArrowRight','Sparkles','Shield','Heart','Star','CheckCircle2','AlertTriangle','Cross']) {
    if (!icons[name]) icons[name] = stub
  }
  return icons
})

describe('Demo login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accessToken: 'demo-jwt' }) }))
  })

  it('calls /demo/session on Try Demo click', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByText(/Try Demo/))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/demo/session'), expect.anything()))
  })

  it('renders the Demo Mode banner after demo login', async () => {
    render(<DemoBanner onExit={() => {}} />)
    expect(screen.getByText(/Demo Mode/)).toBeInTheDocument()
  })

  it('renders the banner host when the demo flag is set', async () => {
    localStorage.setItem('demo', '1')
    render(<DemoBannerHost />)
    await waitFor(() => expect(screen.getByText(/Demo Mode/)).toBeInTheDocument())
  })

  it('stores demo flag and token on success', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByText(/Try Demo/))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    // wait a tick for json() and storage
    await waitFor(() => expect(localStorage.getItem('demo')).toBe('1'))
    expect(localStorage.getItem('niangelos_token')).toBe('demo-jwt')
  })
})

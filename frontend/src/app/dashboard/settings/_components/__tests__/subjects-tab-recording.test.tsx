import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SubjectsTab } from '../subjects-tab'

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, children }: any) =>
    open ? <div role="dialog" data-testid="modal">{children}</div> : null,
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, children }: any) => (open ? <div role="dialog" data-testid="confirm">{children}</div> : null),
}))

vi.mock('@/components/ui/detail-drawer', () => ({
  DetailDrawer: ({ open, children }: any) => (open ? <div role="dialog" data-testid="drawer">{children}</div> : null),
  DetailSection: ({ children }: any) => <div>{children}</div>,
  DetailRow: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/form-field', () => ({
  FormField: ({ label, value, onChange, placeholder, error }: any) => (
    <input aria-label={label} value={value ?? ''} onChange={onChange} placeholder={placeholder} data-error={error} />
  ),
}))

vi.mock('@/components/curriculum/slide-editor', () => ({
  SlideEditor: ({ value, onChange }: any) => (
    <div data-testid="slide-editor" onClick={() => onChange && onChange(value)} />
  ),
}))

vi.mock('@/components/curriculum/presentation-viewer', () => ({
  PresentationViewer: () => null,
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  for (const name of ['Plus', 'Pencil', 'Trash2', 'Loader2', 'X', 'Search', 'Presentation', 'Download', 'Upload', 'Check', 'Power', 'PowerOff']) {
    icons[name] = (props: any) => <span data-testid={`icon-${name}`} {...props} />
  }
  return icons
})

const mockToast = vi.fn()
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/lib/use-language', () => ({
  useLanguage: () => 'en',
}))

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/http-client', () => ({
  http: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    patch: mocks.patch,
    delete: mocks.delete,
    upload: mocks.upload,
  },
}))

const mockSubjects = [
  { id: 's1', name: 'Coptic Hymns', nameAr: 'التسبحة القبطية', description: '', color: '#D4AF37', status: 'active', orderIndex: 1 },
]
const mockLevels = [
  { id: 'l1', name: 'Level 1', number: 1, status: 'active' },
]
const mockItems = [
  { id: 'i1', subjectId: 's1', whenLabel: 'Liturgy', name: 'Tenosht', nameAr: 'تنوش', level: 1, sessionsGroup1: 2, sessionsGroup2: 0, sessionsGroup3: 0, sessionsGroup4: 0, optional: false, orderIndex: 1, active: true },
]

describe('SubjectsTab recording control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.get.mockImplementation((url: string) => {
      if (url === '/curriculum/subjects') return Promise.resolve(mockSubjects)
      if (url === '/curriculum/levels') return Promise.resolve(mockLevels)
      if (url.startsWith('/curriculum/subjects/') && url.endsWith('/items')) return Promise.resolve(mockItems)
      return Promise.reject(new Error(`Unhandled get: ${url}`))
    })
    mocks.post.mockResolvedValue({ id: 'new' })
    mocks.put.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
    mocks.upload.mockResolvedValue({ recordingUrl: 'https://cdn/rec.mp3', recordingMeta: { originalName: 'rec.mp3', sizeBytes: 123, contentType: 'audio/mpeg' } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an Upload recording button when no recordingUrl, and uploads via http.upload with the recording endpoint', async () => {
    const user = userEvent.setup()
    render(<SubjectsTab />)

    // Select a subject to reveal the items section
    await user.click(await screen.findByText('Coptic Hymns'))
    // Open the item edit modal (recording control requires an existing item)
    await user.click(await screen.findByLabelText('Edit Item'))

    const uploadBtn = await screen.findByText('Upload recording')
    expect(uploadBtn).toBeInTheDocument()

    // Simulate choosing an audio file via the hidden file input
    const audioInput = document.querySelector('input[type="file"][accept="audio/*"]') as HTMLInputElement
    expect(audioInput).toBeTruthy()
    const file = new File(['data'], 'hymn.mp3', { type: 'audio/mpeg' })
    fireEvent.change(audioInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(mocks.upload).toHaveBeenCalledWith(
        '/curriculum/subjects/items/i1/recording',
        expect.any(FormData),
      )
    })

    // After a successful upload an <audio> element should appear
    await waitFor(() => {
      const audio = document.querySelector('audio')
      expect(audio).toBeTruthy()
      expect(audio?.getAttribute('src')).toBe('https://cdn/rec.mp3')
    })
  })
})

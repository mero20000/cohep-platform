import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { FollowUpControl } from '../follow-up-control'

const mockPut = vi.fn()
vi.mock('@/lib/http-client', () => ({ http: { put: (...a: any[]) => mockPut(...a) } }))

beforeEach(() => { mockPut.mockReset() })

it('ticks the student and reports the saved state', async () => {
  const onChange = vi.fn()
  const saved = { done: true, note: null, completedAt: '2026-10-31T09:00:00Z' }
  mockPut.mockResolvedValue(saved)
  render(<FollowUpControl studentId="s1" followUp={null} lang="en" onChange={onChange} />)
  fireEvent.click(screen.getByRole('checkbox'))
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(saved))
  expect(mockPut).toHaveBeenCalledWith('/dashboard/follow-ups/s1', { done: true })
})

it('unticks an already-done follow-up', async () => {
  mockPut.mockResolvedValue({ done: false, note: null, completedAt: null })
  render(<FollowUpControl studentId="s1" followUp={{ done: true, note: null, completedAt: 'x' }} lang="en" onChange={vi.fn()} />)
  expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('checkbox'))
  await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/dashboard/follow-ups/s1', { done: false }))
})

it('saves the note on blur only when it changed', async () => {
  mockPut.mockResolvedValue({ done: false, note: 'Called mum', completedAt: null })
  render(<FollowUpControl studentId="s1" followUp={null} lang="en" onChange={vi.fn()} />)
  const box = screen.getByLabelText(/What happened/)
  fireEvent.blur(box)
  expect(mockPut).not.toHaveBeenCalled()
  fireEvent.change(box, { target: { value: 'Called mum' } })
  fireEvent.blur(box)
  await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/dashboard/follow-ups/s1', { note: 'Called mum' }))
})

it('shows an error when saving fails', async () => {
  mockPut.mockImplementation(() => Promise.reject(new Error('boom')))
  render(<FollowUpControl studentId="s1" followUp={null} lang="en" onChange={vi.fn()} />)
  fireEvent.click(screen.getByRole('checkbox'))
  expect(await screen.findByRole('alert')).toBeTruthy()
})

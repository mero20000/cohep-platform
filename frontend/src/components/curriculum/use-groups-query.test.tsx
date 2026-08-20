import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useGroupsQuery } from './hooks'

vi.mock('@/lib/school', () => ({
  getSchoolId: () => 'school-1',
}))

const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

it('returns the flat groups array from /students/groups/all', async () => {
  const groups = [
    { id: 'g1', name: 'Group 1A', status: 'active', orderIndex: 5 },
    { id: 'g2', name: 'Group 2A', status: 'active', orderIndex: 6 },
  ]
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => groups }) as any

  const { result } = renderHook(() => useGroupsQuery(), { wrapper: makeWrapper() })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  expect(result.current.data).toEqual(groups)
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/students/groups/all?schoolId=school-1'),
    expect.anything(),
  )
})
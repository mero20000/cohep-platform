import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/http-client', () => ({
  http: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}))

import {
  fetchGrades,
  fetchActiveGrades,
  fetchGroups,
  createGrade,
  updateGrade,
  deleteGrade,
} from './grades'

const grade = (id: string, name: string, status: string) => ({ id, name, status })

describe('fetchGrades', () => {
  it('requests /grades with the school id', async () => {
    mocks.get.mockResolvedValue([grade('g1', 'Grade 1', 'active')])
    const grades = await fetchGrades()
    expect(mocks.get).toHaveBeenCalledWith('/grades', { schoolId: 'niangelos-main' })
    expect(grades).toEqual([grade('g1', 'Grade 1', 'active')])
  })
})

describe('fetchActiveGrades', () => {
  beforeEach(() => {
    mocks.get.mockReset()
  })

  it('returns only grades with status active', async () => {
    mocks.get.mockResolvedValue([
      grade('g1', 'Grade 1', 'active'),
      grade('g2', 'Grade 2', 'inactive'),
      grade('g3', 'Grade 3', 'active'),
    ])
    const grades = await fetchActiveGrades()
    expect(grades.map(g => g.name)).toEqual(['Grade 1', 'Grade 3'])
  })

  it('returns empty array when no grades are active', async () => {
    mocks.get.mockResolvedValue([grade('g1', 'Grade 1', 'inactive')])
    expect(await fetchActiveGrades()).toEqual([])
  })
})

describe('fetchGroups', () => {
  it('returns the flat groups array from /students/groups/all', async () => {
    const groups = [
      { id: 'grp1', name: 'Group 1', status: 'active' },
      { id: 'grp2', name: 'Group 2', status: 'inactive' },
    ]
    mocks.get.mockResolvedValue(groups)
    const result = await fetchGroups()
    expect(mocks.get).toHaveBeenCalledWith('/students/groups/all', { schoolId: 'niangelos-main' })
    expect(result).toEqual(groups)
  })
})

describe('createGrade', () => {
  it('posts to /grades with the input and school id', async () => {
    const input = { name: 'Grade 4', groupId: 'grp1' }
    mocks.post.mockResolvedValue({ id: 'g4', ...input, status: 'active' })
    const created = await createGrade(input)
    expect(mocks.post).toHaveBeenCalledWith('/grades', input, { schoolId: 'niangelos-main' })
    expect(created.id).toBe('g4')
  })
})

describe('updateGrade', () => {
  it('patches /grades/:id with the input', async () => {
    const input = { name: 'Grade 4B', status: 'inactive' }
    mocks.patch.mockResolvedValue({ id: 'g4', name: 'Grade 4B', status: 'inactive' })
    await updateGrade('g4', input)
    expect(mocks.patch).toHaveBeenCalledWith('/grades/g4', input)
  })
})

describe('deleteGrade', () => {
  it('deletes /grades/:id', async () => {
    mocks.delete.mockResolvedValue(undefined)
    await deleteGrade('g4')
    expect(mocks.delete).toHaveBeenCalledWith('/grades/g4')
  })
})

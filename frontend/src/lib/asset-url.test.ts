import { describe, it, expect, afterEach } from 'vitest'
import { assetUrl } from './asset-url'

const API = 'https://api.example.com/api'

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL
})

describe('assetUrl', () => {
  it('returns empty string for nullish input', () => {
    expect(assetUrl(undefined)).toBe('')
    expect(assetUrl(null)).toBe('')
    expect(assetUrl('')).toBe('')
  })

  it('returns absolute URLs unchanged', () => {
    const abs = 'https://cdn.example.com/recordings/subject-items/x-y.mp3'
    expect(assetUrl(abs)).toBe(abs)
    expect(assetUrl('http://other/foo.mp3')).toBe('http://other/foo.mp3')
  })

  it('rewrites /uploads/ to the API origin (default and configured)', () => {
    expect(assetUrl('/uploads/audio/foo.mp3')).toBe('http://localhost:3001/uploads/audio/foo.mp3')
    process.env.NEXT_PUBLIC_API_URL = API
    expect(assetUrl('/uploads/audio/foo.mp3')).toBe('https://api.example.com/uploads/audio/foo.mp3')
  })

  it('routes relative storage keys through the backend stream proxy', () => {
    process.env.NEXT_PUBLIC_API_URL = API
    expect(assetUrl('recordings/01_Alleluia_Fai_Pe_Pi.mp3')).toBe(
      'https://api.example.com/api/curriculum/recordings/stream?src=recordings%2F01_Alleluia_Fai_Pe_Pi.mp3',
    )
    expect(assetUrl('01_Alleluia_Fai_Pe_Pi.mp3')).toBe(
      'https://api.example.com/api/curriculum/recordings/stream?src=01_Alleluia_Fai_Pe_Pi.mp3',
    )
  })
})

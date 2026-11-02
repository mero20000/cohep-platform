import { describe, it, expect, afterEach } from 'vitest'
import { assetUrl, thumbUrl } from './asset-url'

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

describe('thumbUrl', () => {
  const cloud = 'https://res.cloudinary.com/demo/image/upload/v1700000000/student-photos/abc.jpg'

  it('asks Cloudinary for a face-centred crop at twice the CSS size', () => {
    expect(thumbUrl(cloud, 36)).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_72,h_72,q_auto,f_auto/v1700000000/student-photos/abc.jpg',
    )
  })

  it('does not stack a second transformation on an already-transformed URL', () => {
    const done = 'https://res.cloudinary.com/demo/image/upload/c_fill,w_100/v1/student-photos/abc.jpg'
    expect(thumbUrl(done, 36)).toBe(done)
  })

  it('returns other storage hosts and local uploads unchanged (they cannot be resized)', () => {
    expect(thumbUrl('https://pub-123.r2.dev/student-photos/a.jpg', 36)).toBe('https://pub-123.r2.dev/student-photos/a.jpg')
    process.env.NEXT_PUBLIC_API_URL = API
    expect(thumbUrl('/uploads/student-photos/a.jpg', 36)).toBe('https://api.example.com/uploads/student-photos/a.jpg')
  })

  it('returns an empty string for no photo', () => {
    expect(thumbUrl(null, 36)).toBe('')
    expect(thumbUrl(undefined, 36)).toBe('')
  })

  it('does not rewrite look-alike hosts', () => {
    const fake = 'https://res.cloudinary.com.evil.example/image/upload/v1/a.jpg'
    expect(thumbUrl(fake, 36)).toBe(fake)
  })
})

export function assetUrl(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('/uploads/')) {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '')
    return base + url
  }
  return url
}

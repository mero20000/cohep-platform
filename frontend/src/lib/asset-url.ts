export function assetUrl(url?: string | null): string {
  if (!url) return ''
  // Already an absolute URL (R2 / CDN) — use as-is.
  if (/^https?:\/\//i.test(url)) return url
  // Local uploads served statically by the API.
  if (url.startsWith('/uploads/')) {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '')
    return base + url
  }
  // Relative storage key (e.g. a bare R2 key without the public-URL prefix) —
  // the browser can't resolve it on its own, so stream it through the backend
  // proxy which knows how to locate the file (R2 or local).
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  return `${api}/curriculum/recordings/stream?src=${encodeURIComponent(url)}`
}

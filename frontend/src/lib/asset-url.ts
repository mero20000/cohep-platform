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

/**
 * A small version of an image for avatars. A student list can be 30+ faces on a phone, and the originals are
 * full camera photos, so fetching them as they are would cost megabytes on church Wi-Fi.
 *
 * Cloudinary can resize and crop on the fly (and `g_face` centres the crop on the face), so its URLs get a
 * transformation. Anything else (R2, local uploads) is returned unchanged: it still works, just not resized.
 * `px` is the CSS size; twice that is requested so the image stays sharp on high-density phone screens.
 */
export function thumbUrl(url: string | null | undefined, px: number): string {
  const full = assetUrl(url)
  const marker = '/image/upload/'
  if (!full || !/^https:\/\/res\.cloudinary\.com\//i.test(full)) return full
  const at = full.indexOf(marker)
  if (at === -1) return full
  const head = full.slice(0, at + marker.length)
  const rest = full.slice(at + marker.length)
  // Already transformed (e.g. "c_fill,w_100/v123/..."): leave it alone rather than stack transformations.
  if (/^[a-z]{1,3}_[^/]*\//i.test(rest) && !/^v\d+\//.test(rest)) return full
  const size = Math.round(px * 2)
  return `${head}c_fill,g_face,w_${size},h_${size},q_auto,f_auto/${rest}`
}

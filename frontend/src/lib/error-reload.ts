export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false
  const msg = error.message || ''
  return (
    /Loading chunk \d+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Unable to preload CSS/i.test(msg)
  )
}

export const CHUNK_RELOAD_KEY = 'niangelos_chunk_reload_attempted'

export function shouldAutoReloadOnChunkError(error: Error | null | undefined): boolean {
  if (!isChunkLoadError(error)) return false
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    return true
  } catch {
    return true
  }
}

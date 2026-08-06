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

/**
 * Maximum consecutive auto-reloads allowed per session for chunk-load errors.
 * A deploy can briefly serve a stale HTML shell whose chunk hashes no longer
 * exist, so we retry a couple of times before giving up and showing the error
 * UI (avoiding an infinite reload loop if a chunk is genuinely missing).
 */
export const CHUNK_RELOAD_MAX = 3

export function shouldAutoReloadOnChunkError(error: Error | null | undefined): boolean {
  if (!isChunkLoadError(error)) return false
  if (typeof window === 'undefined') return false
  try {
    const used = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0) || 0
    if (used >= CHUNK_RELOAD_MAX) return false
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(used + 1))
    return true
  } catch {
    return true
  }
}

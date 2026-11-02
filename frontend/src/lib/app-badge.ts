/**
 * App-icon badge (Badging API). Shows the unread count on the installed app's icon.
 * A silent no-op wherever it isn't supported or the app isn't installed.
 */
type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

export function setAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return
  const nav = navigator as BadgeNavigator
  try {
    const result = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
    result?.catch(() => {})
  } catch {
    // The API can throw synchronously on some platforms; the badge is cosmetic.
  }
}

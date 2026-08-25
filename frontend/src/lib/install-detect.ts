/**
 * Browser/platform detection for the PWA install experience.
 * All functions are SSR-safe (return false when window is undefined).
 */

export type Platform = 'ios' | 'android' | 'desktop' | 'other'

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/** iPadOS 13+ masquerades as desktop Safari — detect via touch + Mac. */
export function isIPadOS(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.navigator.userAgent.includes('Mac') &&
    (window.navigator.maxTouchPoints ?? 0) > 1
  )
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false
  return /android/i.test(window.navigator.userAgent)
}

export function isSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return /safari/i.test(ua) && !/chrome|crios|fxios|edg/i.test(ua)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'other'
  if (isIOS() || isIPadOS()) return 'ios'
  if (isAndroid()) return 'android'
  if (window.matchMedia('(display-mode: standalone)').matches || !('ontouchstart' in window)) {
    return 'desktop'
  }
  return 'other'
}

/** Chrome/Edge expose BeforeInstallPromptEvent. */
export function supportsBeforeInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false
  return 'onbeforeinstallprompt' in window
}

/** Minimal typing for the non-standard event. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getPlatform, isStandalone, supportsBeforeInstallPrompt,
  type BeforeInstallPromptEvent, type Platform,
} from './install-detect'
import { track } from './analytics'

/**
 * Intelligent display gating (spec §6) — localStorage keys:
 *   cohep_install_dismissed_at   — last dismissal timestamp
 *   cohep_install_dismiss_count  — total dismissals
 *   cohep_install_installed      — '1' once installed
 *   cohep_visit_count            — distinct session visits
 *   cohep_first_seen_at          — first visit timestamp
 *
 * Show when ANY of: ≥3 page visits, ≥60s on platform, second visit (returning),
 * or lesson completed (cohep_lesson_completed set by lesson flow).
 * Never show: installed, dismissed 3×, or dismissed < 7 days ago.
 */

const K = {
  dismissedAt: 'cohep_install_dismissed_at',
  dismissCount: 'cohep_install_dismiss_count',
  installed: 'cohep_install_installed',
  visits: 'cohep_visit_count',
  firstSeen: 'cohep_first_seen_at',
  lessonDone: 'cohep_lesson_completed',
} as const

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const MAX_DISMISSALS = 3
const MIN_SECONDS_ON_SITE = 60

export type InstallSurface = 'ios' | 'android' | 'desktop'

export interface InstallState {
  /** Modal may be shown (all gates passed, platform eligible). */
  shouldShow: boolean
  /** false while the eligibility timer is still running. */
  ready: boolean
  platform: Platform
  surface: InstallSurface | null
  deferredPrompt: BeforeInstallPromptEvent | null
  isInstalled: boolean
  dismiss: () => void
  markInstalled: () => void
  /** Android/Chrome native prompt(); resolves userChoice. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

function readNum(key: string): number {
  try { return parseInt(localStorage.getItem(key) || '0', 10) || 0 } catch { return 0 }
}

function readTs(key: string): number {
  try { return parseInt(localStorage.getItem(key) || '0', 10) || 0 } catch { return 0 }
}

/** Count this tab's visit once per session (sessionStorage guard). */
export function recordVisit(): void {
  if (typeof window === 'undefined') return
  try {
    if (!sessionStorage.getItem('cohep_visit_counted')) {
      sessionStorage.setItem('cohep_visit_counted', '1')
      localStorage.setItem(K.visits, String(readNum(K.visits) + 1))
      if (!readTs(K.firstSeen)) localStorage.setItem(K.firstSeen, String(Date.now()))
    }
  } catch { /* storage unavailable */ }
}

/** Called by lesson-completion flows to unlock the prompt early. */
export function markLessonCompleted(): void {
  try { localStorage.setItem(K.lessonDone, '1') } catch { /* noop */ }
}

export function useInstallPrompt(): InstallState {
  const [platform, setPlatform] = useState<Platform>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [eligible, setEligible] = useState(false)
  const [secondsOnSite, setSecondsOnSite] = useState(0)

  // Capture the native prompt event (Android/desktop Chrome & Edge).
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    const onInstalled = () => { setInstalled(true); try { localStorage.setItem(K.installed, '1') } catch {} }
    window.addEventListener('appinstalled', onInstalled)
    if (isStandalone()) { setInstalled(true); try { localStorage.setItem(K.installed, '1') } catch {} }
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Platform + eligibility evaluation.
  useEffect(() => {
    setPlatform(getPlatform())
    setInstalled(isStandalone() || readNum(K.installed) === 1)

    // 60-second on-platform timer (spec: "spent 60 seconds").
    const tick = setInterval(() => setSecondsOnSite(s => s + 1), 1000)
    // Re-evaluate when the tab becomes visible again (visit count may have changed).
    const evaluate = () => {
      const visits = readNum(K.visits)
      const firstSeen = readTs(K.firstSeen)
      const returning = visits >= 2 && Date.now() - firstSeen > 5_000
      const lessonDone = readTs(K.lessonDone) > 0
      setEligible(visits >= 3 || secondsOnSite >= MIN_SECONDS_ON_SITE || returning || lessonDone)
    }
    evaluate()
    window.addEventListener('focus', evaluate)
    return () => { clearInterval(tick); window.removeEventListener('focus', evaluate) }
  }, [secondsOnSite])

  const surface: InstallSurface | null =
    platform === 'ios' ? 'ios'
    : platform === 'android' ? 'android'
    : platform === 'desktop' ? 'desktop'
    : null

  const gatesOk = (() => {
    try {
      if (readNum(K.installed) === 1 || installed) return false
      if (readNum(K.dismissCount) >= MAX_DISMISSALS) return false
      const last = readTs(K.dismissedAt)
      if (last && Date.now() - last < SEVEN_DAYS_MS) return false
      return true
    } catch { return false }
  })()

  const shouldShow = gatesOk && eligible && !installed && surface !== null

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(K.dismissedAt, String(Date.now()))
      localStorage.setItem(K.dismissCount, String(readNum(K.dismissCount) + 1))
    } catch { /* noop */ }
    track('install_prompt_dismissed', 'pwa', { platform })
  }, [platform])

  const markInstalled = useCallback(() => {
    try { localStorage.setItem(K.installed, '1') } catch { /* noop */ }
    setInstalled(true)
    track('install_completed', 'pwa', { platform })
  }, [platform])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    track('install_started', 'pwa', { platform })
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') markInstalled()
    setDeferredPrompt(null)
    return outcome
  }, [deferredPrompt, platform, markInstalled])

  return {
    shouldShow, ready: true, platform, surface, deferredPrompt,
    isInstalled: installed, dismiss, markInstalled, promptInstall,
  }
}

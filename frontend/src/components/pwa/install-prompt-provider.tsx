'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import InstallAppModal from '@/components/pwa/install-app-modal'
import { useInstallPrompt, recordVisit } from '@/lib/use-install-prompt'

/**
 * Mounts once in the root layout. Counts visits, runs the eligibility
 * gates with a small grace delay (avoid interrupting first paint), and
 * renders InstallAppModal when all conditions pass.
 */
export default function InstallPromptProvider() {
  const pathname = usePathname()
  const { shouldShow, surface, promptInstall, dismiss, markInstalled } = useInstallPrompt()
  const [open, setOpen] = useState(false)

  // Count each session visit (spec gate: visited 3 pages / returned 2nd visit).
  useEffect(() => { recordVisit() }, [pathname])

  // Grace delay so the prompt never fights initial load; re-check when gates change.
  useEffect(() => {
    if (!shouldShow || open) return
    const timer = setTimeout(() => setOpen(true), 2500)
    return () => clearTimeout(timer)
  }, [shouldShow, open])

  // Don't remount over navigation while open.
  useEffect(() => { if (open && !shouldShow) setOpen(false) }, [shouldShow, open])

  if (!open || !surface) return null

  return (
    <InstallAppModal
      surface={surface}
      onPromptInstall={promptInstall}
      onDismiss={() => { dismiss(); setOpen(false) }}
      onInstalled={() => { markInstalled(); setOpen(false) }}
    />
  )
}

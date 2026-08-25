'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { X, Share, PlusSquare, CheckCircle2, MonitorSmartphone, Download, Loader2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { track } from '@/lib/analytics'
import type { InstallSurface } from '@/lib/use-install-prompt'

interface Props {
  surface: InstallSurface
  /** Android/desktop: native prompt() runner; iOS passes undefined. */
  onPromptInstall?: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  onDismiss: () => void
  onInstalled: () => void
}

/**
 * InstallAppModal — premium dark bottom-sheet (mobile) / centered card (desktop).
 * iOS: 4-step manual instructions. Android/desktop: native prompt button.
 * WCAG AA: role=dialog, aria-modal, focus trap, Esc closes, labelled controls.
 */
export default function InstallAppModal({ surface, onPromptInstall, onDismiss, onInstalled }: Props) {
  const lang = useLanguage()
  const ar = lang === 'ar'
  const t = (en: string, arText: string) => (ar ? arText : en)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const [prompting, setPrompting] = useState(false)
  const [installedNow, setInstalledNow] = useState(false)

  useEffect(() => { track('install_prompt_shown', 'pwa', { surface }) }, [surface])

  // Focus management: move focus in, trap Tab, restore on close, Esc dismisses.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement
    const node = dialogRef.current
    node?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss() }
      if (e.key === 'Tab' && node) {
        const focusables = node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0], last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused.current?.focus()
    }
  }, [onDismiss])

  const handleNativeInstall = useCallback(async () => {
    if (!onPromptInstall) return
    setPrompting(true)
    const outcome = await onPromptInstall()
    setPrompting(false)
    if (outcome === 'accepted') { setInstalledNow(true); onInstalled() }
  }, [onPromptInstall, onInstalled])

  const benefits = [
    t('Faster access', 'وصول أسرع'),
    t('Works like an app', 'يعمل كتطبيق'),
    t('Better mobile learning experience', 'تجربة تعلم أفضل على الجوال'),
    t('Receive future notifications', 'استقبل الإشعارات المستقبلية'),
  ]

  const iosSteps = [
    { icon: Share, text: t('Tap the Share button in Safari', 'اضغط زر المشاركة في سفاري'), label: t('Step 1', 'الخطوة ١') },
    { icon: PlusSquare, text: t('Scroll down and select "Add to Home Screen"', 'انزل للأسفل واختر "إضافة إلى الشاشة الرئيسية"'), label: t('Step 2', 'الخطوة ٢') },
    { icon: CheckCircle2, text: t('Tap "Add"', 'اضغط "إضافة"'), label: t('Step 3', 'الخطوة ٣') },
  ]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in sm:items-center"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
        aria-describedby="install-modal-desc"
        dir={ar ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-gradient-to-b from-[#1A2744] to-[#101a30] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 sm:zoom-in-95"
        style={{ borderRadius: '24px' }}
      >
        {/* Grab handle (mobile affordance) */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

        {/* Close */}
        <button
          onClick={onDismiss}
          aria-label={t('Close', 'إغلاق')}
          className="absolute top-4 end-4 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C89B3C]"
        >
          <X className="h-5 w-5" />
        </button>

        {/* App icon + title */}
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192x192.png" alt="COHEP" width={56} height={56} className="h-14 w-14 rounded-2xl border border-white/15 shadow-lg" />
          <div className="min-w-0">
            <h2 id="install-modal-title" className="text-xl font-bold text-white tracking-tight">
              {t('Install COHEP', 'ثبّت COHEP')}
            </h2>
            <p className="text-xs font-medium text-[#C89B3C]">{t('Free · Works offline', 'مجاني · يعمل دون اتصال')}</p>
          </div>
        </div>

        <p id="install-modal-desc" className="mt-4 text-sm leading-relaxed text-white/70">
          {t(
            'Learn hymns anytime, anywhere. Add COHEP to your device for faster access to lessons, recordings, notation, and spiritual resources.',
            'تعلّم التراتيل في أي وقت ومن أي مكان. أضف COHEP إلى جهازك للوصول السريع إلى الدروس والتسجيلات والنوتات والمصادر الروحية.'
          )}
        </p>

        {/* Benefits */}
        <ul className="mt-4 space-y-2" aria-label={t('Benefits', 'المزايا')}>
          {benefits.map(b => (
            <li key={b} className="flex items-center gap-2.5 text-sm text-white/85">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              {b}
            </li>
          ))}
        </ul>

        {/* ── iOS: 4-step sheet ── */}
        {surface === 'ios' && (
          <ol className="mt-5 space-y-3" aria-label={t('Installation steps', 'خطوات التثبيت')}>
            {iosSteps.map((step, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C89B3C]/15 border border-[#C89B3C]/30" aria-hidden="true">
                  <step.icon className="h-5 w-5 text-[#C89B3C]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{step.label}</div>
                  <div className="text-sm font-medium text-white/90">{step.text}</div>
                </div>
              </li>
            ))}
            <li className="flex items-center gap-3 rounded-2xl border border-[#C89B3C]/25 bg-[#C89B3C]/10 p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-192x192.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#C89B3C]">{t('Step 4', 'الخطوة ٤')}</div>
                <div className="text-sm font-medium text-white/90">{t('COHEP will appear on your Home Screen', 'سيظهر COHEP على شاشتك الرئيسية')}</div>
              </div>
            </li>
          </ol>
        )}

        {/* ── Android / Desktop: native prompt ── */}
        {surface !== 'ios' && (
          <div className="mt-5">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C89B3C]/15 border border-[#C89B3C]/30" aria-hidden="true">
                <MonitorSmartphone className="h-5 w-5 text-[#C89B3C]" />
              </span>
              <p className="text-sm text-white/85">
                {surface === 'android'
                  ? t('Install COHEP', 'ثبّت COHEP')
                  : t('Install COHEP on your computer', 'ثبّت COHEP على حاسوبك')}
              </p>
            </div>
            {installedNow ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 text-sm font-semibold text-emerald-300" role="status">
                <CheckCircle2 className="h-4 w-4" /> {t('Installed! Check your home screen.', 'تم التثبيت! تحقق من شاشتك الرئيسية.')}
              </div>
            ) : (
              <button
                data-autofocus
                onClick={handleNativeInstall}
                disabled={prompting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C89B3C] to-[#B8862F] px-5 py-3.5 text-sm font-bold text-[#1A2744] shadow-lg shadow-[#C89B3C]/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {prompting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {surface === 'android' ? t('Install Now', 'ثبّت الآن') : t('Install App', 'ثبّت التطبيق')}
              </button>
            )}
          </div>
        )}

        {/* Not now */}
        <button
          onClick={onDismiss}
          className="mt-3 w-full rounded-xl py-2.5 text-center text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {t('Not now', 'ليس الآن')}
        </button>
      </div>
    </div>
  )
}

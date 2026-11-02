'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push'
import { isIOS, isIPadOS, isStandalone } from '@/lib/install-detect'

/** Opt-in for notifications on this device. Asking needs a click, so it lives in settings, not on load. */
export function PushToggle() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPushState().then((s) => { if (!cancelled) setState(s) }).catch(() => { if (!cancelled) setState('unsupported') })
    return () => { cancelled = true }
  }, [])

  const run = async (action: () => Promise<PushState>) => {
    setBusy(true)
    setFailed(false)
    try {
      setState(await action())
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const needsHomeScreen = (isIOS() || isIPadOS()) && !isStandalone()

  const message: Record<PushState, string> = {
    unsupported: needsHomeScreen
      ? t('On iPhone and iPad, add COHEP to your Home Screen first, then open it from there to turn on notifications.',
          'على الآيفون والآيباد، أضف التطبيق إلى الشاشة الرئيسية أولاً ثم افتحه من هناك لتفعيل الإشعارات.')
      : t('This browser does not support push notifications.', 'هذا المتصفح لا يدعم الإشعارات الفورية.'),
    unavailable: t('Push notifications are not set up yet.', 'الإشعارات الفورية غير مفعّلة بعد.'),
    denied: t('Notifications are blocked for this site. Allow them in your browser settings, then come back here.',
              'الإشعارات محظورة لهذا الموقع. اسمح بها من إعدادات المتصفح ثم عد إلى هنا.'),
    off: t('Get a notification on this device when something needs your attention.',
           'احصل على إشعار على هذا الجهاز عندما يحتاج أمر ما إلى انتباهك.'),
    on: t('Notifications are on for this device.', 'الإشعارات مفعّلة على هذا الجهاز.'),
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-700" aria-hidden="true">
          {state === 'on' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900">{t('Push notifications', 'الإشعارات الفورية')}</h3>
          <p className="mt-1 text-sm text-gray-600" role="status" aria-live="polite">
            {state === null ? t('Checking…', 'جارٍ التحقق…') : message[state]}
          </p>
          {failed && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {t('Something went wrong. Please try again.', 'حدث خطأ. حاول مرة أخرى.')}
            </p>
          )}
          {(state === 'off' || state === 'on') && (
            <Button
              className="mt-3 min-h-[44px]"
              variant={state === 'on' ? 'outline' : 'default'}
              disabled={busy}
              onClick={() => run(state === 'on' ? disablePush : enablePush)}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {state === 'on' ? t('Turn off on this device', 'إيقاف على هذا الجهاز') : t('Turn on notifications', 'تفعيل الإشعارات')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

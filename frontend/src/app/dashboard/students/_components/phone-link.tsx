'use client'
import { useState, useRef, useEffect } from 'react'
import { Phone, MessageCircle } from 'lucide-react'
import { toTelHref, toWhatsAppDigits } from '@/lib/phone'

interface Props { phone: string; lang: 'en' | 'ar' }

export function PhoneLink({ phone, lang }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const timer = setTimeout(() => document.addEventListener('click', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handler) }
  }, [open])

  if (!phone.trim()) return <span className="text-gray-400">&mdash;</span>
  const whatsappDigits = toWhatsAppDigits(phone)

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 underline decoration-dotted underline-offset-2">
        <Phone className="h-3.5 w-3.5" />{phone}
      </button>
      {open && (
        <div className="absolute start-0 top-full mt-1 z-50 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg" onClick={() => setOpen(false)}>
          <a href={toTelHref(phone)}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors">
            <Phone className="h-3.5 w-3.5" />{t('Call','اتصال')}
          </a>
          {whatsappDigits ? (
            <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
              <MessageCircle className="h-3.5 w-3.5" />{t('WhatsApp','واتساب')}
            </a>
          ) : (
            <span
              title={t('Add a country code (e.g. +20) to this number to enable WhatsApp', 'أضف رمز الدولة (مثل ٢٠+) لهذا الرقم لتفعيل واتساب')}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-400 cursor-not-allowed">
              <MessageCircle className="h-3.5 w-3.5" />{t('WhatsApp','واتساب')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { HelpCircle, X, Keyboard, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

const SHORTCUTS = [
  { key: '?', en: 'Show this help', ar: 'إظهار هذه المساعدة' },
  { key: 'H', en: 'Go to Dashboard', ar: 'الذهاب إلى لوحة التحكم' },
  { key: 'A', en: 'Go to Attendance', ar: 'الذهاب إلى الحضور' },
  { key: 'S', en: 'Focus search', ar: 'تركيز البحث' },
  { key: 'T', en: 'Go to Students', ar: 'الذهاب إلى الطلاب' },
  { key: 'G', en: 'Go to Gamification', ar: 'الذهاب إلى الألعاب' },
  { key: '⌘K', en: 'Focus search', ar: 'تركيز البحث' },
]

export function HelpButton() {
  const lang = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        id="help-button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-200 hover:bg-gold-600 hover:scale-105 active:scale-95 transition-transform"
        aria-label={lang === 'ar' ? 'مساعدة' : 'Help'}
        title={lang === 'ar' ? 'مساعدة' : 'Help'}
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {lang === 'ar' ? 'مساعدة' : 'Help'}
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Keyboard className="h-4 w-4 text-gold-700" />
                  {lang === 'ar' ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
                </h3>
                <div className="space-y-2">
                  {SHORTCUTS.map(s => (
                    <div key={s.key} className="flex items-center justify-between">
                      <kbd className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-mono font-bold text-gray-600 min-w-[2.5rem]">
                        {s.key}
                      </kbd>
                      <span className="text-xs text-gray-600">{lang === 'ar' ? s.ar : s.en}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {lang === 'ar' ? 'نصائح سريعة' : 'Quick Tips'}
                </h3>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-3 w-3 text-gold-700 mt-0.5 shrink-0" />
                    {lang === 'ar' ? 'بياناتك تُحدَّث تلقائياً كل دقيقتين.' : 'Dashboard data refreshes automatically every 2 minutes.'}
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-3 w-3 text-gold-700 mt-0.5 shrink-0" />
                    {lang === 'ar' ? 'يمكنك تغيير دور العرض من القائمة العلوية.' : 'Switch your view role from the top toolbar.'}
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-3 w-3 text-gold-700 mt-0.5 shrink-0" />
                    {lang === 'ar' ? 'اختر مدرسة مختلفة من قائمة المدارس في الأعلى.' : 'Switch between schools using the school picker.'}
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

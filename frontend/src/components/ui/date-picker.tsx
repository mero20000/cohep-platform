'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  min?: string
  max?: string
  id?: string
}

function toDate(value: string): Date | null {
  if (!value) return null
  const d = new Date(value + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDisplay(dateStr: string, locale: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']

export function DatePicker({ value, onChange, className = '', min, max, id }: DatePickerProps) {
  const lang = useLanguage()
  const isRtl = lang === 'ar'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = toDate(value)
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? new Date().getMonth())
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? new Date().getFullYear())
  const today = new Date()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick) }
  }, [open])

  useEffect(() => {
    if (selected) {
      setViewMonth(selected.getMonth())
      setViewYear(selected.getFullYear())
    }
  }, [value])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const todayStr = formatDate(today)

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }, [viewMonth])

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }, [viewMonth])

  const MONTHS = isRtl ? MONTHS_AR : MONTHS_EN
  const DAYS = isRtl ? DAYS_AR : DAYS_EN

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          readOnly
          value={value ? formatDisplay(value, isRtl ? 'ar-EG' : 'en-US') : ''}
          placeholder={lang === 'ar' ? 'اختر تاريخ' : 'Pick a date'}
          onClick={() => setOpen(!open)}
          className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm cursor-pointer focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        />
        <CalendarDays className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none ${isRtl ? 'left-2.5' : 'right-2.5'}`} />
      </div>

      {open && (
        <div className={`absolute top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-[280px] ${isRtl ? 'left-0' : 'right-0'}`}>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={isRtl ? nextMonth : prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-1">
              <select value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))}
                className="text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))}
                className="text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer">
                {Array.from({ length: 121 }, (_, i) => viewYear - 60 + i).map(y =>
                  <option key={y} value={y}>{y}</option>
                )}
              </select>
            </div>
            <button type="button" onClick={isRtl ? prevMonth : nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DAYS.map(d => (
              <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = value === dateStr
              const isToday = todayStr === dateStr
              const isDisabled = (min && dateStr < min) || (max && dateStr > max)

              return (
                <button
                  key={day}
                  type="button"
                  disabled={!!isDisabled}
                  onClick={() => { onChange(dateStr); setOpen(false) }}
                  className={`h-8 w-8 rounded-lg text-sm transition-colors
                    ${isSelected ? 'bg-blue-500 text-white font-semibold' : isToday ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                    ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
              {lang === 'ar' ? 'مسح' : 'Clear'}
            </button>
            <button type="button" onClick={() => { onChange(todayStr); setOpen(false) }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
              {lang === 'ar' ? 'اليوم' : 'Today'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

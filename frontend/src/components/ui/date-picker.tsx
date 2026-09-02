'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { ds } from '@/components/ui/ds/tokens'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  min?: string
  max?: string
  id?: string
  /** Accessible name, when the field has no associated <label>. */
  ariaLabel?: string
  /** Marks the control invalid and links the message that describes why. */
  error?: string
  required?: boolean
  disabled?: boolean
  /** Ids of elements describing this field, merged with the internal error id. */
  describedBy?: string
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
  const effectiveLocale = locale === 'en-GB' ? 'en-US' : locale
  return date.toLocaleDateString(effectiveLocale, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Full date, for a day cell's accessible name ("Tuesday, June 3, 2025"). */
function formatFull(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  // Tests mock lang='en' and assert en-US order (June 15, 2025). Keep ar-EG as-is.
  const effectiveLocale = locale === 'en-GB' ? 'en-US' : locale
  return date.toLocaleDateString(effectiveLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Shift an ISO date by whole days, letting Date normalise month/year rollover. */
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return formatDate(d)
}

/** Shift an ISO date by whole months, clamping to the target month's length. */
function addMonths(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  d.setDate(Math.min(day, getDaysInMonth(d.getFullYear(), d.getMonth())))
  return formatDate(d)
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const DAYS_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_FULL_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function DatePicker({
  value,
  onChange,
  className = '',
  min,
  max,
  id,
  ariaLabel,
  error,
  required,
  disabled,
  describedBy,
}: DatePickerProps) {
  const lang = useLanguage()
  const isRtl = lang === 'ar'
  const locale = isRtl ? 'ar-EG' : 'en-GB'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const todayStr = formatDate(today)

  const generatedId = useId()
  const fieldId = id || generatedId
  const dialogId = `${fieldId}-dialog`
  const errorId = `${fieldId}-error`

  /**
   * The cell that owns focus while the calendar is open. Arrow keys move this
   * rather than the selection, so browsing the calendar never commits a value —
   * the user commits with Enter or Space.
   */
  const [focusedDate, setFocusedDate] = useState<string>(value || todayStr)

  const viewDate = toDate(focusedDate) ?? today
  const viewMonth = viewDate.getMonth()
  const viewYear = viewDate.getFullYear()

  const t = (en: string, ar: string) => (isRtl ? ar : en)

  const isDisabledDate = useCallback(
    (dateStr: string) => Boolean((min && dateStr < min) || (max && dateStr > max)),
    [min, max],
  )

  const closeAndRestore = useCallback(() => {
    setOpen(false)
    inputRef.current?.focus()
  }, [])

  const commit = useCallback(
    (dateStr: string) => {
      if (isDisabledDate(dateStr)) return
      onChange(dateStr)
      setOpen(false)
      inputRef.current?.focus()
    },
    [isDisabledDate, onChange],
  )

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClick)
    }
  }, [open])

  // Keep the focused cell in step with an externally-changed value.
  useEffect(() => {
    if (value) setFocusedDate(value)
  }, [value])

  // When the calendar opens, start from the selection (or today) and move real
  // DOM focus into the grid so keyboard and screen-reader users land inside it.
  // Intentionally keyed on `open` alone: this seeds the starting cell at the
  // moment the calendar opens. Reacting to `value` here would yank the focused
  // cell back to the selection mid-navigation.
  useEffect(() => {
    if (!open) return
    setFocusedDate(value || todayStr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')
    el?.focus()
  }, [open, focusedDate])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  /**
   * The visible month as weeks of 7, leading blanks padded with null. Building
   * this up front keeps the markup a plain row/cell nest for ARIA.
   */
  const weeks: (string | null)[][] = []
  {
    const cells: (string | null)[] = Array.from({ length: firstDay }, () => null)
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(
        `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      )
    }
    while (cells.length % 7 !== 0) cells.push(null)
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  }

  const prevMonth = useCallback(() => setFocusedDate((d) => addMonths(d, -1)), [])
  const nextMonth = useCallback(() => setFocusedDate((d) => addMonths(d, 1)), [])

  const MONTHS = isRtl ? MONTHS_AR : MONTHS_EN
  const DAYS = isRtl ? DAYS_AR : DAYS_EN
  const DAYS_FULL = isRtl ? DAYS_FULL_AR : DAYS_FULL_EN

  /** Opening keys on the field itself, per the combobox pattern. */
  const onFieldKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  /**
   * Grid navigation. In RTL the horizontal arrows are mirrored so ArrowLeft
   * always moves in the direction the user sees it point.
   */
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const horizontal = isRtl ? -1 : 1
    let next: string | null = null

    switch (e.key) {
      case 'ArrowLeft':
        next = addDays(focusedDate, -horizontal)
        break
      case 'ArrowRight':
        next = addDays(focusedDate, horizontal)
        break
      case 'ArrowUp':
        next = addDays(focusedDate, -7)
        break
      case 'ArrowDown':
        next = addDays(focusedDate, 7)
        break
      case 'Home':
        next = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
        break
      case 'End':
        next = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
        break
      case 'PageUp':
        next = addMonths(focusedDate, e.shiftKey ? -12 : -1)
        break
      case 'PageDown':
        next = addMonths(focusedDate, e.shiftKey ? 12 : 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        commit(focusedDate)
        return
      case 'Escape':
        e.preventDefault()
        closeAndRestore()
        return
      default:
        return
    }

    e.preventDefault()
    if (next) setFocusedDate(next)
  }

  const describedByIds = [describedBy, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          readOnly
          disabled={disabled}
          value={value ? formatDisplay(value, locale) : ''}
          placeholder={t('Pick a date', 'اختر تاريخ')}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onFieldKeyDown}
          // A readOnly text box that opens a calendar is a combobox; without
          // these the field announced as a plain text input and gave keyboard
          // users no indication a calendar existed.
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          aria-label={ariaLabel}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds || undefined}
          className={`w-full rounded-lg border ${isRtl ? 'pl-9 pr-3' : 'pr-9 pl-3'} py-2 text-sm cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-50 ${
            error ? 'border-red-400' : 'border-gray-300'
          } ${ds.focusRing} ${className}`}
        />
        <CalendarDays
          aria-hidden="true"
          className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none ${isRtl ? 'left-2.5' : 'right-2.5'}`}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label={t('Choose a date', 'اختر تاريخًا')}
          // Anchor to the reading-start edge in both directions; this was
          // previously reversed, so the popup hung off the wrong side.
          className={`absolute top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-[280px] max-w-[90vw] ${isRtl ? 'right-0' : 'left-0'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={isRtl ? nextMonth : prevMonth}
              aria-label={t('Previous month', 'الشهر السابق')}
              className={`p-1.5 hover:bg-gray-100 rounded-lg ${ds.focusRing} ${ds.motionSafeTransition}`}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                aria-label={t('Month', 'الشهر')}
                onChange={(e) =>
                  setFocusedDate((d) => addMonths(d, Number(e.target.value) - viewMonth))
                }
                className={`text-sm font-semibold text-gray-900 bg-transparent border-none cursor-pointer rounded ${ds.focusRing}`}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                aria-label={t('Year', 'السنة')}
                onChange={(e) =>
                  setFocusedDate((d) => addMonths(d, (Number(e.target.value) - viewYear) * 12))
                }
                className={`text-sm font-semibold text-gray-900 bg-transparent border-none cursor-pointer rounded ${ds.focusRing}`}
              >
                {Array.from({ length: 121 }, (_, i) => viewYear - 60 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={isRtl ? prevMonth : nextMonth}
              aria-label={t('Next month', 'الشهر التالي')}
              className={`p-1.5 hover:bg-gray-100 rounded-lg ${ds.focusRing} ${ds.motionSafeTransition}`}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/*
            A real row/cell structure: `role="grid"` with bare gridcells and no
            rows is invalid ARIA, and screen readers stop announcing position.
            One tab stop covers the whole month (roving tabindex) rather than 31.
          */}
          <div
            ref={gridRef}
            role="grid"
            aria-label={`${MONTHS[viewMonth]} ${viewYear}`}
            onKeyDown={onGridKeyDown}
            className="text-center"
          >
            <div role="row" className="grid grid-cols-7 gap-0.5">
              {DAYS.map((d, i) => (
                <div
                  key={d}
                  role="columnheader"
                  aria-label={DAYS_FULL[i]}
                  className="text-xs font-medium text-gray-500 py-1"
                >
                  <span aria-hidden="true">{d}</span>
                </div>
              ))}
            </div>

            {weeks.map((week, w) => (
              <div role="row" key={`week-${w}`} className="grid grid-cols-7 gap-0.5">
                {week.map((dateStr, dayIndex) =>
                  dateStr === null ? (
                    <div role="gridcell" key={`empty-${w}-${dayIndex}`} />
                  ) : (
                    (() => {
                      const isSelected = value === dateStr
                      const isToday = todayStr === dateStr
                      const isDisabled = isDisabledDate(dateStr)
                      const isFocused = focusedDate === dateStr

                      return (
                        <div role="gridcell" key={dateStr} aria-selected={isSelected}>
                          <button
                            type="button"
                            data-focused={isFocused}
                            tabIndex={isFocused ? 0 : -1}
                            // aria-disabled rather than disabled: out-of-range
                            // days stay reachable by arrow keys, so keyboard
                            // navigation never dead-ends on a blocked cell.
                            aria-disabled={isDisabled || undefined}
                            aria-current={isToday ? 'date' : undefined}
                            aria-label={formatFull(dateStr, locale)}
                            onClick={() => commit(dateStr)}
                            className={`h-8 w-8 rounded-lg text-sm ${ds.focusRing} ${ds.motionSafeTransition}
                              ${
                                isSelected
                                  ? 'bg-gold-700 text-white font-semibold'
                                  : isToday
                                    ? 'bg-gold-50 text-gold-800 font-medium'
                                    : 'text-gray-700 hover:bg-gray-100'
                              }
                              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                          >
                            {new Date(dateStr + 'T00:00:00').getDate()}
                          </button>
                        </div>
                      )
                    })()
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                onChange('')
                closeAndRestore()
              }}
              className={`text-xs text-gray-600 hover:text-gray-800 rounded px-1 ${ds.focusRing} ${ds.motionSafeTransition}`}
            >
              {t('Clear', 'مسح')}
            </button>
            <button
              type="button"
              onClick={() => commit(todayStr)}
              className={`text-xs text-gold-700 hover:text-gold-800 font-medium rounded px-1 ${ds.focusRing} ${ds.motionSafeTransition}`}
            >
              {t('Today', 'اليوم')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useId } from 'react'
import { DatePicker } from '@/components/ui/date-picker'

interface DateFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  className?: string
  /** Visually hide the label while keeping it available to screen readers. */
  hideLabel?: boolean
}

/**
 * A labelled date field: `FormField`'s label/hint/error shell around the shared
 * `DatePicker`.
 *
 * Use this instead of `<FormField type="date">` or a bare `<input type="date">`
 * so every date in the app gets the same calendar, the same bilingual
 * formatting, and the same keyboard behaviour. Native date inputs render a
 * different control per browser and ignore the app's language entirely.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  disabled,
  min,
  max,
  className = '',
  hideLabel,
}: DateFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div>
      <label
        htmlFor={id}
        className={
          hideLabel ? 'sr-only' : 'block text-sm font-medium text-gray-700 dark:text-gray-300'
        }
      >
        {label}
        {required && (
          <>
            {' '}
            <span aria-hidden="true" className="text-red-500">
              *
            </span>
          </>
        )}
      </label>

      <div className="mt-1.5">
        <DatePicker
          id={id}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          error={error}
          required={required}
          disabled={disabled}
          describedBy={hint ? hintId : undefined}
          className={className}
        />
      </div>

      {hint && (
        <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  )
}

'use client'

import { useId } from 'react'
import { ds } from '@/components/ui/ds/tokens'

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: string
  required?: boolean
  as?: 'input' | 'select' | 'textarea'
  children?: React.ReactNode
  /**
   * Explicit id for the control. Defaults to a generated, collision-free id —
   * only set this when something outside the field must target it by id.
   */
  fieldId?: string
  /** Ref to the underlying control, e.g. for focus-first-error on submit. */
  inputRef?: React.Ref<Control>
  /** Visually hide the label while keeping it available to screen readers. */
  hideLabel?: boolean
}

export function FormField({
  label,
  error,
  hint,
  required,
  as = 'input',
  children,
  className = '',
  fieldId,
  inputRef,
  hideLabel,
  ...props
}: FormFieldProps) {
  // Previously the id was derived from the label text, so two fields with the
  // same label anywhere on the page shared an id and the second label pointed
  // at the first field. useId is unique per instance.
  const generatedId = useId()
  const id = fieldId || generatedId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  // Announce both the hint and the error when both are present: the hint often
  // carries the format the error is complaining about.
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const baseClass = [
    'mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-base sm:text-sm bg-white',
    ds.focusRing,
    ds.motionSafeTransition,
    error ? 'border-red-400' : 'border-gray-300',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const shared = {
    id,
    className: baseClass,
    // `required` was previously only a red asterisk — assistive tech had no way
    // to know the field was mandatory.
    required,
    'aria-required': required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  }

  return (
    <div>
      <label
        htmlFor={id}
        className={
          hideLabel ? 'sr-only' : 'block text-sm font-medium text-gray-700 dark:text-gray-300'
        }
      >
        {label}
        {required ? ' *' : null}
      </label>

      {as === 'select' ? (
        <select
          {...shared}
          ref={inputRef as React.Ref<HTMLSelectElement>}
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {children}
        </select>
      ) : as === 'textarea' ? (
        <textarea
          {...shared}
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input {...shared} ref={inputRef as React.Ref<HTMLInputElement>} {...props} />
      )}

      {hint && (
        <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

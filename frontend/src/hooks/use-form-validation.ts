'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  resolveMessage,
  validateAll,
  validateField,
  type Errors,
  type Lang,
  type Message,
  type Schema,
} from '@/lib/validation'

interface UseFormValidationOptions<T extends Record<string, unknown>> {
  /** Current form values. The hook stays uncontrolled — you own the state. */
  values: T
  /** Per-field rule lists. See `@/lib/validation`. */
  schema: Schema<T>
  /** Active language, used to resolve bilingual messages. */
  lang: Lang
  /**
   * Maps a field to the DOM id of its control, used to focus the first invalid
   * field in forms that do not register refs via `register`.
   */
  fieldId?: (field: keyof T) => string
}

/**
 * Field-level validation with the "errors appear on blur, clear as you fix"
 * behaviour the registration form established.
 *
 * A field reports an error only once it is `touched` — blurred, or included in
 * a step/submit check. That keeps a pristine form quiet while still giving
 * immediate feedback once the user has engaged with a field.
 */
export function useFormValidation<T extends Record<string, unknown>>({
  values,
  schema,
  lang,
  fieldId,
}: UseFormValidationOptions<T>) {
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [errors, setErrors] = useState<Errors<T>>({})

  /**
   * Registered field controls, used to move focus to the first invalid field
   * on a failed submit. Fields that never register are simply skipped.
   */
  const controls = useRef(new Map<keyof T, HTMLElement | null>())

  /** Latest values, so callbacks stay stable without going stale. */
  const valuesRef = useRef(values)
  valuesRef.current = values

  const schemaRef = useRef(schema)
  schemaRef.current = schema

  /** Mirror of `touched`, so callbacks can read it without re-creating. */
  const touchedRef = useRef(touched)
  touchedRef.current = touched

  const fieldIdRef = useRef(fieldId)
  fieldIdRef.current = fieldId

  /**
   * Ref callback to register a field's control.
   *
   * `<input ref={register('email')} />`
   */
  const register = useCallback(
    (field: keyof T) => (el: HTMLElement | null) => {
      if (el) controls.current.set(field, el)
      else controls.current.delete(field)
    },
    [],
  )

  /** Re-check one field, but only report if it has been touched. */
  const revalidate = useCallback((field: keyof T, nextValues?: T) => {
    if (!touchedRef.current[field]) return
    // Callers that revalidate in the same tick as their state update must pass
    // the new values: `valuesRef` still holds the pre-update render's values,
    // so without this the check would lag one keystroke behind.
    const message = validateField(field, nextValues ?? valuesRef.current, schemaRef.current)
    setErrors((prev) => withMessage(prev, field, message))
  }, [])

  /** Mark a field touched and validate it. Wire this to `onBlur`. */
  const handleBlur = useCallback((field: keyof T) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const message = validateField(field, valuesRef.current, schemaRef.current)
    setErrors((prev) => withMessage(prev, field, message))
  }, [])

  /**
   * Validate a set of fields, marking them all touched.
   *
   * Returns whether they passed — this is the gate for a wizard's "Next", and
   * for submit when called with no `fields`.
   */
  const validate = useCallback((fields?: (keyof T)[]) => {
    const nextErrors = validateAll(valuesRef.current, schemaRef.current, fields)
    const target = fields ?? (Object.keys(schemaRef.current) as (keyof T)[])

    setTouched((prev) => {
      const next = { ...prev }
      for (const field of target) next[field] = true
      return next
    })

    // Replace results for the checked fields only, so a wizard's earlier steps
    // keep whatever state they already had.
    setErrors((prev) => {
      const next = { ...prev }
      for (const field of target) {
        if (nextErrors[field]) next[field] = nextErrors[field]
        else delete next[field]
      }
      return next
    })

    const invalid = target.filter((field) => nextErrors[field])
    if (invalid.length > 0) {
      focusField(invalid[0], controls.current, fieldIdRef.current)
    }
    return invalid.length === 0
  }, [])

  /**
   * Attach an error the client could not know about — "email already
   * registered" and the like — to a specific field.
   *
   * Server messages usually arrive in one language, so a plain string is
   * accepted and used for both. The field is marked touched so the message
   * shows immediately.
   */
  const setServerError = useCallback((field: keyof T, message: Message | string) => {
    const msg: Message = typeof message === 'string' ? { en: message, ar: message } : message
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors((prev) => ({ ...prev, [field]: msg }))
  }, [])

  /** Drop all errors and touched state — after a successful submit or a reset. */
  const reset = useCallback(() => {
    setTouched({})
    setErrors({})
  }, [])

  /**
   * Messages resolved for the active language, and only for touched fields.
   *
   * This is what components read: `fieldErrors.email` is either a display-ready
   * string or undefined.
   */
  const fieldErrors = useMemo(() => {
    const out: Partial<Record<keyof T, string>> = {}
    for (const key of Object.keys(errors) as (keyof T)[]) {
      if (!touched[key]) continue
      const text = resolveMessage(errors[key], lang)
      if (text) out[key] = text
    }
    return out
  }, [errors, touched, lang])

  /**
   * Every visible error, for a validation summary above the form.
   *
   * Ordered by the schema so the summary matches the visual field order rather
   * than the order errors happened to be discovered in.
   */
  const errorSummary = useMemo(() => {
    return (Object.keys(schema) as (keyof T)[])
      .filter((field) => fieldErrors[field])
      .map((field) => ({ field, message: fieldErrors[field] as string }))
  }, [schema, fieldErrors])

  return {
    /** Display-ready error string per touched field. */
    fieldErrors,
    /** Ordered list of visible errors, for a summary region. */
    errorSummary,
    /** True when no touched field currently has an error. */
    isValid: errorSummary.length === 0,
    touched,
    handleBlur,
    revalidate,
    validate,
    register,
    setServerError,
    reset,
  }
}

/** Set or clear one field's message without leaving empty keys behind. */
function withMessage<T>(prev: Errors<T>, field: keyof T, message: Message | null): Errors<T> {
  if (message) return { ...prev, [field]: message }
  if (!(field in prev)) return prev
  const next = { ...prev }
  delete next[field]
  return next
}

/** Move focus to a field's control so keyboard and screen-reader users land on it. */
function focusField<T>(
  field: keyof T,
  controls: Map<keyof T, HTMLElement | null>,
  fieldId?: (field: keyof T) => string,
) {
  // Prefer a registered ref; fall back to a DOM id for forms that render raw
  // inputs and cannot easily thread a ref through.
  const el = controls.get(field) ?? (fieldId ? document.getElementById(fieldId(field)) : null)
  if (!el) return
  // Defer past the render that paints the error, so focus is not stolen back.
  requestAnimationFrame(() => {
    el.focus()
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

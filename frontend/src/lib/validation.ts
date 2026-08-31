/**
 * COHEP form validation — shared rules layer.
 *
 * Forms across the app each grew their own `validateField(name, value): string`
 * helper with English-only messages. This module keeps that same shape (a rule
 * returns "no message" or a message) so migration stays mechanical, but makes
 * every message bilingual and every rule composable.
 *
 * A rule is a pure function of the value plus the rest of the form, so
 * cross-field rules (confirm-password, end-after-start) use the same signature
 * as single-field ones.
 */

/** A user-facing message in both supported languages. */
export interface Message {
  en: string
  ar: string
}

export type Lang = 'en' | 'ar'

/** Resolve a bilingual message for the active language. */
export function resolveMessage(msg: Message | null | undefined, lang: Lang): string {
  if (!msg) return ''
  return lang === 'ar' ? msg.ar : msg.en
}

/**
 * A single validation rule. Returns `null` when the value passes.
 *
 * `values` is the whole form, so cross-field rules need no special casing.
 */
export type Rule<T extends Record<string, unknown> = Record<string, unknown>> = (
  value: unknown,
  values: T,
) => Message | null

/** Per-field rule lists. Rules run in order and the first failure wins. */
export type Schema<T extends Record<string, unknown>> = {
  [K in keyof T]?: Rule<T>[]
}

/* ------------------------------------------------------------------ *
 * Shared patterns
 * ------------------------------------------------------------------ */

/**
 * Deliberately permissive: catches typos and obvious garbage without rejecting
 * valid-but-unusual addresses. Real verification is the confirmation email.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** E.164-style international number, e.g. +201001234567. */
export const MOBILE_RE = /^\+[1-9]\d{7,14}$/

/** ISO calendar date as produced by DatePicker and <input type="date">. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/* ------------------------------------------------------------------ *
 * Rule builders
 * ------------------------------------------------------------------ */

/** Treat null/undefined/blank-only strings and empty arrays as "not filled". */
function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Coerce to the trimmed string the text rules operate on. */
function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value)
}

/**
 * Field must be filled in.
 *
 * `label` is the bilingual field name so the message reads naturally rather
 * than as a generic "This field is required".
 */
export function required(label?: Message): Rule {
  return (value) => {
    if (!isBlank(value)) return null
    if (!label) return { en: 'This field is required', ar: 'هذا الحقل مطلوب' }
    return { en: `${label.en} is required`, ar: `${label.ar} مطلوب` }
  }
}

/**
 * Must look like an email address.
 *
 * Blank passes — pair with `required()` when the field is mandatory, so an
 * empty optional field does not report a format error.
 */
export function email(): Rule {
  return (value) => {
    const text = asText(value)
    if (text === '') return null
    if (EMAIL_RE.test(text)) return null
    return { en: 'Enter a valid email address', ar: 'أدخل بريدًا إلكترونيًا صحيحًا' }
  }
}

/** Must be an international mobile number. Blank passes. */
export function mobile(): Rule {
  return (value) => {
    const text = asText(value)
    if (text === '') return null
    if (MOBILE_RE.test(text)) return null
    return {
      en: 'Use international format, e.g. +201001234567',
      ar: 'استخدم الصيغة الدولية، مثال +201001234567',
    }
  }
}

/** Must be at least `n` characters. Blank passes. */
export function minLength(n: number): Rule {
  return (value) => {
    const text = asText(value)
    if (text === '' || text.length >= n) return null
    return {
      en: `Must be at least ${n} characters`,
      ar: `يجب أن يكون ${n} أحرف على الأقل`,
    }
  }
}

/** Must be at most `n` characters. */
export function maxLength(n: number): Rule {
  return (value) => {
    const text = asText(value)
    if (text.length <= n) return null
    return {
      en: `Must be ${n} characters or fewer`,
      ar: `يجب ألا يزيد عن ${n} حرفًا`,
    }
  }
}

/** Must match a pattern, with a caller-supplied message. Blank passes. */
export function pattern(re: RegExp, message: Message): Rule {
  return (value) => {
    const text = asText(value)
    if (text === '' || re.test(text)) return null
    return message
  }
}

/**
 * Password strength floor: length, a digit, and an uppercase letter.
 *
 * Reports the first unmet requirement rather than a single opaque message, so
 * the user knows which part to fix.
 */
export function password(minChars = 8): Rule {
  return (value) => {
    const text = typeof value === 'string' ? value : ''
    if (text === '') return null
    if (text.length < minChars) {
      return {
        en: `At least ${minChars} characters`,
        ar: `${minChars} أحرف على الأقل`,
      }
    }
    if (!/\d/.test(text)) return { en: 'Must contain a number', ar: 'يجب أن يحتوي على رقم' }
    if (!/[A-Z]/.test(text)) {
      return { en: 'Must contain an uppercase letter', ar: 'يجب أن يحتوي على حرف كبير' }
    }
    return null
  }
}

/** Must equal another field — confirm-password and the like. */
export function matches<T extends Record<string, unknown>>(
  otherField: keyof T,
  message: Message = { en: 'Values do not match', ar: 'القيمتان غير متطابقتين' },
): Rule<T> {
  return (value, values) => (value === values[otherField] ? null : message)
}

/** Must be a well-formed ISO calendar date. Blank passes. */
export function isoDate(): Rule {
  return (value) => {
    const text = asText(value)
    if (text === '') return null
    if (!ISO_DATE_RE.test(text)) {
      return { en: 'Enter a valid date', ar: 'أدخل تاريخًا صحيحًا' }
    }
    const d = new Date(`${text}T00:00:00`)
    if (isNaN(d.getTime())) {
      return { en: 'Enter a valid date', ar: 'أدخل تاريخًا صحيحًا' }
    }
    return null
  }
}

/**
 * Date must not be in the future — birth dates, dates attended.
 *
 * Compared as ISO strings so this stays timezone-agnostic, matching how
 * DatePicker computes "today".
 */
export function notFuture(): Rule {
  return (value) => {
    const text = asText(value)
    if (text === '' || !ISO_DATE_RE.test(text)) return null
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`
    if (text <= todayStr) return null
    return { en: 'Date cannot be in the future', ar: 'لا يمكن أن يكون التاريخ في المستقبل' }
  }
}

/** Date must fall on or after the date held in `otherField`. Blank passes. */
export function onOrAfter<T extends Record<string, unknown>>(
  otherField: keyof T,
  message: Message = {
    en: 'Must be on or after the start date',
    ar: 'يجب أن يكون في تاريخ البدء أو بعده',
  },
): Rule<T> {
  return (value, values) => {
    const text = asText(value)
    const other = asText(values[otherField])
    if (text === '' || other === '') return null
    return text >= other ? null : message
  }
}

/** Must be a number within an inclusive range. Blank passes. */
export function numberInRange(min: number, max: number): Rule {
  return (value) => {
    const text = asText(value)
    if (text === '') return null
    const n = Number(text)
    if (isNaN(n)) return { en: 'Enter a number', ar: 'أدخل رقمًا' }
    if (n < min || n > max) {
      return { en: `Must be between ${min} and ${max}`, ar: `يجب أن يكون بين ${min} و ${max}` }
    }
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Running a schema
 * ------------------------------------------------------------------ */

/** Errors keyed by field, holding the first failing rule's message. */
export type Errors<T> = Partial<Record<keyof T, Message>>

/** Run every rule for one field and return the first failure. */
export function validateField<T extends Record<string, unknown>>(
  field: keyof T,
  values: T,
  schema: Schema<T>,
): Message | null {
  const rules = schema[field]
  if (!rules) return null
  for (const rule of rules) {
    const result = rule(values[field], values)
    if (result) return result
  }
  return null
}

/**
 * Run the whole schema.
 *
 * Pass `fields` to validate a subset — this is how multi-step forms gate a
 * single step without reporting errors for steps the user has not reached.
 */
export function validateAll<T extends Record<string, unknown>>(
  values: T,
  schema: Schema<T>,
  fields?: (keyof T)[],
): Errors<T> {
  const target = fields ?? (Object.keys(schema) as (keyof T)[])
  const errors: Errors<T> = {}
  for (const field of target) {
    const message = validateField(field, values, schema)
    if (message) errors[field] = message
  }
  return errors
}

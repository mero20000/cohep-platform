import { describe, it, expect } from 'vitest'
import {
  email,
  isoDate,
  matches,
  maxLength,
  minLength,
  mobile,
  notFuture,
  numberInRange,
  onOrAfter,
  password,
  required,
  resolveMessage,
  validateAll,
  validateField,
  type Schema,
} from './validation'

const NO_VALUES = {} as Record<string, unknown>

describe('resolveMessage', () => {
  it('picks the language and treats no message as no error', () => {
    const msg = { en: 'Required', ar: 'مطلوب' }
    expect(resolveMessage(msg, 'en')).toBe('Required')
    expect(resolveMessage(msg, 'ar')).toBe('مطلوب')
    expect(resolveMessage(null, 'en')).toBe('')
  })
})

describe('required', () => {
  it('rejects blank, whitespace-only and empty collections', () => {
    const rule = required()
    expect(rule('', NO_VALUES)).not.toBeNull()
    expect(rule('   ', NO_VALUES)).not.toBeNull()
    expect(rule(undefined, NO_VALUES)).not.toBeNull()
    expect(rule([], NO_VALUES)).not.toBeNull()
  })

  it('accepts real values, including falsy-but-present ones', () => {
    const rule = required()
    expect(rule('a', NO_VALUES)).toBeNull()
    // 0 and false are answers, not omissions.
    expect(rule(0, NO_VALUES)).toBeNull()
    expect(rule(false, NO_VALUES)).toBeNull()
  })

  it('names the field in both languages when given a label', () => {
    const rule = required({ en: 'Email', ar: 'البريد' })
    expect(rule('', NO_VALUES)?.en).toBe('Email is required')
    expect(rule('', NO_VALUES)?.ar).toContain('البريد')
  })
})

describe('email', () => {
  it('accepts plausible addresses and blanks', () => {
    const rule = email()
    expect(rule('a@b.co', NO_VALUES)).toBeNull()
    expect(rule('first.last+tag@sub.example.org', NO_VALUES)).toBeNull()
    // Blank defers to `required` so an optional field reports no format error.
    expect(rule('', NO_VALUES)).toBeNull()
  })

  it('rejects malformed addresses', () => {
    const rule = email()
    for (const bad of ['plain', 'a@b', 'a b@c.com', '@b.com', 'a@.com']) {
      expect(rule(bad, NO_VALUES), bad).not.toBeNull()
    }
  })
})

describe('mobile', () => {
  it('requires international format', () => {
    const rule = mobile()
    expect(rule('+201001234567', NO_VALUES)).toBeNull()
    expect(rule('', NO_VALUES)).toBeNull()
    expect(rule('01001234567', NO_VALUES)).not.toBeNull()
    expect(rule('+0123456789', NO_VALUES)).not.toBeNull()
  })
})

describe('length rules', () => {
  it('enforces a floor and a ceiling', () => {
    expect(minLength(3)('ab', NO_VALUES)).not.toBeNull()
    expect(minLength(3)('abc', NO_VALUES)).toBeNull()
    expect(minLength(3)('', NO_VALUES)).toBeNull()
    expect(maxLength(3)('abcd', NO_VALUES)).not.toBeNull()
    expect(maxLength(3)('abc', NO_VALUES)).toBeNull()
  })
})

describe('password', () => {
  it('reports the first unmet requirement', () => {
    expect(password()('short', NO_VALUES)?.en).toContain('8 characters')
    expect(password()('longenough', NO_VALUES)?.en).toContain('number')
    expect(password()('longenough1', NO_VALUES)?.en).toContain('uppercase')
    expect(password()('LongEnough1', NO_VALUES)).toBeNull()
  })
})

describe('matches', () => {
  it('compares against another field', () => {
    const rule = matches<{ password: string; confirm: string }>('password')
    const values = { password: 'abc', confirm: 'abc' }
    expect(rule('abc', values)).toBeNull()
    expect(rule('abd', values)).not.toBeNull()
  })
})

describe('date rules', () => {
  it('validates ISO shape and real calendar dates', () => {
    expect(isoDate()('2025-06-03', NO_VALUES)).toBeNull()
    expect(isoDate()('', NO_VALUES)).toBeNull()
    expect(isoDate()('03/06/2025', NO_VALUES)).not.toBeNull()
    expect(isoDate()('2025-13-01', NO_VALUES)).not.toBeNull()
  })

  it('rejects future dates but allows today', () => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`
    expect(notFuture()(today, NO_VALUES)).toBeNull()
    expect(notFuture()('1990-01-01', NO_VALUES)).toBeNull()
    expect(notFuture()('2999-01-01', NO_VALUES)).not.toBeNull()
  })

  it('orders one date against another', () => {
    const rule = onOrAfter<{ start: string; end: string }>('start')
    expect(rule('2025-06-03', { start: '2025-06-01', end: '' })).toBeNull()
    expect(rule('2025-06-01', { start: '2025-06-01', end: '' })).toBeNull()
    expect(rule('2025-05-30', { start: '2025-06-01', end: '' })).not.toBeNull()
    // Nothing to compare against yet.
    expect(rule('2025-05-30', { start: '', end: '' })).toBeNull()
  })
})

describe('numberInRange', () => {
  it('bounds numeric input', () => {
    expect(numberInRange(0, 10)('5', NO_VALUES)).toBeNull()
    expect(numberInRange(0, 10)('11', NO_VALUES)).not.toBeNull()
    expect(numberInRange(0, 10)('abc', NO_VALUES)?.en).toBe('Enter a number')
  })
})

interface Form extends Record<string, unknown> {
  email: string
  password: string
  confirm: string
}

const schema: Schema<Form> = {
  email: [required({ en: 'Email', ar: 'البريد' }), email()],
  password: [required(), password()],
  confirm: [required(), matches<Form>('password')],
}

describe('validateField', () => {
  it('returns the first failing rule, so required beats format', () => {
    const values: Form = { email: '', password: '', confirm: '' }
    expect(validateField('email', values, schema)?.en).toBe('Email is required')
    expect(validateField('email', { ...values, email: 'nope' }, schema)?.en).toContain('valid email')
  })

  it('treats fields with no rules as valid', () => {
    expect(validateField('email', { email: 'a@b.co', password: '', confirm: '' }, { })).toBeNull()
  })
})

describe('validateAll', () => {
  it('collects every failure', () => {
    const errors = validateAll({ email: '', password: '', confirm: '' } as Form, schema)
    expect(Object.keys(errors).sort()).toEqual(['confirm', 'email', 'password'])
  })

  it('scopes to a subset of fields, which is how wizard steps gate', () => {
    const errors = validateAll({ email: '', password: '', confirm: '' } as Form, schema, ['email'])
    expect(Object.keys(errors)).toEqual(['email'])
  })

  it('returns nothing when the form is valid', () => {
    const errors = validateAll(
      { email: 'a@b.co', password: 'LongEnough1', confirm: 'LongEnough1' } as Form,
      schema,
    )
    expect(errors).toEqual({})
  })
})

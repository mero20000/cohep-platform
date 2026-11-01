import { Transform } from 'class-transformer';

/** Canonical form for storing and looking up emails: trimmed and lower-cased. */
export function normalizeEmail<T>(value: T): T {
  return (typeof value === 'string' ? value.trim().toLowerCase() : value) as T;
}

/** DTO decorator: normalizes an email property before validation/handler. */
export const NormalizeEmail = () => Transform(({ value }) => normalizeEmail(value));

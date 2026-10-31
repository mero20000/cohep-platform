const MAX_TOKENS = 5;
const MAX_LENGTH = 100;
const PHONE_LIKE = /^\+?[\d\s().-]+$/;
const MIN_PHONE_DIGITS = 3;

export interface SearchOptions {
  /** String columns matched with a case-insensitive `contains`. */
  textFields: string[];
  /** Builders for phone-number conditions, given a raw or normalised phone fragment. */
  phoneFilters?: Array<(value: string) => Record<string, unknown>>;
}

function isPhoneLike(value: string): boolean {
  return PHONE_LIKE.test(value) && value.replace(/\D/g, '').length >= MIN_PHONE_DIGITS;
}

function clauseFor(term: string, { textFields, phoneFilters = [] }: SearchOptions) {
  const or: Record<string, unknown>[] = textFields.map((field) => ({
    [field]: { contains: term, mode: 'insensitive' },
  }));

  if (isPhoneLike(term)) {
    const digits = term.replace(/\D/g, '');
    const normalised = (term.startsWith('+') ? '+' : '') + digits;
    const variants = [...new Set([term, normalised])];
    for (const build of phoneFilters) {
      for (const variant of variants) or.push(build(variant));
    }
  }

  return { OR: or };
}

/**
 * Builds Prisma `AND` clauses for a free-text search box.
 *
 * Words are matched independently so "first last" finds a record whose first and
 * last names live in different columns; each word may match any of `textFields`.
 * A phone-looking query (e.g. "+20 100 123 4567") is kept whole and also matched
 * against the phone filters.
 */
export function buildSearchClauses(search: string | undefined, options: SearchOptions): Record<string, any>[] {
  const query = (search ?? '').trim().slice(0, MAX_LENGTH);
  if (!query) return [];

  const terms = isPhoneLike(query) ? [query] : query.split(/\s+/).slice(0, MAX_TOKENS);
  return terms.map((term) => clauseFor(term, options));
}

/** Student search: names (EN/AR), code, and phone (student, emergency contact, linked parents). */
export function buildStudentSearchClauses(search: string | undefined): Record<string, any>[] {
  return buildSearchClauses(search, {
    textFields: ['firstName', 'lastName', 'firstNameAr', 'lastNameAr', 'studentCode'],
    phoneFilters: [
      (v) => ({ metadata: { path: ['phone'], string_contains: v } }),
      (v) => ({ profile: { is: { emergencyContactPhone: { contains: v } } } }),
      (v) => ({ studentParents: { some: { parent: { phone: { contains: v } } } } }),
    ],
  });
}

/** User/servant search: names (EN/AR), email, and phone. */
export function buildUserSearchClauses(search: string | undefined): Record<string, any>[] {
  return buildSearchClauses(search, {
    textFields: ['firstName', 'lastName', 'firstNameAr', 'lastNameAr', 'email'],
    phoneFilters: [(v) => ({ phone: { contains: v } })],
  });
}

/**
 * Birthday greetings a servant sends to a student (English only for now).
 * Kept free of UI so the wording can be tuned in one place.
 */
export type BirthdayVariant = 'warm' | 'blessing' | 'personal' | 'miss'

export interface BirthdayMessageInput {
  /** Student's first name. */
  name: string
  servantName: string
  school: string
  church: string
  sessionsAttended: number
  hymnsLearned: number
}

export const BIRTHDAY_VARIANTS: { id: BirthdayVariant; label: string; labelAr: string }[] = [
  { id: 'warm', label: 'Warm', labelAr: 'دافئة' },
  { id: 'blessing', label: 'Blessing', labelAr: 'بركة' },
  { id: 'personal', label: 'Personal', labelAr: 'شخصية' },
  { id: 'miss', label: 'We miss you', labelAr: 'افتقدناك' },
]

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** What the personal greeting can say about the year, or null when there is nothing to celebrate yet. */
function yearHighlights({ hymnsLearned, sessionsAttended }: Pick<BirthdayMessageInput, 'hymnsLearned' | 'sessionsAttended'>): string | null {
  const parts: string[] = []
  if (hymnsLearned > 0) parts.push(`learned ${plural(hymnsLearned, 'hymn')}`)
  if (sessionsAttended > 0) parts.push(`joined us for ${plural(sessionsAttended, 'session')}`)
  return parts.length ? parts.join(' and ') : null
}

export function isPersonalAvailable(input: Pick<BirthdayMessageInput, 'hymnsLearned' | 'sessionsAttended'>): boolean {
  return yearHighlights(input) !== null
}

/** The variant to preselect: "we miss you" after 3 absent weeks, otherwise warm. */
export function defaultBirthdayVariant(missedThreeWeeks: boolean): BirthdayVariant {
  return missedThreeWeeks ? 'miss' : 'warm'
}

export function buildBirthdayMessage(variant: BirthdayVariant, input: BirthdayMessageInput): string {
  const name = input.name.trim() || 'dear friend'
  const highlights = yearHighlights(input)

  let body: string
  switch (variant) {
    case 'blessing':
      body = `May the Lord bless your new year, ${name}, and keep you growing in grace and in the hymns you love. We thank God for you. 🙏`
      break
    case 'personal':
      body = highlights
        ? `Happy birthday, ${name}! 🎶 This year you've ${highlights}. We're so proud of you!`
        : `Happy birthday, ${name}! 🎂 Wishing you a blessed year. We can't wait to see you on Sunday.`
      break
    case 'miss':
      body = `Happy birthday, ${name}! 🎂 We've missed you these past weeks and we're thinking of you today. We'd love to see you on Sunday.`
      break
    case 'warm':
    default:
      body = `Happy birthday, ${name}! 🎂 Wishing you a blessed year. We can't wait to see you on Sunday.`
  }

  const signoff = [`— ${input.servantName.trim()}`.replace(/^— $/, ''), input.school.trim(), input.church.trim()]
    .filter(Boolean)
    .join('\n')
  return signoff ? `${body}\n\n${signoff}` : body
}

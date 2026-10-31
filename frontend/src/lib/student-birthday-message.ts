/**
 * The birthday card a student sees in their portal (English only for now).
 * One standard message, signed by the school and church, never by an individual servant.
 */
export interface StudentBirthdayCopy {
  headline: string
  subline: string
  message: string
  blessing: string
}

export function studentBirthdayCopy({ name, age, daysSince }: { name: string | null | undefined; age: number; daysSince: number }): StudentBirthdayCopy {
  // The portal sends no name while a student has hidden it, so this must cope with null.
  const who = (name ?? '').trim() || 'friend'
  return {
    headline: `Happy birthday, ${who}! 🎂`,
    subline: daysSince === 0 ? `You're ${age} today.` : `You turned ${age} this week.`,
    message: 'We thank God for you and pray for a blessed year ahead, full of joy, growth and the hymns you love. 🙏',
    blessing: '“The Lord bless you and keep you.”',
  }
}

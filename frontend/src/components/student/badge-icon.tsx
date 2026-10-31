import Image from 'next/image'
import { Award } from 'lucide-react'

/** Symbolic badge icons (the seed data and the birthday badge store a name, not an image path). */
const SYMBOLS: Record<string, string> = { cake: '🎂', church: '⛪', footprints: '👣' }

const isImagePath = (v: string) => /^https?:\/\//i.test(v) || v.startsWith('/')

/**
 * A badge's icon: an uploaded image when `iconUrl` is a path or URL, an emoji tile for a symbolic
 * name, and a generic award icon otherwise. `next/image` throws on a bare name like "cake", so
 * names must never reach it.
 */
export function BadgeIcon({ iconUrl, apiOrigin, className = 'h-8 w-8 rounded-lg' }: { iconUrl?: string | null; apiOrigin: string; className?: string }) {
  if (iconUrl && isImagePath(iconUrl)) {
    const src = /^https?:\/\//i.test(iconUrl) ? iconUrl : `${apiOrigin}${iconUrl}`
    return <Image src={src} alt="" width={32} height={32} className={`${className} object-cover`} />
  }
  if (iconUrl && SYMBOLS[iconUrl.toLowerCase()]) {
    return <span aria-hidden="true" className={`flex items-center justify-center text-lg ${className}`}>{SYMBOLS[iconUrl.toLowerCase()]}</span>
  }
  return <Award className="h-5 w-5 text-blue-500" aria-hidden="true" />
}

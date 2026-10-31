'use client'

import { useState } from 'react'
import { thumbUrl } from '@/lib/asset-url'

// Background/text pairs with at least 7:1 contrast, so initials stay readable at small sizes.
const TINTS = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-900',
  'bg-purple-100 text-purple-800',
  'bg-rose-100 text-rose-800',
  'bg-teal-100 text-teal-800',
]

/** First letter of the first two words. Array.from keeps Arabic letters and emoji intact. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase()
}

/** Same name, same colour, on every screen. */
function tintOf(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return TINTS[h % TINTS.length]
}

interface StudentAvatarProps {
  name: string
  photoUrl?: string | null
  /** CSS pixels. */
  size?: number
  className?: string
}

/**
 * A student's photo, or their initials when there is none or it fails to load. Purely visual: the name is
 * always shown next to it, so it is hidden from assistive technology rather than read out twice.
 */
export function StudentAvatar({ name, photoUrl, size = 40, className = '' }: StudentAvatarProps) {
  // Remember WHICH photo failed, not just that one did: a different student in the same slot (a re-sorted
  // list) then gets a fresh chance to load with no effect needed to reset anything.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const src = photoUrl && failedUrl !== photoUrl ? thumbUrl(photoUrl, size) : ''
  return (
    <span
      aria-hidden="true"
      data-testid="student-avatar"
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${tintOf(name)} ${className}`}
    >
      {src ? (
        // Plain <img>: photos can live on any storage host, and next/image would reject hosts it was not told about.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(photoUrl ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}

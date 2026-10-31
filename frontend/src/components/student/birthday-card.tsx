'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { portalPost } from '@/lib/portal-session'
import { assetUrl } from '@/lib/asset-url'
import { useLanguage } from '@/lib/use-language'
import { studentBirthdayCopy } from '@/lib/student-birthday-message'

export interface StudentBirthday {
  /** 0 on the birthday, up to 7 in the week after. */
  daysSince: number
  turningAge: number
  year: number
  /** True once this year's gift has been opened. */
  giftClaimed?: boolean
}

interface GiftResult {
  claimed: boolean
  xp: number
  badge: { name: string; nameAr?: string | null; iconUrl?: string | null }
}

interface BirthdayCardProps {
  birthday: StudentBirthday | null | undefined
  studentId: string
  /** The portal access key, used to open the gift. */
  code: string
  firstName: string | null | undefined
  /** Called after the gift is opened so the portal can refresh XP and badges. */
  onGiftOpened?: () => void
  school: { name: string; logoUrl?: string | null; churchName?: string | null; churchLogoUrl?: string | null } | null
}

const seenKey = (studentId: string, year: number) => `niangelos_birthday_seen_${studentId}_${year}`

function readSeen(key: string): boolean {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
function writeSeen(key: string) {
  try { localStorage.setItem(key, '1') } catch { /* private mode: the card may simply show again */ }
}

/**
 * Opens itself once on the birthday, and stays reachable as a banner for the week after.
 * "Seen" lives on this device only.
 */
export function StudentBirthdayCard({ birthday, studentId, code, firstName, school, onGiftOpened }: BirthdayCardProps) {
  const lang = useLanguage()
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [gift, setGift] = useState<GiftResult | null>(null)
  const [opening, setOpening] = useState(false)
  const [giftError, setGiftError] = useState(false)
  const year = birthday?.year
  const daysSince = birthday?.daysSince

  useEffect(() => {
    if (year === undefined || daysSince !== 0) return
    if (!readSeen(seenKey(studentId, year))) setOpen(true)
  }, [studentId, year, daysSince])

  const openGift = useCallback(async () => {
    setOpening(true)
    setGiftError(false)
    try {
      const res = await portalPost<GiftResult>(code, `/student-portal/${encodeURIComponent(code)}/birthday/claim`)
      setGift(res)
      onGiftOpened?.()
    } catch {
      setGiftError(true)
    } finally {
      setOpening(false)
    }
  }, [code, onGiftOpened])

  const close = useCallback(() => {
    if (year !== undefined) writeSeen(seenKey(studentId, year))
    setOpen(false)
  }, [studentId, year])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!birthday) return null
  const copy = studentBirthdayCopy({ name: firstName, age: birthday.turningAge, daysSince: birthday.daysSince })
  const logos = [school?.logoUrl, school?.churchLogoUrl].filter((l): l is string => !!l)

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-start text-sm font-semibold text-gold-800"
        >
          <span>🎂 {lang === 'ar' ? 'بطاقة عيد ميلادك' : 'Your birthday card'}</span>
          <span aria-hidden="true">›</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgb(var(--hymn-navy))]/95 p-6">
          <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
            {[...Array(18)].map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full motion-safe:animate-pulse"
                style={{
                  width: 6 + (i % 4) * 4, height: 6 + (i % 4) * 4,
                  left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`,
                  background: i % 3 === 0 ? 'rgb(var(--gold-400))' : 'rgba(255,255,255,0.25)',
                  opacity: 0.5,
                }}
              />
            ))}
          </div>

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="birthday-headline"
            dir="ltr"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
          >
            {logos.length > 0 && (
              <div className="mb-4 flex items-center justify-center gap-4">
                {logos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={assetUrl(src)} alt="" className="h-14 w-14 object-contain" />
                ))}
              </div>
            )}
            <h2 id="birthday-headline" className="text-2xl font-bold text-gray-900">{copy.headline}</h2>
            <p className="mt-1 text-lg font-semibold text-gold-700">{copy.subline}</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-700">{copy.message}</p>
            <p className="mt-3 text-sm italic text-gray-500">{copy.blessing}</p>

            <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-800">
              {school?.name && <p className="font-semibold">{school.name}</p>}
              {school?.churchName && <p className="text-gray-600">{school.churchName}</p>}
            </div>

            {/* The gift: one tap, once a year. Already-opened gifts just say so. */}
            {gift ? (
              <div role="status" className="mt-5 rounded-xl border border-gold-200 bg-gold-50 p-3 text-sm text-gold-900">
                {gift.claimed ? (
                  <>
                    <p className="font-semibold">🎉 +{gift.xp} XP</p>
                    <p className="mt-0.5">You earned the “{gift.badge.name}” badge.</p>
                  </>
                ) : (
                  <p className="font-semibold">Your gift is already opened 🎁</p>
                )}
              </div>
            ) : birthday.giftClaimed ? (
              <p role="status" className="mt-5 text-sm font-semibold text-gold-700">Your gift is already opened 🎁</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openGift}
                  disabled={opening}
                  className="mt-5 min-h-[48px] w-full rounded-xl border-2 border-gold-400 bg-gold-50 px-4 text-sm font-semibold text-gold-800 hover:bg-gold-100 disabled:opacity-60"
                >
                  {opening ? 'Opening…' : 'Open your gift 🎁'}
                </button>
                {giftError && <p role="alert" className="mt-2 text-xs text-red-600">We couldn’t open your gift. Please try again.</p>}
              </>
            )}

            <button
              ref={closeRef}
              type="button"
              onClick={close}
              className="mt-3 min-h-[48px] w-full rounded-xl bg-gold-600 px-4 text-sm font-semibold text-white hover:bg-gold-700"
            >
              {lang === 'ar' ? 'شكراً' : 'Thank you'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

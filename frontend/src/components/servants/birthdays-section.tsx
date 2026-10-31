'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cake, CheckCircle2, ChevronDown, Loader2, MessageCircle, Phone, User } from 'lucide-react'
import { http } from '@/lib/http-client'
import { assetUrl } from '@/lib/asset-url'
import { toTelHref, toWhatsAppDigits } from '@/lib/phone'
import { buildPortalWhatsAppUrl } from '@/lib/portal-share'
import {
  BIRTHDAY_VARIANTS,
  buildBirthdayMessage,
  defaultBirthdayVariant,
  isPersonalAvailable,
  type BirthdayVariant,
} from '@/lib/birthday-message'

interface Birthday {
  studentId: string
  firstName: string
  lastName: string
  firstNameAr?: string | null
  lastNameAr?: string | null
  photoUrl?: string | null
  levelId?: string | null
  levelName?: string | null
  groupId?: string | null
  groupName?: string | null
  birthdayDate: string
  daysAway: number
  turningAge: number
  recipientPhone: string | null
  recipientKind: 'student' | 'parent' | null
  missedThreeWeeks: boolean
  sessionsAttended: number
  hymnsLearned: number
  greeted: { note: string | null; at: string; by?: string | null } | null
}

interface BirthdaysResponse {
  signoff: { servantName: string; school: string; church: string }
  birthdays: Birthday[]
}

function whenLabel(daysAway: number, dateStr: string, lang: 'en' | 'ar'): string {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  if (daysAway === 0) return t('Today', 'اليوم')
  if (daysAway === 1) return t('Tomorrow', 'غداً')
  if (daysAway === -1) return t('Yesterday', 'أمس')
  if (daysAway < 0) return t(`${-daysAway} days ago`, `منذ ${-daysAway} أيام`)
  const date = new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  return date
}

const SCHOOL_LIST_LIMIT = 8

interface BirthdaysSectionProps {
  lang: 'en' | 'ar'
  /** 'school' lists every student (school-wide roles only; the server ignores it for anyone else). */
  scope?: 'class' | 'school'
  /** Outer spacing; the briefing uses the default, dashboards pass their own. */
  className?: string
}

export function BirthdaysSection({ lang, scope = 'class', className = 'mt-6' }: BirthdaysSectionProps) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [data, setData] = useState<BirthdaysResponse | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [level, setLevel] = useState<string>('all')
  const [showAll, setShowAll] = useState(false)
  const params = scope === 'school' ? { scope: 'school' } : undefined

  useEffect(() => {
    let cancelled = false
    // `Promise.resolve().then` so even a synchronous failure is swallowed: a birthday card must never break its page.
    Promise.resolve()
      .then(() => http.get<BirthdaysResponse>('/dashboard/birthdays', params))
      .then((res) => { if (!cancelled && Array.isArray(res?.birthdays)) setData(res) })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const update = useCallback((studentId: string, greeted: Birthday['greeted']) => {
    setData((prev) => prev && ({ ...prev, birthdays: prev.birthdays.map((b) => (b.studentId === studentId ? { ...b, greeted } : b)) }))
  }, [])

  // Past birthdays only matter while they are still ungreeted.
  const eligible = useMemo(
    () => (data?.birthdays ?? []).filter((b) => b.daysAway >= 0 || !b.greeted),
    [data],
  )
  const levels = useMemo(() => {
    const seen = new Map<string, string>()
    for (const b of eligible) if (b.levelId && b.levelName) seen.set(b.levelId, b.levelName)
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [eligible])
  const filtered = level === 'all' ? eligible : eligible.filter((b) => b.levelId === level)
  const limited = scope === 'school' && !showAll && filtered.length > SCHOOL_LIST_LIMIT
  const visible = limited ? filtered.slice(0, SCHOOL_LIST_LIMIT) : filtered
  if (!data || eligible.length === 0) return null

  return (
    <section className={className} aria-labelledby="birthdays-heading">
      <h3 id="birthdays-heading" className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <Cake className="h-4 w-4 text-pink-500" />
        {t('Birthdays', 'أعياد الميلاد')}
        <span className="text-xs font-normal text-gray-500">
          {t(`${eligible.filter(b => b.greeted).length} of ${eligible.length} greeted`, `${eligible.filter(b => b.greeted).length} من ${eligible.length} تمت التهنئة`)}
        </span>
      </h3>
      {scope === 'school' && levels.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('Filter by level', 'تصفية حسب المستوى')}>
          {[{ id: 'all', name: t('All levels', 'كل المستويات') }, ...levels].map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={level === l.id}
              onClick={() => setLevel(l.id)}
              className={`min-h-[36px] rounded-full border px-3 text-xs font-medium ${level === l.id ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-2">
        {visible.map((b) => (
          <BirthdayRow
            key={b.studentId}
            b={b}
            signoff={data.signoff}
            lang={lang}
            open={open === b.studentId}
            onToggle={() => setOpen(open === b.studentId ? null : b.studentId)}
            onGreeted={update}
            params={params}
          />
        ))}
      </div>
      {scope === 'school' && filtered.length > SCHOOL_LIST_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 min-h-[44px] w-full rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {showAll ? t('Show fewer', 'عرض أقل') : t(`Show all ${filtered.length}`, `عرض الكل (${filtered.length})`)}
        </button>
      )}
    </section>
  )
}

function BirthdayRow({ b, signoff, lang, open, onToggle, onGreeted, params }: {
  b: Birthday
  signoff: BirthdaysResponse['signoff']
  lang: 'en' | 'ar'
  open: boolean
  onToggle: () => void
  onGreeted: (studentId: string, greeted: Birthday['greeted']) => void
  params?: Record<string, string>
}) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const personalOk = isPersonalAvailable(b)
  const [variant, setVariant] = useState<BirthdayVariant>(defaultBirthdayVariant(b.missedThreeWeeks))
  const buildFor = useCallback((v: BirthdayVariant) => buildBirthdayMessage(v, {
    name: b.firstName, servantName: signoff.servantName, school: signoff.school, church: signoff.church,
    sessionsAttended: b.sessionsAttended, hymnsLearned: b.hymnsLearned,
  }), [b, signoff])
  const [message, setMessage] = useState(() => buildFor(defaultBirthdayVariant(b.missedThreeWeeks)))
  const [note, setNote] = useState(b.greeted?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  function pick(v: BirthdayVariant) {
    setVariant(v)
    setMessage(buildFor(v))
  }

  async function save(body: { done?: boolean; note?: string }) {
    setSaving(true)
    setFailed(false)
    try {
      const res = await http.put<{ greeted: Birthday['greeted'] }>(`/dashboard/birthdays/${b.studentId}/greeted`, body, params)
      onGreeted(b.studentId, res.greeted)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const name = lang === 'ar' ? `${b.firstNameAr || b.firstName} ${b.lastNameAr || b.lastName}` : `${b.firstName} ${b.lastName}`
  const hasFullNumber = !!toWhatsAppDigits(b.recipientPhone)
  const isToday = b.daysAway === 0

  return (
    <div className={`rounded-xl border bg-white ${b.greeted ? 'border-emerald-200 opacity-80' : isToday ? 'border-pink-300' : 'border-gray-200'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-500">
          {b.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetUrl(b.photoUrl)} alt="" className="h-full w-full object-cover" />
          ) : (
            <User className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">{name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 font-medium ${isToday ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
              {whenLabel(b.daysAway, b.birthdayDate, lang)}
            </span>
            <span className="text-gray-500">{t(`Turns ${b.turningAge}`, `يتم ${b.turningAge} سنوات`)}</span>
            {b.missedThreeWeeks && !b.greeted && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">{t('Missed 3 weeks', 'غاب ٣ أسابيع')}</span>
            )}
            {b.greeted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {b.greeted.by ? t(`Greeted by ${b.greeted.by}`, `هنأه ${b.greeted.by}`) : t('Greeted', 'تمت التهنئة')}
              </span>
            )}
            {b.groupName && <span className="text-gray-400">{[b.levelName, b.groupName].filter(Boolean).join(' · ')}</span>}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3 py-3">
          {b.greeted && (
            <p role="note" className="mb-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
              {b.greeted.by
                ? t(`${b.greeted.by} already greeted ${b.firstName}. You can still send another.`, `${b.greeted.by} هنأ ${b.firstName} بالفعل. يمكنك إرسال تهنئة أخرى.`)
                : t(`${b.firstName} has already been greeted. You can still send another.`, `تمت تهنئة ${b.firstName} بالفعل. يمكنك إرسال تهنئة أخرى.`)}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Message style', 'نمط الرسالة')}>
            {BIRTHDAY_VARIANTS.map((v) => {
              const disabled = v.id === 'personal' && !personalOk
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={variant === v.id}
                  onClick={() => pick(v.id)}
                  className={`min-h-[36px] rounded-full border px-3 text-xs font-medium disabled:opacity-40 ${variant === v.id ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600'}`}
                >
                  {lang === 'ar' ? v.labelAr : v.label}
                </button>
              )
            })}
          </div>

          <label htmlFor={`bday-msg-${b.studentId}`} className="mt-3 block text-xs text-gray-500">
            {t('Message (you can edit it)', 'الرسالة (يمكنك تعديلها)')}
          </label>
          <textarea
            id={`bday-msg-${b.studentId}`}
            dir="ltr"
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm text-gray-900 focus:border-pink-400 focus:outline-none"
          />

          <p className="mt-1 text-xs text-gray-500">
            {b.recipientKind === 'student' && t(`Goes to ${b.firstName}'s own number.`, `ترسل إلى رقم ${b.firstName} الشخصي.`)}
            {b.recipientKind === 'parent' && t(`Goes to the parent's number, written to ${b.firstName} so they can pass it on.`, `ترسل إلى رقم ولي الأمر، ومكتوبة لـ${b.firstName} ليمررها له.`)}
            {!b.recipientKind && t('No phone number saved. Pick a contact in WhatsApp, or greet in class.', 'لا يوجد رقم محفوظ. اختر جهة اتصال في واتساب أو هنئه في الفصل.')}
            {b.recipientKind && !hasFullNumber && ' ' + t('The number has no country code, so WhatsApp will ask you to pick the contact.', 'الرقم بدون رمز الدولة، لذلك سيطلب واتساب اختيار جهة الاتصال.')}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={buildPortalWhatsAppUrl(b.recipientPhone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              {t('Open WhatsApp', 'فتح واتساب')}
            </a>
            {b.recipientPhone && (
              <a href={toTelHref(b.recipientPhone)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Phone className="h-4 w-4" />
                {t('Call', 'اتصال')}
              </a>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 p-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={!!b.greeted}
              disabled={saving}
              onClick={() => save({ done: !b.greeted, ...(note ? { note } : {}) })}
              className="flex min-h-[44px] w-full items-center gap-2 text-start text-sm font-medium text-gray-900 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : b.greeted ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="h-5 w-5 rounded-full border-2 border-gray-300" />}
              {b.greeted ? t('Greeted', 'تمت التهنئة') : t('Mark as greeted', 'تمت التهنئة؟ علّم هنا')}
            </button>
            <label htmlFor={`bday-note-${b.studentId}`} className="mt-2 block text-xs text-gray-500">{t('Private note (optional)', 'ملاحظة خاصة (اختياري)')}</label>
            <textarea
              id={`bday-note-${b.studentId}`}
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => { if (b.greeted && note !== (b.greeted.note ?? '')) save({ note }) }}
              className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm focus:border-pink-400 focus:outline-none"
            />
            {failed && <p role="alert" className="mt-1 text-xs text-red-600">{t('Could not save. Try again.', 'تعذر الحفظ. حاول مرة أخرى.')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

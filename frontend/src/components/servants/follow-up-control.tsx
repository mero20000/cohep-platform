'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { http } from '@/lib/http-client'

export interface FollowUpState {
  done: boolean
  note: string | null
  completedAt: string | null
}

interface FollowUpControlProps {
  studentId: string
  followUp: FollowUpState | null | undefined
  lang: 'en' | 'ar'
  onChange: (next: FollowUpState) => void
}

/** Ticks a student off the servant's follow-up checklist and keeps a short private note. */
export function FollowUpControl({ studentId, followUp, lang, onChange }: FollowUpControlProps) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const [note, setNote] = useState(followUp?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const done = followUp?.done ?? false

  useEffect(() => { setNote(followUp?.note ?? '') }, [followUp?.note])

  async function save(body: { done?: boolean; note?: string }) {
    setSaving(true)
    setFailed(false)
    try {
      const next = await http.put<FollowUpState>(`/dashboard/follow-ups/${studentId}`, body)
      onChange(next)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={saving}
        onClick={() => save({ done: !done })}
        className="flex min-h-[44px] w-full items-center gap-2 text-start text-sm font-medium text-gray-900 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-gray-400" />}
        {done ? t('Followed up', 'تمت المتابعة') : t('Mark as followed up', 'تمت المتابعة؟ علّم هنا')}
      </button>
      <label className="mt-2 block text-xs text-gray-500" htmlFor={`follow-up-note-${studentId}`}>
        {t('What happened? (private to you)', 'ماذا حدث؟ (خاص بك)')}
      </label>
      <textarea
        id={`follow-up-note-${studentId}`}
        value={note}
        maxLength={500}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => { if (note !== (followUp?.note ?? '')) save({ note }) }}
        className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
        placeholder={t('e.g. Called his mother, back next week', 'مثال: اتصلت بوالدته، سيحضر الأسبوع القادم')}
      />
      {failed && <p role="alert" className="mt-1 text-xs text-red-600">{t('Could not save. Try again.', 'تعذر الحفظ. حاول مرة أخرى.')}</p>}
    </div>
  )
}

export function FollowUpDoneBadge({ lang }: { lang: 'en' | 'ar' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      {lang === 'ar' ? 'تمت المتابعة' : 'Followed up'}
    </span>
  )
}

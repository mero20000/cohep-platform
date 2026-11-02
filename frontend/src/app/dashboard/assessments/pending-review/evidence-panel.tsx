'use client'

import { Mic, StickyNote } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { AudioPlayer } from '@/components/audio-player'
import { assetUrl } from '@/lib/asset-url'
import type { PendingItem } from './types'

/** What the student handed in besides typed answers: their recording, the reference to compare it with, and their notes. */
export function EvidencePanel({ item }: { item: PendingItem }) {
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const { recording, notes, assessment, extraAnswers } = item
  if (!recording && !notes && extraAnswers.length === 0) return null

  return (
    <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      {recording && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <Mic className="h-3.5 w-3.5" /> {t('Student recording', 'تسجيل الطالب')}
          </div>
          <AudioPlayer src={assetUrl(recording.url)} duration={recording.durationSeconds ?? undefined} />
          {assessment.referenceRecordingUrl && (
            <div className="mt-2">
              <div className="mb-1 text-xs text-gray-500">
                {assessment.referenceRecordingName || t('Reference recording', 'التسجيل المرجعي')}
              </div>
              <AudioPlayer src={assetUrl(assessment.referenceRecordingUrl)} compact />
            </div>
          )}
        </div>
      )}
      {notes && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <StickyNote className="h-3.5 w-3.5" /> {t('Student notes', 'ملاحظات الطالب')}
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{notes}</p>
        </div>
      )}
      {extraAnswers.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {t('Answers to questions no longer in the assessment', 'إجابات على أسئلة لم تعد في التقييم')}
          </div>
          <ul className="list-disc space-y-0.5 ps-5 text-sm text-gray-800">
            {extraAnswers.map(a => <li key={a.questionId} className="whitespace-pre-wrap">{a.answer}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

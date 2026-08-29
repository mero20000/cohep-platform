'use client'

import { FileText, Target, Presentation, Download, Church } from 'lucide-react'
import type { HymnMapItem } from './hooks'

/**
 * The words, and everything else a student needs to read while practising.
 *
 * Nothing of this reached the student before: the hymn map returned titles, level,
 * subject, tags and up to three audio/video resources, while requiredMemorization,
 * description, objectives and presentationUrl sat unused on the lesson, and any PDF of
 * lyrics or notation was filtered out of the response by type. A student was asked to
 * learn liturgical Coptic chant from a single audio file.
 */
export function LessonText({ hymn, lang }: { hymn: HymnMapItem; lang: 'en' | 'ar' }) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const pick = (en?: string | null, ar?: string | null) =>
    (lang === 'ar' ? ar || en : en || ar) || null

  const memorization = pick(hymn.requiredMemorization, hymn.requiredMemorizationAr)
  const description = pick(hymn.description, hymn.descriptionAr)
  const objectives = normaliseObjectives(lang === 'ar' ? hymn.objectivesAr ?? hymn.objectives : hymn.objectives ?? hymn.objectivesAr)
  const documents = (hymn.resources ?? []).filter(r => r.type !== 'audio' && r.type !== 'video')

  const hasAnything =
    hymn.progress?.isReadyForLiturgy ||
    memorization ||
    description ||
    objectives.length > 0 ||
    documents.length > 0 ||
    hymn.presentationUrl
  if (!hasAnything) return null

  return (
    <div className="space-y-3">
      {hymn.progress?.isReadyForLiturgy && (
        // Arguably the most meaningful moment in this platform's whole purpose, and it
        // was never shown to the person it happened to.
        <section className="rounded-lg border-2 border-gold-300 bg-gold-50 p-3">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-gold-800">
            <Church className="h-4 w-4" aria-hidden="true" />
            {t('You are cleared to sing this in the liturgy', 'تم اعتمادك لترتيل هذا اللحن في القداس')}
          </h4>
          {hymn.progress.readyForLiturgyAt && (
            <p className="mt-1 text-xs text-gold-700">
              {t('Cleared on', 'تم الاعتماد في')}{' '}
              {new Date(hymn.progress.readyForLiturgyAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
            </p>
          )}
          {hymn.progress.clergyNotes && (
            <p className="mt-1.5 text-sm italic text-gray-700">&ldquo;{hymn.progress.clergyNotes}&rdquo;</p>
          )}
        </section>
      )}

      {memorization && (
        <section className="rounded-lg border border-gold-200 bg-gold-50 p-3">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gold-700">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {t('The words', 'الكلمات')}
          </h4>
          {/* Chant text is line-oriented — preserve the author's line breaks. */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{memorization}</p>
        </section>
      )}

      {description && (
        <section className="rounded-lg border border-gray-200 p-3">
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            {t('About this hymn', 'عن هذا اللحن')}
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{description}</p>
        </section>
      )}

      {objectives.length > 0 && (
        <section className="rounded-lg border border-gray-200 p-3">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            <Target className="h-3.5 w-3.5" aria-hidden="true" />
            {t('What to aim for', 'ما تسعى إليه')}
          </h4>
          <ul className="list-disc space-y-1 ps-5 text-sm text-gray-700">
            {objectives.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </section>
      )}

      {(documents.length > 0 || hymn.presentationUrl) && (
        <section className="rounded-lg border border-gray-200 p-3">
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            {t('Lyrics & notation', 'الكلمات والتدوين')}
          </h4>
          <ul className="space-y-1.5">
            {documents.map(d => (
              <li key={d.id}>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {(lang === 'ar' ? d.titleAr || d.title : d.title || d.titleAr) || t('Document', 'مستند')}
                </a>
              </li>
            ))}
            {hymn.presentationUrl && (
              <li>
                <a
                  href={hymn.presentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
                >
                  <Presentation className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('Presentation', 'العرض التقديمي')}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  )
}

/** objectives is a Json column, so it may be an array, a newline string, or nothing. */
function normaliseObjectives(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(o => (typeof o === 'string' ? o : String(o ?? ''))).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split('\n').map(s => s.trim()).filter(Boolean)
  }
  return []
}

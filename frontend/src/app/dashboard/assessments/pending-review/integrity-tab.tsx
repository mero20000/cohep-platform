'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Loader2, Search, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { findingKey, type IntegrityFinding, type IntegrityFixResult, type IntegrityRecord, type IntegrityReport } from './types'

const STATUS_LABELS: Record<string, [string, string]> = {
  completed: ['Completed', 'مكتمل'],
  submitted: ['Submitted', 'تم التسليم'],
  assigned: ['Pending (not started)', 'معلّق (لم يبدأ)'],
}

function describeRecord(r: IntegrityRecord, lang: 'en' | 'ar'): string {
  const pair = STATUS_LABELS[r.status] ?? [r.status, r.status]
  const status = lang === 'ar' ? pair[1] : pair[0]
  const mark = r.score !== null && r.maxScore !== null ? ` ${r.score}/${r.maxScore}` : ''
  const created = new Date(r.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')
  return `${status}${mark} · ${lang === 'ar' ? 'أُنشئ' : 'created'} ${created}`
}

/**
 * Finds students whose assessment records are broken (the same assessment done and pending, or an
 * assessment that is not for them) and repairs them. Scanning changes nothing; fixing archives.
 */
export function IntegrityTab({ onCount }: { onCount?: (n: number) => void }) {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [code, setCode] = useState('')
  const [report, setReport] = useState<IntegrityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [fixing, setFixing] = useState(false)

  const scan = useCallback(async (studentCode: string) => {
    setLoading(true)
    setError(false)
    try {
      const params: Record<string, string> = { schoolId: getSchoolId() }
      if (studentCode.trim()) params.studentCode = studentCode.trim()
      const res = await http.get<IntegrityReport>('/assessments/integrity', params)
      setReport(res)
      setSelected(new Set())
      if (!studentCode.trim()) onCount?.(res.findings.length)
    } catch (err) {
      console.error('Integrity scan failed', err)
      setError(true)
    }
    setLoading(false)
  }, [onCount])

  useEffect(() => { scan('') }, [scan])

  const findings = report?.findings ?? []
  const fixable = findings.filter(f => f.fixable)
  const allSelected = fixable.length > 0 && fixable.every(f => selected.has(findingKey(f)))

  const toggle = (key: string) => setSelected(sel => {
    const next = new Set(sel)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const fixSelected = async () => {
    const items = findings
      .filter(f => selected.has(findingKey(f)))
      .map(f => ({ kind: f.kind, assessmentId: f.assessmentId, studentId: f.studentId }))
    setFixing(true)
    try {
      const res = await http.post<IntegrityFixResult>('/assessments/integrity/fix', { items }, { schoolId: getSchoolId() })
      if (res.failed === 0) {
        toast('success', t(`Fixed ${res.fixed}`, `تم إصلاح ${res.fixed}`))
      } else {
        toast('error', t(`Fixed ${res.fixed}, ${res.failed} could not be fixed`, `تم إصلاح ${res.fixed} وتعذر إصلاح ${res.failed}`))
      }
      setConfirming(false)
      await scan(code)
    } catch {
      toast('error', t('The fix failed', 'فشل الإصلاح'))
    }
    setFixing(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {t(
          'Finds students who have the same assessment twice (for example one done and one pending) or an assessment that is not for their level or group. Scanning changes nothing; fixing archives the extra record, it never deletes it.',
          'يجد الطلاب الذين لديهم التقييم نفسه مرتين (مثلاً واحد مكتمل وآخر معلّق) أو تقييماً ليس لمستواهم أو مجموعتهم. الفحص لا يغيّر شيئاً؛ والإصلاح يؤرشف السجل الزائد ولا يحذفه.',
        )}
      </p>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={e => { e.preventDefault(); scan(code) }}
      >
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={t('Student code, e.g. STU-00032 (blank = whole school)', 'كود الطالب مثل STU-00032 (فارغ = كل المدرسة)')}
          aria-label={t('Student code', 'كود الطالب')}
          className="w-80 max-w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={loading} className="gap-1.5">
          <Search className="h-4 w-4" />{t('Scan', 'فحص')}
        </Button>
      </form>

      {loading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : error || !report ? (
        <EmptyState
          icon={ShieldCheck}
          title={t('The scan failed', 'فشل الفحص')}
          action={<Button size="sm" variant="outline" onClick={() => scan(code)}>{t('Retry', 'إعادة المحاولة')}</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{t(`${report.scanned} records scanned`, `تم فحص ${report.scanned} سجل`)}</span>
            <Badge variant={report.counts.duplicate ? 'warning' : 'default'}>{report.counts.duplicate} {t('duplicates', 'مكرر')}</Badge>
            <Badge variant={report.counts.notAssigned ? 'warning' : 'default'}>{report.counts.notAssigned} {t('not assigned', 'غير معيّن')}</Badge>
            <Badge variant={report.counts.reviewOnly ? 'info' : 'default'}>{report.counts.reviewOnly} {t('need review', 'تحتاج مراجعة')}</Badge>
          </div>

          {findings.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title={t('No problems found', 'لا توجد مشاكل')}
              description={code.trim() ? t('This student\'s assessment records are consistent.', 'سجلات تقييمات هذا الطالب متسقة.') : t('Every student\'s records are consistent.', 'سجلات كل الطلاب متسقة.')}
            />
          ) : (
            <>
              {fixable.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(fixable.map(findingKey)))}
                    />
                    {t('Select all that can be fixed', 'تحديد كل ما يمكن إصلاحه')} ({fixable.length})
                  </label>
                  <Button size="sm" disabled={selected.size === 0 || fixing} onClick={() => setConfirming(true)}>
                    {t('Fix selected', 'إصلاح المحدد')} ({selected.size})
                  </Button>
                </div>
              )}

              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {findings.map(f => (
                  <FindingRow
                    key={findingKey(f)}
                    f={f}
                    checked={selected.has(findingKey(f))}
                    onToggle={() => toggle(findingKey(f))}
                  />
                ))}
              </div>
              {report.truncated && (
                <p className="text-xs text-gray-500">{t('Showing the first 500 findings; fix these and scan again.', 'يتم عرض أول 500 نتيجة؛ أصلحها ثم افحص مجدداً.')}</p>
              )}
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={fixSelected}
        loading={fixing}
        variant="warning"
        title={t('Fix selected records?', 'إصلاح السجلات المحددة؟')}
        message={t(
          `${selected.size} item(s) will be fixed. The extra or stale records are archived, not deleted, and the record that is kept is unchanged.`,
          `سيتم إصلاح ${selected.size} عنصر. تُؤرشف السجلات الزائدة أو القديمة ولا تُحذف، ويبقى السجل المحتفَظ به كما هو.`,
        )}
        confirmLabel={t('Fix', 'إصلاح')}
        cancelLabel={t('Cancel', 'إلغاء')}
      />
    </div>
  )
}

function FindingRow({ f, checked, onToggle }: { f: IntegrityFinding; checked: boolean; onToggle: () => void }) {
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const describe = (r: IntegrityRecord) => describeRecord(r, lang)

  return (
    <div className="flex flex-wrap items-start gap-3 p-4">
      {f.fixable ? (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={t(`Select ${f.assessment.title} for ${f.student.name}`, `تحديد ${f.assessment.title} لـ ${f.student.name}`)}
          className="mt-1"
        />
      ) : (
        <span className="mt-1 w-4" />
      )}
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-gray-900">
          {f.student.name}
          <span className="ml-2 text-xs font-normal text-gray-500">
            {[f.student.studentCode, f.student.levelName, f.student.groupName].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span>{f.assessment.title}</span>
          <Badge variant={f.kind === 'duplicate' ? 'warning' : 'danger'}>
            {f.kind === 'duplicate' ? t('Duplicate', 'مكرر') : t('Not assigned to this student', 'غير معيّن لهذا الطالب')}
          </Badge>
          {!f.fixable && <Badge variant="info">{t('Needs manual review', 'يحتاج مراجعة يدوية')}</Badge>}
        </div>

        {f.kind === 'duplicate' ? (
          <ul className="mt-2 space-y-0.5 text-xs">
            <li className="text-green-700">{t('Keep', 'يُحتفَظ به')}: {describe(f.keep)}</li>
            {f.archive.map(r => (
              <li key={r.id} className="text-gray-500">{t('Archive', 'يُؤرشَف')}: {describe(r)}</li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 space-y-0.5 text-xs text-gray-600">
            <p>
              {f.reason === 'level'
                ? t(`The assessment is for ${f.assessment.levelName ?? '—'}, but the student is in ${f.student.levelName ?? '—'}.`, `التقييم لـ ${f.assessment.levelName ?? '—'} لكن الطالب في ${f.student.levelName ?? '—'}.`)
                : t(`The assessment is for ${f.assessment.groupName ?? '—'}, but the student is in ${f.student.groupName ?? '—'}.`, `التقييم لـ ${f.assessment.groupName ?? '—'} لكن الطالب في ${f.student.groupName ?? '—'}.`)}
            </p>
            <p className={f.fixable ? 'text-gray-500' : 'text-amber-700'}>
              {f.fixable
                ? `${t('Archive', 'يُؤرشَف')}: ${describe(f.keep)}`
                : `${t('Has work on it — not changed automatically', 'عليه عمل — لا يتغير تلقائياً')}: ${describe(f.keep)}`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

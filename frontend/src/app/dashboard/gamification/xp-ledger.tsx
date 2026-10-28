'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableSkeleton } from '@/components/ui/skeleton'
import { http } from '@/lib/http-client'

export interface XpLedgerItem {
  id: string
  amount: number
  balanceAfter: number
  type: string
  description: string | null
  referenceType: string | null
  referenceId: string | null
  createdAt: string
  createdByName: string | null
  /** The XP came from an assessment attempt that was archived or no longer exists */
  flag: 'archived_attempt' | 'missing_attempt' | null
}

interface XpLedger {
  totalXp: number
  level: number
  total: number
  items: XpLedgerItem[]
}

const PAGE = 50

function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string }
  const m = e?.response?.data?.message ?? e?.message
  return (Array.isArray(m) ? m.join(', ') : m) || fallback
}

/**
 * One student's XP, entry by entry. An admin can correct the size of a single award or remove it,
 * for example one that duplicated another. Every change needs a reason and is audit-logged;
 * later balances are recalculated.
 */
export function XpLedger({ studentId, onChanged }: { studentId: string; onChanged?: () => void }) {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)

  const [ledger, setLedger] = useState<XpLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: string; mode: 'amend' | 'delete' } | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setLedger(await http.get<XpLedger>(`/gamification/students/${studentId}/xp-ledger`, { skip: '0', take: String(PAGE) }))
    } catch (err) {
      setError(errorText(err, t('Could not load the XP history', 'تعذر تحميل سجل الخبرة')))
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  useEffect(() => { load() }, [load])

  const loadMore = async () => {
    if (!ledger) return
    setLoadingMore(true)
    try {
      const next = await http.get<XpLedger>(`/gamification/students/${studentId}/xp-ledger`, {
        skip: String(ledger.items.length),
        take: String(PAGE),
      })
      setLedger({ ...next, items: [...ledger.items, ...next.items] })
    } catch (err) {
      setError(errorText(err, t('Could not load more', 'تعذر تحميل المزيد')))
    }
    setLoadingMore(false)
  }

  const open = (item: XpLedgerItem, mode: 'amend' | 'delete') => {
    setEditing({ id: item.id, mode })
    setAmount(String(item.amount))
    setReason('')
    setError('')
  }

  const submit = async (item: XpLedgerItem) => {
    if (!editing) return
    setError('')
    if (reason.trim().length < 3) { setError(t('A reason of at least 3 characters is required', 'السبب مطلوب (3 أحرف على الأقل)')); return }
    const base = `/gamification/students/${studentId}/xp/transactions/${item.id}`
    setBusy(true)
    try {
      if (editing.mode === 'amend') {
        const next = Number(amount)
        if (!Number.isInteger(next) || next === 0) {
          setError(t('The amount must be a whole number other than zero', 'يجب أن يكون المبلغ رقماً صحيحاً غير الصفر'))
          setBusy(false)
          return
        }
        await http.patch(base, { amount: next, reason: reason.trim() })
        toast('success', t('XP award corrected', 'تم تصحيح مكافأة الخبرة'))
      } else {
        await http.delete(base, { reason: reason.trim() })
        toast('success', t('XP award removed', 'تم حذف مكافأة الخبرة'))
      }
      setEditing(null)
      await load()
      onChanged?.()
    } catch (err) {
      setError(errorText(err, t('The change failed', 'فشل التغيير')))
    }
    setBusy(false)
  }

  if (loading) return <TableSkeleton rows={4} cols={3} />

  if (!ledger) {
    return (
      <div className="space-y-3">
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Button size="sm" variant="outline" onClick={load}>{t('Retry', 'إعادة المحاولة')}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <span className="text-2xl font-black text-blue-600">{ledger.totalXp.toLocaleString('en-GB')}</span>
          <span className="ml-1 text-xs font-semibold text-blue-700">XP · {t('Level', 'المستوى')} {ledger.level}</span>
        </div>
        <span className="text-xs text-gray-500">{ledger.total} {t('entries', 'سجل')}</span>
      </div>
      <p className="text-xs text-gray-500">
        {t(
          'Correct or remove a single award. Badges already earned with that XP are not taken back.',
          'صحّح أو احذف مكافأة واحدة. لا تُسحب الشارات التي نُلت بهذه الخبرة.',
        )}
      </p>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {ledger.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">{t('No XP yet.', 'لا توجد خبرة بعد.')}</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
          {ledger.items.map(item => {
            const isOpen = editing?.id === item.id
            return (
              <li key={item.id} className="p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{item.type.replace(/_/g, ' ')}</span>
                      {item.flag === 'archived_attempt' && <Badge variant="warning">{t('From an archived attempt', 'من محاولة مؤرشفة')}</Badge>}
                      {item.flag === 'missing_attempt' && <Badge variant="danger">{t('Attempt no longer exists', 'المحاولة لم تعد موجودة')}</Badge>}
                    </div>
                    {item.description && <p className="mt-0.5 break-words text-xs text-gray-600">{item.description}</p>}
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                      {item.createdByName ? ` · ${item.createdByName}` : ''}
                      {` · ${t('balance', 'الرصيد')} ${item.balanceAfter}`}
                    </p>
                  </div>
                  <div className={`text-sm font-bold ${item.amount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {item.amount > 0 ? '+' : ''}{item.amount}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={t('Correct this award', 'تصحيح هذه المكافأة')} onClick={() => open(item, 'amend')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={t('Remove this award', 'حذف هذه المكافأة')} onClick={() => open(item, 'delete')} className="text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isOpen && editing && (
                  <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                    {editing.mode === 'amend' ? (
                      <label className="block text-xs font-semibold text-gray-700">
                        {t('Correct amount', 'المبلغ الصحيح')}
                        <input
                          type="number"
                          step={1}
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          className="mt-1 block w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    ) : (
                      <p className="text-xs text-red-700">
                        {t(`This removes ${item.amount > 0 ? '+' : ''}${item.amount} XP from the student.`, `سيؤدي هذا إلى إزالة ${item.amount > 0 ? '+' : ''}${item.amount} خبرة من الطالب.`)}
                      </p>
                    )}
                    <label className="block text-xs font-semibold text-gray-700">
                      {t('Reason (required)', 'السبب (مطلوب)')}
                      <input
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder={editing.mode === 'amend' ? t('Why is this amount wrong?', 'لماذا هذا المبلغ غير صحيح؟') : t('Why is this being removed?', 'لماذا تتم إزالتها؟')}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>{t('Cancel', 'إلغاء')}</Button>
                      <Button size="sm" variant={editing.mode === 'delete' ? 'destructive' : 'default'} disabled={busy} onClick={() => submit(item)}>
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {editing.mode === 'amend' ? t('Save correction', 'حفظ التصحيح') : t('Remove award', 'حذف المكافأة')}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {ledger.items.length < ledger.total && (
        <div className="text-center">
          <Button size="sm" variant="outline" disabled={loadingMore} onClick={loadMore}>
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('Load more', 'تحميل المزيد')}
          </Button>
        </div>
      )}
    </div>
  )
}

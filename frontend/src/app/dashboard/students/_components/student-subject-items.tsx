'use client'
import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, Circle, Zap } from 'lucide-react'
import { http } from '@/lib/http-client'
import { useToast } from '@/components/ui/toast'

interface SubjectItem { id: string; name: string; nameAr?: string; nameCoptic?: string }
export interface StudentSubjectItemRow {
  subjectItem: SubjectItem
  status: 'passed' | 'not_started'
  passedAt: string | null
  passedByUser: { id: string; firstName: string; lastName: string } | null
  history: unknown[]
}
interface Props { studentId: string; lang: 'en'|'ar' }

const TOGGLE_ROLES = ['servant', 'group_leader', 'level_leader', 'admin', 'super_admin']

function canToggleRoles(): boolean {
  try {
    const stored = localStorage.getItem('user')
    if (!stored) return false
    const roles: string[] = JSON.parse(stored)?.roles ?? []
    return roles.some(r => TOGGLE_ROLES.includes(r))
  } catch { return false }
}

export function StudentSubjectItemsPanel({ studentId, lang }: Props) {
  const [items, setItems] = useState<StudentSubjectItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const [canToggle, setCanToggle] = useState(false)

  useEffect(() => { setCanToggle(canToggleRoles()) }, [])

  useEffect(() => {
    setLoading(true)
    http.get<StudentSubjectItemRow[]>(`/students/${studentId}/subject-items`)
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => { setItems([]); toast('error', t('Failed to load hymns','فشل تحميل الترانيم')) })
      .finally(() => setLoading(false))
  }, [studentId])

  const toggle = async (itemId: string) => {
    setToggling(itemId)
    const prev = items
    setItems(list => list.map(i => i.subjectItem.id === itemId ? { ...i, status: i.status==='passed' ? 'not_started' : 'passed' } : i))
    try {
      const res = await http.post<{ passed: boolean }>(`/students/${studentId}/subject-items/${itemId}/pass`, {})
      setItems(list => list.map(i => i.subjectItem.id === itemId ? { ...i, status: res.passed ? 'passed' : 'not_started' } : i))
      toast('success', res.passed ? t('Marked as passed', 'تم وضع علامة اجتياز') : t('Passed mark revoked', 'تم إلغاء علامة الاجتياز'))
    } catch (e: any) {
      setItems(prev)
      toast('error', e?.message || t('Failed to update status', 'فشل تحديث الحالة'))
    }
    setToggling(null)
  }

  const passedCount = items.filter(i => i.status === 'passed').length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0
  const allPassed = totalCount > 0 && passedCount === totalCount

  const toggleAll = async (markAs: 'passed' | 'not_started') => {
    const itemsToToggle = items.filter(i => i.status !== markAs)
    if (itemsToToggle.length === 0) return

    const prev = items
    setItems(list => list.map(i => ({ ...i, status: markAs })))
    setToggling('all')

    try {
      await Promise.all(itemsToToggle.map(item =>
        http.post(`/students/${studentId}/subject-items/${item.subjectItem.id}/pass`, {})
      ))
      toast('success', markAs === 'passed' ? t('All marked as passed', 'تم وضع علامة الاجتياز للكل') : t('All marks revoked', 'تم إلغاء علامات الاجتياز'))
    } catch (e: any) {
      setItems(prev)
      toast('error', e?.message || t('Failed to update', 'فشل التحديث'))
    }
    setToggling(null)
  }

  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 overflow-hidden">
      {/* Header with progress */}
      <div className="px-4 py-3 border-b border-blue-100">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">{t('Allocated Hymns','الترانيم المخصصة')}</h3>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-blue-200 text-xs font-medium text-blue-700">
              {passedCount}/{totalCount}
            </span>
          </div>
          {canToggle && totalCount > 0 && (
            <div className="flex items-center gap-1.5">
              {!allPassed && (
                <button
                  onClick={() => toggleAll('passed')}
                  disabled={toggling !== null}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-60 transition-colors"
                  title={t('Mark all as passed', 'وضع علامة الاجتياز للكل')}>
                  {toggling === 'all' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                </button>
              )}
              {passedCount > 0 && (
                <button
                  onClick={() => toggleAll('not_started')}
                  disabled={toggling !== null}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 transition-colors"
                  title={t('Revoke all marks', 'إلغاء جميع العلامات')}>
                  {toggling === 'all' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Circle className="h-3 w-3" />}
                </button>
              )}
            </div>
          )}
        </div>
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="w-full h-2 rounded-full bg-blue-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300" style={{width: `${progressPercent}%`}} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {loading ? (
          <div className="space-y-2">
            {[0,1,2].map(n => <div key={n} className="h-10 rounded-lg bg-white/50 animate-pulse" />)}
          </div>
        ) : totalCount === 0 ? (
          <div className="py-6 text-center">
            <Circle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{t('No hymns allocated yet','لا توجد ترانيم مخصصة بعد')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(({ subjectItem, status, passedAt, passedByUser, history }) => (
              <div key={subjectItem.id}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors ${
                  status === 'passed'
                    ? 'bg-green-50/50 border-green-100'
                    : 'bg-white border-gray-100 hover:border-blue-200'
                }`}>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {status === 'passed' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${status === 'passed' ? 'text-green-900' : 'text-gray-900'}`}>
                      {lang==='ar' && subjectItem.nameAr ? subjectItem.nameAr : subjectItem.name}
                    </div>
                    {status==='passed' && passedAt && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {passedByUser ? `${t('by','بواسطة')} ${passedByUser.firstName}` : ''} • {new Date(passedAt).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{month:'short',day:'numeric'})}
                      </div>
                    )}
                    {status!=='passed' && history.length>0 && (
                      <div className="text-xs text-amber-600 mt-0.5">{t(`previously passed (${history.length})`,`اجتياز سابق (${history.length})`)}</div>
                    )}
                  </div>
                </div>
                {canToggle && (
                  <button
                    onClick={() => toggle(subjectItem.id)}
                    disabled={toggling===subjectItem.id}
                    className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                      status==='passed'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-60'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-60'
                    }`}>
                    {toggling===subjectItem.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : status === 'passed' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                    {status==='passed' ? t('Passed','مجتاز') : t('Mark Passed','تحديد مجتاز')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

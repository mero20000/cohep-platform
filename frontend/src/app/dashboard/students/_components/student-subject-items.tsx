'use client'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
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
    // optimistic update
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

  return (
    <div className="mt-4 rounded-lg border border-gray-100 p-3">
      <div className="text-xs text-gray-500 mb-2">{t('Allocated Hymns','الترانيم المخصصة')}</div>
      {loading ? <div className="space-y-1.5">{[0,1,2].map(n=><div key={n} className="h-8 rounded bg-gray-100 animate-pulse"/>)}</div>
      : items.length===0 ? <div className="py-2 text-xs text-gray-400">{t('No hymns allocated yet','لا توجد ترانيم مخصصة بعد')}</div>
      : <div className="space-y-1.5">
          {items.map(({ subjectItem, status, passedAt, passedByUser, history }) => (
            <div key={subjectItem.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{lang==='ar' && subjectItem.nameAr ? subjectItem.nameAr : subjectItem.name}</div>
                {status==='passed' && passedAt && <div className="text-xs text-gray-400">{passedByUser ? `${t('by','بواسطة')} ${passedByUser.firstName} ${passedByUser.lastName}`.trim() + (passedAt ? ` · ${new Date(passedAt).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{day:'2-digit',month:'short',year:'numeric'})}` : '') : new Date(passedAt).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>}
                {status!=='passed' && history.length>0 && <div className="text-xs text-gray-400">{t(`previously passed (${history.length})`,`اجتياز سابق (${history.length})`)}</div>}
              </div>
              {canToggle && (
                <button onClick={() => toggle(subjectItem.id)} disabled={toggling===subjectItem.id}
                  className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${status==='passed'?'bg-green-100 text-green-700 hover:bg-green-200':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {toggling===subjectItem.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  {status==='passed' ? t('Passed ✓','تم الاجتياز ✓') : t('Mark Passed','وضع علامة الاجتياز')}
                </button>
              )}
            </div>
          ))}
        </div>}
    </div>
  )
}

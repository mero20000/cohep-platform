'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Copy, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'
import { calcAge } from './student-types'

interface DupStudent {
  id: string; firstName: string; lastName: string; dateOfBirth: string; studentCode: string
  status: string; createdAt: string
  level?: { name: string } | null; group?: { name: string } | null
}
interface DupGroup { reason: 'same_name_dob' | 'same_phone' | 'same_email'; students: DupStudent[] }
interface Props { onClose: () => void; onChanged: () => void; lang: 'en'|'ar' }

const REASON_LABEL: Record<string, { en: string; ar: string }> = {
  same_name_dob: { en: 'Same name & date of birth', ar: 'نفس الاسم وتاريخ الميلاد' },
  same_phone: { en: 'Same phone number', ar: 'نفس رقم الهاتف' },
  same_email: { en: 'Same email', ar: 'نفس البريد الإلكتروني' },
}

export function StudentDuplicatesModal({ onClose, onChanged, lang }: Props) {
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const { toast } = useToast()
  const [groups, setGroups] = useState<DupGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [ignored, setIgnored] = useState<Set<number>>(new Set())
  const dialogRef = useRef<HTMLDivElement>(null)

  const load = () => {
    setLoading(true)
    http.get<{ groups: DupGroup[]; totalGroups: number }>('/students/duplicates', { schoolId: getSchoolId() })
      .then(d => setGroups(d.groups || []))
      .catch(() => { setGroups([]); toast('error', t('Failed to load duplicates','فشل تحميل التكرارات')) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { dialogRef.current?.focus(); load() }, [])

  const handleDelete = async (studentId: string) => {
    setDeletingId(studentId)
    try {
      await http.delete(`/students/${studentId}`, { schoolId: getSchoolId() })
      toast('success', t('Student removed','تم حذف الطالب'))
      onChanged()
      load()
    } catch (e: any) {
      toast('error', e?.message || t('Failed to delete','فشل الحذف'))
    }
    setDeletingId(null)
  }

  const visibleGroups = groups.filter((_, i) => !ignored.has(i))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('Find Duplicate Students','البحث عن طلاب مكررين')}
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col outline-none">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold inline-flex items-center gap-2"><Copy className="h-5 w-5 text-amber-600" />{t('Duplicate Students','الطلاب المكررون')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : visibleGroups.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{t('No potential duplicates found','لا توجد تكرارات محتملة')}</p>
            </div>
          ) : (
            groups.map((g, idx) => {
              if (ignored.has(idx)) return null
              return (
                <div key={idx} className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-100">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {lang==='ar' ? REASON_LABEL[g.reason]?.ar : REASON_LABEL[g.reason]?.en}
                    </span>
                    <button onClick={() => setIgnored(prev => new Set(prev).add(idx))} className="text-xs text-gray-500 hover:text-gray-700">
                      {t('Dismiss','تجاهل')}
                    </button>
                  </div>
                  <div className="divide-y divide-amber-100">
                    {g.students.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            #{s.studentCode} · {calcAge(s.dateOfBirth)} {t('yrs','سنة')} · {s.level?.name || '—'}{s.group?.name ? ` / ${s.group.name}` : ''} · {t('created','أُنشئ')} {new Date(s.createdAt).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="shrink-0 inline-flex items-center gap-1.5 text-red-600 hover:bg-red-100">
                          {deletingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {t('Remove','حذف')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>{t('Close','إغلاق')}</Button>
        </div>
      </div>
    </div>
  )
}

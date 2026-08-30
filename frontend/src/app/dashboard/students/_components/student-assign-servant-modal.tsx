'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Users, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'
import { SERVANT_ROLES } from '@/lib/roles'

interface ServantOption { id: string; firstName: string; lastName: string; userRoles?: { role: { name: string; displayName: string } }[] }
interface Props { studentIds: string[]; onClose: () => void; onSuccess: () => void; lang: 'en'|'ar' }

export function StudentAssignServantModal({ studentIds, onClose, onSuccess, lang }: Props) {
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const { toast } = useToast()
  const [servants, setServants] = useState<ServantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => { dialogRef.current?.focus() }, [])

  useEffect(() => {
    setLoading(true)
    http.get<ServantOption[]>('/users', { schoolId: getSchoolId(), roleIn: SERVANT_ROLES.join(',') })
      .then(d => setServants(Array.isArray(d) ? d : []))
      .catch(() => setServants([]))
      .finally(() => setLoading(false))
  }, [])

  const handleAssign = async () => {
    if (!selectedId) return
    setAssigning(true)
    try {
      await http.post('/students/bulk-assign-servant', { ids: studentIds, servantId: selectedId, mode: addMode ? 'add' : 'replace' }, { schoolId: getSchoolId() })
      const message = addMode
        ? t(`Added to ${studentIds.length} student(s)`, `تمت إضافته لـ ${studentIds.length} طالب`)
        : t(`Assigned to ${studentIds.length} student(s)`, `تم التعيين لـ ${studentIds.length} طالب`)
      toast('success', message)
      onSuccess()
      onClose()
    } catch (e: any) {
      toast('error', e?.message || t('Failed to assign servant', 'فشل تعيين الخادم'))
    }
    setAssigning(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('Assign Servant','تعيين خادم')}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col outline-none">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold inline-flex items-center gap-2"><Users className="h-5 w-5 text-purple-600" />{t('Assign Servant','تعيين خادم')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <p className="text-sm text-gray-500 mb-4">
            {t(`Assigning a servant to ${studentIds.length} selected student(s).`, `تعيين خادم لـ ${studentIds.length} طالب محدد.`)}
          </p>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 font-medium mb-2">{t('Assignment Mode','طريقة التعيين')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setAddMode(false)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${!addMode ? 'bg-red-100 text-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {t('Replace', 'استبدال')} {t('current','الحالي')}
              </button>
              <button
                onClick={() => setAddMode(true)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors ${addMode ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {t('Add also', 'إضافة أيضا')}
              </button>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              {addMode
                ? t('Servant will be added to existing assignments', 'سيتم إضافة الخادم إلى التعيينات الموجودة')
                : t('Servant will replace existing assignments', 'سيتم استبدال الخادم بدلا من التعيينات الموجودة')}
            </p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : servants.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('No servants found','لا يوجد خدم')}</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {servants.map(s => {
                const role = s.userRoles?.find(ur => SERVANT_ROLES.includes(ur.role.name))
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-start transition-colors ${
                      selectedId === s.id ? 'border-purple-300 bg-purple-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</div>
                      {role && <div className="text-xs text-gray-500">{role.role.displayName}</div>}
                    </div>
                    {selectedId === s.id && <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>{t('Cancel','إلغاء')}</Button>
          <Button onClick={handleAssign} disabled={!selectedId || assigning} className="inline-flex items-center gap-2">
            {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('Assign','تعيين')}
          </Button>
        </div>
      </div>
    </div>
  )
}

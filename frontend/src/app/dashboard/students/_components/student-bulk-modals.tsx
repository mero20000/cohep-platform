'use client'
import { useState, useEffect, useRef } from 'react'
import { Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { track } from '@/lib/analytics'
import type { Level } from './student-types'
import type { GradeItem } from '@/lib/grades'

type BM = 'delete'|'status'|'level'|'grade'
interface Props {
  showBulkDelete: boolean; showBulkStatus: boolean; showBulkLevel: boolean; showBulkGrade: boolean
  onClose: (m: BM) => void; selectedIds: Set<string>
  activeLevels: Level[]; gradeOptions: GradeItem[]
  onSuccess: (page: number) => void; currentPage: number
  toast: (type: 'success'|'error', title: string, msg?: string) => void; lang: 'en'|'ar'
}
export function StudentBulkModals({ showBulkDelete, showBulkStatus, showBulkLevel, showBulkGrade, onClose, selectedIds, activeLevels, gradeOptions, onSuccess, currentPage, toast, lang }: Props) {
  const [bulkStatus, setBulkStatus] = useState('active')
  const [bulkLevelId, setBulkLevelId] = useState('')
  const [bulkGrade, setBulkGrade] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const ids = [...selectedIds]

  const patch = async (data: Record<string,string>, m: 'status'|'level'|'grade') => {
    try {
      const r: {updated:number} = await http.patch('/students/bulk',{ids,data},{schoolId:getSchoolId()})
      onClose(m); onSuccess(currentPage); toast('success',`${r.updated} ${t('students updated','طالب تم تحديثهم')}`)
      track('bulk.action','action',{action:`students.bulk_update_${m}`,count:ids.length})
    } catch { toast('error',t('Bulk update failed','فشل التحديث الجماعي')); onSuccess(currentPage) }
  }

  const handleBulkDelete = async () => {
    setDeleting(true)
    try {
      const r: {deleted:number} = await http.post('/students/bulk-delete',{ids},{schoolId:getSchoolId()})
      onClose('delete'); setConfirmText(''); onSuccess(currentPage)
      toast('success',`${r.deleted} ${t('students deleted','طالب تم حذفهم')}`)
      track('bulk.action','action',{action:'students.bulk_delete',count:ids.length})
    } catch { toast('error',t('Bulk delete failed','فشل الحذف الجماعي')); onSuccess(currentPage) }
    finally { setDeleting(false) }
  }

  return (
    <>
      {showBulkDelete&&<M label={t('Delete Students','حذف الطلاب')} onClose={()=>{setConfirmText('');onClose('delete')}}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto"><Trash2 className="h-6 w-6 text-red-600"/></div>
        <h3 className="mt-4 text-lg font-semibold text-center text-gray-900">{t(`Delete ${ids.length} Students`,`حذف ${ids.length} طالب`)}</h3>
        <p className="mt-2 text-sm text-gray-500 text-center">{t('Are you sure you want to delete','هل أنت متأكد من حذف')} <strong>{ids.length}</strong> {t('students?','طالب؟')}</p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              {t('This will soft-delete each student','سيتم إخفاء كل طالب من القوائم النشطة')}:<br/>
              &bull; {t('Profile & enrollment data (hidden)','بيانات الطالب والتسجيل (مخفية)')}<br/>
              &bull; {t('Attendance / grades / XP history is retained','يتم الاحتفاظ بسجلات الحضور والدرجات والنقاط')}<br/>
              &bull; {t('Recovery is only possible via an administrator','لا يمكن الاستعادة إلا بواسطة مسؤول النظام')}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 text-center">{t('This fully removes them from the active roster but does not erase historical records.','يُحذف الطالب من قائمة النشطاء لكن لا تُمسح السجلات التاريخية.')}</p>
        <p className="mt-4 text-sm font-medium text-gray-700">{t('Type','اكتب')} <span className="font-bold text-red-600">{t('DELETE','DELETE')}</span> {t('to confirm','للتأكيد')}:</p>
        <input type="text" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder={t('Type DELETE','اكتب DELETE')}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none" />
        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={()=>{setConfirmText('');onClose('delete')}} className="flex-1">{t('Cancel','إلغاء')}</Button>
          <Button variant="destructive" disabled={deleting||confirmText!=='DELETE'} className="flex-1" onClick={handleBulkDelete}>
            {deleting?<span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin"/>{t('Deleting','جار الحذف')}</span>:t('Delete Selected','حذف المحدد')}
          </Button>
        </div>
      </M>}

      {showBulkStatus&&<M label={t('Change Status','تغيير الحالة')} onClose={()=>onClose('status')}>
        <h3 className="text-lg font-semibold text-gray-900">{t('Change Status','تغيير الحالة')}</h3>
        <p className="mt-1 text-sm text-gray-500">{ids.length} {t('students will be updated','طالب سيتم تحديثهم')}</p>
        <div className="mt-4 space-y-2">
          {(['active','inactive','graduated'] as const).map(st=>(
            <label key={st} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 has-[:checked]:border-gold-500 has-[:checked]:bg-blue-50">
              <input type="radio" name="bulkStatus" value={st} checked={bulkStatus===st} onChange={()=>setBulkStatus(st)} className="h-4 w-4 accent-gold-600 focus:ring-blue-500"/>
              <span className="text-sm font-medium text-gray-900">{st==='active'?t('Active','نشط'):st==='inactive'?t('Inactive','غير نشط'):t('Graduated','متخرج')}</span>
            </label>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={()=>onClose('status')} className="flex-1">{t('Cancel','إلغاء')}</Button>
          <Button onClick={()=>patch({status:bulkStatus},'status')} className="flex-1">{t('Update','تحديث')}</Button>
        </div>
      </M>}

      {showBulkLevel&&<M label={t('Change Level','تغيير المستوى')} onClose={()=>onClose('level')}>
        <h3 className="text-lg font-semibold text-gray-900">{t('Change Level','تغيير المستوى')}</h3>
        <p className="mt-1 text-sm text-gray-500">{ids.length} {t('students will be updated','طالب سيتم تحديثهم')}</p>
        <div className="mt-4 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('Level','المستوى')}</label><select value={bulkLevelId} onChange={e=>setBulkLevelId(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"><option value="">{t('Select level','اختر المستوى')}</option>{activeLevels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={()=>onClose('level')} className="flex-1">{t('Cancel','إلغاء')}</Button>
          <Button disabled={!bulkLevelId} onClick={()=>patch({levelId:bulkLevelId},'level')} className="flex-1">{t('Update','تحديث')}</Button>
        </div>
      </M>}

      {showBulkGrade&&<M label={t('Change Grade','تغيير المرحلة الدراسية')} onClose={()=>onClose('grade')}>
        <h3 className="text-lg font-semibold text-gray-900">{t('Change Grade','تغيير المرحلة الدراسية')}</h3>
        <p className="mt-1 text-sm text-gray-500">{ids.length} {t('students will be updated','طالب سيتم تحديثهم')}</p>
        <div className="mt-4"><label className="block text-sm font-medium text-gray-700 mb-1">{t('School Grade','المرحلة الدراسية')}</label><select value={bulkGrade} onChange={e=>setBulkGrade(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"><option value="">{t('Select grade','اختر المرحلة')}</option>{gradeOptions.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={()=>onClose('grade')} className="flex-1">{t('Cancel','إلغاء')}</Button>
          <Button disabled={!bulkGrade} onClick={()=>patch({gradeId:bulkGrade},'grade')} className="flex-1">{t('Update','تحديث')}</Button>
        </div>
      </M>}
    </>
  )
}
function M({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 outline-none" onClick={e=>e.stopPropagation()}>{children}</div></div>
}

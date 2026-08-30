'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Student } from './student-types'
interface Props { student: Student; onClose: () => void; onConfirm: () => void; lang: 'en'|'ar' }
export function StudentDeleteModal({ student:s, onClose, onConfirm, lang }: Props) {
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [confirmText, setConfirmText] = useState('')
  useEffect(() => { confirmRef.current?.focus() }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('Delete Student','حذف الطالب')} className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 outline-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-full mx-auto" style={{backgroundColor: 'hsl(var(--semantic-status-inactive-bg) / 0.1)'}}><Trash2 className="h-6 w-6" style={{color: 'hsl(var(--semantic-status-inactive-text))'}} /></div>
        <h3 className="mt-4 text-lg font-semibold text-center text-gray-900">{t('Delete Student','حذف الطالب')}</h3>
        <p className="mt-2 text-sm text-gray-500 text-center">
          {t('Are you sure you want to remove','هل أنت متأكد من حذف')} <strong>{s.firstName} {s.lastName}</strong>?
        </p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              {t('This will soft-delete the student','سيتم إخفاء الطالب من القوائم النشطة')}:<br/>
              &bull; {t('Profile & enrollment data (hidden)','بيانات الطالب والتسجيل (مخفية)')}<br/>
              &bull; {t('Attendance / grades / XP history is retained','يتم الاحتفاظ بسجلات الحضور والدرجات والنقاط')}
              {s.parentEmail ? <>&bull; {t('Parent account links are kept','يُحتفظ بروابط حسابات أولياء الأمور')}<br/></> : null}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 text-center">{t('Recovery is only possible via an administrator.','لا يمكن الاستعادة إلا بواسطة مسؤول النظام.')}</p>
        <p className="mt-4 text-sm font-medium text-gray-700">{t('Type','اكتب')} <span className="font-bold text-semantic-status-inactive">DELETE</span> {t('to confirm','للتأكيد')}:</p>
        <input type="text" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="DELETE"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none" />
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">{t('Cancel','إلغاء')}</Button>
          <Button variant="destructive" ref={confirmRef} disabled={confirmText!=='DELETE'} onClick={onConfirm} className="flex-1">{t('Delete','حذف')}</Button>
        </div>
      </div>
    </div>
  )
}

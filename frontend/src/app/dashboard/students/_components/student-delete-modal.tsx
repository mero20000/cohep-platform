'use client'
import { useEffect, useRef } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Student } from './student-types'
interface Props { student: Student; onClose: () => void; onConfirm: () => void; lang: 'en'|'ar' }
export function StudentDeleteModal({ student:s, onClose, onConfirm, lang }: Props) {
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { confirmRef.current?.focus() }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('Delete Student','حذف الطالب')} className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 outline-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto"><Trash2 className="h-6 w-6 text-red-600" /></div>
        <h3 className="mt-4 text-lg font-semibold text-center text-gray-900">{t('Delete Student','حذف الطالب')}</h3>
        <p className="mt-2 text-sm text-gray-500 text-center">
          {t('Are you sure you want to remove','هل أنت متأكد من حذف')} <strong>{s.firstName} {s.lastName}</strong>?
        </p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              {t('This will permanently delete','سيتم حذف ما يلي نهائياً')}:<br/>
              &bull; {t('Student profile & enrollment data','بيانات الطالب والتسجيل')}<br/>
              &bull; {t('Attendance records','سجلات الحضور')}<br/>
              &bull; {t('Assessment submissions & grades','نتائج التقييمات والدرجات')}<br/>
              &bull; {t('Gamification XP & badges','نقاط الخبرة والشارات')}<br/>
              {s.parentEmail ? <>&bull; {t('Parent account linking','ربط حساب ولي الأمر')}<br/></> : null}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 text-center">{t('This action cannot be undone.','لا يمكن التراجع عن هذا الإجراء.')}</p>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">{t('Cancel','إلغاء')}</Button>
          <Button variant="destructive" ref={confirmRef} onClick={onConfirm} className="flex-1">{t('Delete','حذف')}</Button>
        </div>
      </div>
    </div>
  )
}

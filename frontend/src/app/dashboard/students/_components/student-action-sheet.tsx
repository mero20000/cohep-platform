'use client'
import { useEffect, useRef } from 'react'
import { Eye, Pencil, Trash2, Star, Send, Phone, CheckCircle2, PauseCircle, X } from 'lucide-react'
import { usePermission } from '@/lib/use-permission'
import { toTelHref } from '@/lib/phone'
import { buildPortalShareMessage, buildPortalWhatsAppUrl } from '@/lib/portal-share'
import type { Student } from './student-types'

interface Props {
  student: Student
  lang: 'en' | 'ar'
  isFavorite: boolean
  onClose: () => void
  onView: (s: Student) => void
  onEdit: (s: Student) => void
  onDelete: (s: Student) => void
  onToggleFavorite?: (id: string) => void
  onToggleStatus: (s: Student) => void
  onApprove: (s: Student) => void
}

const row = 'flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-medium text-gray-800 hover:bg-gray-50 active:bg-gray-100'

/** Mobile "⋯" menu for a roster card — replaces the row of tiny icon buttons. */
export function StudentActionSheet({ student: s, lang, isFavorite, onClose, onView, onEdit, onDelete, onToggleFavorite, onToggleStatus, onApprove }: Props) {
  const { can } = usePermission()
  const ref = useRef<HTMLDivElement>(null)
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  useEffect(() => { ref.current?.focus() }, [])
  const done = (fn: () => void) => () => { onClose(); fn() }
  const parentPhone = s.metadata?.phone?.trim()
  const canApprove = can('student:approve') && s.status === 'pending'
  const canToggle = can('student:edit') && (s.status === 'active' || s.status === 'inactive')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:hidden" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${s.firstName} ${s.lastName}`}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        className="w-full rounded-t-2xl bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl outline-none animate-slideUp">
        <div className="mx-auto mb-1 mt-1 h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />
        <div className="flex items-center justify-between px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{s.firstName} {s.lastName}</p>
            <p className="text-xs text-gray-500">#{s.studentCode}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Close', 'إغلاق')} className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <button type="button" className={row} onClick={done(() => onView(s))}><Eye className="h-5 w-5 text-blue-600" />{t('View details', 'عرض التفاصيل')}</button>
        {can('student:edit') && <button type="button" className={row} onClick={done(() => onEdit(s))}><Pencil className="h-5 w-5 text-amber-600" />{t('Edit student', 'تعديل الطالب')}</button>}
        {parentPhone && (
          <a className={row} href={toTelHref(parentPhone)} onClick={onClose}><Phone className="h-5 w-5 text-green-600" />{t('Call parent', 'اتصال بولي الأمر')}<span className="ms-auto text-xs font-normal text-gray-500" dir="ltr">{parentPhone}</span></a>
        )}
        {s.portalAccessKey && (
          <a className={`${row} bg-emerald-50 text-emerald-800 hover:bg-emerald-100`} target="_blank" rel="noopener noreferrer" onClick={onClose}
            href={buildPortalWhatsAppUrl(parentPhone, buildPortalShareMessage({ studentName: `${s.firstName} ${s.lastName}`, portalKey: s.portalAccessKey }))}>
            <Send className="h-5 w-5" />{t('Share portal on WhatsApp', 'مشاركة البوابة على واتساب')}
          </a>
        )}
        {onToggleFavorite && (
          <button type="button" className={row} onClick={done(() => onToggleFavorite(s.id))}>
            <Star className={`h-5 w-5 ${isFavorite ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
            {isFavorite ? t('Remove from favorites', 'إزالة من المفضلة') : t('Add to favorites', 'إضافة للمفضلة')}
          </button>
        )}
        {canApprove && (
          <button type="button" className={`${row} text-green-700`} onClick={done(() => onApprove(s))}>
            <CheckCircle2 className="h-5 w-5" />{t('Approve student', 'اعتماد الطالب')}
          </button>
        )}
        {canToggle && (
          <button type="button" className={row} onClick={done(() => onToggleStatus(s))}>
            {s.status === 'active' ? <PauseCircle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {s.status === 'active' ? t('Mark as inactive', 'تحويل إلى غير نشط') : t('Mark as active', 'تحويل إلى نشط')}
          </button>
        )}
        {can('student:delete') && <button type="button" className={`${row} text-red-600 hover:bg-red-50`} onClick={done(() => onDelete(s))}><Trash2 className="h-5 w-5" />{t('Delete student', 'حذف الطالب')}</button>}
      </div>
    </div>
  )
}

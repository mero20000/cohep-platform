'use client'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Pencil, Calendar, User, MapPin, Phone, Layers, Users, Church, GraduationCap, Mail, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { STATUS_STYLE, photoSrc, calcAge, type Student } from './student-types'
import { PhoneLink } from './phone-link'

interface Activity { id: string; action: string; createdAt: string; user?: { firstName: string; lastName: string } }
interface Props { student: Student; onClose: () => void; onEdit: () => void; onPreviewPhoto: (url: string) => void; lang: 'en'|'ar' }

export function StudentDetailModal({ student:s, onClose, onEdit, onPreviewPhoto, lang }: Props) {
  const [log, setLog] = useState<Activity[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const t = (en: string, ar: string) => lang==='ar'?ar:en

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    setLogLoading(true)
    http.get(`/students/${s.id}/activity`).then(d=>setLog(d as Activity[])).catch(()=>setLog([])).finally(()=>setLogLoading(false))
  }, [s.id])

  const details = [
    {icon:Calendar,label:t('Date of Birth','تاريخ الميلاد'),value:new Date(s.dateOfBirth).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{day:'2-digit',month:'2-digit',year:'numeric'})},
    {icon:User,label:t('Age','العمر'),value:`${calcAge(s.dateOfBirth)} ${t('years','سنة')}`},
    {icon:Layers,label:t('Level','المستوى'),value:s.level?.name},{icon:Users,label:t('Group','المجموعة'),value:s.group?.name},
    {icon:Church,label:t('Church','الكنيسة'),value:s.churchName||'—'},{icon:GraduationCap,label:t('Grade','المرحلة الدراسية'),value:s.schoolGrade||'—'},
    {icon:Mail,label:t('Email','البريد الإلكتروني'),value:s.metadata?.email||'—'},
    {icon:MapPin,label:t('Address','العنوان'),value:s.metadata?.address||'—'},{icon:UserCheck,label:t('Parent Email','بريد ولي الأمر'),value:s.parentEmail||'—'},
  ]
  const statusLabel = s.status==='active'?t('Active','نشط'):s.status==='inactive'?t('Inactive','غير نشط'):s.status==='graduated'?t('Graduated','متخرج'):s.status

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('Student Details','تفاصيل الطالب')} className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col outline-none">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">{t('Student Details','تفاصيل الطالب')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div className="flex items-center gap-4 mb-6">
            {s.photoUrl?<Button type="button" variant="ghost" size="icon" onClick={()=>onPreviewPhoto(photoSrc(s.photoUrl))} className="flex-shrink-0"><Image src={photoSrc(s.photoUrl)} alt={`${s.firstName} ${s.lastName}`} width={64} height={64} className="h-16 w-16 rounded-full object-cover border border-gray-200 cursor-pointer hover:ring-2 hover:ring-gold-400" /></Button>
            :<div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold flex-shrink-0 ${s.gender==='female'?'bg-pink-100 text-pink-700':'bg-blue-100 text-blue-700'}`}>{s.firstName[0]}{s.lastName[0]}</div>}
            <div><h3 className="text-xl font-bold text-gray-900">{s.firstName} {s.lastName}</h3>{s.firstNameAr&&<p className="text-sm text-gray-500">{s.firstNameAr} {s.lastNameAr}</p>}<p className="text-sm text-gray-500">{s.studentCode}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
              <div><div className="text-xs text-gray-500">{t('Phone','رقم الهاتف')}</div><div className="text-sm font-medium text-gray-900"><PhoneLink phone={s.metadata?.phone||''} lang={lang} /></div></div>
            </div>
            {details.map(item=>(
              <div key={item.label} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                <item.icon className="h-4 w-4 text-gray-400 mt-0.5" />
                <div><div className="text-xs text-gray-500">{item.label}</div><div className="text-sm font-medium text-gray-900">{item.value}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-100 p-3"><div className="text-xs text-gray-500">{t('Status','الحالة')}</div><Badge variant={STATUS_STYLE[s.status]?.variant||'default'}>{statusLabel}</Badge></div>
            <div className="rounded-lg border border-gray-100 p-3"><div className="text-xs text-gray-500">{t('Enrolled','تاريخ التسجيل')}</div><div className="text-sm font-medium text-gray-900">{new Date(s.enrollmentDate).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'})}</div></div>
          </div>
          {s.metadata?.notes&&<div className="mt-4 rounded-lg border border-gray-100 p-3"><div className="text-xs text-gray-500">{t('Notes','ملاحظات')}</div><div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{s.metadata.notes}</div></div>}
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('Activity','النشاط')}</h4>
            {logLoading?<div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
            :log.length===0?<p className="text-xs text-gray-400 py-2">{t('No activity recorded','لا يوجد نشاط مسجل')}</p>
            :<div className="space-y-2 max-h-48 overflow-y-auto">
              {log.map(entry=>{
                const label=entry.action==='CREATE'?t('create','إنشاء'):entry.action==='UPDATE'?t('update','تحديث'):entry.action==='DELETE'?t('delete','حذف'):entry.action.toLowerCase()
                const dot=entry.action==='CREATE'?'bg-green-400':entry.action==='UPDATE'?'bg-amber-400':entry.action==='DELETE'?'bg-red-400':'bg-gray-400'
                return <div key={entry.id} className="flex items-start gap-2 text-xs"><div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${dot}`}/><div className="flex-1 min-w-0"><span className="font-medium text-gray-700">{label}</span>{entry.user&&<span className="text-gray-500"> {t('by','بواسطة')} {entry.user.firstName} {entry.user.lastName}</span>}<span className="text-gray-400 ms-1">{entry.createdAt?new Date(entry.createdAt).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):''}</span></div></div>
              })}
            </div>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <Button variant="outline" onClick={onEdit} className="inline-flex items-center gap-2"><Pencil className="h-4 w-4" />{t('Edit','تعديل')}</Button>
          <Button variant="secondary" onClick={onClose}>{t('Close','إغلاق')}</Button>
        </div>
      </div>
    </div>
  )
}

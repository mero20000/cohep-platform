'use client'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Pencil, Calendar, User, MapPin, Phone, Layers, Users, Church, GraduationCap, Mail, UserCheck, Copy, Check, QrCode, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { StudentQrCard } from '@/components/qr/qr-code-card'
import { STATUS_STYLE, photoSrc, calcAge, type Student } from './student-types'
import { PhoneLink } from './phone-link'

interface Activity { id: string; action: string; createdAt: string; user?: { firstName: string; lastName: string } }
interface Props { student: Student; onClose: () => void; onEdit: () => void; onPreviewPhoto: (url: string) => void; lang: 'en'|'ar' }

export function StudentDetailModal({ student:s, onClose, onEdit, onPreviewPhoto, lang }: Props) {
  const [log, setLog] = useState<Activity[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showContactParent, setShowContactParent] = useState(false)
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
    {icon:Church,label:t('Church','الكنيسة'),value:s.churchName||'—'},{icon:GraduationCap,label:t('Grade','المرحلة الدراسية'),value:s.grade?.name||'—'},
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
          
          {/* Contact Parent Button */}
          {s.studentParents && s.studentParents.length > 0 && (
            <div className="mt-4">
              <button onClick={() => setShowContactParent(true)}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors">
                <MessageSquare className="h-4 w-4" />
                {t('Contact Parentتواصل مع الوالد')}
              </button>
            </div>
          )}

          {s.portalAccessKey && (
            <div className="mt-4 rounded-lg border border-gray-100 p-3">
              <div className="text-xs text-gray-500 mb-2">{t('Portal Access Key','مفتاح الوصول للبوابة')}</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-gray-700 bg-gray-50 rounded px-2 py-1.5 truncate">{s.portalAccessKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(s.portalAccessKey!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="shrink-0 p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={t('Copy','نسخ')}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
                <button onClick={() => setShowQr(true)}
                  className="shrink-0 p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={t('Show QR Code','عرض رمز QR')}>
                  <QrCode className="h-4 w-4" />
                </button>
              </div>
              <a href={`/student-portal/${s.portalAccessKey}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-700">
                {t('Open Student Portal','فتح بوابة الطالب')} →
              </a>
            </div>
          )}
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
      {showQr && s.portalAccessKey && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('Student Portal QR Code','رمز QR لبوابة الطالب')}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowQr(false)}><X className="h-4 w-4" /></Button>
            </div>
            <StudentQrCard student={{ id: s.id, firstName: s.firstName, lastName: s.lastName, studentCode: s.studentCode, portalAccessKey: s.portalAccessKey }} />
          </div>
        </div>
      )}
      
      {/* Contact Parent Modal */}
      {showContactParent && s.studentParents && s.studentParents.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowContactParent(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('Contact Parentتواصل مع الوالد')}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowContactParent(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3">
              {s.studentParents.map((sp: any) => {
                const parent = sp.parent
                if (!parent) return null
                return (
                  <div key={parent.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{parent.firstName} {parent.lastName}</div>
                      <div className="text-sm text-gray-500">{sp.relationship || t('Parent','والد')}</div>
                    </div>
                    <div className="flex gap-2">
                      {parent.phone && (
                        <a href={`tel:${parent.phone}`} className="p-2 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors">
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {parent.email && (
                        <a href={`mailto:${parent.email}`} className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors">
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import {
  Loader2, Mail, Building2, MapPin, Phone, User, ArrowLeft, Pencil, XCircle,
  CheckCircle2, Trash2, Music, Clock, Eye, Baby,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField } from '@/components/ui/form-field'
import { AudioPlayer } from '@/components/audio-player'
import { assetUrl } from '@/lib/asset-url'
import { languages as allLanguages } from '@/data/languages'

// ─────────────────────────────────────────────────────────────────────────────
// Unified Registrations module — two entity tabs:
//   • Students  — new-joiner applications from /register/[schoolSlug]
//   • Churches  — new church sign-ups for the platform
// ─────────────────────────────────────────────────────────────────────────────

type Entity = 'students' | 'churches'

export default function PendingRegistrationsPage() {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [entity, setEntity] = useState<Entity>('students')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('Back', 'العودة')}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('Registrations', 'التسجيلات')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('Review student joiners and church sign-ups — edit before approving', 'مراجعة انضمام الطلاب وطلبات الكنائس — يمكن التعديل قبل الموافقة')}
        </p>
      </div>

      {/* Entity switch */}
      <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1" role="tablist" aria-label={t('Registration type', 'نوع التسجيل')}>
        {([
          { id: 'students' as Entity, label: t('Student Applications', 'طلبات الطلاب'), icon: Baby, count: null },
          { id: 'churches' as Entity, label: t('Church Registrations', 'تسجيلات الكنائس'), icon: Building2, count: null },
        ]).map(tb => (
          <button key={tb.id} role="tab" aria-selected={entity === tb.id}
            onClick={() => setEntity(tb.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              entity === tb.id ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <tb.icon className="h-4 w-4" />
            {tb.label}
          </button>
        ))}
      </div>

      {entity === 'students' ? <StudentsPanel /> : <ChurchesPanel />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// STUDENTS PANEL — /register/[schoolSlug] applications
// ═════════════════════════════════════════════════════════════════════════════

function StudentsPanel() {
  const lang = useLanguage()
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [status, setStatus] = useState('pending')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [levelId, setLevelId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [gradeId, setGradeId] = useState('')
  const [levels, setLevels] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await http.get<any[]>(`/registrations`, { schoolId: getSchoolId(), status })
      setItems(data || [])
    } catch { setItems([]) }
    setLoading(false)
  }, [status])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    http.get<any[]>('/curriculum/levels', { schoolId: getSchoolId() }).then(setLevels).catch(() => {})
    import('@/lib/grades').then(m => m.fetchActiveGrades().then(setGrades).catch(() => {}))
  }, [])

  const HYMN_LABEL: Record<string, string> = {
    amen_be_mawteka: 'Amen be mawteka',
    be_shafaat: 'Be shafaat',
    both: 'Both hymns',
  }

  const handleApprove = async () => {
    if (!selected) return
    setApproving(true)
    try {
      await http.post(`/registrations/${selected.id}/approve`, { levelId: levelId || undefined, groupId: groupId || undefined, gradeId: gradeId || undefined })
      toast('success', t('Approved — student created', 'تمت الموافقة — تم إنشاء الطالب'))
      setSelected(null); fetchAll()
    } catch (e: any) { toast('error', e?.message || t('Failed to approve', 'فشلت الموافقة')) }
    setApproving(false)
  }

  const handleReject = async () => {
    if (!selected) return
    const reason = window.prompt(t('Reason for rejection (included in the email):', 'سبب الرفض (يُضمَّن في البريد):')) || ''
    setRejecting(true)
    try {
      await http.post(`/registrations/${selected.id}/reject`, { reason })
      toast('success', t('Rejected', 'تم الرفض'))
      setSelected(null); fetchAll()
    } catch (e: any) { toast('error', e?.message || t('Failed to reject', 'فشل الرفض')) }
    setRejecting(false)
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!window.confirm(t('Delete this registration permanently? The parent would need to register again.', 'حذف هذا التسجيل نهائيًا؟ سيحتاج ولي الأمر للتسجيل مرة أخرى.'))) return
    try {
      await http.delete(`/registrations/${selected.id}`)
      toast('success', t('Registration deleted', 'تم حذف التسجيل'))
      setSelected(null); fetchAll()
    } catch (e: any) { toast('error', e?.message || t('Failed to delete', 'فشل الحذف')) }
  }

  const handleUpdate = async () => {
    if (!selected || !editData) return
    try {
      await http.patch(`/registrations/${selected.id}`, { studentData: editData })
      toast('success', t('Updated', 'تم التحديث'))
      setSelected({ ...selected, studentData: editData })
      fetchAll()
    } catch (e: any) { toast('error', e?.message || t('Failed to update', 'فشل التحديث')) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${status === s ? 'bg-gold-500 border-gold-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t(s.charAt(0).toUpperCase() + s.slice(1), s === 'pending' ? 'قيد المراجعة' : s === 'approved' ? 'معتمد' : 'مرفوض')}
            {status === s && ` (${items.length})`}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gold-600" /></div>
        : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <Baby className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{t('No student applications', 'لا توجد طلبات طلاب')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('Share the registration link with parents — applications land here', 'شارك رابط التسجيل مع أولياء الأمور — ستظهر الطلبات هنا')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map(app => {
              const sd: any = app.studentData || {}
              return (
                <div key={app.id} className={`rounded-2xl border bg-white p-5 hover:shadow-md transition-shadow ${app.status === 'approved' ? 'border-green-200' : app.status === 'rejected' ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                      {sd.photoUrl ? <Image src={assetUrl(sd.photoUrl)} alt="" width={56} height={56} className="h-full w-full object-cover" priority /> : <div className="h-full w-full flex items-center justify-center text-gray-400 font-bold">{(sd.name || '?')[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{sd.name || sd.firstName}</div>
                      <div className="text-xs text-gray-500">{sd.dateOfBirth} · {sd.gender} · {sd.churchName || ''}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${app.hymnChoice === 'amen_be_mawteka' ? 'bg-blue-50 text-blue-700' : app.hymnChoice === 'both' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-purple-50 text-purple-700'}`}>
                          <Music className="h-3 w-3" />{HYMN_LABEL[app.hymnChoice] || app.hymnChoice}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(app.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const recs = sd.recordings || {}
                    const players: { label: string; url: string }[] = []
                    if (recs.amen_be_mawteka) players.push({ label: t('Amen be mawteka', 'امين امين بموتك'), url: recs.amen_be_mawteka })
                    if (recs.be_shafaat) players.push({ label: t('Be shafaat', 'بي شفاعات'), url: recs.be_shafaat })
                    if (!players.length && app.voiceRecordingUrl) players.push({ label: t('Recording', 'التسجيل'), url: app.voiceRecordingUrl })
                    return players.length ? (
                      <div className="mt-3 space-y-2">
                        {players.map(p => (
                          <div key={p.url}>
                            <div className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-0.5">
                              <Music className="h-3 w-3 text-gold-600" />{p.label}
                            </div>
                            <AudioPlayer src={assetUrl(p.url)} />
                          </div>
                        ))}
                      </div>
                    ) : null
                  })()}
                   <div className="mt-3 text-xs text-gray-600 line-clamp-2">{sd.notes || sd.address || ''} · {sd.parentEmail}</div>
                   <div className="mt-3 flex items-center gap-2 flex-wrap">
                     <Button size="sm" variant="outline" onClick={() => { setSelected(app); setEditData(app.studentData) }}>
                       <Eye className="h-3.5 w-3.5" />{t('View/Edit', 'عرض/تعديل')}
                     </Button>
                     {app.status === 'pending' && (
                       <>
                         <Button size="sm" onClick={() => { setSelected(app); setLevelId(''); setGroupId(''); setGradeId(sd.gradeId || '') }} className="bg-gold-500 hover:bg-gold-600 text-white">
                           <CheckCircle2 className="h-3.5 w-3.5" />{t('Approve', 'موافقة')}
                         </Button>
                         <Button size="sm" variant="outline" onClick={() => { setSelected(app); handleReject() }} className="text-red-600 border-red-200 hover:bg-red-50">
                           <XCircle className="h-3.5 w-3.5" />{t('Reject', 'رفض')}
                         </Button>
                         <Button size="sm" variant="outline" onClick={() => { setSelected(app); handleDelete() }} className="text-red-600 border-red-200 hover:bg-red-50">
                           <Trash2 className="h-3.5 w-3.5" />{t('Delete', 'حذف')}
                         </Button>
                       </>
                     )}
                   </div>
                </div>
              )
            })}
          </div>
        )}

      {/* Student detail / edit modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? ((selected.studentData || {}).name || t('Application', 'طلب')) : ''} size="lg"
        footer={selected?.status === 'pending' ? (
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>{t('Close', 'إغلاق')}</Button>
            <Button variant="outline" onClick={handleDelete} className="text-red-600 border-red-200 hover:bg-red-50"><Trash2 className="h-4 w-4" />{t('Delete', 'حذف')}</Button>
            <Button variant="outline" onClick={handleUpdate}><Pencil className="h-4 w-4" />{t('Save Edits', 'حفظ التعديلات')}</Button>
            <Button onClick={handleApprove} disabled={approving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {approving && <Loader2 className="h-4 w-4 animate-spin" />}{t('Approve & Create Student', 'موافقة وإنشاء طالب')}
            </Button>
            <Button variant="outline" onClick={handleReject} disabled={rejecting} className="text-red-600 border-red-200 hover:bg-red-50">{t('Reject', 'رفض')}</Button>
          </>
        ) : <Button variant="outline" onClick={() => setSelected(null)}>{t('Close', 'إغلاق')}</Button>
        }>
        {selected && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Recordings — one player per hymn */}
            {(() => {
              const sd: any = selected.studentData || {}
              const recs = sd.recordings || {}
              const players: { label: string; url: string }[] = []
              if (recs.amen_be_mawteka) players.push({ label: t('Amen be mawteka', 'امين امين بموتك'), url: recs.amen_be_mawteka })
              if (recs.be_shafaat) players.push({ label: t('Be shafaat', 'بي شفاعات'), url: recs.be_shafaat })
              if (!players.length && selected.voiceRecordingUrl) players.push({ label: t('Recording', 'التسجيل'), url: selected.voiceRecordingUrl })
              return players.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700">{t('Voice recordings', 'التسجيلات الصوتية')}</p>
                  {players.map(p => (
                    <div key={p.url} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1">
                        <Music className="h-3 w-3 text-gold-600" />{p.label}
                      </div>
                      <AudioPlayer src={assetUrl(p.url)} />
                    </div>
                  ))}
                </div>
              ) : null
            })()}
            {selected.status === 'pending' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">{t('Edit any information before approving — everything flows into the Student record', 'عدّل أي معلومة قبل الموافقة — كل الحقول تُنقل لملف الطالب')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <FormField label={t('Student Name *', 'اسم الطالب *')} value={editData?.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                  <FormField label={t('First Name (Arabic)', 'الاسم الأول (عربي)')} value={editData?.firstNameAr || ''} onChange={e => setEditData({ ...editData, firstNameAr: e.target.value })} />
                  <FormField label={t('Last Name (Arabic)', 'الاسم الأخير (عربي)')} value={editData?.lastNameAr || ''} onChange={e => setEditData({ ...editData, lastNameAr: e.target.value })} />
                  <FormField label={t('Date of Birth', 'تاريخ الميلاد')} type="date" value={editData?.dateOfBirth || ''} onChange={e => setEditData({ ...editData, dateOfBirth: e.target.value })} />
                  <FormField label={t('Gender', 'الجنس')} as="select" value={editData?.gender || 'male'} onChange={e => setEditData({ ...editData, gender: e.target.value })}>
                    <option value="male">{t('Male', 'ذكر')}</option>
                    <option value="female">{t('Female', 'أنثى')}</option>
                  </FormField>
                  <FormField label={t('Grade (for group)', 'المرحلة (للمجموعة)')} as="select" value={gradeId} onChange={e => setGradeId(e.target.value)}>
                    <option value="">{t('Select grade', 'اختر المرحلة')}</option>
                    {grades.map((g: any) => <option key={g.id} value={g.id}>{g.name}{g.nameAr ? ` – ${g.nameAr}` : ''}</option>)}
                  </FormField>
                  <FormField label={t('Church', 'الكنيسة')} value={editData?.churchName || ''} onChange={e => setEditData({ ...editData, churchName: e.target.value })} />
                  <FormField label={t('Parent / Guardian Name', 'اسم ولي الأمر')} value={editData?.parentName || ''} onChange={e => setEditData({ ...editData, parentName: e.target.value })} />
                  <FormField label={t('Relationship', 'صلة القرابة')} as="select" value={editData?.relationship || 'father'} onChange={e => setEditData({ ...editData, relationship: e.target.value })}>
                    <option value="father">{t('Father', 'أب')}</option>
                    <option value="mother">{t('Mother', 'أم')}</option>
                    <option value="guardian">{t('Guardian', 'ولي أمر')}</option>
                  </FormField>
                  <FormField label={t('Phone', 'الهاتف')} value={editData?.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                  <FormField label={t('Parent Email', 'بريد ولي الأمر')} value={editData?.parentEmail || ''} onChange={e => setEditData({ ...editData, parentEmail: e.target.value })} />
                  <FormField label={t('Student Email', 'بريد الطالب')} value={editData?.email || ''} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                  <FormField label={t('Address', 'العنوان')} value={editData?.address || ''} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                  <FormField label={t('Emergency Name', 'اسم الطوارئ')} value={editData?.emergencyContactName || ''} onChange={e => setEditData({ ...editData, emergencyContactName: e.target.value })} />
                  <FormField label={t('Emergency Phone', 'هاتف الطوارئ')} value={editData?.emergencyContactPhone || ''} onChange={e => setEditData({ ...editData, emergencyContactPhone: e.target.value })} />
                  <FormField label={t('Emergency Relation', 'صلة الطوارئ')} value={editData?.emergencyContactRelation || ''} onChange={e => setEditData({ ...editData, emergencyContactRelation: e.target.value })} />
                </div>
                <FormField label={t('Notes', 'ملاحظات')} as="textarea" value={editData?.notes || ''} onChange={e => setEditData({ ...editData, notes: e.target.value })} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// CHURCHES PANEL — platform sign-ups (admin module)
// ═════════════════════════════════════════════════════════════════════════════

interface AdminUser {
  id: string; firstName: string; lastName: string; email: string; phone?: string; isActive: boolean
}

interface Reg {
  id: string; schoolName: string; churchName: string; country?: string; city?: string;
  educationLanguage?: string; registrationStatus: 'pending' | 'approved' | 'rejected';
  isActive: boolean; createdAt: string;
  users: AdminUser[];
}

type ChurchTab = 'pending' | 'approved' | 'rejected' | 'all'

const CHURCH_TABS: { key: ChurchTab; label: string; labelAr: string }[] = [
  { key: 'pending', label: 'Pending Review', labelAr: 'قيد المراجعة' },
  { key: 'approved', label: 'Approved', labelAr: 'معتمد' },
  { key: 'rejected', label: 'Rejected', labelAr: 'مرفوض' },
  { key: 'all', label: 'All', labelAr: 'الكل' },
]

const STATUS_BADGE: Record<Reg['registrationStatus'], { text: string; textAr: string; cls: string; dot: string }> = {
  pending: { text: 'Pending Review', textAr: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  approved: { text: 'Approved', textAr: 'معتمد', cls: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  rejected: { text: 'Rejected', textAr: 'مرفوض', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
}

const RELEVANT_LANG_CODES = ['cop', 'en', 'ar', 'fr', 'de', 'el', 'it', 'pt', 'es', 'ro', 'ru', 'tr', 'am', 'ti']
const EDUC_LANGS = [
  { code: 'cop', name: 'Coptic' },
  ...allLanguages.filter(l => RELEVANT_LANG_CODES.includes(l.code) && l.code !== 'cop'),
]

function ChurchesPanel() {
  const lang = useLanguage()
  const { toast } = useToast()
  const [tab, setTab] = useState<ChurchTab>('pending')
  const [registrations, setRegistrations] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [editingReg, setEditingReg] = useState<Reg | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ kind: 'reject' | 'delete'; reg: Reg } | null>(null)

  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  const fetchRegistrations = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await http.get<Reg[]>(`/admin/registrations?status=${tab}`)
      setRegistrations(data || [])
    } catch (e: any) {
      setError(e?.message || t('Failed to load registrations', 'فشل تحميل التسجيلات'))
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchRegistrations() }, [fetchRegistrations])

  const refresh = useCallback(() => { fetchRegistrations() }, [fetchRegistrations])

  const handleApprove = async (reg: Reg) => {
    setProcessing(reg.id)
    try {
      await http.post(`/admin/registrations/${reg.id}/approve`)
      toast('success', t('Registration approved', 'تم اعتماد التسجيل'))
      refresh()
    } catch (e: any) {
      toast('error', e?.message || t('Failed to approve', 'فشل الاعتماد'))
    } finally { setProcessing(null) }
  }

  const handleRejectConfirm = async () => {
    if (!confirmAction || confirmAction.kind !== 'reject') return
    const reg = confirmAction.reg
    setConfirmAction(null); setProcessing(reg.id)
    try {
      await http.post(`/admin/registrations/${reg.id}/reject`)
      toast('success', t('Registration rejected', 'تم رفض التسجيل'))
      refresh()
    } catch (e: any) {
      toast('error', e?.message || t('Failed to reject', 'فشل الرفض'))
    } finally { setProcessing(null) }
  }

  const handleDeleteConfirm = async () => {
    if (!confirmAction || confirmAction.kind !== 'delete') return
    const reg = confirmAction.reg
    setConfirmAction(null); setProcessing(reg.id)
    try {
      await http.delete(`/admin/registrations/${reg.id}`)
      toast('success', t('Registration deleted', 'تم حذف التسجيل'))
      refresh()
    } catch (e: any) {
      toast('error', e?.message || t('Failed to delete', 'فشل الحذف'))
    } finally { setProcessing(null) }
  }

  const showApprove = (s: Reg['registrationStatus']) => s === 'pending' || s === 'rejected'
  const showReject = (s: Reg['registrationStatus']) => s === 'pending' || s === 'approved'

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {CHURCH_TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${tab === tb.key ? 'bg-gold-500 border-gold-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t(tb.label, tb.labelAr)}
          </button>
        ))}
      </div>

      {loading && <div className="px-4 py-12"><TableSkeleton rows={5} cols={3} /></div>}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && registrations.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-white">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-50 mb-4">
            <CheckCircle2 className="h-7 w-7 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {tab === 'pending' && t('No Pending Requests', 'لا توجد طلبات معلقة')}
            {tab === 'approved' && t('No Approved Registrations', 'لا توجد تسجيلات معتمدة')}
            {tab === 'rejected' && t('No Rejected Registrations', 'لا توجد تسجيلات مرفوضة')}
            {tab === 'all' && t('No Registrations', 'لا توجد تسجيلات')}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{t('Church sign-ups from the platform registration form appear here', 'تسجيلات الكنائس من نموذج المنصة تظهر هنا')}</p>
        </div>
      )}

      {!loading && !error && registrations.length > 0 && (
        <div className="space-y-4">
          {registrations.map((reg) => {
            const badge = STATUS_BADGE[reg.registrationStatus]
            const busy = processing === reg.id
            return (
              <div key={reg.id} className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow ${reg.registrationStatus === 'approved' ? 'border-green-200' : reg.registrationStatus === 'rejected' ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${reg.registrationStatus === 'pending' ? 'bg-amber-50 text-amber-600' : reg.registrationStatus === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{reg.churchName}</h3>
                        <p className="text-sm text-gray-500">{reg.schoolName}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                      {t(badge.text, badge.textAr)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {reg.users[0] && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{reg.users[0].firstName} {reg.users[0].lastName}</span>
                      </div>
                    )}
                    {reg.users[0]?.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{reg.users[0].email}</span>
                      </div>
                    )}
                    {reg.country && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{reg.city ? `${reg.city}, ` : ''}{reg.country}</span>
                      </div>
                    )}
                    {reg.users[0]?.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{reg.users[0].phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      {t('Submitted: ', 'تم التقديم: ')}
                      {new Date(reg.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {showReject(reg.registrationStatus) && (
                        <Button variant="outline" size="sm" disabled={busy}
                          onClick={() => setConfirmAction({ kind: 'reject', reg })}
                          className="text-red-600 border-red-200 hover:bg-red-50">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          {t('Reject', 'رفض')}
                        </Button>
                      )}
                      {showApprove(reg.registrationStatus) && (
                        <Button size="sm" disabled={busy} onClick={() => handleApprove(reg)} className="bg-green-600 hover:bg-green-700">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          {t('Approve', 'اعتماد')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditingReg(reg)}>
                        <Pencil className="h-4 w-4" />{t('Edit', 'تعديل')}
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy}
                        onClick={() => setConfirmAction({ kind: 'delete', reg })}
                        className="text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />{t('Delete', 'حذف')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ChurchEditModal reg={editingReg} lang={lang === 'ar' ? 'ar' : 'en'} onClose={() => setEditingReg(null)}
        onSaved={() => { setEditingReg(null); refresh() }} />

      <ConfirmDialog
        open={confirmAction !== null && confirmAction.kind === 'reject'}
        title={t('Reject this registration?', 'رفض هذا التسجيل؟')}
        message={t('The church and admin account will be deactivated. This can be reversed later.', 'ستُعطَّل الكنيسة وحساب المسؤول. يمكن التراجع عن هذا لاحقاً.')}
        confirmLabel={t('Reject', 'تأكيد الرفض')}
        cancelLabel={t('Cancel', 'إلغاء')}
        variant="warning"
        loading={processing === confirmAction?.reg?.id}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleRejectConfirm}
      />

      <ConfirmDialog
        open={confirmAction?.kind === 'delete'}
        title={t('Delete this registration?', 'حذف هذا التسجيل؟')}
        message={t('This permanently hides the record (soft delete). This action cannot be undone from the UI.', 'يؤدي هذا إلى إخفاء السجل بشكل دائم (حذف ناعم). لا يمكن التراجع عن هذه العملية من الواجهة.')}
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        variant="danger"
        loading={processing === confirmAction?.reg?.id}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

interface EditRegForm {
  churchName: string; country: string; city: string; educationLanguage: string;
  firstName: string; lastName: string; email: string; phone: string
}

function ChurchEditModal({ reg, lang, onClose, onSaved }: {
  reg: Reg | null; lang: 'en' | 'ar'; onClose: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<EditRegForm>({
    churchName: '', country: '', city: '', educationLanguage: 'en', firstName: '', lastName: '', email: '', phone: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  useEffect(() => {
    if (reg) {
      setForm({
        churchName: reg.churchName || '',
        country: reg.country || '',
        city: reg.city || '',
        educationLanguage: reg.educationLanguage || 'en',
        firstName: reg.users[0]?.firstName || '',
        lastName: reg.users[0]?.lastName || '',
        email: reg.users[0]?.email || '',
        phone: reg.users[0]?.phone || '',
      })
      setError('')
    }
  }, [reg])

  const update = (key: keyof EditRegForm, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!reg) return
    if (!form.churchName.trim()) { setError(t('Church name is required', 'اسم الكنيسة مطلوب')); return }
    if (!form.email.trim()) { setError(t('Admin email is required', 'بريد المسؤول مطلوب')); return }
    setSaving(true); setError('')
    try {
      await http.patch(`/admin/registrations/${reg.id}`, {
        churchName: form.churchName,
        country: form.country || undefined,
        city: form.city || undefined,
        educationLanguage: form.educationLanguage,
        admin: {
          firstName: form.firstName || undefined,
          lastName: form.lastName || undefined,
          email: form.email,
          phone: form.phone || undefined,
        },
      })
      toast('success', t('Registration updated', 'تم تحديث التسجيل'))
      onSaved()
    } catch (e: any) {
      setError(e?.message || t('Failed to save changes', 'فشل حفظ التغييرات'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={reg !== null} onClose={onClose} size="lg"
      title={t('Edit Registration', 'تعديل التسجيل')}
      description={t('Modify registration details before or after a decision.', 'عدّل تفاصيل التسجيل قبل أو بعد اتخاذ القرار.')}>
      <div className="space-y-5">
        {error && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('Church', 'الكنيسة')}</h4>
          <div className="space-y-4">
            <FormField label={t('Church name', 'اسم الكنيسة')} required value={form.churchName}
              onChange={(e) => update('churchName', e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('Country', 'الدولة')} value={form.country}
                onChange={(e) => update('country', e.target.value)} />
              <FormField label={t('City', 'المدينة')} value={form.city}
                onChange={(e) => update('city', e.target.value)} />
            </div>
            <FormField as="select" label={t('Education language', 'لغة التعليم')} value={form.educationLanguage}
              onChange={(e) => update('educationLanguage', e.target.value)}>
              {EDUC_LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </FormField>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('Admin account', 'حساب المسؤول')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('First name', 'الاسم الأول')} value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)} />
            <FormField label={t('Last name', 'اسم العائلة')} value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <FormField label={t('Email', 'البريد الإلكتروني')} required type="email" value={form.email}
              onChange={(e) => update('email', e.target.value)} />
            <FormField label={t('Phone', 'الهاتف')} value={form.phone}
              onChange={(e) => update('phone', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        <button onClick={onClose} disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {t('Cancel', 'إلغاء')}
        </button>
        <Button onClick={handleSave} disabled={saving} className="bg-gold-600 hover:bg-gold-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('Save changes', 'حفظ التغييرات')}
        </Button>
      </div>
    </Modal>
  )
}

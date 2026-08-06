'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/use-language'
import { useToast } from '@/components/ui/toast'
import { http } from '@/lib/http-client'
import { Loader2, Mail, Building2, MapPin, Phone, User, ArrowLeft, Pencil, XCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Tabs } from '@/components/ui/tabs'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField } from '@/components/ui/form-field'
import { languages as allLanguages } from '@/data/languages'

interface AdminUser {
  id: string; firstName: string; lastName: string; email: string; phone?: string; isActive: boolean
}

interface Reg {
  id: string; schoolName: string; churchName: string; country?: string; city?: string;
  educationLanguage?: string; registrationStatus: 'pending' | 'approved' | 'rejected';
  isActive: boolean; createdAt: string;
  users: AdminUser[];
}

type Tab = 'pending' | 'approved' | 'rejected' | 'all'

const TABS: { key: Tab; label: string; labelAr: string; icon?: any }[] = [
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

export default function PendingRegistrationsPage() {
  const lang = useLanguage()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('pending')
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

  useEffect(() => { fetchRegistrations() }, [fetchRegistrations, tab])

  const refresh = useCallback(() => {
    fetchRegistrations()
  }, [fetchRegistrations])

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('Back', 'العودة')}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('Church Registrations', 'تسجيلات الكنائس')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('Review, edit, and manage church registration requests', 'مراجعة وتعديل وإدارة طلبات تسجيل الكنائس')}
        </p>
      </div>

      <Tabs
        tabs={TABS.map((tb) => ({ id: tb.key, label: t(tb.label, tb.labelAr) }))}
        activeTab={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && registrations.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-50 mb-4">
            <CheckCircle2 className="h-7 w-7 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {tab === 'pending' && t('No Pending Requests', 'لا توجد طلبات معلقة')}
            {tab === 'approved' && t('No Approved Registrations', 'لا توجد تسجيلات معتمدة')}
            {tab === 'rejected' && t('No Rejected Registrations', 'لا توجد تسجيلات مرفوضة')}
            {tab === 'all' && t('No Registrations', 'لا توجد تسجيلات')}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('Registrations you process will appear here by status', 'ستظهر التسجيلات التي تعالجها هنا حسب حالتها')}
          </p>
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
                      {new Date(reg.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
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
                        <Button size="sm" disabled={busy}
                          onClick={() => handleApprove(reg)}
                          className="bg-green-600 hover:bg-green-700">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          {t('Approve', 'اعتماد')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" disabled={busy}
                        onClick={() => setEditingReg(reg)}>
                        <Pencil className="h-4 w-4" />
                        {t('Edit', 'تعديل')}
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy}
                        onClick={() => setConfirmAction({ kind: 'delete', reg })}
                        className="text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                        {t('Delete', 'حذف')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EditModal reg={editingReg} lang={lang === 'ar' ? 'ar' : 'en'} onClose={() => setEditingReg(null)}
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

function EditModal({ reg, lang, onClose, onSaved }: {
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
'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Building2, Loader2, ImagePlus, Upload, Trash2, CheckCircle2, Ban } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField } from '@/components/ui/form-field'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'

interface ChurchItem {
  id: string; name: string; nameAr?: string;
}

interface SchoolItem {
  id: string; name: string; nameAr?: string; slug: string;
  logoUrl?: string; phone?: string; email?: string;
  timezone: string; locale: string; isActive: boolean;
  churchId: string;
}

const emptyForm = { name: '', nameAr: '', churchId: '', phone: '', email: '', timezone: 'UTC', locale: 'en', logoUrl: '' }

export function SchoolTab() {
  const lang = useLanguage()
  const [schools, setSchools] = useState<SchoolItem[]>([])
  const [churches, setChurches] = useState<ChurchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SchoolItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState<SchoolItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchSchools = () => {
    setLoading(true)
    http.get<SchoolItem[]>('/users/schools')
      .then((data: SchoolItem[]) => { setSchools(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setSchools([]); setLoading(false) })
  }
  useEffect(() => { fetchSchools() }, [])

  const fetchChurches = () => {
    http.get<ChurchItem[]>('/churches')
      .then((data: ChurchItem[]) => setChurches(Array.isArray(data) ? data : []))
      .catch(() => setChurches([]))
  }

  const openCreate = () => {
    fetchChurches()
    setEditing(null); setForm(emptyForm); setError(''); setShowForm(true)
  }

  const openEdit = (s: SchoolItem) => {
    fetchChurches()
    setEditing(s)
    setForm({
      name: s.name || '', nameAr: s.nameAr || '', churchId: s.churchId || '',
      phone: s.phone || '', email: s.email || '', timezone: s.timezone || 'UTC',
      locale: s.locale || 'en', logoUrl: s.logoUrl || '',
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError(lang === 'ar' ? 'اسم المدرسة مطلوب' : 'School name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await http.patch(`/users/schools/${editing.id}`, form)
      } else {
        await http.post('/users/schools', form)
      }
      setShowForm(false)
      fetchSchools()
    } catch { setError(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error') }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await http.delete(`/users/schools/${deleting.id}`)
      setShowDelete(false)
      fetchSchools()
    } catch { console.error('Delete failed') }
  }

  const handleToggleActive = async (s: SchoolItem) => {
    setTogglingId(s.id)
    try {
      await http.patch(`/users/schools/${s.id}`, { isActive: !s.isActive })
      fetchSchools()
    } catch { console.error('Toggle failed') }
    setTogglingId(null)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const data = await http.upload<{ url: string }>('/upload/school-logo', fd)
      setForm(prev => ({ ...prev, logoUrl: data.url }))
    } catch (err) { console.error(err) }
  }

  return (
    <>
      <RegistrationLinkCard schools={schools} loading={loading} />
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'المدارس' : 'Schools'}</h2>
            <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة المدارس وإعداداتها' : 'Manage schools and their settings'}</p>
          </div>
          <Button onClick={openCreate} aria-label={lang === 'ar' ? 'إضافة مدرسة' : 'Add school'} size="sm">
            <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة مدرسة' : 'Add School'}
          </Button>
        </div>

        {loading ? (
          <div className="px-4 py-12"><TableSkeleton rows={5} cols={4} /></div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">{lang === 'ar' ? 'لا توجد مدارس بعد' : 'No schools yet'}</p>
            <Button variant="link" onClick={openCreate} className="mt-2 text-sm font-medium text-blue-700 hover:text-gold-700">{lang === 'ar' ? 'إضافة أول مدرسة' : 'Add first school'}</Button>
          </div>
        ) : (
          <div className="overflow-x-auto table-to-cards">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'اسم المدرسة' : 'School Name'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'جهة الاتصال' : 'Contact'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'اللغة' : 'Language'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schools.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                    <td className="px-6 py-3.5" data-label="School Name">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 overflow-hidden">
                          {s.logoUrl ? (
                            <Image src={s.logoUrl.startsWith('http') ? s.logoUrl : `${API_ORIGIN}${s.logoUrl}`} alt="" width={36} height={36} className="h-9 w-9 object-cover"  />
                          ) : (
                            <Building2 className="h-4 w-4 text-blue-700" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{s.name}</div>
                          {s.nameAr && <div className="text-xs text-gray-400 arabic-text" dir="rtl">{s.nameAr}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5" data-label="Contact">
                      <div className="text-sm text-gray-900">{s.phone || '—'}</div>
                      <div className="text-xs text-gray-400">{s.email || ''}</div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-600 uppercase" data-label="Language">{s.locale}</td>
                    <td className="px-6 py-3.5" data-label="Status">
                      {s.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{lang === 'ar' ? 'نشط' : 'Active'}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{lang === 'ar' ? 'غير نشط' : 'Inactive'}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right" data-label="Actions">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleToggleActive(s)} disabled={togglingId === s.id} aria-label={lang === 'ar' ? (s.isActive ? `إيقاف ${s.name}` : `تفعيل ${s.name}`) : (s.isActive ? `Deactivate ${s.name}` : `Activate ${s.name}`)} title={lang === 'ar' ? (s.isActive ? 'إيقاف' : 'تفعيل') : (s.isActive ? 'Deactivate' : 'Activate')}
                          className={`rounded-lg p-1.5 ${s.isActive ? 'text-gray-400 hover:bg-gray-50 active:bg-gray-100 hover:text-gray-600' : 'text-green-500 hover:bg-green-50'}`}>
                          {s.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={lang === 'ar' ? `تعديل ${s.name}` : `Edit ${s.name}`} title={lang === 'ar' ? 'تعديل' : 'Edit'}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDeleting(s); setShowDelete(true) }} aria-label={lang === 'ar' ? `حذف ${s.name}` : `Delete ${s.name}`} title={lang === 'ar' ? 'حذف' : 'Delete'}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? (lang === 'ar' ? 'تعديل المدرسة' : 'Edit School') : (lang === 'ar' ? 'إضافة مدرسة جديدة' : 'Add New School')} size="lg">
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label={lang === 'ar' ? 'اسم المدرسة (بالإنجليزية)' : 'School Name (English)'} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: مدرسة COHEP' : 'e.g. COHEP School'} />
            <FormField label={lang === 'ar' ? 'اسم المدرسة (بالعربية)' : 'School Name (Arabic)'} value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} placeholder={lang === 'ar' ? 'مثال: مدرسة COHE' : 'مثال: مدرسة COHE'} dir="rtl" className="arabic-text" />
          </div>
          <FormField label={lang === 'ar' ? 'الكنيسة' : 'Church'} as="select" value={form.churchId} onChange={e => setForm({ ...form, churchId: e.target.value })} required>
            <option value="">{lang === 'ar' ? 'اختر كنيسة...' : 'Select a church...'}</option>
            {churches.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.nameAr ? ` (${c.nameAr})` : ''}</option>
            ))}
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label={lang === 'ar' ? 'الهاتف' : 'Phone'} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1234567890" />
            <FormField label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="school@example.com" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label={lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone'} as="select" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
              <option value="UTC">UTC</option><option value="America/New_York">Eastern (ET)</option><option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option><option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="Europe/London">London (GMT)</option><option value="Africa/Cairo">Cairo (EET)</option>
            </FormField>
            <FormField label={lang === 'ar' ? 'اللغة الافتراضية' : 'Default Language'} as="select" value={form.locale} onChange={e => setForm({ ...form, locale: e.target.value })}>
              <option value="en">{lang === 'ar' ? 'الإنجليزية' : 'English'}</option><option value="ar">{lang === 'ar' ? 'العربية' : 'Arabic'}</option>
            </FormField>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'ar' ? 'شعار المدرسة' : 'School Logo'}</label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden flex-shrink-0">
                {form.logoUrl ? (
                  <Image src={form.logoUrl.startsWith('http') ? form.logoUrl : `${API_ORIGIN}${form.logoUrl}`} alt="School logo" width={80} height={80} className="h-full w-full object-cover"  />
                ) : (
                  <ImagePlus className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer">
                  <Upload className="h-4 w-4" /> {lang === 'ar' ? 'رفع الشعار' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
                <p className="text-xs text-gray-400">{lang === 'ar' ? 'JPG, PNG أو SVG. الحد الأقصى 5MB.' : 'JPG, PNG or SVG. Max 5MB.'}</p>
                {form.logoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                    className="text-xs text-red-500 hover:text-red-600 p-0 h-auto">{lang === 'ar' ? 'إزالة الشعار' : 'Remove logo'}</Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إضافة مدرسة' : 'Add School')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={lang === 'ar' ? 'حذف المدرسة' : 'Delete School'}
        message={deleting ? (lang === 'ar' ? `هل أنت متأكد أنك تريد حذف ${deleting.name}؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete ${deleting.name}? This action cannot be undone.`) : ''}
      />
    </>
  )
}

// ── Registration link + QR ───────────────────────────────────────────────────
import { QRCodeSVG } from 'qrcode.react'
import { Link2, Copy, Check, Download, ExternalLink } from 'lucide-react'

const REG_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://cohep-platform.vercel.app'

function RegistrationLinkCard({ schools, loading }: { schools: SchoolItem[]; loading: boolean }) {
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const active = schools.find(s => s.slug) || schools[0]

  if (loading) return null
  if (!active?.slug) return null

  const link = `${REG_BASE}/register/${active.slug}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(link) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const downloadSvg = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url; a.download = `registration-qr-${active.slug}.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-gold-200 bg-gradient-to-br from-gold-50 to-white p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-5 w-5 text-gold-700" />
        <h2 className="text-lg font-semibold text-gray-900">{t('Registration Link', 'رابط التسجيل')}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{t('Share this link or QR code with parents — new joiners register directly, no account needed.', 'شارك هذا الرابط أو رمز QR مع أولياء الأمور — يسجل الأطفال الجدد مباشرة دون حساب.')}</p>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div ref={qrRef} className="rounded-2xl border-4 border-white shadow-lg bg-white p-2 shrink-0">
          <QRCodeSVG value={link} size={120} fgColor="#1A2744" bgColor="#FFFFFF" />
        </div>
        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <code className="flex-1 text-xs sm:text-sm text-gray-700 truncate" dir="ltr">{link}</code>
            <button onClick={copy} aria-label={t('Copy link', 'نسخ الرابط')}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gold-700 hover:bg-gold-50 transition-colors">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={copy} className="bg-gold-600 hover:bg-gold-700">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('Copied!', 'تم النسخ!') : t('Copy Link', 'نسخ الرابط')}
            </Button>
            <Button size="sm" variant="outline" onClick={downloadSvg}>
              <Download className="h-4 w-4" />{t('Download QR', 'تحميل رمز QR')}
            </Button>
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4" />{t('Open', 'فتح')}</Button>
            </a>
          </div>
          <p className="text-xs text-gray-400">{t('Parents fill the form, record a hymn, and you review it under Dashboard → Registrations.', 'يملأ أولياء الأمور النموذج ويسجلون اللحن، ثم تراجعونه من لوحة التحكم → التسجيلات.')}</p>
        </div>
      </div>
    </div>
  )
}

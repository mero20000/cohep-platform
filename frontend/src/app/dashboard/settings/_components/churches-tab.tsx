'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2, Church, Loader2, ImagePlus, Upload, CheckCircle2, Ban } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField } from '@/components/ui/form-field'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'

interface ChurchItem {
  id: string; name: string; nameAr?: string; slug: string;
  logoUrl?: string;
  country?: string; city?: string; locale: string; timezone: string;
  isActive?: boolean;
  _count?: { schools: number }
}

const emptyChurch = { name: '', nameAr: '', country: '', city: '', defaultLanguage: 'en', timezone: 'UTC', logoUrl: '' }

export function ChurchesTab() {
  const lang = useLanguage()
  const [churches, setChurches] = useState<ChurchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ChurchItem | null>(null)
  const [form, setForm] = useState(emptyChurch)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState<ChurchItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchChurches = () => {
    setLoading(true)
    http.get<ChurchItem[]>('/churches')
      .then((data: ChurchItem[]) => { setChurches(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setChurches([]); setLoading(false) })
  }
  useEffect(() => { fetchChurches() }, [])

  const openCreate = () => { setEditing(null); setForm(emptyChurch); setError(''); setShowForm(true) }

  const openEdit = (c: ChurchItem) => {
    setEditing(c)
    setForm({
      name: c.name, nameAr: c.nameAr || '', country: c.country || '',
      city: c.city || '', defaultLanguage: c.locale, timezone: c.timezone,
      logoUrl: c.logoUrl || '',
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError(lang === 'ar' ? 'اسم الكنيسة مطلوب' : 'Church name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        await http.patch(`/churches/${editing.id}`, form)
      } else {
        await http.post('/churches', form)
      }
      setShowForm(false)
      fetchChurches()
    } catch { setError(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error') }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await http.delete(`/churches/${deleting.id}`)
      setShowDelete(false)
      fetchChurches()
    } catch (err) { console.error('Delete failed', err) }
  }

  const handleToggleActive = async (c: ChurchItem) => {
    setTogglingId(c.id)
    try {
      await http.patch(`/churches/${c.id}`, { isActive: !c.isActive })
      fetchChurches()
    } catch (err) { console.error('Toggle failed', err) }
    setTogglingId(null)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const data = await http.upload<{ url: string }>('/upload/church-logo', formData)
      setForm(prev => ({ ...prev, logoUrl: data.url }))
    } catch { setError(lang === 'ar' ? 'فشل الرفع' : 'Upload failed') }
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'الكنائس' : 'Churches'}</h3>
            <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة مواقع الكنائس والإعدادات' : 'Manage church locations and settings'}</p>
          </div>
          <Button onClick={openCreate} aria-label={lang === 'ar' ? 'إضافة كنيسة' : 'Add church'} size="sm">
            <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة كنيسة' : 'Add Church'}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>
        ) : churches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Church className="h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">{lang === 'ar' ? 'لا توجد كنائس بعد' : 'No churches yet'}</p>
            <Button variant="link" onClick={openCreate} className="mt-2 text-sm font-medium text-blue-700 hover:text-gold-500">{lang === 'ar' ? 'إضافة أول كنيسة' : 'Add first church'}</Button>
          </div>
        ) : (
          <div className="overflow-x-auto table-to-cards">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'اسم الكنيسة' : 'Church Name'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الدولة' : 'Country'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'المدينة' : 'City'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'اللغة' : 'Language'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'المدارس' : 'Schools'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {churches.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                    <td className="px-6 py-3.5" data-label="Church Name">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 overflow-hidden">
                          {c.logoUrl ? (
                            <Image src={`${API_ORIGIN}${c.logoUrl}`} alt="" width={36} height={36} className="h-9 w-9 object-cover"  />
                          ) : (
                            <Church className="h-4 w-4 text-blue-700" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{c.name}</div>
                          {c.nameAr && <div className="text-xs text-gray-400">{c.nameAr}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-600" data-label="Country">{c.country || '—'}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600" data-label="City">{c.city || '—'}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600 uppercase" data-label="Language">{c.locale}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-600" data-label="Schools">{c._count?.schools || 0}</td>
                    <td className="px-6 py-3.5" data-label="Status">
                      {c.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{lang === 'ar' ? 'نشط' : 'Active'}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{lang === 'ar' ? 'غير نشط' : 'Inactive'}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right" data-label="Actions">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleToggleActive(c)} disabled={togglingId === c.id} aria-label={lang === 'ar' ? (c.isActive ? `إيقاف ${c.name}` : `تفعيل ${c.name}`) : (c.isActive ? `Deactivate ${c.name}` : `Activate ${c.name}`)} title={lang === 'ar' ? (c.isActive ? 'إيقاف' : 'تفعيل') : (c.isActive ? 'Deactivate' : 'Activate')}
                          className={`rounded-lg p-1.5 ${c.isActive ? 'text-gray-400 hover:bg-gray-50 active:bg-gray-100 hover:text-gray-600' : 'text-green-500 hover:bg-green-50'}`}>
                          {c.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label={lang === 'ar' ? `تعديل ${c.name}` : `Edit ${c.name}`} title={lang === 'ar' ? 'تعديل' : 'Edit'}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDeleting(c); setShowDelete(true) }} aria-label={lang === 'ar' ? `حذف ${c.name}` : `Delete ${c.name}`} title={lang === 'ar' ? 'حذف' : 'Delete'}
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
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? (lang === 'ar' ? 'تعديل الكنيسة' : 'Edit Church') : (lang === 'ar' ? 'إضافة كنيسة جديدة' : 'Add New Church')} size="lg">
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{error}</div>}
          <FormField label={lang === 'ar' ? 'اسم الكنيسة' : 'Church Name'} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={lang === 'ar' ? 'مثال: كنيسة القديس مارمرقس' : 'e.g. St. Mark Coptic Orthodox Church'} />
          <FormField label={lang === 'ar' ? 'اسم الكنيسة (بالعربية)' : 'Church Name (Arabic)'} value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} placeholder={lang === 'ar' ? 'كنيسة القديس مارمرقس' : 'كنيسة الشريعة القبطية الأرثوذكسية'} />
          <div className="grid grid-cols-2 gap-4">
            <FormField label={lang === 'ar' ? 'الدولة' : 'Country'} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder={lang === 'ar' ? 'مثال: الولايات المتحدة' : 'e.g. United States'} />
            <FormField label={lang === 'ar' ? 'المدينة' : 'City'} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder={lang === 'ar' ? 'مثال: لوس أنجلوس' : 'e.g. Los Angeles'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={lang === 'ar' ? 'اللغة الافتراضية' : 'Default Language'} as="select" value={form.defaultLanguage} onChange={e => setForm({ ...form, defaultLanguage: e.target.value })}>
              <option value="en">{lang === 'ar' ? 'الإنجليزية' : 'English'}</option><option value="ar">{lang === 'ar' ? 'العربية' : 'Arabic'}</option><option value="coptic">{lang === 'ar' ? 'القبطية' : 'Coptic'}</option>
            </FormField>
            <FormField label={lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone'} as="select" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
              <option value="UTC">UTC</option><option value="America/New_York">Eastern (ET)</option><option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option><option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="Europe/London">London (GMT)</option><option value="Africa/Cairo">Cairo (EET)</option>
            </FormField>
          </div>

          {/* Logo Uploads */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{lang === 'ar' ? 'شعار الكنيسة' : 'Church Logo'}</label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden flex-shrink-0">
                  {form.logoUrl ? (
                    <Image src={`${API_ORIGIN}${form.logoUrl}`} alt="Church logo" width={64} height={64} className="h-16 w-16 object-cover"  />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 cursor-pointer" aria-label={lang === 'ar' ? 'رفع شعار الكنيسة' : 'Upload church logo'}>
                    <Upload className="h-3.5 w-3.5" /> {lang === 'ar' ? 'رفع' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  {form.logoUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm(prev => ({ ...prev, logoUrl: '' }))}
                      className="ml-2 text-xs text-red-500 hover:text-red-700">{lang === 'ar' ? 'إزالة' : 'Remove'}</Button>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{lang === 'ar' ? 'PNG, JPG, SVG (الحد الأقصى 5MB)' : 'PNG, JPG, SVG (max 5MB)'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إضافة كنيسة' : 'Add Church')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={lang === 'ar' ? 'حذف الكنيسة' : 'Delete Church'}
        message={deleting ? (lang === 'ar' ? `هل أنت متأكد أنك تريد حذف ${deleting.name}؟${deleting._count?.schools ? ` لديه ${deleting._count.schools} مدرسة مرتبطة.` : ''} لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete ${deleting.name}?${deleting._count?.schools ? ` It has ${deleting._count.schools} school(s) linked.` : ''} This action cannot be undone.`) : ''}
      />
    </>
  )
}

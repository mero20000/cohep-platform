'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Loader2, Search, UserPlus, Power, PowerOff } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormField } from '@/components/ui/form-field'
import { getSchoolId } from '@/lib/school'
import { http } from '@/lib/http-client'
import { useLanguage } from '@/lib/use-language'

interface Role { id: string; name: string; displayName: string }
interface School { id: string; name: string; nameAr?: string; churchId: string }
interface Church { id: string; name: string; nameAr?: string }
interface AppUser {
  id: string; email: string; firstName: string; lastName: string;
  firstNameAr?: string; lastNameAr?: string; phone?: string;
  isActive: boolean; lastLoginAt?: string;
  userRoles?: Array<{ role: Role }>;
  schoolId?: string;
}

export function UsersTab() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [churches, setChurches] = useState<Church[]>([])
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([])
  const lang = useLanguage()

  const isSuperAdmin = currentUserRoles.includes('super_admin')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', firstNameAr: '', lastNameAr: '', phone: '', password: '', roleName: 'servant', schoolId: '', churchId: '' })
  const [saving, setSaving] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState<AppUser | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { schoolId: getSchoolId() }
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      const data = await http.get<any[]>('/users', params)
      setUsers(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const fetchRoles = async () => {
    try { const data = await http.get<any[]>('/users/roles'); setRoles(data) } catch (e) { console.error(e) }
  }

  const fetchSchools = async () => {
    try { const data = await http.get<any[]>('/users/schools'); setSchools(data) } catch (e) { console.error(e) }
  }

  const fetchChurches = async () => {
    try { const data = await http.get<any[]>('/churches'); setChurches(data) } catch (e) { console.error(e) }
  }

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { setCurrentUserRoles(JSON.parse(stored)?.roles || []) } catch {}
    }
    fetchRoles()
    fetchSchools()
    fetchChurches()
  }, [])
  useEffect(() => { fetchUsers() }, [search, roleFilter])

  const filteredSchools = form.churchId
    ? schools.filter(s => s.churchId === form.churchId)
    : schools

  const getSchoolName = (schoolId?: string) => {
    if (!schoolId) return ''
    const s = schools.find(s => s.id === schoolId)
    return s ? s.name : schoolId.slice(0, 8)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ email: '', firstName: '', lastName: '', firstNameAr: '', lastNameAr: '', phone: '', password: '', roleName: 'servant', schoolId: '', churchId: '' })
    setShowForm(true)
  }

  const openEdit = (u: AppUser) => {
    const userSchool = schools.find(s => s.id === u.schoolId)
    setEditing(u)
    setForm({
      email: u.email, firstName: u.firstName, lastName: u.lastName,
      firstNameAr: u.firstNameAr || '', lastNameAr: u.lastNameAr || '',
      phone: u.phone || '', password: '',
      roleName: u.userRoles?.[0]?.role?.name || 'servant',
      schoolId: u.schoolId || '',
      churchId: userSchool?.churchId || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: any = {
        email: form.email,
        firstName: form.firstName, lastName: form.lastName,
        firstNameAr: form.firstNameAr, lastNameAr: form.lastNameAr,
        phone: form.phone, roleName: form.roleName,
        password: form.password || 'Password123!',
      }
      if (isSuperAdmin && form.schoolId) body.schoolId = form.schoolId
      if (editing) {
        await http.patch(`/users/${editing.id}`, body)
      } else {
        const params: Record<string, string> = {}
        if (form.schoolId) params.schoolId = form.schoolId
        await http.post('/users', body, params)
      }
      setShowForm(false)
      fetchUsers()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleToggleActive = async (u: AppUser) => {
    await http.patch(`/users/${u.id}`, { isActive: !u.isActive })
    fetchUsers()
  }

  const handleDelete = async () => {
    if (!deleting) return
    await http.delete(`/users/${deleting.id}`)
    setShowDelete(false)
    fetchUsers()
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{lang === 'ar' ? 'المستخدمين والأدوار' : 'Users & Roles'}</h2>
            <p className="text-sm text-gray-500">{lang === 'ar' ? 'إدارة المستخدمين وتعيين الأدوار وربطهم بالمدارس' : 'Manage users, assign roles, and link them to schools'}</p>
          </div>
          <Button onClick={openCreate} aria-label={lang === 'ar' ? 'إضافة مستخدم' : 'Add user'} size="sm">
            <UserPlus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة مستخدم' : 'Add User'}
          </Button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder={lang === 'ar' ? 'البحث عن المستخدمين...' : 'Search users...'} value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">{lang === 'ar' ? 'جميع الأدوار' : 'All Roles'}</option>
              {roles.filter(r => isSuperAdmin || (r.name !== 'super_admin' && r.name !== 'admin')).map((r: Role) => <option key={r.id} value={r.name}>{r.displayName}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="px-6 py-12"><TableSkeleton rows={5} cols={4} /></div>
        ) : users.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">{lang === 'ar' ? 'لم يتم العثور على مستخدمين.' : 'No users found.'}</div>
        ) : (
          <div className="overflow-x-auto table-to-cards">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'المستخدم' : 'User'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الدور' : 'Role'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'المدرسة' : 'School'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'آخر تسجيل دخول' : 'Last Login'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u: AppUser) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                    <td className="px-6 py-3.5" data-label="User">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5" data-label="Role">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                        {u.userRoles?.[0]?.role?.displayName || (lang === 'ar' ? 'لا يوجد دور' : 'No Role')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-600" data-label="School">
                      {u.userRoles?.some(ur => ur.role.name === 'super_admin') ? '—' : getSchoolName(u.schoolId) || '—'}
                    </td>
                    <td className="px-6 py-3.5" data-label="Status">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {u.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-500" data-label="Last Login">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : (lang === 'ar' ? 'أبدًا' : 'Never')}
                    </td>
                    <td className="px-6 py-3.5 text-right" data-label="Actions">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} aria-label={lang === 'ar' ? `تعديل ${u.firstName} ${u.lastName}` : `Edit ${u.firstName} ${u.lastName}`} title={lang === 'ar' ? 'تعديل' : 'Edit'}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggleActive(u)} aria-label={u.isActive ? (lang === 'ar' ? `إلغاء تفعيل ${u.firstName}` : `Deactivate ${u.firstName}`) : (lang === 'ar' ? `تفعيل ${u.firstName}` : `Activate ${u.firstName}`)} title={u.isActive ? (lang === 'ar' ? 'إلغاء التفعيل' : 'Deactivate') : (lang === 'ar' ? 'تفعيل' : 'Activate')}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                          {u.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDeleting(u); setShowDelete(true) }} aria-label={lang === 'ar' ? `حذف ${u.firstName} ${u.lastName}` : `Delete ${u.firstName} ${u.lastName}`} title={lang === 'ar' ? 'حذف' : 'Delete'}
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
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? (lang === 'ar' ? 'تعديل المستخدم' : 'Edit User') : (lang === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={lang === 'ar' ? 'الاسم الأول' : 'First Name'} required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            <FormField label={lang === 'ar' ? 'الاسم الأخير' : 'Last Name'} required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={lang === 'ar' ? 'الاسم الأول (بالعربية)' : 'First Name (Arabic)'} value={form.firstNameAr} onChange={e => setForm({ ...form, firstNameAr: e.target.value })} dir="rtl" className="arabic-text" />
            <FormField label={lang === 'ar' ? 'الاسم الأخير (بالعربية)' : 'Last Name (Arabic)'} value={form.lastNameAr} onChange={e => setForm({ ...form, lastNameAr: e.target.value })} dir="rtl" className="arabic-text" />
          </div>
          <FormField label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
          <FormField label={lang === 'ar' ? 'الهاتف' : 'Phone'} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          {isSuperAdmin && (!editing || editing.userRoles?.every(ur => ur.role.name !== 'super_admin')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={lang === 'ar' ? 'الكنيسة' : 'Church'} as="select" value={form.churchId} onChange={e => setForm({ ...form, churchId: e.target.value, schoolId: '' })}>
                <option value="">{lang === 'ar' ? 'اختر كنيسة...' : 'Select church...'}</option>
                {churches.map((c: Church) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormField>
              <FormField label={lang === 'ar' ? 'المدرسة' : 'School'} as="select" value={form.schoolId} onChange={e => setForm({ ...form, schoolId: e.target.value })}>
                <option value="">{lang === 'ar' ? 'اختر مدرسة...' : 'Select school...'}</option>
                {filteredSchools.map((s: School) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FormField>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={lang === 'ar' ? 'الدور' : 'Role'} as="select" value={form.roleName} onChange={e => setForm({ ...form, roleName: e.target.value })}>
            {roles.filter(r => isSuperAdmin || (r.name !== 'super_admin' && r.name !== 'admin')).map((r: Role) => <option key={r.id} value={r.name}>{r.displayName}</option>)}
            </FormField>
            {!editing && (
              <FormField label={lang === 'ar' ? 'كلمة المرور' : 'Password'} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={lang === 'ar' ? 'الافتراضي: Password123!' : 'Default: Password123!'} />
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 mt-4">
          <Button variant="outline" onClick={() => setShowForm(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || !form.firstName.trim() || !form.email.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إنشاء مستخدم' : 'Create User')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={lang === 'ar' ? 'حذف المستخدم' : 'Delete User'}
        message={deleting ? (lang === 'ar' ? `هل أنت متأكد أنك تريد حذف ${deleting.firstName} ${deleting.lastName}؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete ${deleting.firstName} ${deleting.lastName}? This action cannot be undone.`) : ''}
      />
    </>
  )
}

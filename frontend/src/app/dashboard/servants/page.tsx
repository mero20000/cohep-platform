'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search, Plus, Pencil, Trash2, X, Loader2, Upload, UserCheck,
  User, Shield, GraduationCap, LayoutGrid, Rows3,
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FormField } from '@/components/ui/form-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useLanguage } from '@/lib/use-language'
import { SERVANT_ROLES, ROLES } from '@/lib/roles'
import { PhoneLink } from '@/app/dashboard/students/_components/phone-link'
import { usePermission } from '@/lib/use-permission'

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001'

interface ServantRole {
  id: string; name: string; displayName: string
}

interface ServantUser {
  id: string; email: string; phone?: string;
  firstName: string; lastName: string;
  firstNameAr?: string; lastNameAr?: string;
  avatarUrl?: string; isActive: boolean;
  lastLoginAt?: string; schoolId: string;
  userRoles: Array<{ role: ServantRole }>;
  metadata?: {
    teachingSubjects?: string[];
    grade?: string;
    levelId?: string;
    groupId?: string;
  }
}

interface Level { id: string; name: string; number: number; status?: string }
interface Group { id: string; name: string; levelId: string; status?: string }
interface LevelWithGroups extends Level { groups: Group[] }

const TEACHING_SUBJECTS = [
  { value: 'coptic_hymns', label: 'Coptic Hymns', arabicLabel: 'ألحان قبطية' },
  { value: 'coptic_rites', label: 'Coptic Rites', arabicLabel: 'الطقوس القبطية' },
  { value: 'coptic_language', label: 'Coptic Language', arabicLabel: 'اللغة القبطية' },
]

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  servant: { bg: 'bg-blue-50', text: 'text-blue-700' },
  group_leader: { bg: 'bg-amber-50', text: 'text-amber-700' },
  level_leader: { bg: 'bg-purple-50', text: 'text-purple-700' },
}

export default function ServantsPage() {
  const { toast } = useToast()
  const lang = useLanguage()
  const { can } = usePermission()
  const [view, setView] = useState<'table' | 'cards'>(() => {
    try { return (localStorage.getItem('servants_view') as 'table' | 'cards') || 'cards' } catch { return 'cards' }
  })

  const toggleView = (v: 'table' | 'cards') => {
    setView(v)
    try { localStorage.setItem('servants_view', v) } catch {}
  }

  const canEdit = can('servant:edit')
  const canDelete = can('servant:delete')
  const canCreate = can('servant:create')

  const [servants, setServants] = useState<ServantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterSubject, setFilterSubject] = useState('')

  const [levels, setLevels] = useState<LevelWithGroups[]>([])
  const [activeGroups, setActiveGroups] = useState<Group[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ServantUser | null>(null)
  const [form, setForm] = useState({
    firstName: '', lastName: '', firstNameAr: '', lastNameAr: '',
    email: '', phone: '', password: '',
    roleName: 'servant',
    levelId: '',
    groupId: '',
    teachingSubjects: [] as string[],
  })
  const [formError, setFormError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState<ServantUser | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [schoolIdentity, setSchoolIdentity] = useState<{ name: string; nameAr?: string; churchName?: string; logoUrl?: string | null; churchLogoUrl?: string | null } | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const schoolId = getSchoolId()

  const fetchServants = useCallback(async () => {
    setLoading(true)
    try {
      const data = await http.get<ServantUser[]>('/servants')
      setServants(data)
    } catch (e: any) {
      toast('error', e?.message || (lang === 'ar' ? 'فشل تحميل الخدام' : 'Failed to load servants'))
    }
    setLoading(false)
  }, [toast])

  const fetchLevels = useCallback(async () => {
    try {
      const data = await http.get<LevelWithGroups[]>('/students/groups/all', { schoolId: getSchoolId() })
      setLevels(data)
      const allGroups = data.flatMap(l => l.groups.filter(g => g.status !== 'inactive'))
      setActiveGroups(allGroups)
    } catch (e: any) {
      toast('error', e?.message || (lang === 'ar' ? 'فشل تحميل المستويات' : 'Failed to load levels'))
    }
  }, [schoolId, toast])

  useEffect(() => { fetchServants(); fetchLevels() }, [fetchServants, fetchLevels])

  useEffect(() => {
    http.get<any>('/users/schools/me').then(s => {
      const churchName = s?.church?.name || s?.church?.schoolNameEn || ''
      const name = s?.church?.schoolNameEn || s?.name || ''
      const nameAr = s?.church?.schoolNameAr || s?.nameAr || ''
      const churchLogoUrl = s?.church?.logoUrl ? API_ORIGIN + s.church.logoUrl : null
      const logoUrl = s?.logoUrl ? API_ORIGIN + s.logoUrl : null
      setSchoolIdentity({ name, nameAr, churchName, logoUrl, churchLogoUrl })
    }).catch(() => {})
  }, [])

  const filteredGroups = useMemo(() => {
    if (!filterLevel) return activeGroups
    return activeGroups.filter(g => g.levelId === filterLevel)
  }, [filterLevel, activeGroups])

  const formGroups = useMemo(() => {
    if (!form.levelId) return []
    const level = levels.find(l => l.id === form.levelId)
    return level?.groups?.filter(g => g.status !== 'inactive') || []
  }, [form.levelId, levels])

  const roleOptions = useMemo<ServantRole[]>(() =>
    SERVANT_ROLES.map(v => {
      const r = ROLES.find(x => x.value === v)!
      return { id: v, name: v, displayName: lang === 'ar' ? r.labelAr : r.label }
    })
  , [lang])

  const filteredServants = useMemo(() => {
    return servants.filter(s => {
      if (search) {
        const q = search.toLowerCase()
        const name = `${s.firstName} ${s.lastName}`.toLowerCase()
        const email = s.email.toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }
      if (filterRole && !s.userRoles?.some(ur => ur.role.name === filterRole)) return false
      const meta = s.metadata || {}
      if (filterLevel && meta.levelId !== filterLevel) return false
      if (filterGroup && meta.groupId !== filterGroup) return false
      if (filterSubject && !meta.teachingSubjects?.includes(filterSubject)) return false
      return true
    })
  }, [servants, search, filterRole, filterLevel, filterGroup, filterSubject])

  const servantRole = (u: ServantUser): ServantRole | undefined => {
    for (const rn of SERVANT_ROLES) {
      const found = u.userRoles?.find(ur => ur.role.name === rn)
      if (found) return found.role
    }
    return undefined
  }

  const stats = useMemo(() => {
    const total = servants.length
    const byRole: Record<string, number> = {}
    const bySubject: Record<string, number> = {}
    servants.forEach(s => {
      const role = servantRole(s)
      const rn = role?.name || 'unknown'
      byRole[rn] = (byRole[rn] || 0) + 1
      const subjects = s.metadata?.teachingSubjects || []
      subjects.forEach(sub => { bySubject[sub] = (bySubject[sub] || 0) + 1 })
    })
    return { total, byRole, bySubject }
  }, [servants])

  const validateEmail = (email: string): string => {
    if (!email.trim()) return lang === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email is required'
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(email.trim())) return lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email format'
    return ''
  }

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true)
    if (field === 'email') {
      setEmailError(validateEmail(value))
    }
  }

  const revokePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPhotoFile(null)
    setPreviewUrl(null)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ firstName: '', lastName: '', firstNameAr: '', lastNameAr: '', email: '', phone: '', password: '', roleName: 'servant', levelId: '', groupId: '', teachingSubjects: [] })
    revokePhoto()
    setFormError('')
    setEmailError('')
    setDirty(false)
    setShowForm(true)
  }

  const openEdit = (s: ServantUser) => {
    const meta = s.metadata || {}
    setEditing(s)
    setForm({
      firstName: s.firstName, lastName: s.lastName,
      firstNameAr: s.firstNameAr || '', lastNameAr: s.lastNameAr || '',
      email: s.email, phone: s.phone || '', password: '',
      roleName: servantRole(s)?.name || 'servant',
      levelId: meta.levelId || '',
      groupId: meta.groupId || '',
      teachingSubjects: meta.teachingSubjects || [],
    })
    revokePhoto()
    setFormError('')
    setEmailError('')
    setDirty(false)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    if (dirty) {
      setShowDiscardConfirm(true)
    } else {
      revokePhoto()
      setShowForm(false)
    }
  }

  const handleSave = async () => {
    setFormError('')
    const err = validateEmail(form.email)
    if (err) {
      setEmailError(err)
      setFormError(err)
      return
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError(lang === 'ar' ? 'الاسم مطلوب' : 'Name is required')
      return
    }
    setSaving(true)
    try {
      let avatarUrl = editing?.avatarUrl
      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        const uploadResult = await http.upload<{ url: string }>('/upload/avatar', fd)
        avatarUrl = uploadResult.url
      }

      const body: Record<string, any> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        firstNameAr: form.firstNameAr.trim() || undefined,
        lastNameAr: form.lastNameAr.trim() || undefined,
        phone: form.phone.trim() || undefined,
        roleName: form.roleName,
        schoolId,
        metadata: {
          teachingSubjects: form.teachingSubjects,
          levelId: form.levelId || undefined,
          groupId: form.groupId || undefined,
        },
      }
      if (avatarUrl) body.avatarUrl = avatarUrl

      body.email = form.email.trim()
      if (editing) {
        await http.patch(`/users/${editing.id}`, body)
        toast('success', lang === 'ar' ? 'تم تحديث الخادم' : 'Servant updated')
      } else {
        body.password = form.password || 'Password123!'
        await http.post('/users', body)
        toast('success', lang === 'ar' ? 'تم إنشاء الخادم' : 'Servant created')
      }
      setShowForm(false)
      revokePhoto()
      fetchServants()
    } catch (err: any) {
      const msg = err?.message || (lang === 'ar' ? 'فشل الحفظ' : 'Failed to save')
      setFormError(msg)
      toast('error', msg)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await http.delete(`/users/${deleting.id}`)
      setShowDelete(false)
      setDeleting(null)
      fetchServants()
      toast('success', lang === 'ar' ? 'تم حذف الخادم' : 'Servant removed')
    } catch (e: any) {
      toast('error', e?.message || (lang === 'ar' ? 'فشل حذف الخادم' : 'Failed to delete servant'))
    }
  }

  const toggleSubject = (sub: string) => {
    setForm(prev => ({
      ...prev,
      teachingSubjects: prev.teachingSubjects.includes(sub)
        ? prev.teachingSubjects.filter(s => s !== sub)
        : [...prev.teachingSubjects, sub],
    }))
  }

  const hasActiveFilters = search || filterRole || filterLevel || filterGroup || filterSubject

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1">
            {schoolIdentity?.churchLogoUrl && (
              <Image src={schoolIdentity.churchLogoUrl} alt={schoolIdentity.churchName || ''} width={40} height={40}
                className="rounded-xl border border-gray-200 object-cover flex-shrink-0 hidden sm:block" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{lang === 'ar' ? 'الخدام' : 'Servants'}</h1>
              {schoolIdentity && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 rounded-lg px-2 py-0.5">{schoolIdentity.churchName}</span>
                  <span className="text-gray-300 text-xs">·</span>
                  <span className="text-xs text-gray-500">{lang === 'ar' && schoolIdentity.nameAr ? schoolIdentity.nameAr : schoolIdentity.name}</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">{lang === 'ar' ? 'إدارة المعلمين وقادة المجموعات وقادة المستويات' : 'Manage teachers, group leaders, and level leaders'}</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Button onClick={openCreate}
              >
              <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة خادم' : 'Add Servant'}
            </Button>
          )}
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            <button type="button" onClick={() => toggleView('cards')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === 'cards' ? 'bg-gold-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
              {lang === 'ar' ? 'بطاقات' : 'Cards'}
            </button>
            <button type="button" onClick={() => toggleView('table')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${view === 'table' ? 'bg-gold-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              <Rows3 className="h-3.5 w-3.5" />
              {lang === 'ar' ? 'جدول' : 'Table'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={lang === 'ar' ? 'إجمالي الخدام' : 'Total Servants'} value={stats.total} icon={UserCheck} iconBg="bg-blue-50" iconColor="text-blue-700" />
        <StatCard label={lang === 'ar' ? 'خدام' : 'Servants'} value={stats.byRole['servant'] || 0} icon={User} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label={lang === 'ar' ? 'قادة مجموعات' : 'Group Leaders'} value={stats.byRole['group_leader'] || 0} icon={Shield} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard label={lang === 'ar' ? 'قادة مستويات' : 'Level Leaders'} value={stats.byRole['level_leader'] || 0} icon={GraduationCap} iconBg="bg-purple-50" iconColor="text-purple-600" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-6 py-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input type="text" aria-label={lang === 'ar' ? 'بحث عن خدام' : 'Search servants'} placeholder={lang === 'ar' ? 'بحث عن خدام...' : 'Search servants...'} value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 ps-9 pe-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <select aria-label={lang === 'ar' ? 'تصفية حسب الدور' : 'Filter by role'} value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">{lang === 'ar' ? 'جميع الأدوار' : 'All Roles'}</option>
            {roleOptions.map(r => (
              <option key={r.name} value={r.name}>{r.displayName}</option>
            ))}
          </select>
          <select aria-label={lang === 'ar' ? 'تصفية حسب المستوى' : 'Filter by level'} value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setFilterGroup('') }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">{lang === 'ar' ? 'جميع المستويات' : 'All Levels'}</option>
            {levels.filter(l => l.status !== 'inactive').map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select aria-label={lang === 'ar' ? 'تصفية حسب المجموعة' : 'Filter by group'} value={filterGroup} onChange={e => setFilterGroup(e.target.value)} disabled={!filterLevel}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50">
            <option value="">{lang === 'ar' ? 'جميع المجموعات' : 'All Groups'}</option>
            {filteredGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select aria-label={lang === 'ar' ? 'تصفية حسب المادة' : 'Filter by subject'} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">{lang === 'ar' ? 'جميع المواد' : 'All Subjects'}</option>
            {TEACHING_SUBJECTS.map(s => (
              <option key={s.value} value={s.value}>{lang === 'ar' ? s.arabicLabel : s.label}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterRole(''); setFilterLevel(''); setFilterGroup(''); setFilterSubject('') }}
              >
              <X className="h-4 w-4 inline ms-1" />{lang === 'ar' ? 'مسح' : 'Clear'}
            </Button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
          </div>
        ) : filteredServants.length === 0 ? (
          <EmptyState
            size="md"
            title={lang === 'ar' ? 'لم يتم العثور على خدام' : 'No servants found'}
            description={servants.length === 0
              ? (lang === 'ar' ? 'ابدأ بإضافة أول خادم إلى مدرستك.' : 'Start by adding your first servant.')
              : (lang === 'ar' ? 'جرب تعديل معايير البحث أو مسح الفلاتر.' : 'Try adjusting your search or clearing the filters.')}
            icon={UserCheck}
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterRole(''); setFilterLevel(''); setFilterGroup(''); setFilterSubject('') }}>
                  <X className="h-4 w-4 inline ms-1" />{lang === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
                </Button>
              ) : canCreate ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />{lang === 'ar' ? 'إضافة خادم' : 'Add Servant'}
                </Button>
              ) : null
            }
          />
        ) : view === 'table' ? (
          <div className="overflow-x-auto table-to-cards">
            <table className="w-full">
              <thead>
                <tr className="border-t border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الخادم' : 'Servant'}</th>
                  <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الدور' : 'Role'}</th>
                  <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 hidden md:table-cell">{lang === 'ar' ? 'المستوى / المجموعة' : 'Level / Group'}</th>
                  <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">{lang === 'ar' ? 'التدريس' : 'Teaching'}</th>
                  <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 hidden lg:table-cell">{lang === 'ar' ? 'الاتصال' : 'Contact'}</th>
                  {(canEdit || canDelete) && (
                    <th className="px-6 py-3 text-end text-xs font-medium uppercase tracking-wider text-gray-500">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredServants.map(s => {
                  const role = servantRole(s)
                  const meta = s.metadata || {}
                  const badgeStyle = ROLE_BADGE[role?.name || 'servant'] || ROLE_BADGE.servant
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors">
                      <td data-label="Servant" className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 overflow-hidden flex-shrink-0">
                            {s.avatarUrl ? (
                              <Image src={`${API_ORIGIN}${s.avatarUrl}`} alt="" width={36} height={36} className="h-9 w-9 object-cover"  />
                            ) : (
                              <span className="text-sm font-bold text-blue-700">{s.firstName[0]}{s.lastName[0]}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                              <span>{s.firstName} {s.lastName}</span>
                              <span title={s.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')} className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${s.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>
                            <div className="text-xs text-gray-500">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Role" className="px-6 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badgeStyle.bg} ${badgeStyle.text} border-transparent`}>
                          {role?.displayName || (lang === 'ar' ? 'خادم' : 'Servant')}
                        </span>
                      </td>
                      <td data-label="Level / Group" className="px-6 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                        {meta.levelId || meta.groupId
                          ? `${levels.find(l => l.id === meta.levelId)?.name || '—'} / ${activeGroups.find(g => g.id === meta.groupId)?.name || '—'}`
                          : '—'}
                      </td>
                      <td data-label="Teaching" className="px-6 py-3.5 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(meta.teachingSubjects || []).length > 0
                            ? meta.teachingSubjects!.map(sub => (
                                <span key={sub} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                  {lang === 'ar' ? (TEACHING_SUBJECTS.find(t => t.value === sub)?.arabicLabel) || sub : (TEACHING_SUBJECTS.find(t => t.value === sub)?.label || sub)}
                                </span>
                              ))
                            : <span className="text-sm text-gray-400">—</span>}
                        </div>
                      </td>
                      <td data-label="Contact" className="px-6 py-3.5 hidden lg:table-cell">
                        <div className="text-sm text-gray-600">
                          {s.phone ? <PhoneLink phone={s.phone} lang={lang} /> : <span className="text-sm text-gray-400">&mdash;</span>}
                        </div>
                      </td>
                      {(canEdit || canDelete) && (
                        <td data-label="Actions" className="px-6 py-3.5 text-end">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={lang === 'ar' ? `تعديل ${s.firstName}` : `Edit ${s.firstName}`} title={lang === 'ar' ? 'تعديل' : 'Edit'}
                                >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" onClick={() => { setDeleting(s); setShowDelete(true) }} aria-label={lang === 'ar' ? `حذف ${s.firstName}` : `Delete ${s.firstName}`} title={lang === 'ar' ? 'حذف' : 'Delete'}
                                >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredServants.map(s => {
              const role = servantRole(s)
              const meta = s.metadata || {}
              const badgeStyle = ROLE_BADGE[role?.name || 'servant'] || ROLE_BADGE.servant
              return (
                <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 overflow-hidden flex-shrink-0">
                        {s.avatarUrl ? (
                          <Image src={`${API_ORIGIN}${s.avatarUrl}`} alt="" width={44} height={44} className="h-11 w-11 object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-blue-700">{s.firstName[0]}{s.lastName[0]}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <span>{s.firstName} {s.lastName}</span>
                          <span title={s.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')} className={`inline-block h-2 w-2 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </div>
                        <div className="text-xs text-gray-500 truncate">{s.email}</div>
                      </div>
                    </div>
                    {(canEdit || canDelete) && (
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={lang === 'ar' ? `تعديل ${s.firstName}` : `Edit ${s.firstName}`} title={lang === 'ar' ? 'تعديل' : 'Edit'}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => { setDeleting(s); setShowDelete(true) }} aria-label={lang === 'ar' ? `حذف ${s.firstName}` : `Delete ${s.firstName}`} title={lang === 'ar' ? 'حذف' : 'Delete'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badgeStyle.bg} ${badgeStyle.text} border-transparent`}>
                      {role?.displayName || (lang === 'ar' ? 'خادم' : 'Servant')}
                    </span>
                    {(meta.levelId || meta.groupId) && (
                      <span className="ms-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {levels.find(l => l.id === meta.levelId)?.name || '—'} / {activeGroups.find(g => g.id === meta.groupId)?.name || '—'}
                      </span>
                    )}
                  </div>

                  {(meta.teachingSubjects || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {meta.teachingSubjects!.slice(0, 2).map(sub => (
                        <span key={sub} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {lang === 'ar' ? (TEACHING_SUBJECTS.find(t => t.value === sub)?.arabicLabel) || sub : (TEACHING_SUBJECTS.find(t => t.value === sub)?.label || sub)}
                        </span>
                      ))}
                      {(meta.teachingSubjects!.length > 2) && (
                        <span className="text-xs text-gray-400">+{meta.teachingSubjects!.length - 2}</span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                    {s.phone ? (
                      <PhoneLink phone={s.phone} lang={lang} />
                    ) : (
                      <span className="text-sm text-gray-400">{lang === 'ar' ? 'لا يوجد رقم' : 'No phone'}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={handleCloseForm} title={editing ? (lang === 'ar' ? 'تعديل الخادم' : 'Edit Servant') : (lang === 'ar' ? 'إضافة خادم جديد' : 'Add New Servant')} size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={handleCloseForm}
              >{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSave} disabled={saving || !!emailError}
              >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (lang === 'ar' ? 'إضافة خادم' : 'Add Servant')}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">{formError}</div>
          )}

          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 overflow-hidden border-2 border-dashed border-gray-300 flex-shrink-0">
              {photoFile ? (
                <Image src={previewUrl || ''} alt="" width={64} height={64} className="h-16 w-16 object-cover"  />
              ) : editing?.avatarUrl ? (
                <Image src={`${API_ORIGIN}${editing.avatarUrl}`} alt="" width={64} height={64} className="h-16 w-16 object-cover"  />
              ) : (
                <User className="h-6 w-6 text-gray-300" />
              )}
            </div>
            <div>
              <Button variant="outline" size="sm" type="button" onClick={() => photoInputRef.current?.click()}
                >
                <Upload className="h-3.5 w-3.5" /> {lang === 'ar' ? 'رفع صورة' : 'Upload Photo'}
              </Button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0] || null
                setPhotoFile(file)
                if (file) {
                  if (previewUrl) URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(URL.createObjectURL(file))
                }
              }} />
              <p className="text-xs text-gray-500 mt-1">{lang === 'ar' ? 'JPG، PNG. حد أقصى 5 ميجابايت' : 'JPG, PNG. Max 5MB'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={lang === 'ar' ? 'الاسم الأول' : 'First Name'} required value={form.firstName} onChange={e => updateField('firstName', e.target.value)} />
            <FormField label={lang === 'ar' ? 'الاسم الأخير' : 'Last Name'} required value={form.lastName} onChange={e => updateField('lastName', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={lang === 'ar' ? 'الاسم الأول (عربي)' : 'First Name (Arabic)'} value={form.firstNameAr} onChange={e => updateField('firstNameAr', e.target.value)} dir="rtl" className="arabic-text" />
            <FormField label={lang === 'ar' ? 'الاسم الأخير (عربي)' : 'Last Name (Arabic)'} value={form.lastNameAr} onChange={e => updateField('lastNameAr', e.target.value)} dir="rtl" className="arabic-text" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FormField label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} required type="email" value={form.email} onChange={e => updateField('email', e.target.value)} onBlur={() => setEmailError(validateEmail(form.email))} error={emailError} />
            </div>
            <FormField label={lang === 'ar' ? 'الهاتف' : 'Phone'} type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} />
          </div>
          {!editing && (
            <FormField label={lang === 'ar' ? 'كلمة المرور' : 'Password'} type="password" value={form.password} onChange={e => updateField('password', e.target.value)} hint={lang === 'ar' ? 'اتركه فارغاً لاستخدام كلمة المرور الافتراضية: Password123!' : 'Leave blank to use the default password: Password123!'} placeholder={lang === 'ar' ? 'أدخل كلمة مرور' : 'Enter a password'} />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'ar' ? 'الدور' : 'Role'}</label>
            <select value={form.roleName} onChange={e => updateField('roleName', e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {roleOptions.map(r => (
                <option key={r.name} value={r.name}>{r.displayName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'ar' ? 'المستوى' : 'Level'}</label>
              <select value={form.levelId} onChange={e => { updateField('levelId', e.target.value); setForm(prev => ({ ...prev, groupId: '' })) }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">{lang === 'ar' ? 'اختر مستوى...' : 'Select level...'}</option>
                {levels.filter(l => l.status !== 'inactive').map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{lang === 'ar' ? 'المجموعة' : 'Group'}</label>
              <select value={form.groupId} onChange={e => updateField('groupId', e.target.value)} disabled={!form.levelId}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50">
                <option value="">{lang === 'ar' ? 'اختر مجموعة...' : 'Select group...'}</option>
                {formGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Teaching Subjects */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{lang === 'ar' ? 'المواد الدراسية' : 'Teaching Subjects'}</label>
            <div className="flex flex-wrap gap-3">
              {TEACHING_SUBJECTS.map(sub => (
                <label key={sub.value} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50 active:bg-gray-100 has-[:checked]:border-gold-500 has-[:checked]:bg-blue-50 transition-colors">
                  <input type="checkbox" checked={form.teachingSubjects.includes(sub.value)}
                    onChange={() => toggleSubject(sub.value)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">{lang === 'ar' ? sub.arabicLabel : sub.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Discard changes confirmation */}
      <ConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); revokePhoto(); setShowForm(false) }}
        title={lang === 'ar' ? 'تجاهل التغييرات' : 'Discard changes?'}
        message={lang === 'ar' ? 'لديك تغييرات غير محفوظة. هل تريد تجاهلها؟' : 'You have unsaved changes. Discard them?'}
        confirmLabel={lang === 'ar' ? 'تجاهل' : 'Discard'}
        cancelLabel={lang === 'ar' ? 'استمر في التعديل' : 'Keep editing'}
        variant="warning"
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={lang === 'ar' ? 'إزالة الخادم' : 'Remove Servant'}
        message={deleting ? (lang === 'ar' ? `هل أنت متأكد من إزالة ${deleting.firstName} ${deleting.lastName} من الخدام؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to remove ${deleting.firstName} ${deleting.lastName} from the servants? This action cannot be undone.`) : ''}
      />
    </div>
  )
}

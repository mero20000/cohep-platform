'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Loader2, AlertCircle, User, ArrowUpDown, ArrowUp, ArrowDown, Eye, Pencil, Trash2, RefreshCw, Star, CheckCircle2, AlertTriangle, MoreVertical, Phone, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { STATUS_STYLE, photoSrc, calcAge, getStudentCompleteness, type Student } from './student-types'
import { PhoneLink } from './phone-link'
import { StudentActionSheet } from './student-action-sheet'
import { toTelHref } from '@/lib/phone'
import { buildPortalShareMessage, buildPortalWhatsAppUrl } from '@/lib/portal-share'
import { usePermission } from '@/lib/use-permission'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'
import { TagBadge } from './student-tags'

interface Pag { page: number; limit: number; total: number; totalPages: number }
interface Props {
  students: Student[]; loading: boolean; fetchError: boolean
  selectedIds: Set<string>; allSelected: boolean
  toggleId: (id: string, shiftKey?: boolean) => void; toggleAll: () => void
  sortKey: string; sortDir: 'asc'|'desc'; toggleSort: (k: string) => void
  onView: (s: Student) => void; onEdit: (s: Student) => void; onDelete: (s: Student) => void
  onRetry: () => void; hasActiveFilters: boolean; onClearFilters: () => void; onOpenCreate: () => void
  pagination: Pag; onPageChange: (p: number) => void
  pageSize?: number; onPageSizeChange?: (s: number) => void
  onPreviewPhoto: (url: string) => void; lang: 'en'|'ar'
  favorites?: string[]; onToggleFavorite?: (id: string) => void
  onStudentUpdated?: (student: Student) => void
}
const COLS = [
  ['name','Student','الطالب'],['code','Student Code','رمز الطالب'],['gender','Gender','الجنس'],
  ['phone','Parent Phone','هاتف ولي الأمر'],['level','Level','المستوى'],['group','Group','المجموعة'],
  ['age','Age','العمر'],['church','Church','الكنيسة'],['grade','Grade','المرحلة'],['status','Status','الحالة'],
] as const

export function StudentTable({ students, loading, fetchError, selectedIds, allSelected, toggleId, toggleAll, sortKey, sortDir, toggleSort, onView, onEdit, onDelete, onRetry, hasActiveFilters, onClearFilters, onOpenCreate, pagination, onPageChange, pageSize, onPageSizeChange, onPreviewPhoto, lang, favorites = [], onToggleFavorite, onStudentUpdated }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [sheetStudent, setSheetStudent] = useState<Student | null>(null)
  const { toast } = useToast()

  const handleStudentUpdated = (student: Student) => {
    setUpdatingId(null)
    onStudentUpdated?.(student)
  }
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  // Explicit (menu-driven) status change used by the mobile sheet; the desktop pill keeps its inline toggle.
  const approve = async (student: Student) => {
    setUpdatingId(student.id)
    try {
      await http.patch(`/students/${student.id}/approve`, {}, { schoolId: getSchoolId() })
      handleStudentUpdated({ ...student, status: 'active' })
      toast('success', t('Student approved', 'تم اعتماد الطالب'))
    } catch (e: any) {
      handleStudentUpdated(student)
      toast('error', e?.message || t('Failed to approve', 'فشل الاعتماد'))
    }
  }
  const toggleStatus = async (student: Student) => {
    const nextStatus = student.status === 'active' ? 'inactive' : 'active'
    setUpdatingId(student.id)
    try {
      await http.put(`/students/${student.id}`, { status: nextStatus })
      handleStudentUpdated({ ...student, status: nextStatus })
      toast('success', lang === 'ar' ? `تم تغيير الحالة إلى ${nextStatus === 'active' ? 'نشط' : 'غير نشط'}` : `Status changed to ${nextStatus}`)
    } catch (e: any) {
      handleStudentUpdated(student)
      toast('error', e?.message || t('Failed to update status', 'فشل تحديث الحالة'))
    }
  }
  if (loading) return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="animate-pulse">
        <div className="h-12 bg-gray-100 border-b border-gray-200" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="h-8 w-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-gray-200 rounded" />
              <div className="h-2.5 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
            <div className="h-5 w-12 bg-gray-200 rounded" />
            <div className="h-5 w-12 bg-gray-200 rounded" />
            <div className="h-5 w-12 bg-gray-200 rounded" />
            <div className="h-5 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
  if (fetchError) return (
    <div className="rounded-xl border border-gray-200 bg-white flex flex-col items-center justify-center py-16">
      <AlertCircle className="h-12 w-12 text-red-300" />
      <p className="mt-3 text-sm font-medium text-red-600">{t('Failed to load students','تعذر تحميل الطلاب')}</p>
      <Button onClick={onRetry} variant="outline" className="mt-4 inline-flex items-center gap-1.5">
        <RefreshCw className="h-4 w-4" /> {t('Retry','إعادة المحاولة')}
      </Button>
    </div>
  )
  if (students.length === 0) return (
    <div className="rounded-xl border border-gray-200 bg-white flex flex-col items-center justify-center py-16">
      <User className="h-12 w-12 text-gray-300" />
      {hasActiveFilters ? (
        <>
          <p className="mt-3 text-sm font-medium text-gray-700">{t('No students match your filters','لا يوجد طلاب يطابقون الفلتر')}</p>
          <p className="mt-1 text-xs text-gray-400">{t('Try adjusting your search or filter criteria','حاول تعديل معايير البحث أو الفلتر')}</p>
          <Button onClick={onClearFilters} className="mt-4 inline-flex items-center gap-1.5">{t('Clear filters','مسح الفلتر')}</Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium text-gray-700">{t('No students enrolled yet','لا يوجد طلاب مسجلين بعد')}</p>
          <p className="mt-1 text-xs text-gray-400">{t('Start by adding your first student to get going','ابدأ بإضافة أول طالب للمتابعة')}</p>
          <Button onClick={onOpenCreate} className="mt-4 inline-flex items-center gap-1.5">{t('Add first student','إضافة أول طالب')}</Button>
        </>
      )}
    </div>
  )
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-2 py-1.5">
          <label className="flex h-11 items-center gap-2 ps-2 pe-1 text-xs font-medium text-gray-600">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t('Select all on this page','تحديد الكل في هذه الصفحة')} className="h-4 w-4 rounded border-gray-300 accent-gold-600" />
            {t('All','الكل')}
          </label>
          <div className="ms-auto flex items-center gap-1">
            <select aria-label={t('Sort by','ترتيب حسب')} value={sortKey}
              onChange={e => { if (e.target.value && e.target.value !== sortKey) toggleSort(e.target.value) }}
              className="h-11 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold-500">
              <option value="">{t('Sort: newest','الترتيب: الأحدث')}</option>
              {COLS.filter(([k]) => k !== 'phone').map(([k, en, ar]) => <option key={k} value={k}>{lang === 'ar' ? ar : en}</option>)}
            </select>
            <button type="button" disabled={!sortKey} onClick={() => toggleSort(sortKey)}
              aria-label={sortDir === 'asc' ? t('Ascending','تصاعدي') : t('Descending','تنازلي')}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40">
              {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
        {students.map(s => {
          const parentPhone = s.metadata?.phone?.trim()
          const age = calcAge(s.dateOfBirth)
          const facts = [
            s.level?.name ? `${s.level.name}${s.group?.name ? ` · ${s.group.name}` : ''}` : '',
            s.grade?.name || '',
            s.gender ? (s.gender === 'female' ? t('Female','أنثى') : t('Male','ذكر')) : '',
            age > 0 ? `${age} ${t('yrs','سنة')}` : '',
          ].filter(Boolean)
          return (
          <div key={s.id} className={`flex items-start gap-1 ps-1 pe-1 py-2 border-s-4 ${STATUS_STYLE[s.status]?.bar || 'border-s-transparent'} ${selectedIds.has(s.id) ? 'bg-gold-50/40' : ''}`}>
            <RowCheckbox checked={selectedIds.has(s.id)} onChange={e => toggleId(s.id,(e.nativeEvent as MouseEvent).shiftKey)} ariaLabel={t(`Select ${s.firstName} ${s.lastName}`,`تحديد ${s.firstName} ${s.lastName}`)} />
            <div role="button" tabIndex={0} onClick={() => onView(s)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(s) } }}
              className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span onClick={e => e.stopPropagation()}><AvatarCell s={s} size={44} onPreview={onPreviewPhoto} lang={lang} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-gray-900">{s.firstName} {s.lastName}</span>
                  <CompletenessIndicator student={s} lang={lang} />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs text-gray-500">#{s.studentCode}</span>
                  <Badge variant={STATUS_STYLE[s.status]?.variant || 'default'}>{s.status === 'active' ? t('Active','نشط') : s.status === 'inactive' ? t('Inactive','غير نشط') : s.status === 'graduated' ? t('Graduated','متخرج') : s.status === 'pending' ? t('Pending Review','في الانتظار') : s.status}</Badge>
                  {favorites.includes(s.id) && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-label={t('Favorite','مفضل')} />}
                </div>
                {facts.length > 0 && <p className="mt-1 text-xs leading-relaxed text-gray-500">{facts.join(' • ')}</p>}
                {s.churchName && <p className="text-xs text-gray-400 break-words">{s.churchName}</p>}
                {(parentPhone || s.portalAccessKey) && (
                  <div className="mt-2 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                    {parentPhone && (
                      <a href={toTelHref(parentPhone)} aria-label={t(`Call parent ${parentPhone}`,`اتصال بولي الأمر ${parentPhone}`)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700 active:bg-green-100">
                        <Phone className="h-3.5 w-3.5" /><span dir="ltr">{parentPhone}</span>
                      </a>
                    )}
                    {s.portalAccessKey && (
                      <a href={buildPortalWhatsAppUrl(parentPhone, buildPortalShareMessage({ firstName: s.firstName, portalKey: s.portalAccessKey }))}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 active:bg-emerald-100">
                        <Send className="h-3.5 w-3.5" />{t('Share portal','مشاركة البوابة')}
                      </a>
                    )}
                  </div>
                )}
                {(s.metadata?.tags?.length ?? 0) > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {s.metadata!.tags!.slice(0,3).map(tag => <TagBadge key={tag} tag={tag} size="xs" />)}
                    {s.metadata!.tags!.length > 3 && <span className="text-[11px] text-gray-400">+{s.metadata!.tags!.length - 3}</span>}
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setSheetStudent(s)} aria-label={t(`Actions for ${s.firstName} ${s.lastName}`,`إجراءات ${s.firstName} ${s.lastName}`)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 active:bg-gray-200">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
          )
        })}
        </div>
      </div>
      {sheetStudent && (
        <StudentActionSheet student={sheetStudent} lang={lang} isFavorite={favorites.includes(sheetStudent.id)}
          onClose={() => setSheetStudent(null)} onView={onView} onEdit={onEdit} onDelete={onDelete}
          onToggleFavorite={onToggleFavorite} onToggleStatus={toggleStatus} onApprove={approve} />
      )}
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-2 py-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 accent-gold-600" />
              </th>
              {COLS.map(([key, en, ar]) => (
                <th key={key} scope="col" onClick={() => toggleSort(key)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(key) } }}
                  role="button" tabIndex={0}
                  aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-gray-700 ${key!=='name'&&key!=='status'?'hidden md:table-cell':''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset`}>
                  <span className="inline-flex items-center gap-1">
                    {lang==='ar'?ar:en}
                    <ArrowUpDown className={`h-3 w-3 transition-opacity ${sortKey===key?'opacity-100 text-gold-700':'opacity-30'}`} />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wider text-gray-500">{lang==='ar'?'الإجراءات':'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(s => (
              <tr key={s.id} onClick={() => onView(s)} className={`hover:bg-gray-100 transition-colors border-s-4 cursor-pointer ${STATUS_STYLE[s.status]?.bar||'border-s-transparent'}`}>
                <td className="px-2 py-3" onClick={e => e.stopPropagation()}><RowCheckbox checked={selectedIds.has(s.id)} onChange={e=>toggleId(s.id,(e.nativeEvent as MouseEvent).shiftKey)} ariaLabel={t(`Select ${s.firstName} ${s.lastName}`,`تحديد ${s.firstName} ${s.lastName}`)} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                <AvatarCell s={s} size={36} onPreview={onPreviewPhoto} lang={lang} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</span>
                        <CompletenessIndicator student={s} lang={lang} />
                      </div>
                      {s.firstNameAr && <div className="text-xs text-gray-400 truncate">{s.firstNameAr} {s.lastNameAr}</div>}
                      {(s.metadata?.tags?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {s.metadata!.tags!.slice(0,3).map(tag => <TagBadge key={tag} tag={tag} size="xs" />)}
                          {s.metadata!.tags!.length > 3 && <span className="text-[10px] text-gray-400">+{s.metadata!.tags!.length - 3}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600 font-mono">{s.studentCode}</td>
                <td className="hidden md:table-cell px-4 py-3"><span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${s.gender==='female'?'bg-semantic-gender-female-bg text-semantic-gender-female':'bg-semantic-gender-male-bg text-semantic-gender-male'}`}>{s.gender==='female'?t('Female','أنثى'):t('Male','ذكر')}</span></td>
                <td className="hidden md:table-cell px-4 py-3"><PhoneLink phone={s.metadata?.phone||''} lang={lang} share={{firstName:s.firstName,portalKey:s.portalAccessKey}} /></td>
                <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-900">{s.level?.name||'—'}</td>
                <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-900">{s.group?.name||'—'}</td>
                <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">{calcAge(s.dateOfBirth)}</td>
                <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">{s.churchName||'—'}</td>
                <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-900">{s.grade?.name||'—'}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} lang={lang} student={s} onUpdated={handleStudentUpdated} onUpdating={setUpdatingId} isUpdating={updatingId === s.id} /></td>
                <td className="px-4 py-3 text-end" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {onToggleFavorite && (
                      <button onClick={() => onToggleFavorite(s.id)} aria-label={favorites.includes(s.id) ? (lang === 'ar' ? 'إزالة من المفضلة' : 'Remove from favorites') : (lang === 'ar' ? 'إضافة للمفضلة' : 'Add to favorites')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <Star className={`h-4 w-4 ${favorites.includes(s.id) ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
                      </button>
                    )}
                    <Actions s={s} onView={onView} onEdit={onEdit} onDelete={onDelete} lang={lang} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100">
<Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onPageChange={onPageChange} pageSize={pageSize} onPageSizeChange={onPageSizeChange} lang={lang} />
      </div>
    </div>
  )
}
function AvatarCell({ s, size, onPreview, lang }: { s: Student; size: number; onPreview: (u: string) => void; lang: 'en'|'ar' }) {
  const [photoLoading, setPhotoLoading] = useState(true)
  const [photoBroken, setPhotoBroken] = useState(false)
  if (s.photoUrl && !photoBroken) return <Button type="button" variant="ghost" size="icon" onClick={() => onPreview(photoSrc(s.photoUrl))} aria-label={`${lang==='ar'?'عرض صورة':'View photo'} ${s.firstName} ${s.lastName}`} className="flex-shrink-0 relative" style={{width:size+8,height:size+8}}><div className={`absolute inset-0 rounded-full bg-gray-200 animate-pulse flex items-center justify-center ${photoLoading?'':'hidden'}`}><Loader2 className="h-3 w-3 text-gray-400 animate-spin" /></div><Image src={photoSrc(s.photoUrl)} alt={`${s.firstName} ${s.lastName} profile photo`} width={size} height={size} onLoadingComplete={()=>setPhotoLoading(false)} onError={()=>{setPhotoBroken(true);setPhotoLoading(false)}} className="rounded-full object-cover border border-gray-200 cursor-pointer hover:ring-2 hover:ring-gold-400" style={{width:size,height:size}} /></Button>
  return <div className={`flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0 ${s.gender==='female'?'bg-semantic-gender-female-bg text-semantic-gender-female':'bg-semantic-gender-male-bg text-semantic-gender-male'}`} style={{width:size,height:size}}>{s.firstName[0]}{s.lastName?.[0]??''}</div>
}
function RowCheckbox({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; ariaLabel: string }) {
  return (
    <label className="-ms-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel} onClick={e => e.stopPropagation()} className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-gold-600" />
    </label>
  )
}
function StatusBadge({ status, lang, student, onUpdated, onUpdating, isUpdating }: { status: string; lang: 'en'|'ar'; student?: Student; onUpdated?: (s: Student) => void; onUpdating?: (id: string) => void; isUpdating?: boolean }) {
  const label = status==='active'?(lang==='ar'?'نشط':'Active'):status==='inactive'?(lang==='ar'?'غير نشط':'Inactive'):status==='graduated'?(lang==='ar'?'متخرج':'Graduated'):status==='pending'?(lang==='ar'?'في الانتظار':'Pending Review'):status
  const { toast } = useToast()
  const { can } = usePermission()

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!student || !can('student:edit') || isUpdating) return

    const nextStatus = status === 'active' ? 'inactive' : 'active'
    onUpdating?.(student.id)
    try {
      await http.put(`/students/${student.id}`, { status: nextStatus })
      onUpdated?.({ ...student, status: nextStatus })
      toast('success', lang === 'ar' ? `تم تغيير الحالة إلى ${nextStatus === 'active' ? 'نشط' : 'غير نشط'}` : `Status changed to ${nextStatus}`)
    } catch (e: any) {
      onUpdated?.(student)
      toast('error', e?.message || (lang === 'ar' ? 'فشل تحديث الحالة' : 'Failed to update status'))
    }
  }

  if (student && status === 'pending' && can('student:approve')) {
    const approve = async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isUpdating) return
      onUpdating?.(student.id)
      try {
        await http.patch(`/students/${student.id}/approve`, {}, { schoolId: getSchoolId() })
        onUpdated?.({ ...student, status: 'active' })
        toast('success', lang === 'ar' ? 'تم اعتماد الطالب' : 'Student approved')
      } catch (err: any) {
        onUpdated?.(student)
        toast('error', err?.message || (lang === 'ar' ? 'فشل الاعتماد' : 'Failed to approve'))
      }
    }
    return (
      <button onClick={approve} disabled={isUpdating}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-60"
        title={lang === 'ar' ? 'اعتماد الطالب' : 'Approve student'}>
        {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {lang === 'ar' ? 'اعتماد' : 'Approve'}
      </button>
    )
  }

  if (student && can('student:edit') && (status === 'active' || status === 'inactive')) {
    return (
      <button
        onClick={handleStatusToggle}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-all cursor-pointer ${
          status === 'active'
            ? 'bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-60'
            : 'bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-60'
        }`}
        title={lang === 'ar' ? 'انقر لتغيير الحالة' : 'Click to toggle status'}>
        {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {label}
      </button>
    )
  }

  return <Badge variant={STATUS_STYLE[status]?.variant||'default'}>{label}</Badge>
}

function Actions({ s, onView, onEdit, onDelete, lang }: { s: Student; onView: (s:Student)=>void; onEdit: (s:Student)=>void; onDelete: (s:Student)=>void; lang: 'en'|'ar' }) {
  const { can } = usePermission()
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={() => onView(s)} aria-label={`View ${s.firstName} ${s.lastName}`} title={lang==='ar'?'عرض التفاصيل':'View details'} className="hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></Button>
      {can('student:edit')&&<Button variant="ghost" size="icon" onClick={() => onEdit(s)} aria-label={`Edit ${s.firstName} ${s.lastName}`} title={lang==='ar'?'تعديل البيانات':'Edit student'} className="hover:bg-amber-50 hover:text-amber-600"><Pencil className="h-4 w-4" /></Button>}
      {can('student:delete')&&<Button variant="ghost" size="icon" onClick={() => onDelete(s)} aria-label={`Delete ${s.firstName} ${s.lastName}`} title={lang==='ar'?'حذف الطالب':'Delete student'} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>}
    </div>
  )
}

function CompletenessIndicator({ student, lang }: { student: Student; lang: 'en'|'ar' }) {
  const { complete, missing, pct } = getStudentCompleteness(student)
  if (complete) return null
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const missingLabels = missing.map(f => lang === 'ar' ? f.ar : f.en).join(', ')
  return (
    <span
      title={`${t('Incomplete','غير مكتمل')} (${pct}%) — ${t('Missing','ينقص')}: ${missingLabels}`}
      className="inline-flex items-center gap-0.5 shrink-0 rounded-full bg-orange-100 text-orange-700 px-1.5 py-0.5 text-[10px] font-medium cursor-help"
    >
      <AlertTriangle className="h-3 w-3" />
      {pct}%
    </span>
  )
}

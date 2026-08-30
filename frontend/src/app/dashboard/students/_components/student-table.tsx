'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Loader2, AlertCircle, User, ArrowUpDown, Eye, Pencil, Trash2, RefreshCw, Star, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { STATUS_STYLE, photoSrc, calcAge, type Student } from './student-types'
import { PhoneLink } from './phone-link'
import { usePermission } from '@/lib/use-permission'
import { http } from '@/lib/http-client'
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
  ['phone','Phone','رقم الهاتف'],['level','Level','المستوى'],['group','Group','المجموعة'],
  ['age','Age','العمر'],['church','Church','الكنيسة'],['grade','Grade','المرحلة'],['status','Status','الحالة'],
] as const

export function StudentTable({ students, loading, fetchError, selectedIds, allSelected, toggleId, toggleAll, sortKey, sortDir, toggleSort, onView, onEdit, onDelete, onRetry, hasActiveFilters, onClearFilters, onOpenCreate, pagination, onPageChange, pageSize, onPageSizeChange, onPreviewPhoto, lang, favorites = [], onToggleFavorite, onStudentUpdated }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleStudentUpdated = (student: Student) => {
    setUpdatingId(null)
    onStudentUpdated?.(student)
  }
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
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
      <div className="md:hidden divide-y divide-gray-100">
        {students.map(s => (
          <div key={s.id} onClick={() => onView(s)} className={`px-4 py-3 border-s-4 ${STATUS_STYLE[s.status]?.bar || 'border-s-transparent'} cursor-pointer hover:bg-gray-50`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <RowCheckbox checked={selectedIds.has(s.id)} onChange={e => toggleId(s.id,(e.nativeEvent as MouseEvent).shiftKey)} ariaLabel={t(`Select ${s.firstName} ${s.lastName}`,`تحديد ${s.firstName} ${s.lastName}`)} />
                    <AvatarCell s={s} size={36} onPreview={onPreviewPhoto} lang={lang} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gray-500">#{s.studentCode}</span>
                    <StatusBadge status={s.status} lang={lang} student={s} onUpdated={handleStudentUpdated} onUpdating={setUpdatingId} isUpdating={updatingId === s.id} />
                  </div>
                  {(s.metadata?.tags?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {s.metadata!.tags!.slice(0,3).map(tag => <TagBadge key={tag} tag={tag} size="xs" />)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {onToggleFavorite && (
                  <button onClick={() => onToggleFavorite(s.id)} aria-label={favorites.includes(s.id) ? (lang === 'ar' ? 'إزالة من المفضلة' : 'Remove from favorites') : (lang === 'ar' ? 'إضافة للمفضلة' : 'Add to favorites')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <Star className={`h-4 w-4 ${favorites.includes(s.id) ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
                  </button>
                )}
                <Actions s={s} onView={onView} onEdit={onEdit} onDelete={onDelete} lang={lang} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 ms-10">
              {s.level?.name && <span>{s.level.name}{s.group?.name ? ` · ${s.group.name}` : ''}</span>}
              {s.gender && <span>{s.gender === 'female' ? t('Female','أنثى') : t('Male','ذكر')}</span>}
              {s.grade?.name && <span>{s.grade.name}</span>}
              {s.churchName && <span className="truncate max-w-[120px]">{s.churchName}</span>}
              {calcAge(s.dateOfBirth) > 0 && <span>{calcAge(s.dateOfBirth)} {t('yrs','سنة')}</span>}
            </div>
          </div>
        ))}
      </div>
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
                      <div className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</div>
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
                <td className="hidden md:table-cell px-4 py-3"><PhoneLink phone={s.metadata?.phone||''} lang={lang} /></td>
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
  if (s.photoUrl) return <Button type="button" variant="ghost" size="icon" onClick={() => onPreview(photoSrc(s.photoUrl))} aria-label={`${lang==='ar'?'عرض صورة':'View photo'} ${s.firstName} ${s.lastName}`} className="flex-shrink-0 relative" style={{width:size+8,height:size+8}}><div className={`absolute inset-0 rounded-full bg-gray-200 animate-pulse flex items-center justify-center ${photoLoading?'':'hidden'}`}><Loader2 className="h-3 w-3 text-gray-400 animate-spin" /></div><Image src={photoSrc(s.photoUrl)} alt={`${s.firstName} ${s.lastName} profile photo`} width={size} height={size} onLoadingComplete={()=>setPhotoLoading(false)} className="rounded-full object-cover border border-gray-200 cursor-pointer hover:ring-2 hover:ring-gold-400" style={{width:size,height:size}} /></Button>
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
  const label = status==='active'?(lang==='ar'?'نشط':'Active'):status==='inactive'?(lang==='ar'?'غير نشط':'Inactive'):status==='graduated'?(lang==='ar'?'متخرج':'Graduated'):status
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

  if (student && can('student:edit') && status !== 'graduated') {
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
      <Button variant="ghost" size="icon" onClick={() => onView(s)} title={lang==='ar'?'عرض التفاصيل':'View details'} className="hover:bg-blue-50 hover:text-blue-600"><Eye className="h-4 w-4" /></Button>
      {can('student:edit')&&<Button variant="ghost" size="icon" onClick={() => onEdit(s)} title={lang==='ar'?'تعديل البيانات':'Edit student'} className="hover:bg-amber-50 hover:text-amber-600"><Pencil className="h-4 w-4" /></Button>}
      {can('student:delete')&&<Button variant="ghost" size="icon" onClick={() => onDelete(s)} title={lang==='ar'?'حذف الطالب':'Delete student'} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>}
    </div>
  )
}

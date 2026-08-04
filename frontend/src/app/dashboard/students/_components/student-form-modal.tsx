'use client'
import Image from 'next/image'
import { useState, useEffect, useRef, useCallback, useActionState, startTransition } from 'react'
import { X, Loader2, Camera, User } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { Button } from '@/components/ui/button'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'
import { usePermission } from '@/lib/use-permission'
import { emptyForm, photoSrc, type Student, type StudentForm, type Level, type Group, type ChurchItem } from './student-types'
import { gradeOptionsForLevel, resolveGroupId } from '@/lib/grade-groups'
import { fetchGradeGroups } from '@/lib/school'

interface Props {
  student: Student | null; activeLevels: Level[]; allGroups: Group[]
  churches: ChurchItem[]; gradeOptions: string[]
  onClose: () => void; onSuccess: (page: number) => void
  currentPage: number; onOptimisticAdd: (s: Student) => void; lang: 'en'|'ar'
}
export function StudentFormModal({ student, activeLevels, allGroups, churches, gradeOptions, onClose, onSuccess, currentPage, onOptimisticAdd, lang }: Props) {
  const { toast } = useToast()
  const { can } = usePermission()
  const dialogRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<StudentForm>(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string,string>>({})
  const [gradeGroups, setGradeGroups] = useState<Awaited<ReturnType<typeof fetchGradeGroups>>>([])
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const blobRef = useRef('')
  const revoke = useCallback(() => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); blobRef.current = '' }, [])
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const ic = (err?: string) => `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${err?'border-red-300 focus:border-red-500 focus:ring-red-500':'border-gray-300 focus:border-gold-500 focus:ring-blue-500'}`
  const formGroups = form.levelId ? allGroups.filter(g => g.levelId === form.levelId||g.id===student?.groupId) : []
  const comboGrades = form.levelId ? gradeOptionsForLevel(gradeGroups, form.levelId) : []
  const mappedGrade = comboGrades.length > 0 ? comboGrades : gradeOptions

  useEffect(() => {
    fetchGradeGroups().then(setGradeGroups).catch(() => {})
  }, [])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    if (student && gradeGroups.length > 0) {
      const grade = student.schoolGrade || ''
      const groupId = resolveGroupId(gradeGroups, student.levelId, grade) || student.groupId
      setForm(prev => ({ ...prev, groupId }))
    }
  }, [student?.id, gradeGroups])

  useEffect(() => {
    revoke(); setPhotoFile(null); setFormErrors({})
    if (student) {
      setForm({ name:`${student.firstName} ${student.lastName}`.trim(), firstNameAr:student.firstNameAr||'', lastNameAr:student.lastNameAr||'', dateOfBirth:student.dateOfBirth.split('T')[0], gender:student.gender, churchName:student.churchName||'', schoolGrade:student.schoolGrade||'', levelId:student.levelId, groupId:student.groupId, groupName:student.group?.name||'', photoUrl:student.photoUrl||'', status:student.status, phone:student.metadata?.phone||'', email:student.metadata?.email||'', address:student.metadata?.address||'', notes:student.metadata?.notes||'', churchToolId:student.metadata?.churchToolId||'', parentEmail:student.parentEmail||'' })
    } else { setForm(emptyForm) }
  }, [student?.id])
  useEffect(() => () => revoke(), [])

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phoneRe = /^[\d\s\-\+\(\)]{6,20}$/
  const setField = (f: string, v: string) => {
    setForm(prev => ({ ...prev, [f]: v }))
    const req = ['name','dateOfBirth','levelId','groupId']
    let err = ''
    if (req.includes(f)&&!v.trim()) err = t('This field is required','هذا الحقل مطلوب')
    else if (f==='email'&&v&&!emailRe.test(v)) err = t('Invalid email format','صيغة البريد غير صحيحة')
    else if (f==='phone'&&v&&!phoneRe.test(v)) err = t('Invalid phone format','صيغة الهاتف غير صحيحة')
    setFormErrors(e => ({ ...e, [f]: err }))
  }
  const [formState, saveAction, isSaving] = useActionState(async (_prev: {error:string}, data: {form:StudentForm;photoFile:File|null;editing:Student|null}) => {
    if (!data.form.name||!data.form.dateOfBirth||!data.form.levelId||!data.form.groupId)
      return { error: t('Please fill all required fields','يرجى ملء جميع الحقول المطلوبة') }
    const parts = data.form.name.trim().split(/\s+/)
    const firstName = parts[0]||''; const lastName = parts.slice(1).join(' ')||''
    try {
      let photoUrl = data.form.photoUrl
      if (data.photoFile) { const fd=new FormData(); fd.append('file',data.photoFile); photoUrl=(await http.upload<{url:string}>('/upload/student-photo',fd)).url }
      const { name:_n, ...rest } = data.form
      const ctid = data.form.churchToolId
      const body: Record<string,unknown> = { ...rest, firstName, lastName, photoUrl, firstNameAr:data.form.firstNameAr||undefined, lastNameAr:data.form.lastNameAr||undefined, churchName:data.form.churchName||undefined, schoolGrade:data.form.schoolGrade||undefined, churchToolId:ctid }
      if (!data.editing) {
        onOptimisticAdd({...body,id:`temp-${Date.now()}`,photoUrl,enrollmentDate:new Date().toISOString(),level:{id:data.form.levelId,name:'',number:0},group:{id:data.form.groupId,name:''}} as Student)
        await http.post('/students',body,{schoolId:getSchoolId()})
      } else { await http.put(`/students/${data.editing.id}`,body,{schoolId:getSchoolId()}) }
      toast('success',!data.editing?t('Student created','تم إنشاء الطالب'):t('Student updated','تم تحديث الطالب'))
      onClose(); onSuccess(currentPage); return {error:''}
    } catch (err:unknown) {
      const msg = err instanceof Error?err.message:t('Connection error','خطأ في الاتصال')
      toast('error',msg); onSuccess(currentPage); return {error:msg}
    }
  },{error:''})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={student?t('Edit Student','تعديل الطالب'):t('Add New Student','إضافة طالب جديد')} className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col outline-none" onClick={e=>e.stopPropagation()}
        onSubmit={e=>{e.preventDefault();startTransition(()=>saveAction({form,photoFile,editing:student}))}}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">{student?t('Edit Student','تعديل الطالب'):t('Add New Student','إضافة طالب جديد')}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {formState.error&&<div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formState.error}</div>}
          <div>
            <label htmlFor="sf-name" className="block text-sm font-medium text-gray-700">{t('Name *','الاسم *')}</label>
            <input id="sf-name" type="text" value={form.name} onChange={e=>setField('name',e.target.value)} placeholder={t('Full name','الاسم الكامل')} className={ic(formErrors.name)} />
            {formErrors.name&&<p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="sf-name-ar" className="block text-sm font-medium text-gray-700">{t('First Name (Arabic)','الاسم الأول (عربي)')}</label><input id="sf-name-ar" type="text" value={form.firstNameAr} onChange={e=>setForm({...form,firstNameAr:e.target.value})} className={ic()} /></div>
            <div><label htmlFor="sf-last-ar" className="block text-sm font-medium text-gray-700">{t('Last Name (Arabic)','الاسم الأخير (عربي)')}</label><input id="sf-last-ar" type="text" value={form.lastNameAr} onChange={e=>setForm({...form,lastNameAr:e.target.value})} className={ic()} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-dob" className="block text-sm font-medium text-gray-700">{t('Date of Birth *','تاريخ الميلاد *')}</label>
              <DatePicker id="sf-dob" value={form.dateOfBirth} onChange={v=>setField('dateOfBirth',v)} max={new Date().toISOString().split('T')[0]} className={ic(formErrors.dateOfBirth)} />
              {formErrors.dateOfBirth&&<p className="mt-1 text-xs text-red-500">{formErrors.dateOfBirth}</p>}
            </div>
            <div><label htmlFor="sf-gender" className="block text-sm font-medium text-gray-700">{t('Gender *','الجنس *')}</label><select id="sf-gender" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} className={ic()}><option value="male">{t('Male','ذكر')}</option><option value="female">{t('Female','أنثى')}</option></select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-level" className="block text-sm font-medium text-gray-700">{t('Level *','المستوى *')}</label>
              <select id="sf-level" value={form.levelId} onChange={e=>{setField('levelId',e.target.value);setForm(prev=>({...prev,levelId:e.target.value,schoolGrade:'',groupId:''}))}} className={ic(formErrors.levelId)}>
                <option value="">{t('Select level','اختر المستوى')}</option>
                {activeLevels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {formErrors.levelId&&<p className="mt-1 text-xs text-red-500">{formErrors.levelId}</p>}
            </div>
            <div>
              <label htmlFor="sf-group" className="block text-sm font-medium text-gray-700">{t('Group','المجموعة')}</label>
              <div id="sf-group" className={`${ic()} flex items-center justify-between bg-gray-50`}>
                <span className={form.groupId?'text-gray-900':'text-gray-400'}>
                  {form.groupId ? (formGroups.find(g=>g.id===form.groupId)?.name || form.groupName || t('Auto','تلقائي')) : t('Auto from grade','من الصف تلقائياً')}
                </span>
                {form.groupId && <span className="text-xs text-green-600 font-medium">{t('Auto','تلقائي')}</span>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="sf-church" className="block text-sm font-medium text-gray-700">{t('Church','الكنيسة')}</label><select id="sf-church" value={form.churchName} onChange={e=>setForm({...form,churchName:e.target.value})} className={ic()}><option value="">{t('Select church','اختر الكنيسة')}</option>{churches.map(c=><option key={c.id} value={c.name}>{c.name}{c.city?`, ${c.city}`:''}</option>)}</select></div>
            <div><label htmlFor="sf-grade" className="block text-sm font-medium text-gray-700">{t('Grade','المرحلة الدراسية')}</label><select id="sf-grade" value={form.schoolGrade} onChange={e=>{const g=e.target.value;const combo=form.levelId?gradeGroups.find(c=>c.levelId===form.levelId&&c.status==='active'&&c.gradeName===g):undefined;setForm({...form,schoolGrade:g,groupId:combo?.groupId||'',groupName:combo?.groupName||''})}} className={ic()}><option value="">{t('Select grade','اختر المرحلة')}</option>{mappedGrade.map(g=>{
              const combo = form.levelId ? gradeGroups.find(c=>c.levelId===form.levelId&&c.status==='active'&&c.gradeName===g) : undefined
              return <option key={g} value={g}>{combo?`${g} + ${combo.groupName}`:g}</option>
            })}</select>{comboGrades.length===0&&form.levelId&&<p className="mt-1 text-xs text-amber-600">{t('No grades mapped for this level yet — configure in Settings → Grades','لا توجد صفوف مربوطة بهذا المستوى بعد — قم بإعدادها من الإعدادات ← الصفوف')}</p>}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="sf-phone" className="block text-sm font-medium text-gray-700">{t('Phone','رقم الهاتف')}</label><input id="sf-phone" type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className={ic()} /></div>
            <div><label htmlFor="sf-email" className="block text-sm font-medium text-gray-700">{t('Email','البريد الإلكتروني')}</label><input id="sf-email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={ic()} /></div>
          </div>
          <div><label htmlFor="sf-address" className="block text-sm font-medium text-gray-700">{t('Address','العنوان')}</label><input id="sf-address" type="text" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className={ic()} /></div>
          <div><label htmlFor="sf-notes" className="block text-sm font-medium text-gray-700">{t('Notes','ملاحظات')}</label><textarea id="sf-notes" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className={ic()} /></div>
          {can('student:edit-sensitive')&&<><div><label htmlFor="sf-ctid" className="block text-sm font-medium text-gray-700">{t('Church Tool ID','معرف أداة الكنيسة')}</label><input id="sf-ctid" type="text" value={form.churchToolId} onChange={e=>setForm({...form,churchToolId:e.target.value})} placeholder={t('Optional external ID','معرف خارجي اختياري')} className={ic()} /></div>
          <div>
            <label htmlFor="sf-parent" className="block text-sm font-medium text-gray-700">{t('Parent Email (link)','بريد ولي الأمر (رابط)')}</label>
            <input id="sf-parent" type="email" value={form.parentEmail} onChange={e=>setForm({...form,parentEmail:e.target.value})} placeholder={t("Parent's login email",'بريد دخول ولي الأمر')} className={ic()} />
            <p className="mt-1 text-xs text-gray-500">{t('Any student with this email appears automatically on the parent dashboard','أي طالب يحمل هذا البريد يظهر تلقائياً في لوحة ولي الأمر')}</p>
          </div></>}
          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Profile Photo','الصورة الشخصية')}</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {form.photoUrl?<Image src={photoSrc(form.photoUrl)} alt="Preview" width={64} height={64} className="h-16 w-16 rounded-full object-cover border border-gray-200" />:<div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200"><User className="h-6 w-6 text-gray-400" /></div>}
              </div>
              <div className="flex-1">
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f){revoke();const u=URL.createObjectURL(f);blobRef.current=u;setPhotoFile(f);setForm({...form,photoUrl:u})}}} />
                <Button type="button" variant="outline" onClick={()=>photoRef.current?.click()} className="inline-flex items-center gap-1.5">
                  <Camera className="h-4 w-4" />{photoFile||form.photoUrl?t('Change Photo','تغيير الصورة'):t('Upload Photo','رفع صورة')}
                </Button>
                {(photoFile||form.photoUrl)&&<Button type="button" variant="ghost" size="sm" onClick={()=>{revoke();setPhotoFile(null);setForm({...form,photoUrl:''})}} className="ms-2 text-red-500 hover:text-red-700">{t('Remove','إزالة')}</Button>}
              </div>
            </div>
          </div>
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Status','الحالة')}</label>
            <div className="flex gap-2">
              {([{value:'active',label:t('Active','نشط'),color:'border-green-300 bg-green-50 text-green-700'},{value:'inactive',label:t('Inactive','غير نشط'),color:'border-red-300 bg-red-50 text-red-700'},{value:'graduated',label:t('Graduated','متخرج'),color:'border-amber-300 bg-amber-50 text-amber-700'}]).map(opt=>(
                <Button key={opt.value} type="button" variant="outline" onClick={()=>setForm({...form,status:opt.value})}
                  className={`flex-1 border-2 px-3 py-2 text-sm font-medium transition-all ${form.status===opt.value?opt.color+' ring-2 ring-offset-1':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{opt.label}</Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>{t('Cancel','إلغاء')}</Button>
          <Button type="submit" disabled={isSaving} className="inline-flex items-center gap-2">
            {isSaving&&<Loader2 className="h-4 w-4 animate-spin" />}
            {student?t('Save Changes','حفظ التغييرات'):t('Add Student','إضافة طالب')}
          </Button>
        </div>
      </form>
    </div>
  )
}

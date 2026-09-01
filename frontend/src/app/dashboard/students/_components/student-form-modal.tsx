'use client'
import Image from 'next/image'
import { useState, useEffect, useRef, useCallback, useActionState, startTransition } from 'react'
import { X, Loader2, Camera, User } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { http } from '@/lib/http-client'
import { getSchoolId } from '@/lib/school'
import { useToast } from '@/components/ui/toast'
import { usePermission } from '@/lib/use-permission'
import { useFormValidation } from '@/hooks/use-form-validation'
import { email, isoDate, notFuture, pattern, required, type Schema } from '@/lib/validation'
import { emptyForm, photoSrc, type Student, type StudentForm, type Level, type ChurchItem } from './student-types'
import { type GradeItem } from '@/lib/grades'

type StudentFormFields = {
  name: string; dateOfBirth: string; levelId: string; gradeId: string
  email: string; phone: string; parentEmail: string
}

const studentSchema: Schema<StudentFormFields> = {
  name: [required({ en: 'Name', ar: 'الاسم' })],
  dateOfBirth: [required({ en: 'Date of birth', ar: 'تاريخ الميلاد' }), isoDate(), notFuture()],
  levelId: [required({ en: 'Level', ar: 'المستوى' })],
  gradeId: [required({ en: 'Grade', ar: 'الصف' })],
  email: [email()],
  phone: [pattern(/^[\d\s\-\+\(\)]{6,20}$/, { en: 'Invalid phone format', ar: 'صيغة الهاتف غير صحيحة' })],
  parentEmail: [email()],
}

interface Props {
  student: Student | null; activeLevels: Level[]
  churches: ChurchItem[]; gradeOptions: GradeItem[]
  onClose: () => void; onSuccess: (page: number) => void
  currentPage: number; onOptimisticAdd: (s: Student) => void; lang: 'en'|'ar'
}
export function StudentFormModal({ student, activeLevels, churches, gradeOptions, onClose, onSuccess, currentPage, onOptimisticAdd, lang }: Props) {
  const { toast } = useToast()
  const { can } = usePermission()
  const dialogRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<StudentForm>(emptyForm)
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const blobRef = useRef('')
  const revoke = useCallback(() => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); blobRef.current = '' }, [])
  const t = (en: string, ar: string) => lang==='ar'?ar:en
  const ic = (err?: string) => `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${err?'border-semantic-status-inactive focus:border-semantic-status-inactive focus:ring-semantic-status-inactive':'border-gray-300 focus:border-gold-500 focus:ring-gold-500'}`

  const { fieldErrors, handleBlur, validate } = useFormValidation({
    values: form as StudentFormFields,
    schema: studentSchema,
    lang,
  })

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    revoke(); setPhotoFile(null)
    if (student) {
      setForm({ name:`${student.firstName} ${student.lastName}`.trim(), firstNameAr:student.firstNameAr||'', lastNameAr:student.lastNameAr||'', dateOfBirth:student.dateOfBirth.split('T')[0], gender:student.gender, churchName:student.churchName||'', gradeId:student.gradeId||'', levelId:student.levelId, groupId:student.groupId, groupName:student.group?.name||'', photoUrl:student.photoUrl||'', status:student.status, phone:student.metadata?.phone||'', email:student.metadata?.email||'', address:student.metadata?.address||'', notes:student.metadata?.notes||'', churchToolId:student.metadata?.churchToolId||'', parentEmail:student.parentEmail||'' })
    } else { setForm(emptyForm) }
  }, [student?.id])
  useEffect(() => () => revoke(), [])

  const setField = (f: string, v: string) => {
    setForm(prev => ({ ...prev, [f]: v }))
  }
  const [formState, saveAction, isSaving] = useActionState(async (_prev: {error:string}, data: {form:StudentForm;photoFile:File|null;editing:Student|null}) => {
    if (!validate()) return { error: '' }
    const parts = data.form.name.trim().split(/\s+/)
    const firstName = parts[0]||''; const lastName = parts.slice(1).join(' ')||''
    try {
      let photoUrl = data.form.photoUrl
      if (data.photoFile) { const fd=new FormData(); fd.append('file',data.photoFile); photoUrl=(await http.upload<{url:string}>('/upload/student-photo',fd)).url }
      const { name:_n, groupId:_g, groupName:_gn, ...rest } = data.form
      const ctid = data.form.churchToolId
      const body: Record<string,unknown> = { ...rest, firstName, lastName, photoUrl, firstNameAr:data.form.firstNameAr||undefined, lastNameAr:data.form.lastNameAr||undefined, churchName:data.form.churchName||undefined, gradeId:data.form.gradeId||undefined, churchToolId:ctid }
      if (!data.editing) {
        const grade = gradeOptions.find(g => g.id === data.form.gradeId)
        const gradeGroup = grade ? { id: grade.groupId||'', name: grade.groupName||'' } : { id:'', name:'' }
        onOptimisticAdd({...body,id:`temp-${Date.now()}`,photoUrl,enrollmentDate:new Date().toISOString(),level:{id:data.form.levelId,name:'',number:0},grade:grade?{id:grade.id,name:grade.name}:null,groupId:gradeGroup.id,group:gradeGroup} as Student)
        await http.post('/students',body,{schoolId:getSchoolId()})
      } else { await http.put(`/students/${data.editing.id}`,body,{schoolId:getSchoolId()}) }
      toast('success',!data.editing?t('Student created','تم إنشاء الطالب'):t('Student updated','تم تحديث الطالب'))
      // M11: a newly created student sorts to page 1, so jump back there
      onClose(); onSuccess(data.editing ? currentPage : 1); return {error:''}
    } catch (err:unknown) {
      const msg = err instanceof Error?err.message:t('Connection error','خطأ في الاتصال')
      toast('error',msg); onSuccess(currentPage); return {error:msg}
    }
  },{error:''})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={student?t('Edit Student','تعديل الطالب'):t('Add New Student','إضافة طالب جديد')} className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col outline-none" onClick={e=>e.stopPropagation()} noValidate
        onSubmit={e=>{e.preventDefault();startTransition(()=>saveAction({form,photoFile,editing:student}))}}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">{student?t('Edit Student','تعديل الطالب'):t('Add New Student','إضافة طالب جديد')}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {formState.error&&<div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formState.error}</div>}
          <FormField
            label={t('Name','الاسم')}
            type="text"
            value={form.name}
            onChange={e=>setField('name',e.target.value)}
            onBlur={()=>handleBlur('name')}
            error={fieldErrors.name}
            required
            placeholder={t('Full name','الاسم الكامل')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="sf-name-ar" className="block text-sm font-medium text-gray-700">{t('First Name (Arabic)','الاسم الأول (عربي)')}</label><input id="sf-name-ar" type="text" value={form.firstNameAr} onChange={e=>setForm({...form,firstNameAr:e.target.value})} className={ic()} /></div>
            <div><label htmlFor="sf-last-ar" className="block text-sm font-medium text-gray-700">{t('Last Name (Arabic)','الاسم الأخير (عربي)')}</label><input id="sf-last-ar" type="text" value={form.lastNameAr} onChange={e=>setForm({...form,lastNameAr:e.target.value})} className={ic()} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-dob" className="block text-sm font-medium text-gray-700">{t('Date of Birth *','تاريخ الميلاد *')}</label>
              <div onBlur={()=>handleBlur('dateOfBirth')}><DatePicker id="sf-dob" value={form.dateOfBirth} onChange={v=>setField('dateOfBirth',v)} max={new Date().toISOString().split('T')[0]} className={ic(fieldErrors.dateOfBirth)} /></div>
              {fieldErrors.dateOfBirth&&<p role="alert" className="mt-1 text-xs text-red-500">{fieldErrors.dateOfBirth}</p>}
            </div>
            <div><label htmlFor="sf-gender" className="block text-sm font-medium text-gray-700">{t('Gender *','الجنس *')}</label><select id="sf-gender" value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} className={ic()}><option value="male">{t('Male','ذكر')}</option><option value="female">{t('Female','أنثى')}</option></select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sf-level" className="block text-sm font-medium text-gray-700">{t('Level *','المستوى *')}</label>
              <select id="sf-level" value={form.levelId} onChange={e=>{setField('levelId',e.target.value);setForm(prev=>({...prev,levelId:e.target.value,gradeId:'',groupId:'',groupName:''}))}} className={ic(fieldErrors.levelId)}>
                <option value="">{t('Select level','اختر المستوى')}</option>
                {activeLevels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {fieldErrors.levelId&&<p role="alert" className="mt-1 text-xs text-red-500">{fieldErrors.levelId}</p>}
            </div>
            <div>
              <label htmlFor="sf-group" className="block text-sm font-medium text-gray-700">{t('Group','المجموعة')}</label>
              <div id="sf-group" className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {student?.group?.name || form.groupName || (gradeOptions.find(g=>g.id===form.gradeId)?.groupName)||t('—','—')}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label htmlFor="sf-church" className="block text-sm font-medium text-gray-700">{t('Church','الكنيسة')}</label><select id="sf-church" value={form.churchName} onChange={e=>setForm({...form,churchName:e.target.value})} className={ic()}><option value="">{t('Select church','اختر الكنيسة')}</option>{churches.map(c=><option key={c.id} value={c.name}>{c.name}{c.city?`, ${c.city}`:''}</option>)}</select></div>
            <div><label htmlFor="sf-grade" className="block text-sm font-medium text-gray-700">{t('Grade','المرحلة الدراسية')}</label><select id="sf-grade" value={form.gradeId} onChange={e=>{const v=e.target.value;const gr=gradeOptions.find(g=>g.id===v);setForm({...form,gradeId:v,groupId:gr?.groupId||'',groupName:gr?.groupName||''})}} className={ic(fieldErrors.gradeId)}><option value="">{t('Select grade','اختر المرحلة')}</option>{gradeOptions.map(g=>(
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}</select>{fieldErrors.gradeId&&<p role="alert" className="mt-1 text-xs text-red-500">{fieldErrors.gradeId}</p>}<p className="mt-1 text-xs text-gray-400">{t('Group is auto-assigned from the grade','يتم تحديد المجموعة تلقائياً من المرحلة')}</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label={t('Phone','رقم الهاتف')}
              type="tel"
              value={form.phone}
              onChange={e=>setForm({...form,phone:e.target.value})}
              onBlur={()=>handleBlur('phone')}
              error={fieldErrors.phone}
            />
            <FormField
              label={t('Email','البريد الإلكتروني')}
              type="email"
              value={form.email}
              onChange={e=>setForm({...form,email:e.target.value})}
              onBlur={()=>handleBlur('email')}
              error={fieldErrors.email}
            />
          </div>
          <div><label htmlFor="sf-address" className="block text-sm font-medium text-gray-700">{t('Address','العنوان')}</label><input id="sf-address" type="text" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className={ic()} /></div>
          <div><label htmlFor="sf-notes" className="block text-sm font-medium text-gray-700">{t('Notes','ملاحظات')}</label><textarea id="sf-notes" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className={ic()} /></div>
          {can('student:edit-sensitive')&&<><div><label htmlFor="sf-ctid" className="block text-sm font-medium text-gray-700">{t('Church Tool ID','معرف أداة الكنيسة')}</label><input id="sf-ctid" type="text" value={form.churchToolId} onChange={e=>setForm({...form,churchToolId:e.target.value})} placeholder={t('Optional external ID','معرف خارجي اختياري')} className={ic()} /></div>
          <FormField
            label={t('Parent Email (link)','بريد ولي الأمر (رابط)')}
            type="email"
            value={form.parentEmail}
            onChange={e=>setForm({...form,parentEmail:e.target.value})}
            onBlur={()=>handleBlur('parentEmail')}
            error={fieldErrors.parentEmail}
            placeholder={t("Parent's login email",'بريد دخول ولي الأمر')}
          />
          <p className="mt-1 text-xs text-gray-500">{t('Any student with this email appears automatically on the parent dashboard','أي طالب يحمل هذا البريد يظهر تلقائياً في لوحة ولي الأمر')}</p></>}
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

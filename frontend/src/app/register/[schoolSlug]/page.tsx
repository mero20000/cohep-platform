'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, CheckCircle2, Music, User, Calendar, MapPin, Phone, Mail, ShieldCheck, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'
import { VoiceRecorder } from '@/components/registration/voice-recorder'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export default function RegisterPage() {
  const params = useParams()
  const schoolSlug = params.schoolSlug as string
  const lang = useLanguage()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const isAr = lang === 'ar'

  const [step, setStep] = useState(1)
  const [meta, setMeta] = useState<any>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Form state — mirrors Student creation fields to minimize admin work
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [hymnChoice, setHymnChoice] = useState<'amen_be_mawteka'|'be_shafaat'|'both'|''>('')
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [form, setForm] = useState({
    name: '', firstNameAr: '', lastNameAr: '', dateOfBirth: '', gender: 'male',
    churchName: '', gradeId: '', address: '', phone: '', email: '', parentEmail: '',
    notes: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
    parentName: '', relationship: 'father',
  })

  useEffect(() => {
    fetch(`${API}/registrations/${schoolSlug}/meta`).then(r=>r.json()).then(d=>{
      setMeta(d);
      // Default church as per school link (Church identity from School.church)
      const churchName = d?.church?.name || d?.school?.name
      if (churchName) {
        setForm(prev => prev.churchName ? prev : ({ ...prev, churchName }))
      }
      setMetaLoading(false)
    }).catch(()=>setMetaLoading(false))
  }, [schoolSlug])

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const canNext1 = form.name.trim() && form.dateOfBirth && form.gender && !!photoPreview
  const canNext2 = form.parentEmail.trim() && form.parentName.trim() && form.phone.trim()
  const canNext3 = hymnChoice && voiceBlob
  const canSubmit = canNext1 && canNext2 && canNext3 && form.parentEmail.includes('@')

  const handlePhoto = (f: File | null) => {
    setPhotoFile(f)
    if (f) {
      const url = URL.createObjectURL(f)
      setPhotoPreview(url)
    } else setPhotoPreview('')
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setError('')
    try {
      const fd = new FormData()
      fd.append('hymnChoice', hymnChoice)
      fd.append('studentData', JSON.stringify({
        name: form.name.trim(),
        firstNameAr: form.firstNameAr.trim() || undefined,
        lastNameAr: form.lastNameAr.trim() || undefined,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        churchName: form.churchName.trim() || undefined,
        gradeId: form.gradeId || undefined,
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        parentEmail: form.parentEmail.trim(),
        notes: form.notes.trim() || undefined,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        emergencyContactRelation: form.emergencyContactRelation.trim() || undefined,
        parentName: form.parentName.trim(),
        relationship: form.relationship,
      }))
      if (voiceBlob) fd.append('voiceFile', voiceBlob, `voice-${Date.now()}.webm`)
      if (photoFile) fd.append('photoFile', photoFile, photoFile.name)
      // Turnstile token if widget present
      const tsToken = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value
      if (tsToken) fd.append('turnstileToken', tsToken)

      const res = await fetch(`${API}/registrations/${schoolSlug}`, { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(()=>({message:'Failed'}))
        throw new Error(j.message || 'Failed to submit')
      }
      setSuccess(true)
    } catch (e: any) {
      setError(e.message || t('Failed to submit', 'فشل الإرسال'))
    }
    setSubmitting(false)
  }

  if (metaLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold-600" /></div>

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f1f3d] via-[#1A2744] to-[#0f1f3d] flex items-center justify-center p-4" dir={isAr?'rtl':'ltr'}>
        <div className="w-full max-w-lg rounded-[24px] bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Application received!', 'تم استلام الطلب!')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t(`We'll review ${form.name}'s application and send a confirmation to`, 'سنراجع طلب') } <span className="font-semibold text-gray-900">{form.parentEmail}</span> {t('within 48 hours.', 'خلال 48 ساعة.')}</p>
          <div className="mt-6 rounded-xl bg-blue-50 border border-blue-100 p-4 text-left">
            <p className="text-xs font-semibold text-blue-800">{t('What happens next?', 'ماذا بعد؟')}</p>
            <ul className="mt-2 space-y-1 text-xs text-blue-700">
              <li>✓ {t('Servant reviews voice note', 'الخادم يراجع التسجيل الصوتي')}</li>
              <li>✓ {t('You receive an email when approved', 'ستصلك رسالة عند القبول')}</li>
              <li>✓ {t('Student appears in class automatically', 'يظهر الطالب في الفصل تلقائياً')}</li>
            </ul>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(t(`I just registered ${form.name} to COHEP Hymn School — register here: ${typeof window !== 'undefined' ? window.location.href : ''}`, `سجلت ${form.name} في مدرسة الألحان COHEP — سجل هنا: ${typeof window !== 'undefined' ? window.location.href : ''}`))}`} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#128C7E]">
            {t('Share with another parent', 'شارك مع ولي أمر آخر')}
          </a>
          <p className="mt-4 text-xs text-gray-400"><Link href="/" className="text-blue-600 hover:underline">{t('Back to home', 'العودة للرئيسية')}</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr?'rtl':'ltr'}>
      {/* Hero — church + school identity, hook from main portal */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f1f3d] via-[#1A2744] to-[#1e3a5f] px-4 pt-8 pb-10 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(200,155,60,0.15),_transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 border border-white/15 backdrop-blur overflow-hidden">
            {(meta?.church?.logoUrl || meta?.school?.logoUrl) ? <Image src={(meta.church?.logoUrl || meta.school.logoUrl)!.startsWith('http') ? (meta.church?.logoUrl || meta.school.logoUrl)! : `${API.replace('/api','')}${meta.church?.logoUrl || meta.school.logoUrl}`} alt={meta.church?.name || meta.school.name} width={56} height={56} className="h-full w-full object-cover" unoptimized /> : <Music className="h-7 w-7 text-gold-400" />}
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-white">{t('Join the Hymn School', 'انضم لمدرسة الألحان')}</h1>
          <p className="mx-auto mt-2 text-sm font-medium text-gold-300">{meta?.church?.name || meta?.school?.name || schoolSlug}{meta?.church?.nameAr || meta?.school?.nameAr ? ` · ${meta.church?.nameAr || meta.school.nameAr}` : ''}</p>
          {meta?.school?.name && meta?.church?.name && meta.church.name !== meta.school.name && <p className="text-xs text-white/50">{meta.school.name}</p>}
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70">{t('Teach hymns, preserve heritage, and help children belong to the Church. Your child\'s voice matters — begin their spiritual journey today.', 'علموا التراتيل، احفظوا التراث، وساعدوا الأطفال على الانتماء للكنيسة. صوت طفلك مهم — ابدأ رحلته الروحية اليوم.')}</p>
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {meta?.church?.name || meta?.school?.name || schoolSlug} · {t('2025-2026 Intake', 'التسجيل 2025-2026')} · {t('Secure', 'آمن')}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 -mt-6 pb-12">
        <div className="rounded-[24px] bg-white shadow-xl border border-gray-100 overflow-hidden">
          {/* Progress */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between mb-2">
              {[1,2,3,4].map(n=>(
                <div key={n} className="flex items-center gap-2 flex-1">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border-2 ${step>=n ? 'bg-gold-500 border-gold-500 text-white' : 'border-gray-200 text-gray-400'} ${step===n ? 'ring-2 ring-gold-200' : ''}`}>{n}</div>
                  {n<4 && <div className={`flex-1 h-0.5 ${step>n ? 'bg-gold-500' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-medium text-gray-500">
              <span>{t('Student','الطالب')}</span><span>{t('Family','العائلة')}</span><span>{t('Voice','الصوت')}</span><span>{t('Review','المراجعة')}</span>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</div>}

            {step===1 && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 pb-2">
                  <div className="relative">
                    {photoPreview ? <Image src={photoPreview} alt="preview" width={80} height={80} className="h-20 w-20 rounded-full object-cover border-2 border-gold-200" unoptimized /> : <div className={`h-20 w-20 rounded-full bg-gray-100 border-2 border-dashed flex items-center justify-center ${!photoPreview ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}><User className="h-8 w-8 text-gray-400" /></div>}
                    <label className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-gold-500 text-white shadow cursor-pointer hover:bg-gold-600">
                      <input type="file" accept="image/*" className="hidden" onChange={e=>handlePhoto(e.target.files?.[0]||null)} />
                      <span className="text-xs">+</span>
                    </label>
                  </div>
                  <span className="text-xs font-medium text-amber-700">{t('Profile picture * — required', 'الصورة الشخصية * — مطلوبة')}</span>
                  <span className="text-xs text-gray-500">{t('Helps servant recognize your child', 'تساعد الخادم على التعرف على طفلك')}</span>
                  {!photoPreview && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{t('Please upload a photo to continue', 'يرجى رفع صورة للمتابعة')}</span>}
                </div>
                <div><label className="block text-sm font-medium text-gray-700">{t('Full name (English) *','الاسم الكامل (إنجليزي) *')}</label><input value={form.name} onChange={e=>update('name',e.target.value)} placeholder="e.g. Mina George" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700">{t('First name (Arabic)','الاسم الأول (عربي)')}</label><input value={form.firstNameAr} onChange={e=>update('firstNameAr',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">{t('Last name (Arabic)','الاسم الأخير (عربي)')}</label><input value={form.lastNameAr} onChange={e=>update('lastNameAr',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700">{t('Date of birth *','تاريخ الميلاد *')}</label><DatePicker value={form.dateOfBirth} onChange={v=>update('dateOfBirth',v)} className="mt-1" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">{t('Gender *','الجنس *')}</label><select value={form.gender} onChange={e=>update('gender',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-gold-400 focus:outline-none"><option value="male">{t('Male','ذكر')}</option><option value="female">{t('Female','أنثى')}</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700">{t('Church','الكنيسة')}</label><input value={form.churchName} onChange={e=>update('churchName',e.target.value)} placeholder={meta?.school?.name || 'St. Mark'} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">{t('Grade','المرحلة الدراسية')}</label><select value={form.gradeId} onChange={e=>update('gradeId',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-gold-400 focus:outline-none"><option value="">{t('Select grade','اختر المرحلة')}</option>{(meta?.grades||[]).map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                </div>
                <p className="text-xs text-gray-400">{t('Group is auto-assigned from grade — servant can adjust after submission.', 'يتم تحديد المجموعة تلقائياً من المرحلة — يمكن للخادم تعديلها لاحقاً.')}</p>
              </div>
            )}

            {step===2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="block text-sm font-medium text-gray-700">{t('Parent / Guardian full name *','اسم ولي الأمر *')}</label><input value={form.parentName} onChange={e=>update('parentName',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">{t('Relationship *','صلة القرابة *')}</label><select value={form.relationship} onChange={e=>update('relationship',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white"><option value="father">{t('Father','أب')}</option><option value="mother">{t('Mother','أم')}</option><option value="guardian">{t('Guardian','ولي أمر')}</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700">{t('Phone *','الهاتف *')}</label><input value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="+971 5••••••••" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-gray-700">{t('Email (for confirmation) *','البريد الإلكتروني *')}</label><input type="email" value={form.parentEmail} onChange={e=>update('parentEmail',e.target.value)} placeholder="parent@email.com" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" /></div>
                  <div><label className="block text-sm font-medium text-gray-700">{t('Student email (optional)','بريد الطالب (اختياري)')}</label><input type="email" value={form.email} onChange={e=>update('email',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700">{t('Address','العنوان')}</label><input value={form.address} onChange={e=>update('address',e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700">{t('Notes (allergies, medical, special needs)','ملاحظات (حساسية، طبية، احتياجات)')}</label><textarea value={form.notes} onChange={e=>update('notes',e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" /></div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-800">{t('Emergency contact','جهة اتصال للطوارئ')}</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <input value={form.emergencyContactName} onChange={e=>update('emergencyContactName',e.target.value)} placeholder={t('Name','الاسم')} className="rounded-lg border border-amber-200 px-2 py-2 text-sm" />
                    <input value={form.emergencyContactPhone} onChange={e=>update('emergencyContactPhone',e.target.value)} placeholder="+971 5••••••••" className="rounded-lg border border-amber-200 px-2 py-2 text-sm" />
                    <select value={form.emergencyContactRelation} onChange={e=>update('emergencyContactRelation',e.target.value)} className="rounded-lg border border-amber-200 px-2 py-2 text-sm bg-white">
                      <option value="">{t('Relation','الصلة')}</option>
                      <option value="father">{t('Father','أب')}</option>
                      <option value="mother">{t('Mother','أم')}</option>
                      <option value="guardian">{t('Guardian','ولي أمر')}</option>
                      <option value="grandfather">{t('Grandfather','جد')}</option>
                      <option value="grandmother">{t('Grandmother','جدة')}</option>
                      <option value="uncle">{t('Uncle','عم/خال')}</option>
                      <option value="aunt">{t('Aunt','عمة/خالة')}</option>
                      <option value="sibling">{t('Sibling','أخ/أخت')}</option>
                      <option value="other">{t('Other','أخرى')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step===3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">{t('Choose a hymn and record your child singing it. No perfection needed — we just want to hear their voice.', 'اختر لحناً واحداً وسجل طفلك وهو يرتل. لا نطلب الكمال — نريد سماع صوته فقط.')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {id:'amen_be_mawteka', en:'Amen Amen Amen be mawteka', ar:'امين امين بموتك يارب'},
                    {id:'be_shafaat', en:'Be shafa3at — By the intercessions', ar:'بي شفاعات والده الاله'},
                  ].map(h=>(
                    <button key={h.id} type="button" onClick={()=>setHymnChoice(h.id as any)} className={`rounded-2xl border-2 p-4 text-left transition-all ${hymnChoice===h.id ? 'border-gold-500 bg-gold-50 shadow' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${hymnChoice===h.id ? 'bg-gold-500 text-white' : 'bg-gray-100 text-gray-500'}`}><Music className="h-5 w-5" /></div>
                        <div><div className="text-sm font-bold text-gray-900">{h.en}</div><div className="text-xs text-gray-500">{h.ar}</div></div>
                        {hymnChoice===h.id && <CheckCircle2 className="ms-auto h-5 w-5 text-gold-600" />}
                      </div>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={()=>setHymnChoice('both')} className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${hymnChoice==='both' ? 'border-gold-500 bg-gold-50 shadow' : 'border-dashed border-amber-300 hover:border-gold-400 bg-amber-50/50'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${hymnChoice==='both' ? 'bg-gold-500 text-white' : 'bg-amber-100 text-amber-600'}`}><Music className="h-5 w-5" /></div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{t('Both hymns — Advanced', 'كلا اللحنين — متقدم')}</div>
                      <div className="text-xs text-gray-500">{t('Record both hymns together for advanced placement', 'سجل اللحنين معاً للمتقدمين')}</div>
                    </div>
                    {hymnChoice==='both' && <CheckCircle2 className="ms-auto h-5 w-5 text-gold-600" />}
                  </div>
                </button>
                {hymnChoice && <VoiceRecorder onRecordingComplete={setVoiceBlob} lang={lang} />}
                {!hymnChoice && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{t('Please choose a hymn first', 'يرجى اختيار اللحن أولاً')}</p>}
              </div>
            )}

            {step===4 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-3">
                    {photoPreview ? <Image src={photoPreview} alt="preview" width={48} height={48} className="h-12 w-12 rounded-full object-cover" unoptimized /> : <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center"><User className="h-6 w-6 text-gray-400" /></div>}
                    <div><div className="font-bold text-gray-900">{form.name}</div><div className="text-xs text-gray-500">{form.dateOfBirth} · {form.gender} · {form.churchName || schoolSlug}</div></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="text-gray-500">{t('Parent:','ولي الأمر:')} <span className="font-medium text-gray-900">{form.parentName} ({form.relationship})</span></span>
                    <span className="text-gray-500">{t('Email:','البريد:')} <span className="font-medium text-gray-900">{form.parentEmail}</span></span>
                    <span className="text-gray-500">{t('Phone:','الهاتف:')} <span className="font-medium text-gray-900">{form.phone}</span></span>
                    <span className="text-gray-500">{t('Hymn:','اللحن:')} <span className="font-medium text-gray-900">{hymnChoice==='amen_be_mawteka'?'Amen be mawteka':hymnChoice==='both'?'Both hymns': 'Be shafaat'}</span></span>
                  </div>
                </div>
                {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} data-theme="light" />
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm text-gray-600">
                  <input type="checkbox" required className="mt-0.5" />
                  {t('I confirm the information is correct and consent to the church using it for enrollment.', 'أؤكد صحة المعلومات وأوافق على استخدامها للتسجيل.')}
                </label>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {step>1 ? <Button variant="outline" onClick={()=>setStep(s=>s-1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" />{t('Back','رجوع')}</Button> : <span />}
              {step<4 ? (
                <Button onClick={()=>setStep(s=>s+1)} disabled={(step===1 && !canNext1) || (step===2 && !canNext2) || (step===3 && !canNext3)}>
                  {t('Continue','متابعة')} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="bg-gold-500 hover:bg-gold-600 text-white">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('Submit Application','إرسال الطلب')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

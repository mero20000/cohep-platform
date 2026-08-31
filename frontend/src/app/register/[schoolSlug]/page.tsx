'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Loader2, CheckCircle2, Music, User, Users, Mic, ClipboardCheck,
  AlertCircle, ChevronRight, ChevronLeft, Church, GraduationCap, ShieldCheck,
} from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/use-language'
import { VoiceRecorder } from '@/components/registration/voice-recorder'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const HYMNS = [
  { id: 'amen_be_mawteka', en: 'Amen Amen Amen be mawteka', ar: 'امين امين بموتك يارب' },
  { id: 'be_shafaat', en: 'Be shafa3at — By the intercessions', ar: 'بي شفاعات والده الاله' },
]

const STEPS = [
  { n: 1, en: 'Student', ar: 'الطالب', icon: User, time: '~2 min', descEn: 'Student profile', descAr: 'ملف الطالب' },
  { n: 2, en: 'Family', ar: 'العائلة', icon: Users, time: '~2 min', descEn: 'Parent & contact info', descAr: 'بيانات الولي' },
  { n: 3, en: 'Voice', ar: 'الصوت', icon: Mic, time: '~5 min', descEn: 'Record hymns', descAr: 'تسجيل الألحان' },
  { n: 4, en: 'Review', ar: 'المراجعة', icon: ClipboardCheck, time: '~1 min', descEn: 'Confirm details', descAr: 'تأكيد البيانات' },
]

export default function RegisterPage() {
  const params = useParams()
  const schoolSlug = params.schoolSlug as string
  const lang = useLanguage()
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en)
  const isAr = lang === 'ar'

  const [step, setStep] = useState(1)
  const [meta, setMeta] = useState<any>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [showArabicNames, setShowArabicNames] = useState(false)
  const [recordings, setRecordings] = useState<Record<string, Blob | null>>({
    amen_be_mawteka: null,
    be_shafaat: null,
  })
  const [form, setForm] = useState({
    name: '', firstNameAr: '', lastNameAr: '', dateOfBirth: '', gender: 'male',
    churchName: '', gradeId: '', address: '', phone: '', email: '', parentEmail: '',
    notes: '', emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
    parentName: '', relationship: 'father',
  })

  useEffect(() => {
    fetch(`${API}/registrations/${schoolSlug}/meta`).then(r=>r.json()).then(d=>{
      setMeta(d)
      const churchName = d?.church?.name || d?.school?.name
      if (churchName) setForm(prev => prev.churchName ? prev : ({ ...prev, churchName }))
      setMetaLoading(false)
    }).catch(()=>setMetaLoading(false))
  }, [schoolSlug])

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const gradeLabel = (g: any) => {
    const weekday = (g?.nameAr || '').trim()
    return weekday ? `${g.name} – ${weekday}` : (g?.name || '—')
  }

  const getStudentAge = (dob: string) => {
    if (!dob) return null
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const studentAge = getStudentAge(form.dateOfBirth)

  const getMissingFields = () => {
    const missing = []
    if (step === 1) {
      if (!form.name.trim()) missing.push(t('Full name (English)', 'الاسم الكامل (إنجليزي)'))
      if (!form.dateOfBirth) missing.push(t('Date of birth', 'تاريخ الميلاد'))
      if (!form.gender) missing.push(t('Gender', 'الجنس'))
      if (!form.gradeId) missing.push(t('Grade & Weekday', 'المرحلة واليوم (A/B)'))
      if (!photoPreview) missing.push(t('Profile picture', 'الصورة الشخصية'))
    } else if (step === 2) {
      if (!form.parentName.trim()) missing.push(t('Parent / Guardian name', 'اسم ولي الأمر'))
      if (!form.parentEmail.trim()) missing.push(t('Parent email', 'بريد ولي الأمر'))
      if (!form.phone.trim()) missing.push(t('Phone number', 'رقم الهاتف'))
    } else if (step === 3) {
      if (!canNext3) missing.push(t('At least one hymn recording', 'لحن واحد على الأقل'))
    }
    return missing
  }

  const getGroupedGrades = (): Record<string, any[]> => {
    const grouped: Record<string, any[]> = {}
    ;(meta?.grades || []).forEach((g: any) => {
      const num = g.name.match(/^\d+/)?.[0]
      const key = num ? (parseInt(num) < 7 ? 'Primary' : parseInt(num) < 10 ? 'Secondary' : 'Preparatory') : 'Other'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(g)
    })
    return grouped
  }

  const canNext1 = Boolean(form.name.trim() && form.dateOfBirth && form.gender && photoPreview)
  const canNext2 = Boolean(form.parentEmail.trim() && form.parentName.trim() && form.phone.trim())
  const recordedHymns = HYMNS.filter(h => recordings[h.id])
  const canNext3 = recordedHymns.length > 0
  const canSubmit = canNext1 && canNext2 && canNext3 && form.parentEmail.includes('@')

  const handlePhoto = (f: File | null) => {
    setPhotoError('')
    if (!f) {
      setPhotoFile(null)
      setPhotoPreview('')
      return
    }
    const maxSizeMB = 5
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!validTypes.includes(f.type)) {
      setPhotoError(t('Please upload JPG, PNG, or WebP format', 'يرجى رفع صورة بصيغة JPG أو PNG أو WebP'))
      return
    }
    if (f.size > maxSizeBytes) {
      setPhotoError(t(`Photo must be under ${maxSizeMB}MB`, `يجب أن تكون الصورة أقل من ${maxSizeMB}MB`))
      return
    }
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  const setRecording = (hymnId: string) => (blob: Blob | null) => {
    setRecordings(prev => ({ ...prev, [hymnId]: blob }))
  }

  const abs = (u: string) => (u.startsWith('http') ? u : `${API.replace('/api', '')}${u}`)
  const churchLogo = meta?.church?.logoUrl || null
  const schoolLogo = meta?.school?.logoUrl || null
  const gradeObj = (meta?.grades || []).find((g: any) => g.id === form.gradeId)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('hymnChoice', recordedHymns.length === HYMNS.length ? 'both' : recordedHymns[0].id)
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
      for (const h of HYMNS) {
        const blob = recordings[h.id]
        if (blob) fd.append(h.id === 'amen_be_mawteka' ? 'voice_amen' : 'voice_shafaat', blob, `${h.id}-${Date.now()}.mp3`)
      }
      if (photoFile) fd.append('photoFile', photoFile, photoFile.name)
      const tsToken = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value
      if (tsToken) fd.append('turnstileToken', tsToken)

      const res = await fetch(`${API}/registrations/${schoolSlug}`, { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ message: 'Failed' }))
        throw new Error(j.message || 'Failed to submit')
      }
      setSuccess(true)
    } catch (e: any) {
      setError(e.message || t('Failed to submit', 'فشل الإرسال'))
    }
    setSubmitting(false)
  }

  if (metaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f1f3d] via-[#1A2744] to-[#0f1f3d] flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-lg rounded-[24px] bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Application received!', 'تم استلام الطلب!')}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {t(`We'll review ${form.name}'s application and send a confirmation to`, 'سنراجع طلب')}{' '}
            <span className="font-semibold text-gray-900">{form.parentEmail}</span> {t('within 48 hours.', 'خلال 48 ساعة.')}
          </p>
          <div className="mt-6 rounded-xl bg-blue-50 border border-blue-100 p-4 text-left">
            <p className="text-xs font-semibold text-blue-800">{t('What happens next?', 'ماذا بعد؟')}</p>
            <ul className="mt-2 space-y-1 text-xs text-blue-700">
              <li>✓ {t('Servants review the voice recordings', 'الخدام يراجعون التسجيلات الصوتية')}</li>
              <li>✓ {t('You receive an email when approved', 'ستصلك رسالة عند القبول')}</li>
              <li>✓ {t('Student appears in class automatically', 'يظهر الطالب في الفصل تلقائياً')}</li>
            </ul>
          </div>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`I just registered ${form.name} to COHEP Hymn School — register here: ${window.location.href}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#128C7E]"
          >
            {t('Share with another parent', 'شارك مع ولي أمر آخر')}
          </a>
          <p className="mt-4 text-xs text-gray-400">
            <Link href="/" className="text-blue-600 hover:underline">{t('Back to home', 'العودة للرئيسية')}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── HERO — Church + School identity ── */}
      <div className="relative overflow-hidden bg-[#0f1f3d] px-4 pt-10 pb-14 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A2744]/60 via-transparent to-[#0f1f3d]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(200,155,60,0.22),_transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:22px_22px]" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

        <div className="relative mx-auto max-w-3xl text-center">

          {/* Dual identity: Church ⊕ School */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">

            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/10 border-2 border-gold-400/40 shadow-xl overflow-hidden backdrop-blur">
                {churchLogo ? (
                  <Image src={abs(churchLogo)} alt={meta?.church?.name || ''} width={80} height={80} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <Church className="h-8 w-8 text-gold-300" />
                )}
              </div>
              <div className="max-w-[140px] sm:max-w-[180px]">
                <p className="text-xs sm:text-sm font-bold text-white leading-tight">{meta?.church?.name || t('Our Church', 'كنيستنا')}</p>
                <p className="text-[10px] uppercase tracking-widest text-gold-400/80 font-semibold">{t('Church', 'الكنيسة')}</p>
              </div>
            </div>

            <div className="flex flex-col items-center pt-4 sm:pt-6" aria-hidden="true">
              <span className="h-px w-8 sm:w-14 bg-gradient-to-r from-gold-400/10 via-gold-400/70 to-gold-400/10" />
              <span className="my-1 flex h-8 w-8 items-center justify-center rounded-full bg-gold-500 shadow-lg shadow-gold-500/30 ring-4 ring-gold-500/20">
                <Music className="h-4 w-4 text-[#0f1f3d]" />
              </span>
              <span className="h-px w-8 sm:w-14 bg-gradient-to-r from-gold-400/10 via-gold-400/70 to-gold-400/10" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/10 border-2 border-white/25 shadow-xl overflow-hidden backdrop-blur">
                {schoolLogo ? (
                  <Image src={abs(schoolLogo)} alt={meta?.school?.name || ''} width={80} height={80} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <GraduationCap className="h-8 w-8 text-white/70" />
                )}
              </div>
              <div className="max-w-[140px] sm:max-w-[180px]">
                <p className="text-xs sm:text-sm font-bold text-white leading-tight">{meta?.school?.name || schoolSlug}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">{t('Hymn School', 'مدرسة الألحان')}</p>
              </div>
            </div>

          </div>

          <h1 className="mt-7 text-3xl sm:text-[2.6rem] font-bold tracking-tight text-white leading-tight">
            {t('Give your child the voice of the Church', 'امنح طفلك صوت الكنيسة')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-white/70">
            {t('Register in 2 minutes — record a hymn, and begin a spiritual journey that lasts a lifetime.', 'سجل في دقيقتين — سجّل لحناً وابدأ رحلة روحية تدوم مدى الحياة.')}
          </p>

          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/25 px-3 py-1 text-xs font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> {t('Secure & reviewed by servants', 'آمن ويراجعه الخدام')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/10 border border-gold-400/25 px-3 py-1 text-xs font-medium text-gold-300">
              {t('2025–2026 Intake', 'التسجيل 2025–2026')}
            </span>
          </div>

        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 -mt-8 pb-12">
        <div className="rounded-[24px] bg-white shadow-xl border border-gray-100 overflow-hidden">

          {/* ── STEPS navigator ── */}
          <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white px-6 pt-6 pb-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">{t('Step', 'الخطوة')} {step} of 4</span>
              <span className="text-xs text-gray-400">{STEPS[step - 1]?.time}</span>
            </div>
            <ol className="flex items-start" aria-label={t('Progress', 'التقدم')}>
              {STEPS.map((s, i) => {
                const done = step > s.n
                const active = step === s.n
                return (
                  <li key={s.n} className={`flex items-start ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${done ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200' : active ? 'bg-gold-500 border-gold-500 text-white shadow-lg shadow-gold-300 scale-110 ring-4 ring-gold-100' : 'bg-white border-gray-200 text-gray-300'}`}>
                        {done ? <CheckCircle2 className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                      </div>
                      <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide ${active ? 'text-gold-700' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {t(s.en, s.ar)}
                      </span>
                      <span className={`text-[9px] font-medium ${active ? 'text-gold-600' : 'text-gray-600'}`}>
                        {t(s.descEn, s.descAr)}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 flex items-start pt-5 px-1">
                        <div className={`h-0.5 w-full rounded-full transition-all duration-500 ${step > s.n ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="px-6 py-6 space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />{error}
              </div>
            )}

            {getMissingFields().length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-bold text-amber-900 mb-2">{t('Missing required fields:', 'الحقول المطلوبة الناقصة:')}</p>
                <ul className="space-y-1">
                  {getMissingFields().map((field, i) => (
                    <li key={i} className="text-xs text-amber-800 flex items-center gap-2">
                      <span className="inline-block h-1 w-1 rounded-full bg-amber-600" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">

                <div className="flex flex-col items-center gap-3 pb-2">
                  <div className="relative">
                    {photoPreview ? (
                      <Image src={photoPreview} alt="preview" width={80} height={80} className="h-20 w-20 rounded-full object-cover border-2 border-gold-200" unoptimized />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-amber-50 border-2 border-dashed border-amber-300 flex items-center justify-center">
                        <User className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <label className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-gold-500 text-white shadow cursor-pointer hover:bg-gold-600">
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handlePhoto(e.target.files?.[0] || null)} />
                      <span className="text-xs">+</span>
                    </label>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-700 text-center">{t('Profile picture * — required', 'الصورة الشخصية * — مطلوبة')}</p>
                    <p className="text-xs text-gray-500 text-center mt-1">{t('JPG, PNG, or WebP • Max 5MB', 'JPG أو PNG أو WebP • الحد الأقصى 5MB')}</p>
                  </div>
                  {photoError && (
                    <span className="text-xs text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1.5 rounded-lg">
                      <AlertCircle className="h-3.5 w-3.5" />{photoError}
                    </span>
                  )}
                  {!photoPreview && !photoError && (
                    <span className="text-xs text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-1.5 rounded-lg">
                      <AlertCircle className="h-3.5 w-3.5" />{t('Click the + button to upload a photo', 'انقر على زر + لرفع صورة')}
                    </span>
                  )}
                  {photoPreview && (
                    <span className="text-xs text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded-lg">
                      <CheckCircle2 className="h-3.5 w-3.5" />{t('Photo uploaded successfully', 'تم رفع الصورة بنجاح')}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('Full name (English) *', 'الاسم الكامل (إنجليزي) *')}</label>
                  <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Mina George" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" />
                  <p className="mt-1 text-xs text-gray-500">{t('First and last name as it appears in records', 'الاسم الأول والأخير كما يظهر في السجلات')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowArabicNames(!showArabicNames)}
                  className="flex items-center gap-2 text-sm font-medium text-gold-600 hover:text-gold-700"
                >
                  {showArabicNames ? '▼' : '▶'} {t('Add Arabic name (optional)', 'إضافة الاسم بالعربية (اختياري)')}
                </button>

                {showArabicNames && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('First name (Arabic)', 'الاسم الأول (عربي)')}</label>
                      <input value={form.firstNameAr} onChange={e => update('firstNameAr', e.target.value)} placeholder={t('e.g. مينا', 'e.g. مينا')} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" dir="rtl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('Last name (Arabic)', 'الاسم الأخير (عربي)')}</label>
                      <input value={form.lastNameAr} onChange={e => update('lastNameAr', e.target.value)} placeholder={t('e.g. جرجس', 'e.g. جرجس')} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" dir="rtl" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Date of birth *', 'تاريخ الميلاد *')}</label>
                    <DatePicker value={form.dateOfBirth} onChange={v => update('dateOfBirth', v)} className="mt-1" />
                    <p className="mt-1 text-xs text-gray-500">{t('Format: MM/DD/YYYY', 'الصيغة: MM/DD/YYYY')}</p>
                    {studentAge !== null && (
                      <p className="mt-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                        {t(`Age: ${studentAge} years`, `العمر: ${studentAge} سنة`)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Gender *', 'الجنس *')}</label>
                    <select value={form.gender} onChange={e => update('gender', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-gold-400 focus:outline-none">
                      <option value="male">{t('Male', 'ذكر')}</option>
                      <option value="female">{t('Female', 'أنثى')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Church', 'الكنيسة')}</label>
                    <input value={form.churchName} readOnly aria-readonly="true" className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 cursor-default focus:outline-none" />
                    <p className="mt-1 text-xs text-gray-500">{t('Auto-set by your school', 'محدد تلقائياً من مدرستك')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Grade & Weekday (A = Saturday, B = Sunday)', 'المرحلة واليوم (أ = السبت، ب = الأحد)')}</label>
                    <select value={form.gradeId} onChange={e => update('gradeId', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-gold-400 focus:outline-none">
                      <option value="">{t('Select a grade...', 'اختر المرحلة...')}</option>
                      {Object.entries(getGroupedGrades()).map(([group, grades]) => (
                        <optgroup key={group} label={t(group === 'Primary' ? 'Primary (Grades 4-6)' : group === 'Secondary' ? 'Secondary (Grades 7-9)' : group === 'Preparatory' ? 'Preparatory (Grades 10-13)' : 'Other', group === 'Primary' ? 'الابتدائي (المراحل 4-6)' : group === 'Secondary' ? 'الإعدادي (المراحل 7-9)' : group === 'Preparatory' ? 'الثانوي (المراحل 10-13)' : 'أخرى')}>
                          {grades.map((g: any) => (
                            <option key={g.id} value={g.id}>{gradeLabel(g)}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">{t('A classes meet on Saturday, B classes meet on Sunday', 'فصول أ تجتمع يوم السبت، فصول ب تجتمع يوم الأحد')}</p>
                  </div>
                </div>

              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">

                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <p className="text-xs font-semibold text-blue-900">{t('Primary Contact Info', 'معلومات الاتصال الرئيسية')}</p>
                  <p className="text-xs text-blue-700 mt-1">{t('We will send updates and results to this email and phone number.', 'سنرسل التحديثات والنتائج إلى هذا البريد ورقم الهاتف.')}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">{t('Parent / Guardian full name *', 'اسم ولي الأمر *')}</label>
                    <input value={form.parentName} onChange={e => update('parentName', e.target.value)} placeholder="e.g. John Smith" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Relationship *', 'صلة القرابة *')}</label>
                    <select value={form.relationship} onChange={e => update('relationship', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm bg-white focus:border-gold-400 focus:outline-none">
                      <option value="father">{t('Father', 'أب')}</option>
                      <option value="mother">{t('Mother', 'أم')}</option>
                      <option value="guardian">{t('Guardian', 'ولي أمر')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Phone *', 'الهاتف *')}</label>
                    <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+971 5••••••••" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Email (for updates) *', 'البريد الإلكتروني *')}</label>
                    <input type="email" value={form.parentEmail} onChange={e => update('parentEmail', e.target.value)} placeholder="parent@email.com" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Student email (optional)', 'بريد الطالب (اختياري)')}</label>
                    <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="student@email.com" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('Address', 'العنوان')}</label>
                  <input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Street, City, Country" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('Notes (allergies, medical, special needs)', 'ملاحظات (حساسية، طبية، احتياجات)')}</label>
                  <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} placeholder="Let us know about any special considerations..." className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none" />
                  <p className="mt-1 text-xs text-gray-500">{t('Optional but helpful for our servants', 'اختياري لكن مفيد للخدام')}</p>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-800">{t('Emergency contact', 'جهة اتصال للطوارئ')}</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <input value={form.emergencyContactName} onChange={e => update('emergencyContactName', e.target.value)} placeholder={t('Name', 'الاسم')} className="rounded-lg border border-amber-200 px-2 py-2 text-sm" />
                    <input value={form.emergencyContactPhone} onChange={e => update('emergencyContactPhone', e.target.value)} placeholder="+971 5••••••••" className="rounded-lg border border-amber-200 px-2 py-2 text-sm" />
                    <select value={form.emergencyContactRelation} onChange={e => update('emergencyContactRelation', e.target.value)} className="rounded-lg border border-amber-200 px-2 py-2 text-sm bg-white">
                      <option value="">{t('Relation', 'الصلة')}</option>
                      <option value="father">{t('Father', 'أب')}</option>
                      <option value="mother">{t('Mother', 'أم')}</option>
                      <option value="guardian">{t('Guardian', 'ولي أمر')}</option>
                      <option value="grandfather">{t('Grandfather', 'جد')}</option>
                      <option value="grandmother">{t('Grandmother', 'جدة')}</option>
                      <option value="uncle">{t('Uncle', 'عم/خال')}</option>
                      <option value="aunt">{t('Aunt', 'عمة/خالة')}</option>
                      <option value="sibling">{t('Sibling', 'أخ/أخت')}</option>
                      <option value="other">{t('Other', 'أخرى')}</option>
                    </select>
                  </div>
                </div>

              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-sm font-semibold text-blue-900">{t('Voice Recording', 'تسجيل صوتي')}</p>
                  <p className="text-sm text-blue-700 mt-2">
                    {t('Record each hymn separately — no perfection needed, we just want to hear your child\'s voice. You can re-record as many times as needed.', 'سجل كل لحن على حدة — لا نطلب الكمال، نريد سماع صوت طفلك. يمكنك إعادة التسجيل عدة مرات.')}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">💡 {t('Tip: Use a quiet room and speak clearly', 'نصيحة: استخدم غرفة هادئة وتحدث بوضوح')}</p>
                </div>

                <div className="space-y-4">
                  {HYMNS.map((h, i) => (
                    <div key={h.id} className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
                      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500 text-white text-sm font-bold">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{h.en}</div>
                          <div className="text-xs text-gray-500">{h.ar}</div>
                        </div>
                        {recordings[h.id] && (
                          <div className="ms-auto flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{t('Recorded', 'مسجل')}</span>
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          </div>
                        )}
                      </div>
                      <div className="px-4 pb-4">
                        <VoiceRecorder onRecordingComplete={setRecording(h.id)} lang={lang} />
                      </div>
                    </div>
                  ))}
                </div>

                {canNext3 && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-700">{recordedHymns.length === 2 ? t('Both hymns recorded!', 'تم تسجيل كلا اللحنين!') : t('One hymn recorded — you can add another', 'تم تسجيل لحن واحد — يمكنك إضافة آخر')}</span>
                  </div>
                )}

                {!canNext3 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{t('Recording required', 'مطلوب التسجيل')}</p>
                      <p className="text-xs text-amber-800 mt-1">{t('Record at least one hymn to continue', 'سجّل لحناً واحداً على الأقل للمتابعة')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">

                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">{t('Student', 'الطالب')}</div>
                  <div className="p-4 flex items-start gap-4">
                    {photoPreview ? (
                      <Image src={photoPreview} alt="preview" width={56} height={56} className="h-14 w-14 rounded-full object-cover border border-gray-200" unoptimized />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center"><User className="h-6 w-6 text-gray-400" /></div>
                    )}
                    <dl className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <ReviewItem label={t('Name', 'الاسم')} value={form.name} />
                      {(form.firstNameAr || form.lastNameAr) && <ReviewItem label={t('Arabic name', 'الاسم بالعربية')} value={`${form.firstNameAr} ${form.lastNameAr}`.trim()} />}
                      <ReviewItem label={t('Date of birth', 'تاريخ الميلاد')} value={form.dateOfBirth} />
                      <ReviewItem label={t('Gender', 'الجنس')} value={form.gender === 'male' ? t('Male', 'ذكر') : t('Female', 'أنثى')} />
                      <ReviewItem label={t('Church', 'الكنيسة')} value={form.churchName} />
                      <ReviewItem label={t('Grade & weekday', 'المرحلة واليوم')} value={gradeLabel(gradeObj)} />
                    </dl>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">{t('Family & Contact', 'العائلة والتواصل')}</div>
                  <dl className="p-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <ReviewItem label={t('Parent', 'ولي الأمر')} value={`${form.parentName} (${form.relationship})`} />
                    <ReviewItem label={t('Phone', 'الهاتف')} value={form.phone} />
                    <ReviewItem label={t('Email', 'البريد')} value={form.parentEmail} />
                    {form.email && <ReviewItem label={t('Student email', 'بريد الطالب')} value={form.email} />}
                    {form.address && <ReviewItem label={t('Address', 'العنوان')} value={form.address} />}
                    {form.notes && <ReviewItem label={t('Notes', 'ملاحظات')} value={form.notes} />}
                    {form.emergencyContactName && <ReviewItem label={t('Emergency', 'الطوارئ')} value={`${form.emergencyContactName} (${form.emergencyContactRelation || '—'}) ${form.emergencyContactPhone}`} />}
                  </dl>
                </div>

                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">{t('Voice Recordings', 'التسجيلات الصوتية')}</div>
                  <div className="p-4 space-y-3">
                    {HYMNS.filter(h => recordings[h.id]).map(h => (
                      <div key={h.id}>
                        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-700">
                          <Music className="h-3.5 w-3.5 text-gold-600" />{h.en} <span className="text-gray-400 font-normal">· {h.ar}</span>
                        </div>
                        <audio controls src={URL.createObjectURL(recordings[h.id] as Blob)} className="w-full h-9" />
                      </div>
                    ))}
                  </div>
                </div>

                {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center">
                    <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} data-theme="light" />
                  </div>
                )}

                <label className="flex items-start gap-2 text-sm text-gray-600">
                  <input type="checkbox" required className="mt-0.5" />
                  {t('I confirm the information is correct and consent to the church using it for enrollment.', 'أؤكد صحة المعلومات وأوافق على استخدامها للتسجيل.')}
                </label>

              </div>
            )}

            <div className="flex items-center justify-between pt-4 gap-3">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />{t('Back', 'رجوع')}
                </Button>
              ) : (
                <span />
              )}
              {step < 4 ? (
                <div className="flex-1 flex flex-col gap-2">
                  <Button onClick={() => setStep(s => s + 1)} disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)} className="w-full">
                    {t('Continue', 'متابعة')} <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  {((step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)) && (
                    <p className="text-xs text-center text-gray-500">{t('Complete all required fields above', 'أكمل جميع الحقول المطلوبة أعلاه')}</p>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-2">
                  <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-full bg-gold-500 hover:bg-gold-600 text-white">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('Submit Application', 'إرسال الطلب')}
                  </Button>
                  {!canSubmit && !submitting && (
                    <p className="text-xs text-center text-gray-500">{t('Please confirm the information and check the box above', 'يرجى تأكيد المعلومات والتحقق من الصندوق أعلاه')}</p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 truncate">{value}</dd>
    </div>
  )
}

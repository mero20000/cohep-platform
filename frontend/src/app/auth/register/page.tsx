'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import {
  Eye, EyeOff, Loader2, CheckCircle2, XCircle, ArrowRight,
  BookOpen, Trophy, Calendar, Users, Music, Globe,
  Sparkles, Shield, Heart, Star, Building2, ChevronDown,
} from 'lucide-react'
import { countries as allCountries, countriesCities } from '@/data/countries-cities'
import { languages as allLanguages } from '@/data/languages'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const features = [
  { icon: BookOpen, text: '255+ Coptic Hymns' },
  { icon: Trophy, text: 'Gamified Learning & XP' },
  { icon: Calendar, text: 'Smart Academic Calendar' },
  { icon: Users, text: 'Multi-Role Access' },
  { icon: Music, text: 'Coptic Script & Audio' },
  { icon: Globe, text: 'English & Arabic' },
]



// Common Coptic diaspora countries sorted to top
const DIASPORA_COUNTRIES = ['Egypt', 'United States', 'Canada', 'Australia', 'United Kingdom']
const countries = [
  ...DIASPORA_COUNTRIES.filter(c => allCountries.includes(c)),
  ...allCountries.filter(c => !DIASPORA_COUNTRIES.includes(c)),
]

// Restrict languages to Coptic + common school languages
const RELEVANT_LANG_CODES = ['cop', 'en', 'ar', 'fr', 'de', 'el', 'it', 'pt', 'es', 'ro', 'ru', 'tr', 'am', 'ti']
const languages = [
  { code: 'cop', name: 'Coptic / ϯⲙⲉⲧⲣⲉⲙⲛ̀ⲭⲏⲙⲓ' },
  ...allLanguages.filter(l => RELEVANT_LANG_CODES.includes(l.code) && l.code !== 'cop'),
]

const INPUT_CLASS = "block w-full min-h-[48px] rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20 transition-all"
const INPUT_ERROR_CLASS = "block w-full min-h-[48px] rounded-lg border border-red-300 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
const SELECT_CLASS = "block w-full min-h-[48px] rounded-lg border border-gray-200 bg-white px-4 py-3 pe-10 text-sm shadow-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20 transition-all appearance-none cursor-pointer"
const SELECT_ERROR_CLASS = "block w-full min-h-[48px] rounded-lg border border-red-300 bg-white px-4 py-3 pe-10 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all appearance-none cursor-pointer"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_RE = /^\+[0-9]{7,15}$/

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    churchName: '', country: '', city: '', educationLanguage: 'en', mobileNumber: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [regStep, setRegStep] = useState<1|2|3>(1)


  const errorRef = useRef<HTMLDivElement>(null)

  const lang = useLanguage()
  const isAr = lang === 'ar'

  const debouncedEmail = useDebounce(form.email, 500)
  const debouncedPassword = useDebounce(form.password, 500)
  const debouncedConfirm = useDebounce(form.confirmPassword, 500)

  const passwordChecks = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'Contains a number', ok: /\d/.test(form.password) },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(form.password) },
  ]

  const availableCities = form.country ? countriesCities[form.country] || [] : []

  const validateField = useCallback((name: string, value: string): string => {
    switch (name) {
      case 'email':
        if (!value) return 'Email is required'
        if (!EMAIL_RE.test(value)) return 'Enter a valid email address'
        return ''
      case 'password':
        if (!value) return 'Password is required'
        if (value.length < 8) return 'At least 8 characters'
        if (!/\d/.test(value)) return 'Must contain a number'
        if (!/[A-Z]/.test(value)) return 'Must contain an uppercase letter'
        return ''
      case 'confirmPassword':
        if (!value) return 'Confirm your password'
        if (value !== form.password) return 'Passwords do not match'
        return ''
      case 'mobileNumber':
        if (!value) return 'Mobile number is required'
        if (!MOBILE_RE.test(value)) return 'Format: +201001234567'
        return ''
      case 'churchName':
        if (!value) return 'Church name is required'
        return ''
      case 'firstName':
        if (!value) return 'First name is required'
        return ''
      case 'lastName':
        if (!value) return 'Last name is required'
        return ''
      case 'country':
        if (!value) return 'Select a country'
        return ''
      case 'city':
        if (!value) return 'Select a city'
        return ''
      default:
        return ''
    }
  }, [form.password])

  // Debounced field validation
  useEffect(() => {
    if (touched.email) setFieldErrors(prev => ({ ...prev, email: validateField('email', debouncedEmail) }))
  }, [debouncedEmail, touched.email, validateField])

  useEffect(() => {
    if (touched.password) setFieldErrors(prev => ({ ...prev, password: validateField('password', debouncedPassword) }))
  }, [debouncedPassword, touched.password, validateField])

  useEffect(() => {
    if (touched.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: validateField('confirmPassword', debouncedConfirm) }))
  }, [debouncedConfirm, touched.confirmPassword, validateField])

  const update = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'country') next.city = ''
      return next
    })
    if (touched[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: validateField(field, value) }))
    }
    if (field === 'password' && form.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: validateField('confirmPassword', form.confirmPassword) }))
    }
  }

  const validateStep = (s: 1|2|3): boolean => {
    const stepFields: Record<number,string[]> = {
      1: ['churchName','email','password','confirmPassword'],
      2: ['firstName','lastName'],
      3: ['country','city'],
    }
    const fields = stepFields[s]
    const errs: Record<string,string> = {}
    for (const f of fields) {
      const e = validateField(f, form[f as keyof typeof form])
      if (e) errs[f] = e
    }
    setFieldErrors(p => ({...p,...errs}))
    setTouched(p => ({...p,...Object.fromEntries(fields.map(f=>[f,true]))}))
    return Object.keys(errs).length === 0
  }
  const handleNext = () => { if (validateStep(regStep)) setRegStep(s => (Math.min(3,s+1) as 1|2|3)) }

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    setFieldErrors(prev => ({ ...prev, [field]: validateField(field, form[field as keyof typeof form]) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate all fields
    const allErrors: Record<string, string> = {}
    const fields = ['churchName', 'firstName', 'lastName', 'email', 'password', 'confirmPassword', 'country', 'city', 'mobileNumber']
    for (const f of fields) {
      const err = validateField(f, form[f as keyof typeof form])
      if (err) allErrors[f] = err
    }
    setFieldErrors(allErrors)
    setTouched(Object.fromEntries(fields.map(f => [f, true])))

    if (Object.keys(allErrors).length > 0) {
      const firstInvalid = fields.find(f => allErrors[f])
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          churchName: form.churchName,
          country: form.country,
          city: form.city,
          educationLanguage: form.educationLanguage,
          mobileNumber: form.mobileNumber,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.message
        if (typeof msg === 'string') {
          if (msg.toLowerCase().includes('email')) setFieldErrors(p => ({ ...p, email: msg }))
          else if (msg.toLowerCase().includes('password')) setFieldErrors(p => ({ ...p, password: msg }))
          else setError(msg)
        } else if (Array.isArray(msg)) {
          setError(msg.join(', '))
        } else {
          setError('Registration failed')
        }
        setLoading(false)
        return
      }

      if (data.pending) {
        setSubmitted(true)
        setLoading(false)
        return
      }

      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/dashboard')
    } catch {
      setError('Connection failed. Please try again.')
      setLoading(false)
    }
  }

  const err = (name: string) => touched[name] ? fieldErrors[name] : ''

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus()
    }
  }, [error])

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-md mx-auto px-6 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 mb-6">
            <CheckCircle2 className="h-8 w-8 text-gold-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            {isAr ? 'تم تقديم طلب التسجيل' : 'Registration Submitted'}
          </h1>
          <p className="text-gray-400 text-lg mb-2">
            {isAr ? (
              <>تم إرسال طلب تسجيل الكنيسة <strong className="text-white">{form.churchName}</strong> للمراجعة.</>
            ) : (
              <>Your church registration for <strong className="text-white">{form.churchName}</strong> has been submitted for review.</>
            )}
          </p>
          <p className="text-gray-500 text-sm mb-8">
            {isAr ? (
              <>ستصلك رسالة إلكترونية على <strong className="text-gray-300">{form.email}</strong> فور اعتماد حسابك. تتم مراجعة معظم طلبات الكنائس خلال 48 ساعة.</>
            ) : (
              <>You will receive an email at <strong className="text-gray-300">{form.email}</strong> once your account is approved. Most churches are reviewed within 48 hours.</>
            )}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-3 text-gray-950 font-semibold hover:from-gold-400 hover:to-gold-500 transition-all"
            >
              {isAr ? 'الذهاب إلى تسجيل الدخول' : 'Go to Login'} <ArrowRight className="h-4 w-4 rtl-flip" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />

        <div className="relative flex flex-col justify-between px-12 xl:px-16 py-12">
          <Link href="/" className="flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded-lg">
            <Image src="/cohep-logo.png" alt="COHEP" width={80} height={80} className="h-20 w-20 rounded-xl object-contain shadow-lg shadow-gold-500/30" />
          </Link>

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-gold-500/20 px-4 py-1.5 text-sm font-medium text-gold-400 w-fit mb-6">
              <Sparkles className="h-4 w-4" />
              Join 255+ Hymns
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Start Your{' '}
              <span className="bg-gradient-to-r from-gold-400 to-blue-500 bg-clip-text text-transparent">
                Hymn Education
              </span>{' '}
              Journey Today
            </h1>
            <p className="mt-5 text-lg text-gray-400 leading-relaxed">
              Register your church to get started with 255+ hymns, gamified learning, and a supportive community.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {features.map((f) => (
                <div key={f.text} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-gold-400">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-gray-300">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-8 pt-8 border-t border-white/10">
            {[
              { value: '255+', label: isAr ? 'ترنيمة' : 'Hymns' },
              { value: '10', label: isAr ? 'مستويات' : 'Levels' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-bold text-gold-400">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 py-10 sm:px-12 lg:px-16 xl:px-20 bg-gradient-to-br from-white via-gray-50 to-blue-50/30 overflow-y-auto">
        <div className="my-auto mx-auto w-full max-w-md">
          <Link href="/" className="flex items-center gap-3 mb-6 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded-lg">
            <Image src="/cohep-logo.png" alt="COHEP" width={64} height={64} className="h-16 w-16 rounded-lg object-contain shadow-md" />
          </Link>

          <div className="mb-6 text-center lg:text-start">
            <div className="inline-flex items-center gap-2 rounded-full bg-gold-50 border border-gold-500/20 px-3 py-1 text-xs font-medium text-gold-700 mb-3">
              <Sparkles className="h-3 w-3" />
              {isAr ? 'ابدأ مجاناً' : 'Free for churches'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              {isAr ? 'سجل كنيستك' : 'Register Your Church'}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
              <Link href="/auth/login" className="inline-flex items-center gap-1 font-semibold text-gold-700 hover:text-gold-700 transition-colors">
                {isAr ? 'تسجيل الدخول' : 'Sign in'} <ArrowRight className="h-3.5 w-3.5 rtl-flip" />
              </Link>
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Step progress */}
              <div className="flex items-center gap-1.5 mb-1">
                {([
                  {n:1 as const,en:'Church',ar:'الكنيسة'},
                  {n:2 as const,en:'Your details',ar:'بياناتك'},
                  {n:3 as const,en:'Location',ar:'الموقع'},
                ]).map((s,i)=>(
                  <div key={s.n} className="flex items-center gap-1.5 flex-1">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${regStep>s.n?'bg-green-500 text-white':regStep===s.n?'bg-gold-500 text-gray-950 shadow shadow-gold-200':'bg-gray-100 text-gray-400'}`}>
                      {regStep>s.n?'✓':s.n}
                    </div>
                    <span className={`text-[11px] font-medium hidden sm:block whitespace-nowrap ${regStep===s.n?'text-gray-700':'text-gray-400'}`}>{isAr?s.ar:s.en}</span>
                    {i<2&&<div className={`flex-1 h-0.5 rounded-full transition-all ${regStep>s.n?'bg-green-400':'bg-gray-200'}`}/>}
                  </div>
                ))}
              </div>

              {error && (
                <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2 focus:outline-none">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                    <span className="text-xs font-bold text-red-600">!</span>
                  </div>
                  {error}
                </div>
              )}

              {/* ── Step 1: Church + credentials ── */}
              {regStep===1&&<>
              <div>
                <label htmlFor="churchName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'اسم الكنيسة' : 'Church Name'}
                </label>
                <input id="churchName" type="text" value={form.churchName} onChange={(e) => update('churchName', e.target.value)} onBlur={() => handleBlur('churchName')} required autoComplete="organization" className={err('churchName') ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder={isAr ? 'مثال: كنيسة القديس مارمرقس' : 'e.g. St. Mark Coptic Orthodox Church'} />
                {err('churchName') && <p role="alert" className="mt-1 text-xs text-red-600">{err('churchName')}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr ? 'البريد الإلكتروني' : 'Email address'}</label>
                <input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} onBlur={() => handleBlur('email')} required autoComplete="email" className={err('email') ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder="you@example.com" />
                {err('email') && <p role="alert" className="mt-1 text-xs text-red-600">{err('email')}</p>}
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr ? 'كلمة المرور' : 'Password'}</label>
                <div className="relative">
                  <input id="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} onFocus={() => setPasswordFocused(true)} onBlur={() => { handleBlur('password'); setPasswordFocused(false) }} required autoComplete="new-password" className={(err('password') ? INPUT_ERROR_CLASS : INPUT_CLASS) + " pe-11"} placeholder={isAr ? 'إنشاء كلمة مرور قوية' : 'Create a strong password'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide' : 'Show'} className="absolute end-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {(passwordFocused || form.password) && (
                  <div className="mt-3 space-y-1.5">
                    {passwordChecks.map((check) => (
                      <div key={check.label} className="flex items-center gap-2 text-xs">
                        {check.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                        <span className={check.ok ? 'text-green-700 font-medium' : 'text-gray-500'}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {err('password') && !passwordFocused && <p role="alert" className="mt-1 text-xs text-red-600">{err('password')}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}</label>
                <input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => { setForm({ ...form, confirmPassword: e.target.value }) }} onBlur={() => handleBlur('confirmPassword')} required autoComplete="new-password" className={err('confirmPassword') ? INPUT_ERROR_CLASS : INPUT_CLASS} placeholder={isAr ? 'تأكيد كلمة المرور' : 'Confirm your password'} />
                {err('confirmPassword') && <p role="alert" className="mt-1 text-xs text-red-600">{err('confirmPassword')}</p>}
              </div>
              <button type="button" onClick={handleNext} className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 px-4 py-3 text-sm font-semibold text-gray-950 shadow-lg shadow-gold-200 hover:from-gold-400 hover:to-gold-500 transition-all">
                {isAr ? 'التالي ←' : 'Continue →'}
              </button>
              </>}

              {/* ── Step 2: Name + Mobile ── */}
              {regStep===2&&<div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr?'الاسم الأول':'First name'}</label>
                  <input id="firstName" type="text" value={form.firstName} onChange={e=>update('firstName',e.target.value)} onBlur={()=>handleBlur('firstName')} required autoComplete="given-name" className={err('firstName')?INPUT_ERROR_CLASS:INPUT_CLASS} placeholder={isAr?'يوحنا':'John'} />
                  {err('firstName')&&<p role="alert" className="mt-1 text-xs text-red-600">{err('firstName')}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr?'الاسم الأخير':'Last name'}</label>
                  <input id="lastName" type="text" value={form.lastName} onChange={e=>update('lastName',e.target.value)} onBlur={()=>handleBlur('lastName')} required autoComplete="family-name" className={err('lastName')?INPUT_ERROR_CLASS:INPUT_CLASS} placeholder={isAr?'بطرس':'Peters'} />
                  {err('lastName')&&<p role="alert" className="mt-1 text-xs text-red-600">{err('lastName')}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr?'رقم الجوال':'Mobile'} <span className="text-gray-400 font-normal">({isAr?'اختياري':'optional'})</span></label>
                <input id="mobileNumber" type="tel" value={form.mobileNumber} onChange={e=>update('mobileNumber',e.target.value)} autoComplete="tel" className={INPUT_CLASS} placeholder="+201001234567" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setRegStep(1)} className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">{isAr?'← رجوع':'← Back'}</button>
                <button type="button" onClick={handleNext} className="flex-1 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 py-3 text-sm font-semibold text-gray-950 hover:from-gold-400 hover:to-gold-500 transition-all">{isAr?'التالي →':'Continue →'}</button>
              </div>
              </div>}

              {/* ── Step 3: Location + Submit ── */}
              {regStep===3&&<div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr?'الدولة':'Country'}</label>
                  <div className="relative">
                    <select id="country" value={form.country} onChange={(e) => update('country', e.target.value)} onBlur={() => handleBlur('country')} required autoComplete="country-name" className={err('country') ? SELECT_ERROR_CLASS : SELECT_CLASS}>
                      <option value="">{isAr?'اختر الدولة':'Select country'}</option>
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute end-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    {err('country')&&<p role="alert" className="mt-1 text-xs text-red-600">{err('country')}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1.5">{isAr?'المدينة':'City'}</label>
                  <div className="relative">
                    <select id="city" value={form.city} onChange={(e) => update('city', e.target.value)} onBlur={() => handleBlur('city')} required disabled={!form.country} className={(err('city') ? SELECT_ERROR_CLASS : SELECT_CLASS) + " disabled:bg-gray-50 disabled:text-gray-400"}>
                      <option value="">{form.country?(isAr?'اختر المدينة':'Select city'):(isAr?'اختر الدولة أولاً':'Select country first')}</option>
                      {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute end-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    {err('city')&&<p role="alert" className="mt-1 text-xs text-red-600">{err('city')}</p>}
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="educationLanguage" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr?'لغة التعليم':'Education Language'}
                  <span className="ms-1 text-xs font-normal text-gray-400">({isAr?'لغة التدريس':'language of instruction'})</span>
                </label>
                <div className="relative">
                  <select id="educationLanguage" value={form.educationLanguage} onChange={(e) => update('educationLanguage', e.target.value)} required className={SELECT_CLASS}>
                    {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                  <ChevronDown className="absolute end-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setRegStep(2)} className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">{isAr?'← رجوع':'← Back'}</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 py-3 text-sm font-semibold text-gray-950 shadow-lg shadow-gold-200 hover:from-gold-400 hover:to-gold-500 disabled:opacity-60 transition-all">
                  {loading?<Loader2 className="h-4 w-4 animate-spin"/>:<><Building2 className="h-4 w-4"/>{isAr?'إنشاء حساب':'Create Account'}</>}
                </button>
              </div>
              <p className="text-center text-xs text-gray-400">
                {isAr?'بالتسجيل، أنت توافق على':'By registering, you agree to our'}{' '}
                <a href="/terms" className="text-gold-700 hover:underline font-medium">{isAr?'شروط الخدمة':'Terms of Service'}</a>
                {' '}{isAr?'و':'and'}{' '}
                <a href="/privacy" className="text-gold-700 hover:underline font-medium">{isAr?'سياسة الخصوصية':'Privacy Policy'}</a>
              </p>
              </div>}
            </form>
          </div>

          <div className="mt-6 flex items-center justify-center gap-5 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>{isAr ? 'مشفر SSL' : 'SSL Encrypted'}</span>
            </div>
            <div className="h-3 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5" />
              <span>{isAr ? 'مصمم للكنائس' : 'Made for Churches'}</span>
            </div>
            <div className="h-3 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" />
              <span>{isAr ? 'مجاني' : 'Free'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/lib/use-language'
import ForgotPasswordPanel from '@/components/auth/forgot-password-panel'
import {
  Eye, EyeOff, Loader2, BookOpen, Trophy, Calendar, Search,
  Users, Music, Globe, ArrowRight, Sparkles, Shield, Heart, Star,
  AlertCircle, CheckCircle2, AlertTriangle, Cross,
} from 'lucide-react'

const features = [
  { icon: BookOpen, text: '255+ Coptic Hymns' },
  { icon: Trophy, text: 'Gamified Learning & XP' },
  { icon: Calendar, text: 'Smart Academic Calendar' },
  { icon: Users, text: 'Multi-Role Access' },
  { icon: Music, text: 'Coptic Script & Audio' },
  { icon: Globe, text: 'English & Arabic' },
]

const INPUT_CLASS =
  "block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 min-h-[48px] text-sm shadow-sm placeholder:text-gray-500 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20 transition-all"
const INPUT_ERROR_CLASS =
  "block w-full rounded-lg border border-red-300 bg-white px-4 py-3 min-h-[48px] text-sm shadow-sm placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const lang = useLanguage()
  const isAr = lang === 'ar'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [capsLock, setCapsLock] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [coldStartWarning, setColdStartWarning] = useState(false)
  const [schoolSuggestions, setSchoolSuggestions] = useState<Array<{slug:string;name:string;nameAr?:string;churchName?:string;churchNameAr?:string;city?:string;label:string}>>([])
  const [schoolSearchLoading, setSchoolSearchLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>('')
  const schoolSearchRef = useRef<HTMLDivElement>(null)
  const schoolDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordHintRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('remembered_email')
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  useEffect(() => {
    if (error) {
      emailRef.current?.focus()
    }
  }, [error])

  const validateEmail = (value: string) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError(isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address')
    } else {
      setEmailError('')
    }
  }


  const handleSchoolSearch = useCallback((value: string) => {
    setSchoolId(value)
    setSelectedSuggestion('')
    clearTimeout(schoolDebounceRef.current)
    if (!value.trim() || value.length < 2) { setSchoolSuggestions([]); setShowSuggestions(false); return }
    schoolDebounceRef.current = setTimeout(async () => {
      setSchoolSearchLoading(true)
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
        const res = await fetch(`${API}/auth/schools/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSchoolSuggestions(Array.isArray(data) ? data : [])
        setShowSuggestions(true)
      } catch { setSchoolSuggestions([]) }
      setSchoolSearchLoading(false)
    }, 300)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (schoolSearchRef.current && !schoolSearchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setColdStartWarning(false)
    const coldTimer = setTimeout(() => setColdStartWarning(true), 4000)
    setError('')
    setEmailError('')

    if (rememberMe) {
      localStorage.setItem('remembered_email', email)
    } else {
      localStorage.removeItem('remembered_email')
    }

    try {
      await login(email, password, schoolId || undefined)
      clearTimeout(coldTimer)
      setColdStartWarning(false)
      setShowSuccess(true)
      await new Promise((r) => setTimeout(r, 800))
      router.replace('/dashboard')
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('ThrottlerException')) {
        setError(
          isAr
            ? 'محاولات تسجيل دخول كثيرة. يرجى الانتظار 30 ثانية قبل المحاولة مرة أخرى.'
            : 'Too many login attempts. Please wait 30 seconds before trying again.'
        )
      } else if (msg.includes('Invalid credentials') || msg.includes('401')) {
        setError(isAr ? 'بريد إلكتروني أو كلمة مرور غير صحيحة. حاول مرة أخرى.' : 'Invalid email or password. Please try again.')
      } else {
        setError(
          msg ||
            (isAr
              ? 'فشل الاتصال. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'
              : 'Connection failed. Please check your internet and try again.')
        )
      }
      setLoading(false)
      setColdStartWarning(false)
      clearTimeout(coldTimer)
    }
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-blue-50/30" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="text-center animate-in fade-in zoom-in duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <p className="mt-4 text-lg font-semibold text-gray-900">{isAr ? 'مرحبًا بعودتك!' : 'Welcome back!'}</p>
          <p className="mt-1 text-sm text-gray-500">{isAr ? 'جارٍ نقلك إلى لوحة التحكم...' : 'Taking you to your dashboard...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Left panel - branding & features */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />

        <div className="relative flex flex-col justify-between px-12 xl:px-16 py-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded-lg">
            <Image src="/cohep-logo.png" alt="COHEP" width={64} height={64} className="h-16 w-16 rounded-xl object-contain shadow-lg shadow-gold-500/30" />
          </Link>

          {/* Hero content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-gold-500/20 px-4 py-1.5 text-sm font-medium text-gold-400 w-fit mb-6">
              <Sparkles className="h-4 w-4" />
              {isAr ? 'مرحبًا بعودتك' : 'Welcome Back'}
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              {isAr ? 'واصل رحلتك في' : 'Continue Your'}{' '}
              <span className="bg-gradient-to-r from-gold-400 to-blue-500 bg-clip-text text-transparent">
                {isAr ? 'تعليم الترانيم' : 'Hymn Education'}
              </span>{' '}
              {isAr ? '' : 'Journey'}
            </h1>
            <p className="mt-5 text-lg text-gray-400 leading-relaxed">
              {isAr
                ? 'سجّل الدخول للوصول إلى فصولك ومتابعة نقاط XP وشاراتك، وواصل إتقان الترانيم القبطية.'
                : 'Sign in to access your classes, track your XP and badges, and continue mastering Coptic hymns.'}
            </p>

            {/* Feature pills */}
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

          {/* Bottom stats */}
          <div className="flex items-center gap-8 pt-8 border-t border-white/10">
            {[
              { value: '255+', label: isAr ? 'ترنيمة' : 'Hymns' },
              { value: '10', label: isAr ? 'مستويات' : 'Levels' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-bold text-gold-400">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-20 bg-gradient-to-br from-white via-gray-50 to-blue-50/30 overflow-y-auto">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded-lg">
            <Image src="/cohep-logo.png" alt="COHEP" width={48} height={48} className="h-12 w-12 rounded-lg object-contain" />
          </Link>

          <div className="mb-6 text-center lg:text-start">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              {isAr ? 'ليس لديك حساب؟' : "Don&apos;t have an account?"}{' '}
              <Link href="/auth/register" className="inline-flex items-center gap-1 font-semibold text-gold-700 hover:text-gold-500 transition-colors">
                {isAr ? 'أنشئ حسابًا مجانًا' : 'Create one free'} <ArrowRight className="h-3.5 w-3.5 rtl-flip" />
              </Link>
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-3"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-red-600">!</span>
                  </div>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'البريد الإلكتروني' : 'Email address'}
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) validateEmail(e.target.value)
                  }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  autoComplete="email"
                  required
                  aria-invalid={emailError ? 'true' : undefined}
                  aria-describedby={emailError ? 'email-error' : undefined}
                  className={emailError ? INPUT_ERROR_CLASS : INPUT_CLASS}
                  placeholder="you@example.com"
                />
                {emailError && (
                  <p id="email-error" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLock(false)}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    aria-describedby={
                      [
                        error ? 'login-error' : '',
                        !password ? 'password-hint' : '',
                        capsLock ? 'caps-lock-warning' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    className={(password && password.length > 0 && password.length < 8 ? INPUT_ERROR_CLASS : INPUT_CLASS) + " pe-11"}
                    placeholder={isAr ? 'أدخل كلمة المرور' : 'Enter your password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                    aria-pressed={showPassword}
                    className="absolute end-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-gray-500 hover:text-gray-700 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!password && (
                  <p id="password-hint" ref={passwordHintRef} className="mt-1.5 text-xs text-gray-500">
                    {isAr ? '8 أحرف على الأقل' : 'At least 8 characters'}
                  </p>
                )}
                {password && password.length < 8 && (
                  <p id="password-error" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters'}
                  </p>
                )}
                {capsLock && (
                  <p id="caps-lock-warning" className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {isAr ? 'Caps Lock مفعّل — كلمة المرور حساسة لحالة الأحرف' : 'Caps Lock is on — passwords are case-sensitive'}
                  </p>
                )}
              </div>

              <div ref={schoolSearchRef} className="relative">
                <label htmlFor="schoolId" className="block text-sm font-medium text-gray-700 mb-1.5">
                  {isAr ? 'اسم الكنيسة أو المدرسة' : 'Church or School name'} <span className="text-gray-500 font-normal">({isAr ? 'اختياري' : 'optional'})</span>
                </label>
                <div className="relative">
                  <input
                    id="schoolId"
                    type="text"
                    value={schoolId}
                    onChange={(e) => handleSchoolSearch(e.target.value)}
                    onFocus={() => { if (schoolSuggestions.length > 0) setShowSuggestions(true) }}
                    autoComplete="off"
                    className={INPUT_CLASS + " pe-9"}
                    placeholder={isAr ? 'ابحث باسم الكنيسة…' : 'Search by church name…'}
                  />
                  <div className="absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {schoolSearchLoading
                      ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      : <Search className="h-4 w-4 text-gray-300" />}
                  </div>
                </div>
                {showSuggestions && schoolSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    {schoolSuggestions.map((s) => (
                      <button
                        key={s.slug}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSchoolId(s.slug)
                          setSelectedSuggestion(s.slug)
                          setShowSuggestions(false)
                          setSchoolSuggestions([])
                        }}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gold-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-50 mt-0.5">
                          <Cross className="h-4 w-4 text-gold-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {isAr && s.nameAr ? s.nameAr : s.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {isAr && s.churchNameAr ? s.churchNameAr : s.churchName}
                            {s.city ? ` · ${s.city}` : ''}
                          </p>
                          <p className="text-[10px] text-gray-300 mt-0.5 font-mono">{s.slug}</p>
                        </div>
                        {selectedSuggestion === s.slug && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-1" />
                        )}
                      </button>
                    ))}
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400">
                        {isAr ? 'لا تجد كنيستك؟ اكتب المعرف مباشرة.' : "Can't find your church? Type the ID directly."}
                      </p>
                    </div>
                  </div>
                )}
                {selectedSuggestion && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {isAr ? 'تم اختيار الكنيسة' : 'Church selected'}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between min-h-[44px]">
                <label className="flex items-center gap-2.5 cursor-pointer group py-2 min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-6 w-6 rounded border-gray-300 text-gold-600 focus:ring-gold-500 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors select-none">{isAr ? 'تذكرني' : 'Remember me'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(!showForgot)}
                  aria-expanded={showForgot}
                  className="text-sm font-semibold text-gold-700 hover:text-gold-500 transition-colors py-2 min-h-[44px]"
                >
                  {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              </div>

              {showForgot && (
                <ForgotPasswordPanel defaultEmail={email} defaultSchoolId={schoolId} />
              )}

              {coldStartWarning && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">☕</span>
                  <div>
                    <p className="font-semibold">{isAr ? 'الخادم يستيقظ…' : 'Server is waking up…'}</p>
                    <p className="text-amber-700 mt-0.5">{isAr ? 'يحدث هذا فقط عند أول تسجيل دخول بعد فترة هدوء. سيستغرق 20–30 ثانية.' : 'This only happens on the first login after a quiet period. It will take 20–30 seconds.'}</p>
                  </div>
                </div>
              )}
              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-gold-200 hover:shadow-xl hover:shadow-gold-200"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {isAr ? 'جارٍ تسجيل الدخول...' : 'Signing in...'}
                  </>
                ) : (
                  isAr ? 'تسجيل الدخول' : 'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-500">
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
    </div>
  )
}

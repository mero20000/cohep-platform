'use client'

import { ReactNode, useEffect, useState } from 'react'
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react'
import { useLanguage } from '@/lib/use-language'
import { getGreeting, getGreetingAr } from '@/lib/datetime'
import { Sun } from 'lucide-react'

export interface DashboardHeroProps {
  bg: string
  title: ReactNode
  greeting?: ReactNode
  badges?: ReactNode
  logos?: ReactNode
  avatar?: ReactNode
  description?: ReactNode
  children?: ReactNode
  orbTint?: string
}

export default function DashboardHero({
  bg,
  title,
  greeting,
  badges,
  logos,
  avatar,
  description,
  children,
  orbTint = 'bg-blue-500/10',
}: DashboardHeroProps) {
  const lang = useLanguage()
  const reduce = useReducedMotion()
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(max-width: 640px)')
    const h = () => setIsMobile(m.matches)
    h(); m.addEventListener('change', h); return () => m.removeEventListener('change', h)
  }, [])
  const disableMotion = reduce || isMobile
  const { scrollY } = useScroll()
  const springConfig = { stiffness: 80, damping: 20, mass: 0.5 }
  const orb1Y = useSpring(useTransform(scrollY, [0, 400], [0, disableMotion ? 0 : -15]), springConfig)
  const orb2Y = useSpring(useTransform(scrollY, [0, 400], [0, disableMotion ? 0 : 20]), springConfig)
  const curveY = useSpring(useTransform(scrollY, [0, 400], [0, disableMotion ? 0 : -6]), springConfig)

  return (
    <div className="relative overflow-hidden rounded-b-[28px] sm:rounded-b-2xl px-5 pt-7 pb-8 sm:p-8" style={{ backgroundColor: bg }}>
      <motion.div className="absolute -top-6 left-1/2 -translate-x-1/2 w-[120%] h-12 rounded-[50%] bg-blue-500/5" style={{ y: curveY }} />
      <motion.div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" style={{ y: orb1Y }} />
      <motion.div className={`absolute bottom-0 right-1/4 w-48 h-48 ${orbTint} rounded-full blur-3xl`} style={{ y: orb2Y }} />
      <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:18px_18px]" />
      {/* gold hairline */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />

      <div className="relative flex items-start justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
          {avatar && (
            <div className="shrink-0 rounded-2xl border-2 border-white/20 overflow-hidden shadow-lg shadow-black/20">{avatar}</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] border border-white/10 px-2.5 py-1 text-gold-200 text-xs font-semibold tracking-wide mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50">
              {greeting ?? (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span>{lang === 'ar' ? getGreetingAr() : getGreeting()}</span>
                </>
              )}
            </div>
            <h1 className="text-[1.75rem] leading-[1.1] tracking-tight sm:text-3xl font-bold text-white">{title}</h1>
            {badges && <div className="flex flex-wrap items-center gap-2 mt-2">{badges}</div>}
            {description && <div className="text-sm mt-3 text-white/70 leading-relaxed">{description}</div>}
            {/* mobile logos — shown inline on mobile */}
            {logos && <div className="flex sm:hidden items-center gap-2.5 mt-3.5">{logos}</div>}
          </div>
        </div>
        {logos && <div className="hidden sm:flex items-center gap-4 shrink-0">{logos}</div>}
      </div>

      {children && <div className="relative mt-6 sm:mt-6">{children}</div>}
    </div>
  )
}

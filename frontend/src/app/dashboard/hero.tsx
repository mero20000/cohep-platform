'use client'

import { ReactNode } from 'react'
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
  children?: ReactNode
}

export default function DashboardHero({
  bg,
  title,
  greeting,
  badges,
  logos,
  children,
}: DashboardHeroProps) {
  const lang = useLanguage()
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const springConfig = { stiffness: 80, damping: 20, mass: 0.5 }
  const orb1Y = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : -15]), springConfig)
  const orb2Y = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : 20]), springConfig)
  const curveY = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : -6]), springConfig)

  return (
    <div className="relative overflow-hidden rounded-b-[2rem] p-6 sm:p-8" style={{ backgroundColor: bg }}>
      <motion.div className="absolute -top-6 left-1/2 -translate-x-1/2 w-[120%] h-12 rounded-[50%] bg-blue-500/5" style={{ y: curveY }} />
      <motion.div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" style={{ y: orb1Y }} />
      <motion.div className="absolute bottom-0 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" style={{ y: orb2Y }} />
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:20px_20px]" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-gold-400 text-sm font-medium mb-2">
            {greeting ?? (
              <>
                <Sun className="h-4 w-4" />
                <span>{lang === 'ar' ? getGreetingAr() : getGreeting()}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
          {badges && <div className="flex items-center gap-2 mt-1.5">{badges}</div>}
        </div>
        {logos && <div className="flex items-center gap-4 shrink-0">{logos}</div>}
      </div>

      {children && <div className="relative mt-6">{children}</div>}
    </div>
  )
}

'use client'

import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion'

export function HeroCross3D() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const parallaxY = useSpring(useTransform(scrollY, [0, 400], [0, reduce ? 0 : -25]), { stiffness: 80, damping: 20 })

  if (reduce) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <CrossSVG className="w-[420px] h-[420px] opacity-[0.08]" />
      </div>
    )
  }

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      style={{ y: parallaxY }}
    >
      <motion.div
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        style={{ rotateX: 10, rotateZ: 0 }}
      >
        <CrossSVG className="w-[420px] h-[420px] opacity-[0.08]" />
      </motion.div>
    </motion.div>
  )
}

function CrossSVG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Radial glow behind the cross */}
        <radialGradient id="crossBloom" cx="50%" cy="48%" r="45%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.9" />
          <stop offset="30%" stopColor="#F59E0B" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#B45309" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#451A03" stopOpacity="0" />
        </radialGradient>

        {/* Horizontal beam glow */}
        <linearGradient id="hGlow" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0" />
          <stop offset="30%" stopColor="#FDE68A" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#FEF3C7" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#FDE68A" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </linearGradient>

        {/* Vertical beam glow */}
        <linearGradient id="vGlow" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0" />
          <stop offset="30%" stopColor="#FDE68A" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#FEF3C7" stopOpacity="0.8" />
          <stop offset="70%" stopColor="#FDE68A" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </linearGradient>

        {/* Diagonal ray */}
        <linearGradient id="dRay" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0" />
          <stop offset="45%" stopColor="#FDE68A" stopOpacity="0.25" />
          <stop offset="55%" stopColor="#FDE68A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer radial bloom */}
      <circle cx="200" cy="200" r="190" fill="url(#crossBloom)" />

      {/* Horizontal light beam — wide and soft */}
      <rect x="0" y="175" width="400" height="50" rx="25" fill="url(#hGlow)" opacity="0.35" />

      {/* Vertical light beam — wide and soft */}
      <rect x="175" y="0" width="50" height="400" rx="25" fill="url(#vGlow)" opacity="0.3" />

      {/* Diagonal rays */}
      <line x1="30" y1="30" x2="370" y2="370" stroke="url(#dRay)" strokeWidth="2" opacity="0.4" />
      <line x1="370" y1="30" x2="30" y2="370" stroke="url(#dRay)" strokeWidth="2" opacity="0.4" />

      {/* Bright center bloom */}
      <circle cx="200" cy="195" r="35" fill="#FDE68A" opacity="0.2" />
      <circle cx="200" cy="195" r="18" fill="#FEF3C7" opacity="0.25" />

      {/* The cross — solid white */}
      <rect x="182" y="80" width="36" height="260" rx="2" fill="#FFFFFF" opacity="0.92" />
      <rect x="120" y="158" width="160" height="32" rx="2" fill="#FFFFFF" opacity="0.92" />
    </svg>
  )
}

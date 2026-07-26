'use client'

import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'framer-motion'

export function HeroAlpha() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const parallaxY = useSpring(useTransform(scrollY, [0, 500], [0, reduce ? 0 : -30]), { stiffness: 70, damping: 18 })

  if (reduce) {
    return (
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <AlphaSymbol className="absolute top-[15%] left-[8%] w-[140px] h-[140px] opacity-[0.09]" />
      </div>
    )
  }

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      style={{ y: parallaxY }}
    >
      <motion.div
        className="absolute top-[15%] left-[8%]"
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        style={{ perspective: '800px' }}
      >
        <AlphaSymbol className="w-[140px] h-[140px] opacity-[0.09]" />
      </motion.div>
    </motion.div>
  )
}

function AlphaSymbol({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Front face — cream/ivory like the reference */}
        <linearGradient id="alphaFront" x1="35%" y1="5%" x2="65%" y2="95%">
          <stop offset="0%" stopColor="#F5F0E1" />
          <stop offset="30%" stopColor="#EDE5D0" />
          <stop offset="70%" stopColor="#DDD3BA" />
          <stop offset="100%" stopColor="#CFC2A5" />
        </linearGradient>
        {/* 3D side/depth — darker tone for extrusion */}
        <linearGradient id="alphaSide" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B0A07E" />
          <stop offset="100%" stopColor="#8A7B5E" />
        </linearGradient>
        {/* Subtle highlight on the top curve */}
        <radialGradient id="alphaHighlight" cx="45%" cy="25%" r="35%">
          <stop offset="0%" stopColor="#FEFCF5" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FEFCF5" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* === 3D DEPTH LAYERS (back to front, each offset by 1-2px) === */}
      {/* Layer 8 — deepest shadow */}
      <g transform="translate(6, 8)">
        <path
          d={copticAlphaPath}
          fill="#6B5E42"
          opacity="0.3"
        />
      </g>
      {/* Layer 7 */}
      <g transform="translate(5.5, 7)">
        <path
          d={copticAlphaPath}
          fill="#7A6D50"
          opacity="0.35"
        />
      </g>
      {/* Layer 6 */}
      <g transform="translate(5, 6)">
        <path
          d={copticAlphaPath}
          fill="#8A7B5E"
          opacity="0.4"
        />
      </g>
      {/* Layer 5 */}
      <g transform="translate(4, 5)">
        <path
          d={copticAlphaPath}
          fill="#95876A"
          opacity="0.5"
        />
      </g>
      {/* Layer 4 */}
      <g transform="translate(3, 4)">
        <path
          d={copticAlphaPath}
          fill="#A09476"
          opacity="0.55"
        />
      </g>
      {/* Layer 3 */}
      <g transform="translate(2, 3)">
        <path
          d={copticAlphaPath}
          fill="#B0A07E"
          opacity="0.6"
        />
      </g>
      {/* Layer 2 */}
      <g transform="translate(1, 1.5)">
        <path
          d={copticAlphaPath}
          fill="#BFB08C"
          opacity="0.7"
        />
      </g>

      {/* === FRONT FACE === */}
      <path
        d={copticAlphaPath}
        fill="url(#alphaFront)"
      />

      {/* Highlight overlay on the front face */}
      <path
        d={copticAlphaPath}
        fill="url(#alphaHighlight)"
      />

      {/* Top edge highlight — catches light on the curve */}
      <path
        d="M105 38 C95 36, 80 42, 72 55 C64 68, 58 85, 55 100"
        stroke="#FEF9EF"
        strokeWidth="2"
        opacity="0.35"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left leg highlight */}
      <path
        d="M72 130 C65 155, 55 180, 48 205"
        stroke="#FEF9EF"
        strokeWidth="1.5"
        opacity="0.25"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* Coptic Alpha (Ⲁ) path — rounded, decorative form with bulbous top curl */
const copticAlphaPath =
  'M120 30' +
  ' C108 28, 92 32, 82 42' +        /* top curve starts */
  ' C72 52, 65 65, 60 80' +         /* descending left stroke */
  ' C55 95, 52 110, 50 125' +       /* continuing down */
  ' C47 145, 42 170, 38 195' +      /* left leg going down */
  ' C35 215, 33 230, 40 240' +      /* left foot curls out */
  ' C45 248, 55 248, 65 242' +      /* left foot base */
  ' C72 237, 78 228, 82 218' +      /* left leg curves back in */
  ' C88 202, 92 185, 98 168' +      /* inner left stroke */
  ' L108 140' +                      /* joins at center */
  ' L118 168' +                      /* inner right stroke starts */
  ' C124 185, 128 202, 132 218' +   /* right leg going down */
  ' C136 228, 142 237, 150 242' +   /* right leg curves */
  ' C158 248, 168 248, 175 240' +   /* right foot curls */
  ' C182 230, 180 215, 178 195' +   /* right foot base */
  ' C174 170, 170 145, 168 125' +   /* right leg going up */
  ' C166 110, 164 95, 162 80' +     /* continuing up */
  ' C158 65, 152 52, 142 42' +      /* ascending right stroke */
  ' C132 32, 118 28, 120 30' +      /* closes the top curl */
  ' C125 26, 135 22, 140 28' +      /* top curl bulb left */
  ' C148 38, 145 55, 138 65' +      /* curl descends */
  ' C130 78, 122 82, 118 78' +      /* curls back inward */
  ' C112 72, 115 58, 120 48' +      /* inner curl */
  ' C124 40, 122 32, 120 30 Z'      /* closes the curl loop */

'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  src: string
  caption?: string
  onClose: () => void
}

export function PhotoLightbox({ src, caption, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
        <Image
          src={src}
          alt={caption || ''}
          width={1200}
          height={900}
          sizes="(max-width: 768px) 90vw, 768px"
          priority
          className="max-w-full max-h-[80vh] w-auto h-auto rounded-lg"
        />
        {caption && <p className="text-white text-sm mt-2 text-center">{caption}</p>}
      </div>
    </div>
  )
}

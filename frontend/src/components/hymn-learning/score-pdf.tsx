'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Renders every page of a PDF as a canvas, in-page.
 *
 * A plain <iframe>/<embed> is unreliable on iPhones (they show only page 1, with no scrolling),
 * and opening the file in another tab can suspend the microphone mid-recording, so the score has
 * to live inside the page. pdf.js is imported lazily so it only loads when a PDF is shown.
 */
export default function ScorePdf({
  src, zoom, onError, label,
}: { src: string; zoom: number; onError: () => void; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let doc: { destroy: () => Promise<void>; numPages: number; getPage: (n: number) => Promise<any> } | null = null
    const host = hostRef.current
    if (!host) return

    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const task = pdfjs.getDocument({ url: src })
        doc = await task.promise
        if (cancelled || !doc) return
        host.replaceChildren()
        const cssWidth = Math.max(host.clientWidth, 280) * zoom
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          if (cancelled) return
          const base = page.getViewport({ scale: 1 })
          const scale = cssWidth / base.width
          const viewport = page.getViewport({ scale: scale * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
          canvas.style.display = 'block'
          canvas.style.margin = '0 auto 8px'
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `${label} ${n}/${doc.numPages}`)
          host.appendChild(canvas)
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
        }
        if (!cancelled) setLoading(false)
      } catch (err) {
        console.error('Score PDF failed to render:', err)
        if (!cancelled) onError()
      }
    })()

    return () => {
      cancelled = true
      void doc?.destroy().catch(() => undefined)
    }
    // onError/label are stable enough; re-render only when the file or zoom changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, zoom])

  return (
    <div>
      {loading && <p className="py-6 text-center text-xs text-gray-400" role="status">…</p>}
      <div ref={hostRef} />
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { Download } from 'lucide-react'

interface PptxViewerProps {
  url: string
  slideIndex: number
  onTotalSlides: (n: number) => void
}

const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/view.aspx'

export function PptxViewer({ url, slideIndex, onTotalSlides }: PptxViewerProps) {
  useEffect(() => {
    onTotalSlides(1)
  }, [onTotalSlides])

  const isSharePoint = /sharepoint\.com/i.test(url)
  const isRelative = url.startsWith('/')

  const fullUrl = isRelative ? window.location.origin + url : url
  const isLocal = window.location.hostname === 'localhost'

  // SharePoint — open in PowerPoint for web (can't embed cross-domain)
  if (isSharePoint) {
    const isDownloadUrl = url.includes('download.aspx')
    // For download URLs, try ms-powerpoint protocol (Windows) as primary, page link as fallback
    const pptProtocol = `ms-powerpoint:ofe|u|${encodeURIComponent(url)}`
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-8 py-16 text-center"
        style={{ color: 'rgba(255,255,255,0.35)' }}>
        <div className="rounded-full p-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <Download className="h-8 w-8" />
        </div>
        <p className="text-sm max-w-md">
          This presentation is hosted on SharePoint.
        </p>
        {isDownloadUrl ? (
          <div className="flex flex-col gap-3">
            <a href={pptProtocol}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#c9a030', color: '#0a0a0a' }}>
              <Download className="h-4 w-4" />
              Open in PowerPoint (Desktop)
            </a>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              Download file
            </a>
          </div>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#c9a030', color: '#0a0a0a' }}>
            <Download className="h-4 w-4" />
            Open in PowerPoint
          </a>
        )}
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          {isDownloadUrl
            ? 'Desktop link opens PowerPoint directly (Windows). Use Download as fallback.'
            : 'Opens SharePoint PowerPoint for web in a new tab.'}
        </p>
      </div>
    )
  }

  // Relative path uploaded to our backend — need public URL for Office viewer
  if (isRelative) {
    if (isLocal) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-8 py-16 text-center"
          style={{ color: 'rgba(255,255,255,0.35)' }}>
          <div className="rounded-full p-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Download className="h-8 w-8" />
          </div>
          <p className="text-sm max-w-md">
            Office Online viewer requires a publicly accessible URL.
            Set{' '}<code className="text-[#c9a030]">NEXT_PUBLIC_APP_URL</code> in <code className="text-[#c9a030]">.env.local</code> or use ngrok.
          </p>
          <a href={fullUrl} download
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
            <Download className="h-4 w-4" />
            Download file
          </a>
        </div>
      )
    }

    const viewerUrl = `${OFFICE_VIEWER}?src=${encodeURIComponent(fullUrl)}`
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex justify-end pb-2">
          <a href={fullUrl} download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
            <Download className="h-3 w-3" /> Download
          </a>
        </div>
        <iframe src={viewerUrl} className="w-full flex-1" style={{ border: 'none' }}
          title="Presentation" allowFullScreen />
      </div>
    )
  }

  // Non-SharePoint full URL — embed directly
  return (
    <iframe src={url} className="w-full h-full" style={{ border: 'none' }}
      title="Presentation" allowFullScreen />
  )
}

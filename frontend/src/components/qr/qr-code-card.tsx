'use client'

import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { Printer, Download, ExternalLink } from 'lucide-react'

interface StudentInfo {
  id: string
  firstName: string
  lastName: string
  studentCode?: string
  portalAccessKey?: string
}

export function StudentQrCard({ student }: { student: StudentInfo }) {
  const lang = useLanguage()
  const canvasRef = useRef<HTMLDivElement>(null)

  const portalHref = student.portalAccessKey
    ? `/student-portal/${student.portalAccessKey}`
    : `/student-portal/${student.studentCode || student.id}`

  const qrValue = JSON.stringify({ type: 'student-checkin', studentId: student.id })

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    const svg = canvasRef.current?.querySelector('svg')
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${student.firstName}-${student.lastName}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col items-center gap-3 p-6 border rounded-xl bg-white print:border-0 print:shadow-none">
      <div ref={canvasRef}>
        <QRCodeSVG
          value={qrValue}
          size={160}
          level="M"
          includeMargin
          fgColor="#1A2744"
        />
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm">{student.firstName} {student.lastName}</p>
        {student.studentCode && (
          <p className="text-xs text-muted-foreground">{student.studentCode}</p>
        )}
      </div>
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <a href={portalHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            {lang === 'ar' ? 'بوابة الطالب' : 'Student Portal'}
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5 mr-1" />
          {lang === 'ar' ? 'طباعة' : 'Print'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5 mr-1" />
          {lang === 'ar' ? 'تحميل' : 'Download'}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useCallback } from 'react'
import { useLanguage } from '@/lib/use-language'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface QrScannerProps {
  onCheckIn: (studentId: string) => Promise<{ success: boolean; message: string }>
  onClose?: () => void
}

export function QrScanner({ onCheckIn, onClose }: QrScannerProps) {
  const lang = useLanguage()
  const { toast } = useToast()
  const scannerRef = useRef<any>(null)
  const [scanning, setScanning] = useState(false)
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const startScanner = useCallback(async () => {
    setScanning(true)
    setLastResult(null)

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText: string) => {
          scanner.pause()
          setLoading(true)

          try {
            const data = JSON.parse(decodedText)
            if (data.type !== 'student-checkin' || !data.studentId) {
              setLastResult({ success: false, message: lang === 'ar' ? 'رمز QR غير صالح' : 'Invalid QR code' })
              toast('error', lang === 'ar' ? 'رمز QR غير صالح' : 'Invalid QR code')
              setTimeout(() => { scanner.resume(); setLastResult(null) }, 2000)
              return
            }
            const result = await onCheckIn(data.studentId)
            setLastResult(result)
            if (result.success) {
              toast('success', result.message)
            } else {
              toast('error', result.message)
            }
          } catch {
            setLastResult({ success: false, message: lang === 'ar' ? 'رمز QR غير صالح' : 'Invalid QR code' })
            toast('error', lang === 'ar' ? 'رمز QR غير صالح' : 'Invalid QR code')
          }

          setLoading(false)
          setTimeout(() => { scanner.resume(); setLastResult(null) }, 2000)
        },
        () => {},
      )
    } catch (err) {
      console.error('Camera error:', err)
      toast('error', lang === 'ar' ? 'تعذر الوصول للكاميرا' : 'Camera unavailable')
      setScanning(false)
    }
  }, [onCheckIn, toast, lang])

  const stopScanner = useCallback(async () => {
    setScanning(false)
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
  }, [])

  const toggleScanner = useCallback(async () => {
    if (scanning) { await stopScanner() } else { await startScanner() }
  }, [scanning, startScanner, stopScanner])

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="qr-reader"
        className={`w-full max-w-sm aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
          scanning ? 'border-amber-400' : 'border-dashed border-gray-300'
        } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {!scanning && (
          <div className="flex items-center justify-center h-full bg-gray-50 text-muted-foreground text-sm">
            <div className="text-center">
              <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {lang === 'ar' ? 'اضغط لبدء المسح' : 'Tap to start scanner'}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-amber-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          {lang === 'ar' ? 'جارٍ تسجيل الحضور...' : 'Checking in...'}
        </div>
      )}

      {lastResult && !loading && (
        <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${
          lastResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {lastResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {lastResult.message}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={toggleScanner} variant={scanning ? 'destructive' : 'default'}>
          {scanning ? (
            <><CameraOff className="h-4 w-4 mr-1" /> {lang === 'ar' ? 'إيقاف المسح' : 'Stop Scanner'}</>
          ) : (
            <><Camera className="h-4 w-4 mr-1" /> {lang === 'ar' ? 'بدء المسح' : 'Start Scanner'}</>
          )}
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </Button>
        )}
      </div>
    </div>
  )
}

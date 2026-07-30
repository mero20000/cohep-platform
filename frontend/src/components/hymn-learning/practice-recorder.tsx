'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Play, Pause, RotateCcw, Send, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface Props {
  lessonId: string
  lessonTitle: string
  referenceAudioUrl?: string
  onSubmit: (selfRating: number, recordingUrl?: string, durationSec?: number) => Promise<void>
  onCancel: () => void
  lang: 'en' | 'ar'
}

type Stage = 'idle' | 'recording' | 'recorded' | 'comparing' | 'rating' | 'submitting'

const STARS = [1, 2, 3, 4, 5]
const STAR_LABELS: Record<number, { en: string; ar: string }> = {
  1: { en: "I barely know it", ar: "أعرفه بالكاد" },
  2: { en: "I'm still learning", ar: "ما زلت أتعلم" },
  3: { en: "I know most of it", ar: "أعرف معظمه" },
  4: { en: "I know it well", ar: "أعرفه جيداً" },
  5: { en: "I know it perfectly", ar: "أتقنته تماماً" },
}

export function PracticeRecorder({ lessonId, lessonTitle, referenceAudioUrl, onSubmit, onCancel, lang }: Props) {
  const { toast } = useToast()
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en

  const [stage, setStage] = useState<Stage>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [playingRef, setPlayingRef] = useState(false)
  const [playingRec, setPlayingRec] = useState(false)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [recordingUrl, setRecordingUrl] = useState('')
  const [canRecord, setCanRecord] = useState(true)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const refAudioRef = useRef<HTMLAudioElement | null>(null)
  const recAudioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!navigator.mediaDevices) setCanRecord(false)
    return () => {
      if (recordingUrl.startsWith('blob:')) URL.revokeObjectURL(recordingUrl)
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunks.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setRecordingBlob(blob)
        setRecordingUrl(url)
        stream.getTracks().forEach(t => t.stop())
        setStage('recorded')
      }
      mr.start(100)
      mediaRecorder.current = mr
      setElapsed(0)
      setStage('recording')
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } catch (err) {
      toast('error', t('Microphone access denied', 'لم يتم السماح بالوصول إلى الميكروفون'))
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    mediaRecorder.current?.stop()
  }, [])

  const reset = () => {
    if (recordingUrl.startsWith('blob:')) URL.revokeObjectURL(recordingUrl)
    setRecordingBlob(null); setRecordingUrl(''); setElapsed(0); setRating(0); setStage('idle')
  }

  const playPause = (which: 'ref' | 'rec') => {
    const el = which === 'ref' ? refAudioRef.current : recAudioRef.current
    const other = which === 'ref' ? recAudioRef.current : refAudioRef.current
    if (!el) return
    if (other?.paused === false) { other.pause(); if (which === 'ref') setPlayingRec(false); else setPlayingRef(false) }
    if (el.paused) { el.play(); if (which === 'ref') setPlayingRef(true); else setPlayingRec(true) }
    else { el.pause(); if (which === 'ref') setPlayingRef(false); else setPlayingRec(false) }
  }

  const handleSubmit = async () => {
    if (!rating) return
    setStage('submitting')
    try {
      let uploadedUrl: string | undefined
      if (recordingBlob) {
        const fd = new FormData()
        fd.append('file', recordingBlob, `practice-${lessonId}-${Date.now()}.webm`)
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/upload/audio`, { method: 'POST', credentials: 'include', body: fd })
          if (res.ok) { const json = await res.json(); uploadedUrl = json.url }
        } catch {}
      }
      await onSubmit(rating, uploadedUrl, elapsed)
    } catch {
      setStage('rating')
      toast('error', t('Failed to submit', 'فشل التسليم'))
    }
  }

  const fmtTime = (sec: number) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1">{t('Practising', 'تدريب على')}</p>
        <h3 className="text-base font-medium text-gray-900">{lessonTitle}</h3>
      </div>

      {/* Reference audio */}
      {referenceAudioUrl && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">{t('1. Listen to the reference', '1. استمع إلى المرجع')}</p>
          <audio ref={refAudioRef} src={referenceAudioUrl} onEnded={() => setPlayingRef(false)} className="hidden" />
          <button onClick={() => playPause('ref')}
            className="flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600">
            {playingRef ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playingRef ? t('Pause', 'إيقاف') : t('Play reference', 'تشغيل المرجع')}
          </button>
        </div>
      )}

      {/* Recording stage */}
      {stage === 'idle' && (
        <div className="rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500 mb-4">{t('2. Record yourself singing', '2. سجّل نفسك وأنت تغني')}</p>
          {canRecord ? (
            <button onClick={startRecording}
              className="inline-flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-medium text-white hover:bg-red-600 transition-colors">
              <Mic className="h-5 w-5" /> {t('Start recording', 'ابدأ التسجيل')}
            </button>
          ) : (
            <p className="text-sm text-amber-600">{t('Microphone not available — you can still rate without recording.', 'الميكروفون غير متاح — يمكنك التقييم بدون تسجيل.')}</p>
          )}
          {!canRecord && (
            <button onClick={() => setStage('rating')} className="mt-3 text-sm font-medium text-gold-700 hover:text-gold-500">
              {t('Skip to rating', 'تخطّ إلى التقييم')} →
            </button>
          )}
        </div>
      )}

      {stage === 'recording' && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span className="text-sm font-medium text-red-700">{t('Recording...', 'جارٍ التسجيل...')} {fmtTime(elapsed)}</span>
          </div>
          <button onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700">
            <Square className="h-4 w-4" /> {t('Stop', 'إيقاف')}
          </button>
        </div>
      )}

      {stage === 'recorded' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">{t('3. Listen to your recording', '3. استمع إلى تسجيلك')}</p>
          <audio ref={recAudioRef} src={recordingUrl} onEnded={() => setPlayingRec(false)} className="hidden" />
          <div className="flex items-center gap-3">
            <button onClick={() => playPause('rec')}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {playingRec ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playingRec ? t('Pause', 'إيقاف') : t('Play your recording', 'تشغيل تسجيلك')}
            </button>
            <span className="text-xs text-gray-400">{fmtTime(elapsed)}</span>
            <button onClick={reset} className="ml-auto rounded-lg p-1.5 text-gray-400 hover:text-gray-600" aria-label={t('Re-record', 'أعد التسجيل')}>
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setStage('rating')} className="mt-3 w-full rounded-lg bg-gold-500 py-2.5 text-sm font-medium text-white hover:bg-gold-600">
            {t('Rate my performance →', 'قيّم أداءي →')}
          </button>
        </div>
      )}

      {/* Rating */}
      {(stage === 'rating' || stage === 'submitting') && (
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-4 text-center">{t('How well did you know this hymn?', 'كم تعرف هذه التسبيحة؟')}</p>
          <div className="flex justify-center gap-3 mb-3">
            {STARS.map(s => (
              <button key={s} onClick={() => setRating(s)}
                onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
                className="text-3xl transition-transform hover:scale-110"
                aria-label={STAR_LABELS[s][lang as 'en'|'ar']}
                style={{ color: s <= (hovered || rating) ? '#C9A030' : '#D1D5DB' }}>
                ★
              </button>
            ))}
          </div>
          {(hovered || rating) > 0 && (
            <p className="text-center text-sm text-gray-600 min-h-[20px]">
              {STAR_LABELS[hovered || rating]?.[lang as 'en' | 'ar']}
            </p>
          )}
          {rating > 0 && stage === 'rating' && (
            <button onClick={handleSubmit}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-gold-500 py-2.5 text-sm font-medium text-white hover:bg-gold-600">
              <Send className="h-4 w-4" /> {t('Submit practice', 'سلّم التدريب')}
            </button>
          )}
          {stage === 'submitting' && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-gold-100 py-2.5 text-sm text-gold-700">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('Saving...', 'جارٍ الحفظ...')}
            </div>
          )}
        </div>
      )}

      <button onClick={onCancel} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
        {t('Cancel', 'إلغاء')}
      </button>
    </div>
  )
}

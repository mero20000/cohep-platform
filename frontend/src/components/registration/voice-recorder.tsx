'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Play, RotateCcw, Loader2 } from 'lucide-react'
import { Mp3Encoder } from '@breezystack/lamejs'

interface Props {
  onRecordingComplete: (blob: Blob | null) => void
  lang: string
  existingUrl?: string | null
}

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as unknown as { isTypeSupported: (t: string) => boolean }).isTypeSupported(t)) return t
  }
  return 'audio/webm'
}

/** Re-encode any recorded blob to MP3 — plays on every browser/device (WebM fails on Safari/iOS). */
async function transcodeToMp3(blob: Blob): Promise<Blob | null> {
  try {
    const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    await ctx.close()
    const channels = Math.min(buf.numberOfChannels, 2)
    const enc = new Mp3Encoder(channels, buf.sampleRate, 96)
    const left = buf.getChannelData(0)
    const right = channels > 1 ? buf.getChannelData(1) : null
    const to16 = (s: number) => (s < 0 ? s * 0x8000 : s * 0x7fff)
    const blockSize = 1152
    const parts: BlobPart[] = []
    for (let i = 0; i < left.length; i += blockSize) {
      const l = new Int16Array(blockSize)
      const r = right ? new Int16Array(blockSize) : undefined
      for (let j = 0; j < blockSize; j++) {
        l[j] = to16(left[i + j] || 0)
        if (r && right) r[j] = to16(right[i + j] || 0)
      }
      const chunk = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l)
      if (chunk.length) parts.push(new Int8Array(chunk))
    }
    const end = enc.flush()
    if (end.length) parts.push(new Int8Array(end))
    if (!parts.length) return null
    return new Blob(parts, { type: 'audio/mpeg' })
  } catch {
    return null
  }
}

export function VoiceRecorder({ onRecordingComplete, lang, existingUrl }: Props) {
  const t = (en: string, ar: string) => lang === 'ar' ? ar : en
  const [recState, setRecState] = useState<'idle' | 'recording' | 'processing' | 'recorded'>('idle')
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  }, [blobUrl])

  useEffect(() => () => cleanup(), [cleanup])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickMime()
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        const raw = new Blob(chunksRef.current, { type: mime })
        stream.getTracks().forEach(tr => tr.stop())
        // Transcode to MP3 so the recording plays on every device (WebM fails on Safari/iOS)
        setRecState('processing')
        const mp3 = await transcodeToMp3(raw)
        const final = mp3 || raw
        const url = URL.createObjectURL(final)
        setBlobUrl(url)
        setRecState('recorded')
        onRecordingComplete(final)
      }
      rec.start()
      mediaRef.current = rec
      setRecState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d >= 89) {
            rec.stop()
            if (timerRef.current) clearInterval(timerRef.current)
            return d + 1
          }
          return d + 1
        })
      }, 1000)
    } catch {
      alert(t('Microphone permission denied', 'تم رفض إذن الميكروفون'))
    }
  }

  const stop = () => {
    mediaRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const reset = () => {
    cleanup()
    setBlobUrl(null)
    setRecState('idle')
    setDuration(0)
    onRecordingComplete(null)
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  if (existingUrl && recState === 'idle' && !blobUrl) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <div className="text-sm font-medium text-green-800 mb-2">{t('Existing recording', 'التسجيل الحالي')}</div>
        <audio controls src={existingUrl} className="w-full h-8" />
        <button onClick={() => onRecordingComplete(null)} className="mt-2 text-xs text-red-600 hover:text-red-700">{t('Remove and re-record', 'حذف وإعادة التسجيل')}</button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      {recState === 'idle' && (
        <>
          <button onClick={start} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-200 hover:bg-red-600 active:scale-95 transition-all">
            <Mic className="h-8 w-8" />
          </button>
          <p className="mt-3 text-sm font-medium text-gray-700">{t('Tap to record (max 90s)', 'اضغط للتسجيل (الحد 90 ثانية)')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('Choose a hymn first, then record', 'اختر اللحن أولاً ثم سجل')}</p>
        </>
      )}
      {recState === 'recording' && (
        <>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white animate-pulse">
            <div className="h-3 w-3 rounded-full bg-white animate-ping absolute" />
            <Mic className="h-8 w-8 relative" />
          </div>
          <div className="mt-3 text-2xl font-mono font-bold text-gray-900">{fmt(duration)} / 01:30</div>
          <div className="mt-1 h-1 w-full rounded-full bg-gray-200 overflow-hidden"><div className="h-full bg-red-500 transition-all" style={{ width: `${(duration/90)*100}%` }} /></div>
          <button onClick={stop} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black">
            <Square className="h-4 w-4 fill-white" /> {t('Stop', 'إيقاف')}
          </button>
        </>
      )}
      {recState === 'processing' && (
        <>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold-100 text-gold-700">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700">{t('Preparing your recording…', 'جاري تجهيز التسجيل…')}</p>
        </>
      )}
      {recState === 'recorded' && blobUrl && (
        <>
          <audio ref={audioRef} src={blobUrl} onEnded={() => setPlaying(false)} className="hidden" />
          <div className="flex items-center justify-center gap-3">
            <button onClick={togglePlay} className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-black">
              {playing ? <Square className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
            </button>
            <span className="font-mono text-sm text-gray-700">{fmt(duration)}</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <RotateCcw className="h-3.5 w-3.5" /> {t('Re-record', 'إعادة التسجيل')}
            </button>
          </div>
          <p className="mt-2 text-xs text-green-600 font-medium">{t('Recording ready ✓', 'التسجيل جاهز ✓')}</p>
        </>
      )}
    </div>
  )
}

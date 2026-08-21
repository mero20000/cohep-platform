'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'

interface Props {
  src: string
  duration?: number
  compact?: boolean
  className?: string
  autoPlay?: boolean
}

const SPEEDS = [0.75, 1, 1.25, 1.5]

export function AudioPlayer({ src, duration, compact, className = '', autoPlay }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onLoad = () => setLoaded(true)
    const onEnd  = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoad)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoad)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  useEffect(() => {
    if (autoPlay && audioRef.current) audioRef.current.play().catch(() => {})
  }, [autoPlay])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play().then(() => setPlaying(true)).catch(() => {}) }
  }, [playing])

  const cycleSpeed = useCallback(() => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }, [speed])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = e.currentTarget
    if (!audio || !bar) return
    const pct = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth
    audio.currentTime = pct * (audio.duration || 0)
  }, [])

  function fmt(s: number) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const dur = duration || (audioRef.current?.duration || 0)
  const pct = dur > 0 ? (currentTime / dur) * 100 : 0

  /* ── Compact mode ── */
  if (compact) return (
    <div className={`flex items-center gap-2 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-white hover:bg-gold-600 transition-colors"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {!loaded
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : playing
          ? <Pause className="h-4 w-4" fill="white" />
          : <Play className="h-4 w-4 ml-0.5" fill="white" />}
      </button>
      {dur > 0 && <span className="text-xs text-gray-500">{fmt(currentTime)} / {fmt(dur)}</span>}
      <button
        onClick={cycleSpeed}
        className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-gray-200 transition-colors"
        title="Change playback speed"
      >
        {speed}×
      </button>
    </div>
  )

  /* ── Full mode ── */
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={toggle}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500 text-white hover:bg-gold-600 active:scale-95 transition-all shadow-sm shadow-gold-200"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {!loaded
          ? <Loader2 className="h-5 w-5 animate-spin" />
          : playing
          ? <Pause className="h-5 w-5" fill="white" />
          : <Play className="h-5 w-5 ml-0.5" fill="white" />}
      </button>

      {/* Progress bar + time */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        {/* Seekable bar */}
        <div
          className="h-2 w-full cursor-pointer rounded-full bg-gray-200 overflow-hidden"
          onClick={seek}
          role="slider"
          aria-label="Seek"
          aria-valuenow={Math.round(currentTime)}
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
        >
          <div
            className="h-full rounded-full bg-gold-500 transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>{fmt(currentTime)}</span>
          <span>{dur > 0 ? fmt(dur) : '--:--'}</span>
        </div>
      </div>

      {/* Speed control */}
      <button
        onClick={cycleSpeed}
        className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-600 hover:border-gold-300 hover:text-gold-700 transition-colors"
        title="Playback speed"
        aria-label={`Playback speed ${speed}×, click to change`}
      >
        {speed}×
      </button>
    </div>
  )
}

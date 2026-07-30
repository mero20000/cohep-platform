'use client'

import { useRef, useState, useEffect } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'

interface Props {
  src: string
  duration?: number
  compact?: boolean
  className?: string
  autoPlay?: boolean
}

export function AudioPlayer({ src, duration, compact, className = '', autoPlay }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onLoad = () => setLoaded(true)
    const onEnd = () => setPlaying(false)
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
    if (!autoPlay || !audioRef.current) return
    audioRef.current.play().catch(() => {})
  }, [autoPlay])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play().then(() => setPlaying(true)).catch(() => {}) }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const displayDuration = duration || (audioRef.current?.duration || 0)

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <audio ref={audioRef} src={src} preload="metadata" />
        <button onClick={toggle} className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors shrink-0" aria-label={playing ? 'Pause' : 'Play'}>
          {!loaded ? <Loader2 className="w-4 h-4 animate-spin" /> : playing ? <Pause className="w-4 h-4" fill="white" /> : <Play className="w-4 h-4 ml-0.5" fill="white" />}
        </button>
        {displayDuration > 0 && <span className="text-xs text-gray-500">{formatTime(currentTime)} / {formatTime(displayDuration)}</span>}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border bg-gray-50 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button onClick={toggle} className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors shrink-0" aria-label={playing ? 'Pause' : 'Play'}>
        {!loaded ? <Loader2 className="w-5 h-5 animate-spin" /> : playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5 ml-0.5" fill="white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: displayDuration > 0 ? `${(currentTime / displayDuration) * 100}%` : '0%' }} />
        </div>
      </div>
      <span className="text-xs text-gray-500 shrink-0">{formatTime(currentTime)} / {formatTime(displayDuration)}</span>
    </div>
  )
}

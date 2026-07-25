import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Pause, Play } from 'lucide-react'

export interface AudioPlayerProps {
  src: string
  isMine?: boolean
}

// Waveform estático com 30 barras de altura pseudoaleatória mas estável — paridade com
// financiamento-imobiliario-bot/apps/web/src/components/AudioPlayer.tsx. Waveform real
// (a partir do áudio decodificado), velocidade de reprodução, gravador e transcrição (STT)
// ficam como enhancement pós-paridade (fora do escopo desta task).
const BARS = Array.from({ length: 30 }, (_, i) => {
  const heights = [3, 5, 8, 12, 7, 10, 14, 9, 6, 11, 15, 8, 4, 13, 7, 10, 6, 12, 9, 5, 14, 8, 11, 6, 13, 7, 10, 5, 9, 4]
  return heights[i % heights.length]
})

function fmt(sec: number): string {
  if (!isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioPlayer({ src, isMine = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0-1
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      setCurrent(audio.currentTime)
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
    }
    const onMeta = () => setDuration(audio.duration)
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrent(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * audio.duration
  }

  const activeBars = Math.round(progress * BARS.length)

  const playBtn = isMine
    ? 'bg-green-600 hover:bg-green-700 text-white'
    : 'bg-gray-600 hover:bg-gray-700 text-white'

  const activeBar = isMine ? 'bg-green-700' : 'bg-gray-700'
  const inactiveBar = isMine ? 'bg-green-300' : 'bg-gray-300'

  return (
    <div className="flex items-center gap-2 w-full" style={{ minWidth: '200px', maxWidth: '260px' }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={toggle}
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${playBtn}`}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-0.5 h-8 cursor-pointer" onClick={seek}>
          {BARS.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${i < activeBars ? activeBar : inactiveBar}`}
              style={{ height: `${h * 2}px` }}
            />
          ))}
        </div>

        <span className="text-gray-400 tabular-nums text-xs">
          {playing || current > 0 ? fmt(current) : fmt(duration)}
        </span>
      </div>
    </div>
  )
}

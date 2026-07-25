import { useState, useRef, useCallback, useMemo } from 'react'

export interface AudioPlayerProps {
  audioUrl: string
  duration?: number
  direction?: 'inbound' | 'outbound'
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function generateWaveform(seed: number, count: number): number[] {
  const rng = seededRandom(seed)
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    bars.push(0.2 + rng() * 0.8)
  }
  return bars
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const AudioPlayer = ({ audioUrl, duration, direction = 'outbound' }: AudioPlayerProps) => {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration ?? 0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const isSent = direction === 'outbound'
  const filledColor = isSent ? '#4ade80' : '#9ca3af'
  const emptyColor = isSent ? '#bbf7d0' : '#e5e7eb'

  const waveform = useMemo(() => {
    const seed = hashString(audioUrl)
    return generateWaveform(seed, 30)
  }, [audioUrl])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => undefined)
    }
    setPlaying(!playing)
  }, [playing])

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio || duration !== undefined) return
    setAudioDuration(audio.duration)
  }, [duration])

  const handleEnded = useCallback(() => {
    setPlaying(false)
    setCurrentTime(0)
  }, [])

  const handleSeekBar = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || audioDuration <= 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const time = ratio * audioDuration
    audio.currentTime = time
    setCurrentTime(time)
  }, [audioDuration])

  const progress = audioDuration > 0 ? currentTime / audioDuration : 0
  const displayDuration = duration ?? audioDuration

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={togglePlay}
        className={`w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${
          isSent ? 'text-green-600 hover:bg-green-50' : 'text-gray-600 hover:bg-gray-100'
        }`}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="7,4 19,12 7,20" />
          </svg>
        )}
      </button>

      <div
        className="flex-1 flex items-center gap-[1.5px] h-10 cursor-pointer py-1"
        onClick={handleSeekBar}
      >
        {waveform.map((height, index) => {
          const barProgress = index / waveform.length
          const isFilled = barProgress <= progress
          return (
            <div
              key={index}
              className="flex-1 rounded-full transition-colors duration-150"
              style={{
                height: `${height * 100}%`,
                backgroundColor: isFilled ? filledColor : emptyColor,
                minWidth: 2,
              }}
            />
          )
        })}
      </div>

      <span className="text-[11px] text-gray-500 flex-shrink-0 min-w-[48px] text-right select-none">
        {formatTime(currentTime)}
        {displayDuration > 0 && ` / ${formatTime(displayDuration)}`}
      </span>

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
    </div>
  )
}

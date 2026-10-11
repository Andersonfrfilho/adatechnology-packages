import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'

import { claimAudioPlayback, releaseAudioPlayback, type AudioPlaybackHandle } from './participantAudioCoordinator'
import { PLAYBACK_RATES, nextRateIndex, resolveSeekKeyTarget, resolveServerDurationSeconds } from './participantAudioFormat'
import { INITIAL_PLAYER_STATE, applyPlaybackRate, type PlayerState } from './participantAudioPlayerState'
import { useParticipantAudioMediaEvents } from './useParticipantAudioMediaEvents'

export type UseParticipantAudioPlayerParams = {
  readonly url: string | undefined
  readonly durationMs: number | undefined
  /** Fetches a fresh URL after a media error; without it the first error is final. */
  readonly onSourceError?: () => Promise<string | undefined>
  readonly mediaRef?: Ref<HTMLAudioElement>
}

function assignRef(target: Ref<HTMLAudioElement> | undefined, element: HTMLAudioElement | null): void {
  if (typeof target === 'function') target(element)
  else if (target) (target as { current: HTMLAudioElement | null }).current = element
}

export function useParticipantAudioPlayer({ url, durationMs, onSourceError, mediaRef }: UseParticipantAudioPlayerParams) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const handleRef = useRef<AudioPlaybackHandle>({ pause: () => audioRef.current?.pause() })
  const [state, setState] = useState<PlayerState>(INITIAL_PLAYER_STATE)
  const update = useCallback((patch: Partial<PlayerState>) => setState((previous) => ({ ...previous, ...patch })), [])
  const mediaEvents = useParticipantAudioMediaEvents({ context: { audioRef, handleRef, state, update }, url, onSourceError })
  const duration = resolveServerDurationSeconds(durationMs) ?? state.mediaDuration

  const setMedia = useCallback(
    (element: HTMLAudioElement | null) => {
      audioRef.current = element
      assignRef(mediaRef, element)
    },
    [mediaRef],
  )

  useEffect(() => {
    const handle = handleRef.current
    return () => releaseAudioPlayback(handle)
  }, [])

  function handleToggle(): void {
    const audio = audioRef.current
    if (!audio || !url) return
    if (!audio.paused) return audio.pause()
    claimAudioPlayback(handleRef.current)
    applyPlaybackRate(audio, state.rateIndex)
    Promise.resolve(audio.play()).catch(() => update({ isPlaying: false }))
  }

  function seekTo(seconds: number): void {
    const audio = audioRef.current
    if (!audio || !url) return
    audio.currentTime = seconds
    update({ position: seconds, maxSeen: Math.max(state.maxSeen, seconds) })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    const position = audioRef.current?.currentTime ?? state.position
    const target = resolveSeekKeyTarget({ key: event.key, position, duration })
    if (target === undefined) return
    event.preventDefault()
    seekTo(target)
  }

  function handleRateClick(): void {
    const rateIndex = nextRateIndex(state.rateIndex)
    if (audioRef.current) applyPlaybackRate(audioRef.current, rateIndex)
    update({ rateIndex })
  }

  return {
    state,
    duration,
    rate: PLAYBACK_RATES[state.rateIndex] ?? 1,
    mediaProps: { ...mediaEvents, ref: setMedia },
    handleToggle,
    handleRateClick,
    handleKeyDown,
    seekTo,
  }
}

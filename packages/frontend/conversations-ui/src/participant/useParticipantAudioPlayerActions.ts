import type { KeyboardEvent } from 'react'

import { claimAudioPlayback } from './participantAudioCoordinator'
import { nextRateIndex, resolveSeekKeyTarget } from './participantAudioFormat'
import { applyPlaybackRate, type PlayerContext } from './participantAudioPlayerState'

export type UseParticipantAudioPlayerActionsParams = {
  readonly context: PlayerContext
  readonly url: string | undefined
  readonly duration: number | undefined
}

export function useParticipantAudioPlayerActions({ context, url, duration }: UseParticipantAudioPlayerActionsParams) {
  const { audioRef, handleRef, state, update } = context

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

  return { handleToggle, seekTo, handleKeyDown, handleRateClick }
}

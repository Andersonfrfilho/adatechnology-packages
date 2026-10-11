import { useEffect, useRef, type SyntheticEvent } from 'react'

import { claimAudioPlayback, releaseAudioPlayback } from './participantAudioCoordinator'
import { resolveMediaDurationSeconds } from './participantAudioFormat'
import type { PlayerContext } from './participantAudioPlayerState'

export type UseParticipantAudioMediaEventsParams = {
  readonly context: PlayerContext
  readonly url: string | undefined
  readonly onSourceError: (() => Promise<string | undefined>) | undefined
}

/** Media element events, including the single retry with a fresh URL when the signed one expired. */
export function useParticipantAudioMediaEvents({ context, url, onSourceError }: UseParticipantAudioMediaEventsParams) {
  const { audioRef, handleRef, state, update } = context
  const canRetryRef = useRef(true)
  const resumeAtRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const audio = audioRef.current
    const resumeAt = resumeAtRef.current
    if (!audio || resumeAt === undefined || !url) return
    resumeAtRef.current = undefined
    audio.currentTime = resumeAt
    Promise.resolve(audio.play()).catch(() => update({ isPlaying: false }))
  }, [url, audioRef, update])

  function handleStop(): void {
    releaseAudioPlayback(handleRef.current)
    update({ isPlaying: false })
  }

  function handleError(event: SyntheticEvent<HTMLAudioElement>): void {
    if (!onSourceError || !canRetryRef.current) return update({ hasFailed: true, isPlaying: false })
    canRetryRef.current = false
    resumeAtRef.current = event.currentTarget.currentTime
    onSourceError().then((fresh) => {
      if (fresh && fresh !== url) return
      resumeAtRef.current = undefined
      update({ hasFailed: true, isPlaying: false })
    })
  }

  function handleDuration(event: SyntheticEvent<HTMLAudioElement>): void {
    update({ mediaDuration: resolveMediaDurationSeconds(event.currentTarget.duration) })
  }

  return {
    onPlay: () => {
      claimAudioPlayback(handleRef.current)
      update({ isPlaying: true })
    },
    onPause: handleStop,
    onEnded: handleStop,
    onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) => {
      const position = event.currentTarget.currentTime
      update({ position, maxSeen: Math.max(state.maxSeen, position) })
    },
    onLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement>) => {
      canRetryRef.current = true
      handleDuration(event)
    },
    onDurationChange: handleDuration,
    onError: handleError,
  }
}

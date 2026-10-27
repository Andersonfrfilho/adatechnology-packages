import type { SyntheticEvent } from 'react'

import { claimAudioPlayback, releaseAudioPlayback } from './participantAudioCoordinator'
import { resolveMediaDurationSeconds } from './participantAudioFormat'
import type { PlayerContext } from './participantAudioPlayerState'
import { useParticipantAudioSourceRetry } from './useParticipantAudioSourceRetry'

export type UseParticipantAudioMediaEventsParams = {
  readonly context: PlayerContext
  readonly url: string | undefined
  readonly onSourceError: (() => Promise<string | undefined>) | undefined
}

/** Media element events of the player. */
export function useParticipantAudioMediaEvents({ context, url, onSourceError }: UseParticipantAudioMediaEventsParams) {
  const { handleRef, state, update } = context
  const { handleError, allowRetry } = useParticipantAudioSourceRetry({ context, url, onSourceError })

  function handleStop(): void {
    releaseAudioPlayback(handleRef.current)
    update({ isPlaying: false })
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
      allowRetry()
      handleDuration(event)
    },
    onDurationChange: handleDuration,
    onError: handleError,
  }
}

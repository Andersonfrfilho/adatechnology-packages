import { useCallback, useEffect, useRef, useState, type Ref } from 'react'

import { releaseAudioPlayback, type AudioPlaybackHandle } from './participantAudioCoordinator'
import { PLAYBACK_RATES, resolveServerDurationSeconds } from './participantAudioFormat'
import { INITIAL_PLAYER_STATE, type PlayerState } from './participantAudioPlayerState'
import { useParticipantAudioMediaEvents } from './useParticipantAudioMediaEvents'
import { useParticipantAudioPlayerActions } from './useParticipantAudioPlayerActions'

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

  const actions = useParticipantAudioPlayerActions({ context: { audioRef, handleRef, state, update }, url, duration })

  return {
    state,
    duration,
    rate: PLAYBACK_RATES[state.rateIndex] ?? 1,
    mediaProps: { ...mediaEvents, ref: setMedia },
    ...actions,
  }
}

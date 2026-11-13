import { useEffect, useRef, type SyntheticEvent } from 'react'

import type { PlayerContext } from './participantAudioPlayerState'

export type UseParticipantAudioSourceRetryParams = {
  readonly context: PlayerContext
  readonly url: string | undefined
  readonly onSourceError: (() => Promise<string | undefined>) | undefined
}

/** One retry with a fresh URL when the signed one expired, resuming from the same position. */
export function useParticipantAudioSourceRetry({ context, url, onSourceError }: UseParticipantAudioSourceRetryParams) {
  const { audioRef, update } = context
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

  function allowRetry(): void {
    canRetryRef.current = true
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

  return { handleError, allowRetry }
}

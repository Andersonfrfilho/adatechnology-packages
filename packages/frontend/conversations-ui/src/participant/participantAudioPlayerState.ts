import type { MutableRefObject } from 'react'

import type { AudioPlaybackHandle } from './participantAudioCoordinator'
import { PLAYBACK_RATES } from './participantAudioFormat'

export type PlayerState = {
  readonly isPlaying: boolean
  readonly position: number
  readonly mediaDuration: number | undefined
  readonly maxSeen: number
  readonly rateIndex: number
  readonly hasFailed: boolean
}

export const INITIAL_PLAYER_STATE: PlayerState = {
  isPlaying: false,
  position: 0,
  mediaDuration: undefined,
  maxSeen: 0,
  rateIndex: 0,
  hasFailed: false,
}

export type PlayerContext = {
  readonly audioRef: MutableRefObject<HTMLAudioElement | null>
  readonly handleRef: MutableRefObject<AudioPlaybackHandle>
  readonly state: PlayerState
  readonly update: (patch: Partial<PlayerState>) => void
}

export function applyPlaybackRate(audio: HTMLAudioElement, rateIndex: number): void {
  const rate = PLAYBACK_RATES[rateIndex] ?? 1
  audio.defaultPlaybackRate = rate
  audio.playbackRate = rate
}

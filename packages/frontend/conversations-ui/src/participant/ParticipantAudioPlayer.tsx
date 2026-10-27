import type { Ref } from 'react'

import type { ParticipantAudioLabels } from './participantAudioLabels'
import {
  formatAudioClock,
  formatPlaybackRate,
  formatPositionValueText,
  resolveSeekMax,
} from './participantAudioFormat'
import { AudioRateButton, AudioSeekRange, AudioToggleButton } from './ParticipantAudioPlayerControls'
import { useParticipantAudioPlayer } from './useParticipantAudioPlayer'

export type ParticipantAudioPlayerProps = {
  readonly labels: ParticipantAudioLabels
  readonly url: string | undefined
  readonly durationMs?: number | undefined
  readonly filename?: string
  /** True while the host is still resolving the URL: the toggle answers aria-busy and the user taps again. */
  readonly isPending?: boolean
  readonly isUnavailable?: boolean
  readonly onSourceError?: () => Promise<string | undefined>
  readonly mediaRef?: Ref<HTMLAudioElement>
}

function fillRate(template: string, rate: number): string {
  return template.replace('{rate}', formatPlaybackRate(rate))
}

export function ParticipantAudioPlayer({
  labels,
  url,
  durationMs,
  filename,
  isPending = false,
  isUnavailable = false,
  onSourceError,
  mediaRef,
}: ParticipantAudioPlayerProps) {
  const player = useParticipantAudioPlayer({ url, durationMs, onSourceError, mediaRef })
  const { state, duration, rate } = player
  const position = Math.floor(state.position)
  const hasFailed = isUnavailable || state.hasFailed

  return (
    <div className="cv-p-audio" role="group" aria-label={filename ? `${labels.audioPlayer}: ${filename}` : labels.audioPlayer}>
      <AudioToggleButton
        label={state.isPlaying ? labels.pauseAudio : labels.playAudio}
        isPlaying={state.isPlaying}
        isPending={isPending}
        isDisabled={hasFailed}
        onToggle={player.handleToggle}
      />
      <AudioSeekRange
        label={labels.audioPosition}
        max={resolveSeekMax({ duration, maxSeen: state.maxSeen, position })}
        position={position}
        valueText={formatPositionValueText({ template: labels.audioPositionValue, position, duration })}
        isDisabled={hasFailed}
        onSeek={player.seekTo}
        onKeyDown={player.handleKeyDown}
      />
      <span className="cv-p-audio__time">{`${formatAudioClock(position)} / ${formatAudioClock(duration)}`}</span>
      <AudioRateButton label={fillRate(labels.playbackRate, rate)} text={formatPlaybackRate(rate)} onClick={player.handleRateClick} />
      <audio className="cv-p-audio__media" preload="none" src={url} {...player.mediaProps} />
      {hasFailed ? <span className="cv-p-audio__error">{labels.audioUnavailable}</span> : null}
    </div>
  )
}

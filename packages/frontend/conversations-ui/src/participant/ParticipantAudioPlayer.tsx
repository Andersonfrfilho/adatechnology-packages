import { Pause, Play } from 'lucide-react'
import type { Ref } from 'react'

import type { ParticipantAudioLabels } from './participantAudioLabels'
import {
  formatAudioClock,
  formatPlaybackRate,
  formatPositionValueText,
  resolveSeekMax,
} from './participantAudioFormat'
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
  const max = resolveSeekMax({ duration, maxSeen: state.maxSeen, position })
  const hasFailed = isUnavailable || state.hasFailed
  const toggleLabel = state.isPlaying ? labels.pauseAudio : labels.playAudio
  const groupLabel = filename ? `${labels.audioPlayer}: ${filename}` : labels.audioPlayer

  return (
    <div className="cv-p-audio" role="group" aria-label={groupLabel}>
      <button
        type="button"
        className="cv-p-audio__toggle"
        aria-label={toggleLabel}
        data-cv-tooltip={toggleLabel}
        aria-busy={isPending ? true : undefined}
        disabled={hasFailed}
        onClick={player.handleToggle}
      >
        {state.isPlaying ? <Pause size={20} aria-hidden="true" focusable="false" /> : <Play size={20} aria-hidden="true" focusable="false" />}
      </button>
      <input
        type="range"
        className="cv-p-audio__seek"
        aria-label={labels.audioPosition}
        min={0}
        max={max}
        step={1}
        value={Math.min(position, max)}
        aria-valuetext={formatPositionValueText({ template: labels.audioPositionValue, position, duration })}
        disabled={hasFailed}
        onChange={(event) => player.seekTo(Number(event.currentTarget.value))}
        onKeyDown={player.handleKeyDown}
      />
      <span className="cv-p-audio__time">{`${formatAudioClock(position)} / ${formatAudioClock(duration)}`}</span>
      <button
        type="button"
        className="cv-p-audio__rate"
        aria-label={fillRate(labels.playbackRate, rate)}
        onClick={player.handleRateClick}
      >
        {formatPlaybackRate(rate)}
      </button>
      <audio className="cv-p-audio__media" preload="none" src={url} {...player.mediaProps} />
      {hasFailed ? <span className="cv-p-audio__error" role="alert">{labels.audioUnavailable}</span> : null}
    </div>
  )
}

import type { Ref } from 'react'

import { Mic, Send, Square, Trash2 } from 'lucide-react'

import type { ParticipantAudioLabels } from './participantAudioLabels'

export type RecordAudioButtonProps = {
  readonly label: string
  readonly isBusy: boolean
  readonly disabled: boolean
  readonly onClick?: () => void
}

export function RecordAudioButton({ label, isBusy, disabled, onClick }: RecordAudioButtonProps) {
  return (
    <button
      type="button"
      className="cv-p-button cv-p-button--primary cv-p-composer__record"
      aria-label={label}
      data-cv-tooltip={label}
      aria-busy={isBusy ? true : undefined}
      disabled={disabled || isBusy}
      onClick={onClick}
    >
      <Mic size={20} aria-hidden="true" focusable="false" />
    </button>
  )
}

export function RecorderError({ message }: { readonly message: string }) {
  return (
    <p className="cv-p-composer__error" role="alert">
      {message}
    </p>
  )
}

function focusOnMount(element: HTMLElement | null): void {
  element?.focus()
}

type RecorderGroupProps = {
  readonly labels: ParticipantAudioLabels
  readonly onDiscard?: () => void
}

function DiscardButton({ labels, onDiscard }: RecorderGroupProps) {
  return (
    <button
      type="button"
      className="cv-p-button cv-p-recorder__discard"
      aria-label={labels.discardAudio}
      data-cv-tooltip={labels.discardAudio}
      onClick={onDiscard}
    >
      <Trash2 size={20} aria-hidden="true" focusable="false" />
    </button>
  )
}

export type RecordingGroupProps = RecorderGroupProps & {
  readonly clockText: string
  readonly onStop?: () => void
}

export function RecordingGroup({ labels, clockText, onStop, onDiscard }: RecordingGroupProps) {
  return (
    <div className="cv-p-recorder" role="group" aria-label={labels.recordingInProgress}>
      <DiscardButton labels={labels} onDiscard={onDiscard} />
      <span className="cv-p-recorder__dot" aria-hidden="true" />
      <span className="cv-p-recorder__elapsed" role="timer">
        {clockText}
      </span>
      <button
        type="button"
        ref={focusOnMount}
        className="cv-p-button cv-p-button--primary cv-p-recorder__stop"
        aria-label={labels.stopRecording}
        data-cv-tooltip={labels.stopRecording}
        onClick={onStop}
      >
        <Square size={20} aria-hidden="true" focusable="false" />
      </button>
    </div>
  )
}

export type ReviewGroupProps = RecorderGroupProps & {
  readonly url?: string
  readonly audioRef?: Ref<HTMLAudioElement>
  readonly onSend?: () => void
}

/** The plain <audio controls> here is swapped for the participant player by the player task. */
export function ReviewGroup({ labels, url, audioRef, onSend, onDiscard }: ReviewGroupProps) {
  return (
    <div className="cv-p-recorder cv-p-recorder--review" role="group" aria-label={labels.reviewAudio}>
      <p className="cv-p-recorder__hint">{labels.reviewAudio}</p>
      <DiscardButton labels={labels} onDiscard={onDiscard} />
      <audio ref={audioRef} className="cv-p-recorder__audio" controls preload="metadata" src={url} />
      <button
        type="button"
        ref={focusOnMount}
        className="cv-p-button cv-p-button--primary cv-p-recorder__send"
        aria-label={labels.sendAudio}
        data-cv-tooltip={labels.sendAudio}
        onClick={onSend}
      >
        <Send size={20} aria-hidden="true" focusable="false" />
      </button>
    </div>
  )
}

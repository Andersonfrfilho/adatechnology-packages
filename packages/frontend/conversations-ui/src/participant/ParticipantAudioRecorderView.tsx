import type { Ref } from 'react'

import { DEFAULT_MAX_RECORDING_MILLISECONDS } from '../audioRecorderFormat'
import { formatRecordingElapsedLabel, resolveParticipantAudioLabels, type ParticipantAudioLabels } from './participantAudioLabels'
import { formatRecordingClock, type RecorderStatus } from './participantAudioRecorderState'
import type { ParticipantConversationsLabels } from './participantLabels'
import { RecordAudioButton, RecorderError, RecordingGroup, ReviewGroup } from './ParticipantRecorderParts'

export type ParticipantAudioRecorderActions = {
  readonly onStart?: () => void
  readonly onStop?: () => void
  readonly onSend?: () => void
  readonly onDiscard?: () => void
}

export type ParticipantAudioRecorderViewProps = {
  readonly state: RecorderStatus
  readonly elapsedMs: number
  readonly labels?: Partial<ParticipantAudioLabels> | ParticipantConversationsLabels
  readonly maxDurationMs?: number
  readonly review?: { readonly url?: string; readonly audioRef?: Ref<HTMLAudioElement> }
  readonly actions?: ParticipantAudioRecorderActions
  readonly disabled?: boolean
}

const ERROR_LABEL_BY_STATE = {
  denied: 'microphoneDenied',
  unsupported: 'recordingUnsupported',
  empty: 'audioEmpty',
  tooLarge: 'audioTooLarge',
} as const satisfies Partial<Record<RecorderStatus, keyof ParticipantAudioLabels>>

export function resolveRecorderErrorMessage(state: RecorderStatus, labels: ParticipantAudioLabels): string | undefined {
  return state in ERROR_LABEL_BY_STATE ? labels[ERROR_LABEL_BY_STATE[state as keyof typeof ERROR_LABEL_BY_STATE]] : undefined
}

export function ParticipantAudioRecorderView(props: ParticipantAudioRecorderViewProps) {
  const { state, elapsedMs, maxDurationMs = DEFAULT_MAX_RECORDING_MILLISECONDS, review, actions, disabled = false } = props
  const labels = resolveParticipantAudioLabels(props.labels)

  if (state === 'recording') {
    const clockText = formatRecordingElapsedLabel(labels.recordingElapsed, formatRecordingClock(elapsedMs), formatRecordingClock(maxDurationMs))
    return <RecordingGroup labels={labels} clockText={clockText} onStop={actions?.onStop} onDiscard={actions?.onDiscard} />
  }
  if (state === 'review') {
    return <ReviewGroup labels={labels} url={review?.url} audioRef={review?.audioRef} onSend={actions?.onSend} onDiscard={actions?.onDiscard} />
  }
  const errorMessage = resolveRecorderErrorMessage(state, labels)
  return (
    <>
      {errorMessage ? <RecorderError message={errorMessage} /> : null}
      <RecordAudioButton label={labels.recordAudio} isBusy={state === 'requesting'} disabled={disabled} onClick={actions?.onStart} />
    </>
  )
}

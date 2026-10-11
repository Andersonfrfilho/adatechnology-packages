import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

import { maxBytesForChannel } from './participantFileValidation'
import { resolveParticipantAudioLabels } from './participantAudioLabels'
import type { ComposerAudioSettings } from './participantAudioSupport'
import type { RecorderStatus } from './participantAudioRecorderState'
import type { ParticipantConversationsLabels } from './participantLabels'
import { ParticipantAudioRecorderView, resolveRecorderErrorMessage } from './ParticipantAudioRecorderView'
import { RecordAudioButton, RecorderError } from './ParticipantRecorderParts'
import { useParticipantAudioRecorder, type ParticipantAudioRecorder } from './useParticipantAudioRecorder'

export type ComposerAudioRowProps = {
  readonly settings: ComposerAudioSettings
  readonly labels: ParticipantConversationsLabels
  readonly disabled: boolean
  readonly isDraftEmpty: boolean
  /** The send button of the text path; the microphone only takes its place while the draft is empty. */
  readonly sendButton: ReactNode
  /** Attach control and message field, drawn only while no recording is in progress. */
  readonly children: ReactNode
}

function isCapturingStatus(status: RecorderStatus): boolean {
  return status === 'recording' || status === 'review'
}

function useRestoreMicrophoneFocus(status: RecorderStatus): RefObject<HTMLButtonElement | null> {
  const microphoneRef = useRef<HTMLButtonElement>(null)
  const wasCapturingRef = useRef(false)
  useEffect(() => {
    const isCapturing = isCapturingStatus(status)
    if (wasCapturingRef.current && !isCapturing) microphoneRef.current?.focus()
    wasCapturingRef.current = isCapturing
  }, [status])
  return microphoneRef
}

type RecorderLineProps = {
  readonly recorder: ParticipantAudioRecorder
  readonly labels: ParticipantConversationsLabels
  readonly onSendAudio: (file: File) => void
}

function RecorderLine({ recorder, labels, onSendAudio }: RecorderLineProps) {
  function handleSendAudio(): void {
    const file = recorder.confirm()
    if (file) onSendAudio(file)
  }

  return (
    <ParticipantAudioRecorderView
      state={recorder.status}
      elapsedMs={recorder.elapsedMs}
      labels={labels}
      maxDurationMs={recorder.limits.maxDurationMs}
      review={{ url: recorder.recorded?.objectUrl, audioRef: recorder.audioRef }}
      actions={{ onStop: recorder.stop, onSend: handleSendAudio, onDiscard: recorder.discard }}
    />
  )
}

export function ComposerAudioRow({ settings, labels, disabled, isDraftEmpty, sendButton, children }: ComposerAudioRowProps) {
  const recorder = useParticipantAudioRecorder({
    options: settings.audioRecording,
    channelMaxBytes: maxBytesForChannel(settings.channel),
  })
  const microphoneRef = useRestoreMicrophoneFocus(recorder.status)
  const audioLabels = resolveParticipantAudioLabels(labels)
  const errorMessage = resolveRecorderErrorMessage(recorder.status, audioLabels)

  if (isCapturingStatus(recorder.status)) {
    return <RecorderLine recorder={recorder} labels={labels} onSendAudio={settings.onSendAudio} />
  }
  return (
    <>
      {errorMessage ? <RecorderError message={errorMessage} /> : null}
      <div className="cv-p-composer__row">
        {children}
        {isDraftEmpty ? (
          <RecordAudioButton
            label={audioLabels.recordAudio}
            isBusy={recorder.status === 'requesting'}
            disabled={disabled}
            onClick={() => void recorder.start()}
            buttonRef={microphoneRef}
          />
        ) : (
          sendButton
        )}
      </div>
    </>
  )
}

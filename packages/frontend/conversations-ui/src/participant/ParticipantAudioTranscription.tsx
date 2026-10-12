import { useState } from 'react'

import type { ParticipantTranscription } from '@adatechnology/conversation-contracts'

import type { ParticipantAudioLabels } from './participantAudioLabels'
import { useTranscriptionOverflow } from './useTranscriptionOverflow'
import { useTranscriptionReadyAnnouncement } from './useTranscriptionReadyAnnouncement'

const MILLISECONDS_PER_MINUTE = 60_000

export type ParticipantAudioTranscriptionProps = {
  readonly attachmentId: string
  readonly transcription: ParticipantTranscription | undefined
  readonly labels: ParticipantAudioLabels
}

type ReadyTranscriptionBlockProps = {
  readonly attachmentId: string
  readonly transcription: Extract<ParticipantTranscription, { status: 'ready' }>
  readonly labels: ParticipantAudioLabels
}

function resolveTooLongMinutes(transcription: ParticipantTranscription | undefined): number | undefined {
  if (transcription?.status !== 'failed' || transcription.reason !== 'too_long') return undefined
  if (transcription.maxDurationMs === undefined) return undefined
  const minutes = Math.floor(transcription.maxDurationMs / MILLISECONDS_PER_MINUTE)
  return minutes >= 1 ? minutes : undefined
}

export function ParticipantAudioTranscription({ attachmentId, transcription, labels }: ParticipantAudioTranscriptionProps) {
  useTranscriptionReadyAnnouncement({
    attachmentId,
    status: transcription?.status,
    text: labels.transcriptionReady,
  })
  if (transcription?.status === 'pending') {
    return <p className="cv-p-transcription cv-p-transcription--pending">{labels.transcribing}</p>
  }
  if (transcription?.status === 'ready') return <ReadyTranscriptionBlock attachmentId={attachmentId} transcription={transcription} labels={labels} />
  const minutes = resolveTooLongMinutes(transcription)
  if (minutes === undefined) return null
  return (
    <p className="cv-p-transcription cv-p-transcription--too-long">
      {labels.transcriptionTooLong.replace('{minutes}', String(minutes))}
    </p>
  )
}

function ReadyTranscriptionBlock({ attachmentId, transcription, labels }: ReadyTranscriptionBlockProps) {
  const noticeId = `cv-p-transcription-notice-${attachmentId}`
  const [isExpanded, setIsExpanded] = useState(false)
  const { textRef, isOverflowing } = useTranscriptionOverflow(transcription.text, isExpanded)
  const hasText = transcription.text !== ''
  const showsToggle = hasText && (isOverflowing || isExpanded)

  return (
    <div className="cv-p-transcription">
      <p className="cv-p-transcription__notice" id={noticeId}>
        {labels.machineTranscription}
      </p>
      {hasText ? (
        <p
          ref={textRef}
          className="cv-p-transcription__text"
          lang={transcription.language}
          aria-describedby={noticeId}
          data-expanded={isExpanded ? 'true' : undefined}
        >
          {transcription.text}
        </p>
      ) : (
        <p className="cv-p-transcription__empty">{labels.emptyTranscription}</p>
      )}
      {showsToggle ? (
        <button
          type="button"
          className="cv-p-transcription__toggle"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? labels.collapseTranscription : labels.showFullTranscription}
        </button>
      ) : null}
    </div>
  )
}

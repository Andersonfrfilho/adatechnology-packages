import { StatusTicks } from '../StatusTicks'
import type { ParticipantConversationsLabels } from './participantLabels'
import type { ParticipantOwnMessageStatus } from './participantMessages'

function statusText(status: ParticipantOwnMessageStatus, labels: ParticipantConversationsLabels): string {
  const byStatus: Record<ParticipantOwnMessageStatus, string> = {
    sending: labels.statusSending,
    queued: labels.statusQueued,
    sent: labels.statusSent,
    delivered: labels.statusDelivered,
    read: labels.statusRead,
    failed: labels.statusFailed,
  }
  return byStatus[status]
}

type OwnStatusProps = {
  readonly status: ParticipantOwnMessageStatus
  readonly labels: ParticipantConversationsLabels
  readonly onRetry?: () => void
}

export function OwnStatus({ status, labels, onRetry }: OwnStatusProps) {
  const ticksStatus = status === 'sending' ? 'queued' : status
  const isVisibleText = status === 'sending' || status === 'queued' || status === 'failed'

  const text = status === 'failed' ? labels.statusFailedShort : statusText(status, labels)
  const isTextVisible = isVisibleText && !(status === 'failed' && onRetry)
  return (
    <span className="cv-p-bubble__status">
      <StatusTicks status={ticksStatus} appearance="stylesheet" />
      <span className={isTextVisible ? 'cv-p-bubble__status-text' : 'cv-p-sr-only'}>{text}</span>
    </span>
  )
}

type FailedActionsProps = {
  readonly labels: ParticipantConversationsLabels
  readonly onRetry?: () => void
  readonly onDiscard?: () => void
  readonly onEdit?: () => void
}

function RetryIcon() {
  return (
    <svg className="cv-p-bubble__action-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function FailedActions({ labels, onRetry, onDiscard, onEdit }: FailedActionsProps) {
  if (!onRetry && !onDiscard && !onEdit) return null
  return (
    <span className="cv-p-bubble__actions">
      {onRetry ? (
        <button
          type="button"
          className="cv-p-bubble__action cv-p-bubble__action--retry"
          aria-label={labels.statusFailed}
          onClick={onRetry}
        >
          <RetryIcon />
          {labels.retry}
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" className="cv-p-bubble__action" onClick={onEdit}>
          {labels.edit}
        </button>
      ) : null}
      {onDiscard ? (
        <button type="button" className="cv-p-bubble__action cv-p-bubble__action--discard" onClick={onDiscard}>
          {labels.discard}
        </button>
      ) : null}
    </span>
  )
}

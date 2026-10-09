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

  if (status === 'failed' && onRetry) {
    return (
      <button type="button" className="cv-p-bubble__retry" onClick={onRetry}>
        <StatusTicks status="failed" appearance="stylesheet" />
        <span>{labels.statusFailed}</span>
      </button>
    )
  }

  const text = status === 'failed' ? labels.statusFailedShort : statusText(status, labels)
  return (
    <span className="cv-p-bubble__status">
      <StatusTicks status={ticksStatus} appearance="stylesheet" />
      <span className={isVisibleText ? 'cv-p-bubble__status-text' : 'cv-p-sr-only'}>{text}</span>
    </span>
  )
}

type FailedActionsProps = {
  readonly labels: ParticipantConversationsLabels
  readonly onDiscard?: () => void
  readonly onEdit?: () => void
}

export function FailedActions({ labels, onDiscard, onEdit }: FailedActionsProps) {
  if (!onDiscard && !onEdit) return null
  return (
    <span className="cv-p-bubble__actions">
      {onEdit ? (
        <button type="button" className="cv-p-bubble__action" onClick={onEdit}>
          {labels.edit}
        </button>
      ) : null}
      {onDiscard ? (
        <button type="button" className="cv-p-bubble__action" onClick={onDiscard}>
          {labels.discard}
        </button>
      ) : null}
    </span>
  )
}

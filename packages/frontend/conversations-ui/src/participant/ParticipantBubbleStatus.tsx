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

type RetryButtonProps = {
  readonly labels: ParticipantConversationsLabels
  readonly onRetry: () => void
}

export function RetryButton({ labels, onRetry }: RetryButtonProps) {
  return (
    <button type="button" className="cv-p-bubble-row__retry" aria-label={labels.statusFailed} onClick={onRetry}>
      <span className="cv-p-bubble-row__retry-icon">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    </button>
  )
}

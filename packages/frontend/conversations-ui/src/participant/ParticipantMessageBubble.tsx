import type { MessageDeliveryStatus, ParticipantAttachment } from '@adatechnology/conversation-contracts'

import { MessageText } from '../MessageText'
import { StatusTicks } from '../StatusTicks'
import { formatTimestamp } from '../lib/format'
import { ParticipantAttachmentItem, type ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import type { ParticipantConversationsLabels } from './participantLabels'
import {
  isOwnMessage,
  resolveOwnMessageStatus,
  type ParticipantOwnMessageStatus,
  type ParticipantPendingDisplayState,
  type ParticipantTimelineItem,
} from './participantMessages'

export type ParticipantMessageBubbleProps = {
  readonly item: ParticipantTimelineItem
  readonly labels: ParticipantConversationsLabels
  readonly confirmsRead: boolean
  readonly resolveAttachmentUrl: ResolveParticipantAttachmentUrl
  /** Absent means no retry button, even when the message failed. */
  readonly onRetry?: () => void
  /** Absent means no discard button. */
  readonly onDiscard?: () => void
  /** Absent means no edit button. */
  readonly onEdit?: () => void
}

type BubbleContent = {
  readonly isMine: boolean
  readonly authorName?: string
  readonly text?: string
  readonly createdAt: string
  readonly attachments: readonly ParticipantAttachment[]
  readonly pendingFilenames: readonly string[]
  readonly displayState?: ParticipantPendingDisplayState
  readonly serverStatus?: MessageDeliveryStatus
}

function describeItem(item: ParticipantTimelineItem): BubbleContent {
  if (item.kind === 'server') {
    const { message } = item
    return {
      isMine: isOwnMessage(message),
      authorName: message.authorName ?? undefined,
      text: message.text ?? undefined,
      createdAt: message.createdAt,
      attachments: message.attachments,
      pendingFilenames: [],
      serverStatus: message.status,
    }
  }
  return {
    isMine: true,
    text: item.pending.text,
    createdAt: item.pending.createdAt,
    attachments: [],
    pendingFilenames: (item.pending.attachments ?? []).map((attachment) => attachment.filename),
    displayState: item.displayState,
  }
}

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

function OwnStatus({ status, labels, onRetry }: OwnStatusProps) {
  const ticksStatus = status === 'sending' ? 'queued' : status
  const isVisibleText = status === 'sending' || status === 'queued' || status === 'failed'

  if (status === 'failed' && onRetry) {
    return (
      <button type="button" className="cv-p-bubble__retry" onClick={onRetry}>
        <StatusTicks status="failed" />
        <span>{labels.statusFailed}</span>
      </button>
    )
  }

  const text = status === 'failed' ? labels.statusFailedShort : statusText(status, labels)
  return (
    <span className="cv-p-bubble__status">
      <StatusTicks status={ticksStatus} />
      <span className={isVisibleText ? 'cv-p-bubble__status-text' : 'cv-p-sr-only'}>{text}</span>
    </span>
  )
}

type FailedActionsProps = {
  readonly labels: ParticipantConversationsLabels
  readonly onDiscard?: () => void
  readonly onEdit?: () => void
}

function FailedActions({ labels, onDiscard, onEdit }: FailedActionsProps) {
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

function toTextPayload(text: string, createdAt: string, isMine: boolean) {
  return {
    id: createdAt,
    type: 'text' as const,
    content: text,
    direction: isMine ? ('inbound' as const) : ('outbound' as const),
    sender: isMine ? ('customer' as const) : ('agent' as const),
    timestamp: createdAt,
  }
}

export function ParticipantMessageBubble({
  item,
  labels,
  confirmsRead,
  resolveAttachmentUrl,
  onRetry,
  onDiscard,
  onEdit,
}: ParticipantMessageBubbleProps) {
  const content = describeItem(item)
  const { isMine } = content
  const ownStatus = isMine
    ? resolveOwnMessageStatus({ displayState: content.displayState, serverStatus: content.serverStatus, confirmsRead })
    : undefined

  return (
    <div className={isMine ? 'cv-p-bubble cv-p-bubble--mine' : 'cv-p-bubble'}>
      {isMine ? (
        <span className="cv-p-sr-only">{labels.me}</span>
      ) : content.authorName ? (
        <span className="cv-p-bubble__author">{content.authorName}</span>
      ) : null}
      {content.text ? <MessageText message={toTextPayload(content.text, content.createdAt, isMine)} /> : null}
      {content.attachments.map((attachment) => (
        <ParticipantAttachmentItem
          key={attachment.id}
          attachment={attachment}
          resolveAttachmentUrl={resolveAttachmentUrl}
          labels={labels}
        />
      ))}
      {content.pendingFilenames.map((filename) => (
        <span key={filename} className="cv-p-attachment cv-p-attachment--pending">
          {filename}
        </span>
      ))}
      <span className="cv-p-bubble__meta">
        <time className="cv-p-bubble__time" dateTime={content.createdAt}>
          {formatTimestamp(content.createdAt)}
        </time>
        {ownStatus ? <OwnStatus status={ownStatus} labels={labels} onRetry={onRetry} /> : null}
      </span>
      {ownStatus === 'failed' ? <FailedActions labels={labels} onDiscard={onDiscard} onEdit={onEdit} /> : null}
    </div>
  )
}

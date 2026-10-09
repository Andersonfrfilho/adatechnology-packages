import type { ReactNode } from 'react'

import type { MessageDeliveryStatus, ParticipantAttachment } from '@adatechnology/conversation-contracts'

import { MessageText } from '../MessageText'
import { formatTimestamp } from '../lib/format'
import { FailedActions, OwnStatus } from './ParticipantBubbleStatus'
import { ParticipantAttachmentItem, type ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import type { ParticipantConversationsLabels } from './participantLabels'
import {
  isOwnMessage,
  resolveOwnMessageStatus,
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
  /** Opt-in slot to the left of a received bubble; null reserves the space, absent changes nothing. */
  readonly avatar?: ReactNode
  /** Speech-bubble tail on the bottom corner; false removes it. Default true. */
  readonly tail?: boolean
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

function bubbleClassName(isMine: boolean, hasTail: boolean): string {
  const classes = ['cv-p-bubble']
  if (isMine) classes.push('cv-p-bubble--mine')
  if (!hasTail) classes.push('cv-p-bubble--no-tail')
  return classes.join(' ')
}

export function ParticipantMessageBubble({
  item,
  labels,
  confirmsRead,
  resolveAttachmentUrl,
  onRetry,
  onDiscard,
  onEdit,
  avatar,
  tail = true,
}: ParticipantMessageBubbleProps) {
  const content = describeItem(item)
  const { isMine } = content
  const ownStatus = isMine
    ? resolveOwnMessageStatus({ displayState: content.displayState, serverStatus: content.serverStatus, confirmsRead })
    : undefined

  const bubble = (
    <div className={bubbleClassName(isMine, tail)}>
      {isMine ? (
        <span className="cv-p-sr-only">{labels.me}</span>
      ) : content.authorName ? (
        <span className="cv-p-bubble__author">{content.authorName}</span>
      ) : null}
      {content.text ? (
        <MessageText
          message={toTextPayload(content.text, content.createdAt, isMine)}
          copyOnClick={false}
          appearance="stylesheet"
        />
      ) : null}
      {content.attachments.map((attachment) => (
        <ParticipantAttachmentItem
          key={attachment.id}
          attachment={attachment}
          resolveAttachmentUrl={resolveAttachmentUrl}
          labels={labels}
        />
      ))}
      {content.pendingFilenames.map((filename, index) => (
        <span key={`${filename}-${index}`} className="cv-p-attachment cv-p-attachment--pending">
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
  if (avatar === undefined || isMine) return bubble
  return (
    <div className="cv-p-bubble-row">
      <span className="cv-p-bubble-row__avatar">{avatar}</span>
      {bubble}
    </div>
  )
}

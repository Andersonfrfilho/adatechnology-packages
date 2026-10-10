import type { ReactNode } from 'react'

import type { MessageDeliveryStatus, ParticipantAttachment } from '@adatechnology/conversation-contracts'

import { formatTimestamp } from '../lib/format'
import { OwnStatus, RetryButton } from './ParticipantBubbleStatus'
import { ParticipantFailedMenu } from './ParticipantFailedMenu'
import { ParticipantMessageText } from './ParticipantMessageText'
import { ParticipantAttachmentItem, type ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import type { ParticipantConversationsLabels } from './participantLabels'
import type { ParticipantPerspective } from './participantPerspective'
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
  /** Absent means no retry button beside the bubble, even when the message failed. */
  readonly onRetry?: () => void
  /** Absent means no discard item in the failed-message menu. */
  readonly onDiscard?: () => void
  /** Absent means no edit item in the failed-message menu. */
  readonly onEdit?: () => void
  /** Opt-in slot to the left of a received bubble; null reserves the space, absent changes nothing. */
  readonly avatar?: ReactNode
  /** Speech-bubble tail on the bottom corner; false removes it. Default true. */
  readonly tail?: boolean
  /** Who is looking; absent is the participant. The operator owns the outbound messages. */
  readonly perspective?: ParticipantPerspective
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

function describeItem(item: ParticipantTimelineItem, perspective?: ParticipantPerspective): BubbleContent {
  if (item.kind === 'server') {
    const { message } = item
    return {
      isMine: isOwnMessage(message, perspective),
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

function bubbleClassName(isMine: boolean, hasTail: boolean, hasFailed: boolean): string {
  const classes = ['cv-p-bubble']
  if (isMine) classes.push('cv-p-bubble--mine')
  if (hasFailed) classes.push('cv-p-bubble--failed')
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
  perspective,
}: ParticipantMessageBubbleProps) {
  const content = describeItem(item, perspective)
  const { isMine } = content
  const ownStatus = isMine
    ? resolveOwnMessageStatus({ displayState: content.displayState, serverStatus: content.serverStatus, confirmsRead })
    : undefined

  const isFailed = ownStatus === 'failed'

  const bubble = (
    <div className={bubbleClassName(isMine, tail, isFailed)}>
      {isMine ? (
        <span className="cv-p-sr-only">{labels.me}</span>
      ) : content.authorName ? (
        <span className="cv-p-bubble__author">{content.authorName}</span>
      ) : null}
      {content.text ? <ParticipantMessageText text={content.text} labels={labels} /> : null}
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
        {isFailed ? <ParticipantFailedMenu labels={labels} onEdit={onEdit} onDiscard={onDiscard} /> : null}
      </span>
    </div>
  )
  if (isFailed && onRetry) {
    return (
      <div className="cv-p-bubble-row cv-p-bubble-row--failed">
        <RetryButton labels={labels} onRetry={onRetry} />
        {bubble}
      </div>
    )
  }
  if (avatar === undefined || isMine) return bubble
  return (
    <div className="cv-p-bubble-row">
      <span className="cv-p-bubble-row__avatar">{avatar}</span>
      {bubble}
    </div>
  )
}

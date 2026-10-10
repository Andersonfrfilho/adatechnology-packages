import { useId, type ReactNode } from 'react'

import type { MessageDeliveryStatus, ParticipantAttachment } from '@adatechnology/conversation-contracts'

import { BubbleBody } from './ParticipantBubbleBody'
import { RetryButton } from './ParticipantBubbleStatus'
import type { ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
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

export type BubbleContent = {
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

export function ParticipantMessageBubble(props: ParticipantMessageBubbleProps) {
  const { item, labels, confirmsRead, onRetry, avatar, tail = true, perspective } = props
  const textId = useId()
  const content = describeItem(item, perspective)
  const ownStatus = content.isMine
    ? resolveOwnMessageStatus({ displayState: content.displayState, serverStatus: content.serverStatus, confirmsRead })
    : undefined
  const isFailed = ownStatus === 'failed'
  const canRetry = isFailed && onRetry !== undefined

  const bubble = (
    <div className={bubbleClassName(content.isMine, tail, isFailed)}>
      {canRetry ? <RetryButton labels={labels} onRetry={onRetry} describedBy={textId} /> : null}
      <BubbleBody {...props} content={content} ownStatus={ownStatus} textId={canRetry ? textId : undefined} />
    </div>
  )
  if (avatar === undefined || content.isMine) return bubble
  return (
    <div className="cv-p-bubble-row">
      <span className="cv-p-bubble-row__avatar">{avatar}</span>
      {bubble}
    </div>
  )
}

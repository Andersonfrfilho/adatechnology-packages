import { useId, type HTMLAttributes, type ReactNode, type Ref } from 'react'

import type { MessageDeliveryStatus, ParticipantAttachment } from '@adatechnology/conversation-contracts'

import { BubbleBody } from './ParticipantBubbleBody'
import { ParticipantMenuBubble } from './ParticipantMenuBubble'
import { useParticipantMessageMenu } from './ParticipantMessageMenuContext'
import type { ParticipantMessageActionsRenderer } from './ParticipantAuthorAvatar'
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
  /** Host actions at the end of the meta line of a server message; pending ones have nothing to act on yet. */
  readonly renderMessageActions?: ParticipantMessageActionsRenderer
}

export type BubbleContent = {
  readonly isMine: boolean
  readonly authorName?: string
  readonly text?: string
  readonly originalText?: string
  readonly createdAt: string
  readonly attachments: readonly ParticipantAttachment[]
  readonly pendingFilenames: readonly string[]
  readonly displayState?: ParticipantPendingDisplayState
  readonly serverStatus?: MessageDeliveryStatus
  readonly messageId?: string
}

function describeItem(item: ParticipantTimelineItem, perspective?: ParticipantPerspective): BubbleContent {
  if (item.kind === 'server') {
    const { message } = item
    return {
      isMine: isOwnMessage(message, perspective),
      authorName: message.authorName ?? undefined,
      text: message.text ?? undefined,
      originalText: message.originalText ?? undefined,
      createdAt: message.createdAt,
      attachments: message.attachments,
      pendingFilenames: [],
      serverStatus: message.status,
      messageId: message.id,
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

/** What the message menu adds to a bubble: its ref and handlers, a corner slot and a state class. */
export type ParticipantBubbleFrame = {
  readonly ref?: Ref<HTMLDivElement>
  readonly handlers?: HTMLAttributes<HTMLDivElement>
  readonly corner?: ReactNode
  readonly className?: string
}

type RenderBubbleParams = {
  readonly props: ParticipantMessageBubbleProps
  readonly content: BubbleContent
  readonly textId: string
  readonly frame?: ParticipantBubbleFrame
}

export function renderParticipantBubble({ props, content, textId, frame }: RenderBubbleParams): ReactNode {
  const { confirmsRead, onRetry, avatar, tail = true } = props
  const ownStatus = content.isMine
    ? resolveOwnMessageStatus({ displayState: content.displayState, serverStatus: content.serverStatus, confirmsRead })
    : undefined
  const isFailed = ownStatus === 'failed'
  const canRetry = isFailed && onRetry !== undefined
  const className = [bubbleClassName(content.isMine, tail, isFailed), frame?.className].filter(Boolean).join(' ')

  const bubble = (
    <div className={className} ref={frame?.ref} {...frame?.handlers}>
      {canRetry ? <RetryButton labels={props.labels} onRetry={onRetry} describedBy={textId} /> : null}
      <BubbleBody {...props} content={content} ownStatus={ownStatus} textId={canRetry ? textId : undefined} />
      {frame?.corner}
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

export function ParticipantMessageBubble(props: ParticipantMessageBubbleProps) {
  const textId = useId()
  const menu = useParticipantMessageMenu()
  const content = describeItem(props.item, props.perspective)
  if (menu && content.messageId !== undefined) {
    return <ParticipantMenuBubble props={props} content={content} textId={textId} state={menu} />
  }
  return renderParticipantBubble({ props, content, textId })
}

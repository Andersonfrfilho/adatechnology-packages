import type { ReactNode } from 'react'

import { channelCapabilityFor } from '../channelCapability'
import type { ConversationChannel } from '../conversationChannel'
import { isSameDay } from '../lib/format'
import type { ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import { ParticipantAuthorAvatar, type ParticipantAuthorAvatarRenderer } from './ParticipantAuthorAvatar'
import { ParticipantDayDivider } from './ParticipantDayDivider'
import { ParticipantMessageBubble } from './ParticipantMessageBubble'
import { shouldShowAvatar, type ParticipantAvatarAuthor } from './participantAvatar'
import {
  bindPendingActions,
  resolveParticipantBubbleActions,
  type ParticipantPendingActions,
} from './participantBubbleActions'
import type { ParticipantConversationsLabels } from './participantLabels'
import { isOwnMessage, type ParticipantTimelineItem } from './participantMessages'

export type ParticipantTimelineProps = {
  readonly items: readonly ParticipantTimelineItem[]
  readonly labels: ParticipantConversationsLabels
  readonly resolveAttachmentUrl: ResolveParticipantAttachmentUrl
  readonly channel?: ConversationChannel
  readonly locale?: string
  readonly pendingActions?: ParticipantPendingActions
  readonly avatars?: 'initials'
  readonly renderAuthorAvatar?: ParticipantAuthorAvatarRenderer
  readonly tail?: boolean
}

function createdAtOf(item: ParticipantTimelineItem): string {
  return item.kind === 'server' ? item.message.createdAt : item.pending.createdAt
}

function keyOf(item: ParticipantTimelineItem): string {
  return item.kind === 'server' ? item.message.id : `pending:${item.pending.clientMessageId}`
}

type AuthorOfItem = { readonly isMine: boolean; readonly author: ParticipantAvatarAuthor }

function authorOf(item: ParticipantTimelineItem): AuthorOfItem {
  if (item.kind === 'pending') return { isMine: true, author: null }
  return { isMine: isOwnMessage(item.message), author: item.message.authorName ?? null }
}

function resolveActions(item: ParticipantTimelineItem, pendingActions?: ParticipantPendingActions) {
  if (!pendingActions || item.kind === 'server') return {}
  return resolveParticipantBubbleActions(item, bindPendingActions(pendingActions, item.pending.clientMessageId))
}

type AvatarSlotParams = {
  readonly isEnabled: boolean
  readonly isMine: boolean
  readonly showAvatar: boolean
  readonly author: ParticipantAvatarAuthor
  readonly render?: ParticipantAuthorAvatarRenderer
}

function resolveAvatarSlot({ isEnabled, isMine, showAvatar, author, render }: AvatarSlotParams): ReactNode {
  if (!isEnabled || isMine) return undefined
  return showAvatar ? <ParticipantAuthorAvatar name={author} render={render} /> : null
}

export function ParticipantTimeline(props: ParticipantTimelineProps) {
  const { items, labels, locale, resolveAttachmentUrl, pendingActions } = props
  const confirmsRead = channelCapabilityFor(props.channel ?? 'app').confirmsRead
  const isAvatarEnabled = props.avatars === 'initials' || props.renderAuthorAvatar !== undefined
  const nodes: ReactNode[] = []
  let previousDay: Date | undefined
  let previousAuthor: ParticipantAvatarAuthor | undefined

  for (const item of items) {
    const day = new Date(createdAtOf(item))
    if (previousDay === undefined || !isSameDay(previousDay, day)) {
      nodes.push(<ParticipantDayDivider key={`day:${keyOf(item)}`} day={day} locale={locale} />)
      previousAuthor = undefined
    }
    previousDay = day
    const { isMine, author } = authorOf(item)
    const showAvatar = shouldShowAvatar({ previousAuthor, author, isMine })
    previousAuthor = isMine ? undefined : author
    const avatar = resolveAvatarSlot({
      isEnabled: isAvatarEnabled,
      isMine,
      showAvatar,
      author,
      render: props.renderAuthorAvatar,
    })
    nodes.push(
      <ParticipantMessageBubble
        key={keyOf(item)}
        item={item}
        labels={labels}
        confirmsRead={confirmsRead}
        resolveAttachmentUrl={resolveAttachmentUrl}
        tail={props.tail}
        avatar={avatar}
        {...resolveActions(item, pendingActions)}
      />,
    )
  }
  return <div className="cv-p-thread__messages">{nodes}</div>
}

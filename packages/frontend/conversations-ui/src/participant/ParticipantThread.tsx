import type { ReactNode } from 'react'

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { channelCapabilityFor } from '../channelCapability'
import type { ConversationChannel } from '../conversationChannel'
import { isSameDay } from '../lib/format'
import type { QuickReply } from '../quickReplies/quickReply.types'
import { ParticipantComposer } from './ParticipantComposer'
import type { ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import {
  bindPendingActions,
  resolveParticipantBubbleActions,
  type ParticipantPendingActions,
} from './participantBubbleActions'
import type { ParticipantConversationsLabels } from './participantLabels'
import { resolveLoadView, type ParticipantLoadStatus } from './participantLoadView'
import { ParticipantLoadError, ParticipantLoading } from './ParticipantLoadState'
import type { ParticipantThreadScroll } from './useStickToBottom'
import { isOwnMessage, type ParticipantTimelineItem } from './participantMessages'
import { ParticipantMessageBubble } from './ParticipantMessageBubble'
import { ParticipantAuthorAvatar, type ParticipantAuthorAvatarRenderer } from './ParticipantAuthorAvatar'
import { ParticipantThreadHeader } from './ParticipantThreadHeader'
import { shouldShowAvatar, type ParticipantAvatarAuthor } from './participantAvatar'
import type { ParticipantSubjectGroup } from './participant.types'

export type ParticipantThreadDraft = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly files: readonly File[]
  readonly onFilesChange: (files: readonly File[]) => void
}

export type ParticipantThreadProps = {
  readonly conversation: ParticipantConversationSummary
  readonly items: readonly ParticipantTimelineItem[]
  readonly hasMore: boolean
  readonly labels: ParticipantConversationsLabels
  readonly resolveAttachmentUrl: ResolveParticipantAttachmentUrl
  readonly draft: ParticipantThreadDraft
  readonly onSend: () => void
  readonly status: ParticipantLoadStatus
  readonly refresh: () => void
  /** Ref and onScroll of the scrolling area; the hook that owns the rule is useParticipantThreadScroll. */
  readonly scroll: ParticipantThreadScroll
  /** Messages from the other side that arrived while the user was reading above. */
  readonly newMessagesCount: number
  /** A send is in flight: only the send button waits, the field stays editable. */
  readonly isSending: boolean
  readonly channel?: ConversationChannel
  readonly locale?: string
  readonly onBack?: () => void
  readonly onOpenSubject?: (subject: ParticipantSubjectRef) => void
  readonly onLoadOlder?: () => void
  readonly pendingActions?: ParticipantPendingActions
  readonly quickReplies?: readonly QuickReply[]
  readonly acceptedTypes?: readonly string[]
  readonly maxLength?: number
  readonly renderSubjectCard?: (conversation: ParticipantConversationSummary) => ReactNode
  /** Source of the eyebrow above the title: the label of the group of the conversation's subject type. */
  readonly subjectGroups?: readonly ParticipantSubjectGroup[]
  /** Absent draws no avatar. The SDK has no photo: the host supplies it through renderAuthorAvatar. */
  readonly avatars?: 'initials'
  /** Host slot for the author's photo; wins over 'initials' and enables avatars on its own. */
  readonly renderAuthorAvatar?: ParticipantAuthorAvatarRenderer
  /** Speech-bubble tail on the bottom corner; false removes it. Default true. */
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

function Timeline({ props }: { readonly props: ParticipantThreadProps }) {
  const { items, labels, locale, resolveAttachmentUrl, pendingActions } = props
  const confirmsRead = channelCapabilityFor(props.channel ?? 'app').confirmsRead
  const isAvatarEnabled = props.avatars === 'initials' || props.renderAuthorAvatar !== undefined
  const nodes: ReactNode[] = []
  let previousDay: Date | undefined
  let previousAuthor: ParticipantAvatarAuthor | undefined

  for (const item of items) {
    const day = new Date(createdAtOf(item))
    if (previousDay === undefined || !isSameDay(previousDay, day)) {
      nodes.push(
        <div key={`day:${keyOf(item)}`} className="cv-p-day" role="separator">
          {day.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </div>,
      )
      previousAuthor = undefined
    }
    previousDay = day
    const { isMine, author } = authorOf(item)
    const showAvatar = shouldShowAvatar({ previousAuthor, author, isMine })
    previousAuthor = isMine ? undefined : author
    nodes.push(
      <ParticipantMessageBubble
        key={keyOf(item)}
        item={item}
        labels={labels}
        confirmsRead={confirmsRead}
        resolveAttachmentUrl={resolveAttachmentUrl}
        tail={props.tail}
        avatar={resolveAvatarSlot({
          isEnabled: isAvatarEnabled,
          isMine,
          showAvatar,
          author,
          render: props.renderAuthorAvatar,
        })}
        {...resolveActions(item, pendingActions)}
      />,
    )
  }
  return <div className="cv-p-thread__messages">{nodes}</div>
}

function Footer({ props }: { readonly props: ParticipantThreadProps }) {
  const { conversation, labels, draft } = props
  if (conversation.status === 'closed') {
    return <p className="cv-p-thread__closed">{labels.closedNotice}</p>
  }
  return (
    <ParticipantComposer
      value={draft.value}
      onChange={draft.onChange}
      files={draft.files}
      onFilesChange={draft.onFilesChange}
      onSend={props.onSend}
      labels={labels}
      channel={props.channel}
      isSending={props.isSending}
      maxLength={props.maxLength}
      acceptedTypes={props.acceptedTypes}
      quickReplies={props.quickReplies}
    />
  )
}

export function ParticipantThread(props: ParticipantThreadProps) {
  const { conversation, labels, hasMore, onLoadOlder, renderSubjectCard } = props
  const subjectCard = renderSubjectCard?.(conversation)
  const loadView = resolveLoadView({ status: props.status, hasItems: props.items.length > 0 })

  return (
    <div className="cv-p cv-p-thread" aria-busy={loadView.isLoading}>
      <ParticipantThreadHeader
        conversation={conversation}
        labels={labels}
        subjectGroups={props.subjectGroups}
        onBack={props.onBack}
        onOpenSubject={props.onOpenSubject}
      />
      {subjectCard ? <div className="cv-p-thread__subject-card">{subjectCard}</div> : null}
      <div className="cv-p-thread__scroll" ref={props.scroll.ref} onScroll={props.scroll.onScroll}>
        {loadView.isLoading ? <ParticipantLoading labels={labels} /> : null}
        {loadView.hasError ? <ParticipantLoadError labels={labels} onRetry={props.refresh} /> : null}
        {hasMore && onLoadOlder ? (
          <button type="button" className="cv-p-thread__older" onClick={onLoadOlder}>
            {labels.loadOlder}
          </button>
        ) : null}
        <Timeline props={props} />
      </div>
      <div className="cv-p-thread__live" role="status" aria-live="polite">
        {props.newMessagesCount > 0 ? labels.newMessages : ''}
      </div>
      <Footer props={props} />
    </div>
  )
}

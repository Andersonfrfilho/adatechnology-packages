import type { ReactNode } from 'react'

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { channelCapabilityFor } from '../channelCapability'
import type { ConversationChannel } from '../conversationChannel'
import { isSameDay } from '../lib/format'
import type { QuickReply } from '../quickReplies/quickReply.types'
import { ParticipantComposer } from './ParticipantComposer'
import type { ResolveParticipantAttachmentUrl } from './ParticipantAttachmentItem'
import { bindPendingActions, resolveParticipantBubbleActions, type ParticipantPendingActions } from './participantBubbleActions'
import type { ParticipantConversationsLabels } from './participantLabels'
import type { ParticipantTimelineItem } from './participantMessages'
import { ParticipantMessageBubble } from './ParticipantMessageBubble'

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
  readonly channel?: ConversationChannel
  readonly locale?: string
  readonly onBack?: () => void
  readonly onOpenSubject?: (subject: ParticipantSubjectRef) => void
  readonly onLoadOlder?: () => void
  readonly pendingActions?: ParticipantPendingActions
  readonly newMessagesCount?: number
  readonly isSending?: boolean
  readonly quickReplies?: readonly QuickReply[]
  readonly acceptedTypes?: readonly string[]
  readonly maxLength?: number
  readonly renderSubjectCard?: (conversation: ParticipantConversationSummary) => ReactNode
}

function createdAtOf(item: ParticipantTimelineItem): string {
  return item.kind === 'server' ? item.message.createdAt : item.pending.createdAt
}

function keyOf(item: ParticipantTimelineItem): string {
  return item.kind === 'server' ? item.message.id : `pending:${item.pending.clientMessageId}`
}

function resolveActions(item: ParticipantTimelineItem, pendingActions?: ParticipantPendingActions) {
  if (!pendingActions || item.kind === 'server') return {}
  return resolveParticipantBubbleActions(item, bindPendingActions(pendingActions, item.pending.clientMessageId))
}

function Header({ props }: { readonly props: ParticipantThreadProps }) {
  const { conversation, labels, onBack, onOpenSubject } = props
  const { subjectType, subjectId } = conversation

  return (
    <header className="cv-p-thread__header">
      {onBack ? (
        <button type="button" className="cv-p-button cv-p-thread__back" onClick={onBack}>
          <span aria-hidden="true">‹</span>
          <span className="cv-p-sr-only">{labels.back}</span>
        </button>
      ) : null}
      <h2 className="cv-p-thread__title">
        {onOpenSubject ? (
          <button
            type="button"
            className="cv-p-thread__title-button"
            aria-label={`${labels.openSubject}: ${conversation.subjectLabel}`}
            onClick={() => onOpenSubject({ subjectType, subjectId })}
          >
            {conversation.subjectLabel}
          </button>
        ) : (
          conversation.subjectLabel
        )}
      </h2>
    </header>
  )
}

function Timeline({ props }: { readonly props: ParticipantThreadProps }) {
  const { items, labels, locale, resolveAttachmentUrl, pendingActions } = props
  const confirmsRead = channelCapabilityFor(props.channel ?? 'app').confirmsRead
  const nodes: ReactNode[] = []
  let previousDay: Date | undefined

  for (const item of items) {
    const day = new Date(createdAtOf(item))
    if (previousDay === undefined || !isSameDay(previousDay, day)) {
      nodes.push(
        <div key={`day:${keyOf(item)}`} className="cv-p-day" role="separator">
          {day.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
        </div>,
      )
    }
    previousDay = day
    nodes.push(
      <ParticipantMessageBubble
        key={keyOf(item)}
        item={item}
        labels={labels}
        confirmsRead={confirmsRead}
        resolveAttachmentUrl={resolveAttachmentUrl}
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
      disabled={props.isSending}
      maxLength={props.maxLength}
      acceptedTypes={props.acceptedTypes}
      quickReplies={props.quickReplies}
    />
  )
}

export function ParticipantThread(props: ParticipantThreadProps) {
  const { conversation, labels, hasMore, onLoadOlder, renderSubjectCard } = props
  const subjectCard = renderSubjectCard?.(conversation)

  return (
    <div className="cv-p cv-p-thread">
      <Header props={props} />
      {subjectCard ? <div className="cv-p-thread__subject-card">{subjectCard}</div> : null}
      <div className="cv-p-thread__scroll">
        {hasMore && onLoadOlder ? (
          <button type="button" className="cv-p-thread__older" onClick={onLoadOlder}>
            {labels.loadOlder}
          </button>
        ) : null}
        <Timeline props={props} />
      </div>
      <div className="cv-p-thread__live" role="status" aria-live="polite">
        {props.newMessagesCount && props.newMessagesCount > 0 ? labels.newMessages : ''}
      </div>
      <Footer props={props} />
    </div>
  )
}

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { formatTimestamp, isSameDay } from '../lib/format'
import type { ParticipantSubjectGroup, ParticipantSubjectIconRenderer } from './participant.types'
import { formatParticipantLabel, type ParticipantConversationsLabels } from './participantLabels'
import { ParticipantChannelBadges } from './ParticipantChannelBadges'
import { isDrawable, resolveConversationIcon } from './participantSubjectIcon'

export type ParticipantInboxRowProps = {
  readonly conversation: ParticipantConversationSummary
  readonly group: ParticipantSubjectGroup | undefined
  readonly labels: ParticipantConversationsLabels
  readonly locale?: string
  readonly onSelect: (subject: ParticipantSubjectRef) => void
  readonly renderSubjectIcon?: ParticipantSubjectIconRenderer
}

function formatRowTime(iso: string, locale: string | undefined): string {
  const date = new Date(iso)
  if (isSameDay(date, new Date())) return formatTimestamp(iso)
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

function RowIcon({ props, kind }: { readonly props: ParticipantInboxRowProps; readonly kind: string }) {
  const { conversation, group, renderSubjectIcon } = props
  const hostIcon = renderSubjectIcon?.(conversation)
  if (isDrawable(hostIcon)) {
    return (
      <span className="cv-p-row__icon cv-p-inbox__icon" aria-hidden="true">
        {hostIcon}
      </span>
    )
  }
  return (
    <span className="cv-p-row__icon" aria-hidden="true">
      {resolveConversationIcon({ conversation, group }) ?? kind.slice(0, 2)}
    </span>
  )
}

export function ParticipantInboxRow(props: ParticipantInboxRowProps) {
  const { conversation, group, labels, locale, onSelect } = props
  const kind = group?.label ?? conversation.subjectType
  const className = conversation.awaitingParticipant ? 'cv-p-row cv-p-row--awaiting' : 'cv-p-row'
  const { subjectType, subjectId } = conversation

  return (
    <button type="button" className={className} onClick={() => onSelect({ subjectType, subjectId })}>
      <RowIcon props={props} kind={kind} />
      <span className="cv-p-row__body">
        <span className="cv-p-row__kind">{kind}</span>
        <span className="cv-p-row__title">{conversation.subjectLabel}</span>
        <span className="cv-p-row__tags">
          {conversation.protocol ? (
            <span className="cv-p-protocol">
              <span className="cv-p-sr-only">{labels.protocolPrefix} </span>
              {conversation.protocol}
            </span>
          ) : null}
          <ParticipantChannelBadges channels={conversation.channels} labels={labels} variant="inline" />
        </span>
        {conversation.lastMessagePreview ? (
          <span className="cv-p-row__preview">{conversation.lastMessagePreview}</span>
        ) : null}
      </span>
      <span className="cv-p-row__meta">
        {conversation.lastMessageAt ? <span>{formatRowTime(conversation.lastMessageAt, locale)}</span> : null}
        {conversation.unreadCount > 0 ? (
          <span className="cv-p-row__unread">
            <span aria-hidden="true">{conversation.unreadCount}</span>
            <span className="cv-p-sr-only">{formatParticipantLabel(labels.unreadCount, conversation.unreadCount)}</span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

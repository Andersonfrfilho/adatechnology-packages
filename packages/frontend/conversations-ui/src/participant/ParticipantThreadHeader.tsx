import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { ParticipantChannelBadges } from './ParticipantChannelBadges'
import { resolveParticipantChannels } from './participantChannels'
import { ParticipantProtocolBadge } from './ParticipantProtocolBadge'
import type { ParticipantSubjectGroup } from './participant.types'
import type { ParticipantConversationsLabels } from './participantLabels'

export type ParticipantThreadHeaderProps = {
  readonly conversation: ParticipantConversationSummary
  readonly labels: ParticipantConversationsLabels
  readonly subjectGroups?: readonly ParticipantSubjectGroup[]
  readonly onBack?: () => void
  readonly onOpenSubject?: (subject: ParticipantSubjectRef) => void
}

type TitleProps = Pick<ParticipantThreadHeaderProps, 'conversation' | 'labels' | 'onOpenSubject'>

function Title({ conversation, labels, onOpenSubject }: TitleProps) {
  const { subjectType, subjectId, subjectLabel } = conversation
  return (
    <h2 className="cv-p-thread__title">
      {onOpenSubject ? (
        <button
          type="button"
          className="cv-p-thread__title-button"
          aria-label={`${labels.openSubject}: ${subjectLabel}`}
          onClick={() => onOpenSubject({ subjectType, subjectId })}
        >
          <span className="cv-p-thread__title-text">{subjectLabel}</span>
        </button>
      ) : (
        <span className="cv-p-thread__title-text">{subjectLabel}</span>
      )}
    </h2>
  )
}

export function ParticipantThreadHeader({
  conversation,
  labels,
  subjectGroups,
  onBack,
  onOpenSubject,
}: ParticipantThreadHeaderProps) {
  const groupLabel = subjectGroups?.find((group) => group.subjectType === conversation.subjectType)?.label
  const hasChannels = resolveParticipantChannels(conversation.channels).length > 0

  return (
    <header className="cv-p-thread__header">
      {onBack ? (
        <button type="button" className="cv-p-button cv-p-thread__back" onClick={onBack}>
          <span aria-hidden="true">‹</span>
          <span className="cv-p-sr-only">{labels.back}</span>
        </button>
      ) : null}
      <div className="cv-p-thread__heading">
        {groupLabel ? <p className="cv-p-thread__eyebrow">{groupLabel}</p> : null}
        <Title conversation={conversation} labels={labels} onOpenSubject={onOpenSubject} />
        {conversation.protocol || hasChannels ? (
          <div className="cv-p-thread__meta">
            {conversation.protocol ? (
              <ParticipantProtocolBadge protocol={conversation.protocol} labels={labels} />
            ) : null}
            <ParticipantChannelBadges channels={conversation.channels} labels={labels} variant="inline" iconSize={16} />
          </div>
        ) : null}
      </div>
    </header>
  )
}

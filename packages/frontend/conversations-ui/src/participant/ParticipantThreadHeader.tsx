import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { ParticipantBackButton } from './ParticipantBackButton'
import { ParticipantChannelBadges } from './ParticipantChannelBadges'
import { resolveParticipantChannels } from './participantChannels'
import { ParticipantConversationAvatar } from './ParticipantConversationAvatar'
import { ParticipantProtocolBadge } from './ParticipantProtocolBadge'
import type { ParticipantSubjectGroup, ParticipantSubjectIconRenderer } from './participant.types'
import type { ParticipantConversationsLabels } from './participantLabels'
import { resolveConversationIcon } from './participantSubjectIcon'

export type ParticipantThreadHeaderProps = {
  readonly conversation: ParticipantConversationSummary
  readonly labels: ParticipantConversationsLabels
  readonly subjectGroups?: readonly ParticipantSubjectGroup[]
  readonly renderSubjectIcon?: ParticipantSubjectIconRenderer
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
  renderSubjectIcon,
  onBack,
  onOpenSubject,
}: ParticipantThreadHeaderProps) {
  const group = subjectGroups?.find((candidate) => candidate.subjectType === conversation.subjectType)
  const icon = resolveConversationIcon({ conversation, group, renderSubjectIcon })
  const hasChannels = resolveParticipantChannels(conversation.channels).length > 0

  return (
    <header className="cv-p-thread__header">
      {onBack ? <ParticipantBackButton label={labels.back} onBack={onBack} /> : null}
      {icon !== undefined ? <ParticipantConversationAvatar icon={icon} /> : null}
      <div className="cv-p-thread__heading">
        {icon === undefined && group ? <p className="cv-p-thread__eyebrow">{group.label}</p> : null}
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

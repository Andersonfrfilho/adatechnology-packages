import { useMemo, useRef, useState } from 'react'

import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { ParticipantInbox } from './ParticipantInbox'
import type { ParticipantConversationsProps } from './ParticipantConversations'
import { ParticipantThreadScreen, type ParticipantDraft } from './ParticipantThreadScreen'
import { groupParticipantConversations } from './participantGrouping'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { buildParticipantThemeStyle } from './participantTheme'
import type { UseParticipantInboxResult } from './useParticipantInbox'

export type ParticipantConversationsScreenProps = ParticipantConversationsProps & {
  readonly inbox: Pick<UseParticipantInboxResult, 'status' | 'conversations' | 'markSubjectRead'>
}

const ALL_FILTER = 'all'

function subjectKeyOf(subject: ParticipantSubjectRef): string {
  return `${subject.subjectType}:${subject.subjectId}`
}

export function ParticipantConversationsScreen(props: ParticipantConversationsScreenProps) {
  const { selected, inbox, subjectGroups, classNames } = props
  const [filter, setFilter] = useState(ALL_FILTER)
  const drafts = useRef(new Map<string, ParticipantDraft>())
  const labels = useMemo(
    () => ({ ...DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS, ...props.labels }),
    [props.labels],
  )
  const view = useMemo(
    () => groupParticipantConversations({ conversations: inbox.conversations, subjectGroups, filter }),
    [inbox.conversations, subjectGroups, filter],
  )
  const rootClassName = ['cv-p-root', props.className, classNames?.root].filter(Boolean).join(' ')

  return (
    <div className={rootClassName} style={buildParticipantThemeStyle(props.theme)}>
      {selected === undefined ? (
        <div className={['cv-p-root__screen', classNames?.inbox].filter(Boolean).join(' ')}>
          <ParticipantInbox
            view={view}
            subjectGroups={subjectGroups}
            filter={filter}
            onFilterChange={setFilter}
            onSelect={props.onSelect}
            labels={labels}
            locale={props.locale}
          />
        </div>
      ) : (
        <div className={['cv-p-root__screen', classNames?.thread].filter(Boolean).join(' ')}>
          <ParticipantThreadScreen
            key={subjectKeyOf(selected)}
            {...props}
            selected={selected}
            labels={labels}
            drafts={drafts.current}
            draftKey={subjectKeyOf(selected)}
          />
        </div>
      )}
    </div>
  )
}

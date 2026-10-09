import { useMemo, useRef, useState } from 'react'

import { ParticipantInbox } from './ParticipantInbox'
import type { ParticipantConversationsProps } from './ParticipantConversations'
import { ParticipantThreadScreen } from './ParticipantThreadScreen'
import { draftKey, type ParticipantDrafts } from './participantDrafts'
import { groupParticipantConversations } from './participantGrouping'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { buildParticipantThemeStyle } from './participantTheme'
import type { UseParticipantInboxResult } from './useParticipantInbox'

export type ParticipantConversationsScreenProps = ParticipantConversationsProps & {
  readonly inbox: Pick<UseParticipantInboxResult, 'status' | 'conversations' | 'markSubjectRead'>
}

const ALL_FILTER = 'all'

export function ParticipantConversationsScreen(props: ParticipantConversationsScreenProps) {
  const { selected, inbox, subjectGroups, classNames } = props
  const [filter, setFilter] = useState(ALL_FILTER)
  const draftsRef = useRef<ParticipantDrafts>(new Map())
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
            key={draftKey(selected)}
            {...props}
            selected={selected}
            labels={labels}
            draftsRef={draftsRef}
          />
        </div>
      )}
    </div>
  )
}

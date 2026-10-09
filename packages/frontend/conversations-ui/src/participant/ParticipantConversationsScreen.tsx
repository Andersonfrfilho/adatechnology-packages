import { useMemo, useReducer, useRef, useState } from 'react'

import { ParticipantInbox } from './ParticipantInbox'
import type { ParticipantConversationsProps } from './ParticipantConversations'
import { ParticipantThreadScreen } from './ParticipantThreadScreen'
import { draftKey, type ParticipantDrafts } from './participantDrafts'
import { groupParticipantConversations } from './participantGrouping'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS } from './participantLabels'
import { isInboxSearchVisible } from './participantProtocol'
import { participantSendStatesReducer } from './participantSendStates'
import { buildParticipantThemeStyle } from './participantTheme'
import type { UseParticipantInboxResult } from './useParticipantInbox'

export type ParticipantConversationsScreenProps = ParticipantConversationsProps & {
  readonly inbox: Pick<
    UseParticipantInboxResult,
    'status' | 'conversations' | 'hasMore' | 'refresh' | 'loadMore' | 'markSubjectRead'
  >
}

const ALL_FILTER = 'all'

export function ParticipantConversationsScreen(props: ParticipantConversationsScreenProps) {
  const { selected, inbox, subjectGroups, classNames } = props
  const [filter, setFilter] = useState(ALL_FILTER)
  const [searchQuery, setSearchQuery] = useState('')
  const draftsRef = useRef<ParticipantDrafts>(new Map())
  const [sendStates, dispatchSendStates] = useReducer(participantSendStatesReducer, new Map())
  const labels = useMemo(() => ({ ...DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS, ...props.labels }), [props.labels])
  const view = useMemo(
    () =>
      groupParticipantConversations({
        conversations: inbox.conversations,
        subjectGroups,
        filter,
        searchQuery,
      }),
    [inbox.conversations, subjectGroups, filter, searchQuery],
  )
  const isSearchVisible = isInboxSearchVisible({ conversations: inbox.conversations, searchQuery })
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
            status={inbox.status}
            refresh={() => void inbox.refresh()}
            hasMore={inbox.hasMore}
            loadMore={() => void inbox.loadMore()}
            locale={props.locale}
            search={{ value: searchQuery, onChange: setSearchQuery, isVisible: isSearchVisible }}
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
            sendStates={sendStates}
            dispatchSendStates={dispatchSendStates}
          />
        </div>
      )}
    </div>
  )
}

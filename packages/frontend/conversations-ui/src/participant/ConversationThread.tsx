import { useCallback, useMemo, useReducer, useRef, type ReactNode } from 'react'

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ConversationChannel } from '../conversationChannel'
import type { QuickReply } from '../quickReplies/quickReply.types'
import type { ConversationsTheme } from '../types'
import type { ParticipantAuthorAvatarRenderer } from './ParticipantAuthorAvatar'
import { ParticipantThread } from './ParticipantThread'
import { toParticipantApi, type ConversationThreadApi } from './conversationThreadApi'
import { buildThreadSummary } from './conversationThreadSummary'
import type { ParticipantSubjectGroup, ParticipantSubjectIconRenderer } from './participant.types'
import type { ParticipantPendingMessage } from './participantApi.types'
import { draftKey, type ParticipantDrafts } from './participantDrafts'
import { DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS, type ParticipantConversationsLabels } from './participantLabels'
import type { ParticipantPerspective } from './participantPerspective'
import { participantSendStatesReducer } from './participantSendStates'
import { buildParticipantThemeStyle } from './participantTheme'
import { useParticipantThreadController, type ParticipantThreadCoreProps } from './useParticipantThreadController'

export type ConversationThreadProps = {
  readonly api: ConversationThreadApi
  readonly subject: ParticipantSubjectRef
  /** `participant` (default) is the outside party; `operator` is the company, which owns the outbound messages. */
  readonly perspective?: ParticipantPerspective
  readonly title: string
  readonly protocol?: string
  readonly channels?: ParticipantConversationSummary['channels']
  /** `closed` removes the composer and shows `labels.closedNotice`. */
  readonly status?: 'open' | 'closed'
  /** Short line under the title, written by the host (for example "Participant: Ana"). */
  readonly counterpartLabel?: string
  /** Slot at the end of the header bar for the host's own actions (close, reopen...). The package knows none of them. */
  readonly headerActions?: ReactNode
  /** Absent draws no back arrow. */
  readonly onBack?: () => void
  readonly renderSubjectIcon?: ParticipantSubjectIconRenderer
  readonly subjectGroups?: readonly ParticipantSubjectGroup[]
  /** Chips above the field: tapping one fills the text, it never sends. */
  readonly quickReplies?: readonly QuickReply[]
  readonly labels?: Partial<ParticipantConversationsLabels>
  readonly theme?: ConversationsTheme
  readonly className?: string
  readonly locale?: string
  readonly channel?: ConversationChannel
  readonly pendingMessages?: readonly ParticipantPendingMessage[]
  readonly onRetryPending?: (clientMessageId: string) => void
  /** Tells the host the other side's messages were marked read, to refresh its own badges. */
  readonly onMarkedRead?: (subject: ParticipantSubjectRef) => void
  readonly tail?: boolean
  readonly avatars?: 'initials'
  readonly renderAuthorAvatar?: ParticipantAuthorAvatarRenderer
}

function useConversationThreadCore(props: ConversationThreadProps): ParticipantThreadCoreProps {
  const { perspective = 'participant' } = props
  const { subjectType, subjectId } = props.subject
  const subject = useMemo<ParticipantSubjectRef>(() => ({ subjectType, subjectId }), [subjectType, subjectId])
  const onMarkedReadRef = useRef(props.onMarkedRead)
  onMarkedReadRef.current = props.onMarkedRead
  const handleMarkedRead = useCallback((marked: ParticipantSubjectRef) => onMarkedReadRef.current?.(marked), [])
  const api = useMemo(() => toParticipantApi(props.api), [props.api])
  const draftsRef = useRef<ParticipantDrafts>(new Map())
  const [sendStates, dispatchSendStates] = useReducer(participantSendStatesReducer, new Map())
  const labels = useMemo(() => ({ ...DEFAULT_PARTICIPANT_CONVERSATIONS_LABELS, ...props.labels }), [props.labels])
  const { title, protocol, channels, status } = props
  const conversation = useMemo(
    () => buildThreadSummary({ subject, title, protocol, channels, status }),
    [subject, title, protocol, channels, status],
  )
  return useParticipantThreadController({
    api,
    subject,
    conversation,
    labels,
    draftsRef,
    sendStates,
    dispatchSendStates,
    onMarkedRead: handleMarkedRead,
    channel: props.channel,
    locale: props.locale,
    pendingMessages: props.pendingMessages,
    onRetryPending: props.onRetryPending,
    perspective,
  })
}

function ConversationThreadBody(props: ConversationThreadProps) {
  const core = useConversationThreadCore(props)

  return (
    <div
      className={['cv-p-root', props.className].filter(Boolean).join(' ')}
      style={buildParticipantThemeStyle(props.theme)}
    >
      <div className="cv-p-root__screen">
        <ParticipantThread
          {...core}
          onBack={props.onBack}
          quickReplies={props.quickReplies}
          subjectGroups={props.subjectGroups}
          renderSubjectIcon={props.renderSubjectIcon}
          avatars={props.avatars}
          renderAuthorAvatar={props.renderAuthorAvatar}
          tail={props.tail}
          counterpartLabel={props.counterpartLabel}
          headerActions={props.headerActions}
        />
      </div>
    </div>
  )
}

/** One conversation about one subject, drawn like the participant app and seen from either side. */
export function ConversationThread(props: ConversationThreadProps) {
  return <ConversationThreadBody key={draftKey(props.subject)} {...props} />
}

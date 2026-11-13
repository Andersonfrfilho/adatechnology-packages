import { useCallback, useMemo, type Dispatch } from 'react'

import type { ParticipantConversationSummary, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ConversationChannel } from '../conversationChannel'
import type { ParticipantConversationsApi, ParticipantPendingMessage } from './participantApi.types'
import type { ParticipantPerspective } from './participantPerspective'
import { mergeParticipantMessages, type ParticipantTimelineItem } from './participantMessages'
import type { ParticipantSendAction, ParticipantSendEntry } from './participantSendController'
import { selectSendEntries, type ParticipantSendStates, type ParticipantSendStatesAction } from './participantSendStates'
import { useParticipantThread, type UseParticipantThreadResult } from './useParticipantThread'

export type UseParticipantConversationViewParams = {
  readonly api: ParticipantConversationsApi
  readonly subject: ParticipantSubjectRef
  readonly conversation: ParticipantConversationSummary
  readonly channel?: ConversationChannel
  readonly onMarkedRead: (subject: ParticipantSubjectRef) => void
  readonly pendingMessages?: readonly ParticipantPendingMessage[]
  readonly sendStates: ParticipantSendStates
  readonly dispatchSendStates: Dispatch<ParticipantSendStatesAction>
  readonly perspective?: ParticipantPerspective
}

export type UseParticipantConversationViewResult = {
  readonly thread: UseParticipantThreadResult
  readonly items: readonly ParticipantTimelineItem[]
  readonly sendEntries: readonly ParticipantSendEntry[]
  readonly dispatchSend: (action: ParticipantSendAction) => void
}

export function useParticipantConversationView(params: UseParticipantConversationViewParams): UseParticipantConversationViewResult {
  const { api, subject, conversation, pendingMessages, sendStates, dispatchSendStates } = params
  const { subjectType, subjectId } = subject
  const sendEntries = selectSendEntries(sendStates, subject)
  const dispatchSend = useCallback(
    (action: ParticipantSendAction) => dispatchSendStates({ subject: { subjectType, subjectId }, action }),
    [dispatchSendStates, subjectType, subjectId],
  )
  const thread = useParticipantThread({
    api,
    subject,
    channel: params.channel,
    unreadCount: conversation.unreadCount,
    onMarkedRead: params.onMarkedRead,
    sendEntries,
    dispatchSend,
    hostPending: pendingMessages,
    perspective: params.perspective,
  })
  const items = useMemo(
    () =>
      mergeParticipantMessages({
        serverMessages: thread.messages,
        hostPending: pendingMessages ?? [],
        localPending: thread.localPending,
        subject,
      }),
    [thread.messages, thread.localPending, pendingMessages, subject],
  )

  return { thread, items, sendEntries, dispatchSend }
}

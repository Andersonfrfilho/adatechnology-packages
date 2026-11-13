import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import type { ParticipantMessage, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { channelCapabilityFor } from '../channelCapability'
import type { ConversationChannel } from '../conversationChannel'
import type {
  ParticipantConversationEvent,
  ParticipantConversationsApi,
  ParticipantLocalPendingMessage,
  ParticipantPendingMessage,
} from './participantApi.types'
import {
  collectKnownClientMessageIds,
  toLocalPending,
  type ParticipantSendAction,
  type ParticipantSendEntry,
} from './participantSendController'
import { INITIAL_PARTICIPANT_THREAD_STATE, participantThreadReducer, type ParticipantThreadState } from './participantThreadState'
import type { ParticipantPerspective } from './participantPerspective'
import { useParticipantMarkRead } from './useParticipantMarkRead'
import { useParticipantRevalidation } from './useParticipantRevalidation'
import { useParticipantSend, type UseParticipantSendResult } from './useParticipantSend'
import { useParticipantUnread } from './useParticipantUnread'

const THREAD_PAGE_SIZE = 30

export type UseParticipantThreadParams = {
  /** Keep it stable: a new identity re-subscribes to events (it never resets the conversation). */
  readonly api: ParticipantConversationsApi
  readonly subject: ParticipantSubjectRef
  readonly channel?: ConversationChannel
  /** Unread count of this subject as the inbox knows it; drives markRead. */
  readonly unreadCount?: number
  readonly onMarkedRead?: (subject: ParticipantSubjectRef) => void
  /** Sends of this subject, owned above the conversation so they survive leaving it. */
  readonly sendEntries: readonly ParticipantSendEntry[]
  readonly dispatchSend: (action: ParticipantSendAction) => void
  readonly hostPending?: readonly ParticipantPendingMessage[]
  /** Present on a single-conversation screen: unread comes from the messages, not from `unreadCount`. */
  readonly perspective?: ParticipantPerspective
}

export type UseParticipantThreadResult = ParticipantThreadState &
  UseParticipantSendResult & {
    readonly confirmsRead: boolean
    readonly localPending: readonly ParticipantLocalPendingMessage[]
    readonly refresh: () => Promise<void>
    readonly loadOlder: () => Promise<void>
  }

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}

function isForSubject(event: ParticipantConversationEvent | undefined, subject: ParticipantSubjectRef): boolean {
  if (!event || event.type === 'inbox-changed') return true
  return event.subject.subjectType === subject.subjectType && event.subject.subjectId === subject.subjectId
}

export function useParticipantThread(params: UseParticipantThreadParams): UseParticipantThreadResult {
  const { api, subject, channel, unreadCount = 0, onMarkedRead, sendEntries, dispatchSend, hostPending = [], perspective } = params
  const { subjectType, subjectId } = subject
  const stableSubject = useMemo<ParticipantSubjectRef>(() => ({ subjectType, subjectId }), [subjectType, subjectId])
  const [state, dispatch] = useReducer(participantThreadReducer, INITIAL_PARTICIPANT_THREAD_STATE)
  const apiRef = useRef(api)
  apiRef.current = api
  const activeSubjectKey = useRef('')
  const confirmsRead = channelCapabilityFor(channel).confirmsRead

  const refresh = useCallback(async (): Promise<void> => {
    const requestKey = `${subjectType}:${subjectId}`
    dispatch({ type: 'started' })
    try {
      const messages = await apiRef.current.fetchMessages(stableSubject, { limit: THREAD_PAGE_SIZE })
      if (activeSubjectKey.current === requestKey) {
        dispatch({ type: 'loaded', messages, hasMore: messages.length >= THREAD_PAGE_SIZE })
      }
    } catch (error) {
      if (activeSubjectKey.current === requestKey) dispatch({ type: 'failed', error: describeError(error) })
    }
  }, [stableSubject, subjectType, subjectId])

  const oldestMessageId = state.messages[0]?.id
  const loadOlder = useCallback(async (): Promise<void> => {
    if (!oldestMessageId) return
    const requestKey = `${subjectType}:${subjectId}`
    try {
      const messages = await apiRef.current.fetchMessages(stableSubject, { before: oldestMessageId, limit: THREAD_PAGE_SIZE })
      if (activeSubjectKey.current === requestKey) {
        dispatch({ type: 'olderLoaded', messages, hasMore: messages.length >= THREAD_PAGE_SIZE })
      }
    } catch (error) {
      if (activeSubjectKey.current === requestKey) dispatch({ type: 'failed', error: describeError(error) })
    }
  }, [stableSubject, subjectType, subjectId, oldestMessageId])

  const handleSentMessage = useCallback((message: ParticipantMessage) => dispatch({ type: 'sendConfirmed', message }), [])
  const sending = useParticipantSend({ apiRef, subject: stableSubject, entries: sendEntries, dispatchSend, onSentMessage: handleSentMessage })

  useEffect(() => {
    activeSubjectKey.current = `${subjectType}:${subjectId}`
    dispatch({ type: 'reset' })
    void refresh()
  }, [refresh, subjectType, subjectId])

  useParticipantRevalidation(api, (event) => {
    if (isForSubject(event, stableSubject)) void refresh()
  })

  useEffect(() => {
    if (sendEntries.length === 0) return
    dispatchSend({ type: 'reflected', knownClientMessageIds: collectKnownClientMessageIds({ messages: state.messages, hostPending }) })
  }, [sendEntries, state.messages, hostPending, dispatchSend])

  const unread = useParticipantUnread({ messages: state.messages, perspective, reportedUnreadCount: unreadCount, onMarkedRead })
  useParticipantMarkRead({
    apiRef,
    subject: stableSubject,
    unreadCount: unread.unreadCount,
    messageCount: state.messages.length,
    onMarkedRead: unread.handleMarkedRead,
  })

  const localPending = useMemo(() => toLocalPending(sendEntries), [sendEntries])
  return { ...state, localPending, confirmsRead, refresh, loadOlder, ...sending }
}

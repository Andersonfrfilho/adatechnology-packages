import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { channelCapabilityFor } from '../channelCapability'
import type { ConversationChannel } from '../conversationChannel'
import type {
  ParticipantConversationEvent,
  ParticipantConversationsApi,
  ParticipantLocalPendingMessage,
} from './participantApi.types'
import { INITIAL_PARTICIPANT_THREAD_STATE, participantThreadReducer, type ParticipantThreadState } from './participantThreadState'
import { shouldMarkParticipantRead } from './shouldMarkRead'
import { useParticipantRevalidation } from './useParticipantRevalidation'

const THREAD_PAGE_SIZE = 30

export type UseParticipantThreadParams = {
  readonly api: ParticipantConversationsApi
  readonly subject: ParticipantSubjectRef
  readonly channel?: ConversationChannel
  /** Unread count of this subject as the inbox knows it; drives markRead. */
  readonly unreadCount?: number
  readonly onMarkedRead?: (subject: ParticipantSubjectRef) => void
}

export type ParticipantSendDraft = {
  readonly text?: string
  readonly files?: readonly File[]
}

export type ParticipantSendOutcome = 'sent' | 'queued' | 'failed'

export type UseParticipantThreadResult = ParticipantThreadState & {
  readonly confirmsRead: boolean
  readonly refresh: () => Promise<void>
  readonly loadOlder: () => Promise<void>
  readonly send: (draft: ParticipantSendDraft) => Promise<ParticipantSendOutcome>
  readonly retry: (clientMessageId: string) => Promise<void>
}

type SentRecord = { readonly subject: ParticipantSubjectRef; readonly draft: ParticipantSendDraft }

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}

function isForSubject(event: ParticipantConversationEvent | undefined, subject: ParticipantSubjectRef): boolean {
  if (!event || event.type === 'inbox-changed') return true
  return event.subject.subjectType === subject.subjectType && event.subject.subjectId === subject.subjectId
}

function describeAttachments(files: readonly File[] | undefined): ParticipantLocalPendingMessage['attachments'] {
  return files?.map((file) => ({ filename: file.name, mimeType: file.type, sizeBytes: file.size }))
}

export function useParticipantThread(params: UseParticipantThreadParams): UseParticipantThreadResult {
  const { api, subject, channel, unreadCount = 0, onMarkedRead } = params
  const { subjectType, subjectId } = subject
  const stableSubject = useMemo<ParticipantSubjectRef>(() => ({ subjectType, subjectId }), [subjectType, subjectId])
  const [state, dispatch] = useReducer(participantThreadReducer, INITIAL_PARTICIPANT_THREAD_STATE)
  const sentRecords = useRef(new Map<string, SentRecord>())
  const activeSubjectKey = useRef('')
  const confirmsRead = channelCapabilityFor(channel).confirmsRead

  const refresh = useCallback(async (): Promise<void> => {
    const requestKey = `${subjectType}:${subjectId}`
    dispatch({ type: 'started' })
    try {
      const messages = await api.fetchMessages(stableSubject, { limit: THREAD_PAGE_SIZE })
      if (activeSubjectKey.current === requestKey) {
        dispatch({ type: 'loaded', messages, hasMore: messages.length >= THREAD_PAGE_SIZE })
      }
    } catch (error) {
      if (activeSubjectKey.current === requestKey) dispatch({ type: 'failed', error: describeError(error) })
    }
  }, [api, stableSubject, subjectType, subjectId])

  const oldestMessageId = state.messages[0]?.id
  const loadOlder = useCallback(async (): Promise<void> => {
    if (!oldestMessageId) return
    const requestKey = `${subjectType}:${subjectId}`
    try {
      const messages = await api.fetchMessages(stableSubject, { before: oldestMessageId, limit: THREAD_PAGE_SIZE })
      if (activeSubjectKey.current === requestKey) {
        dispatch({ type: 'olderLoaded', messages, hasMore: messages.length >= THREAD_PAGE_SIZE })
      }
    } catch (error) {
      if (activeSubjectKey.current === requestKey) dispatch({ type: 'failed', error: describeError(error) })
    }
  }, [api, stableSubject, subjectType, subjectId, oldestMessageId])

  const dispatchSend = useCallback(
    async (clientMessageId: string, record: SentRecord): Promise<ParticipantSendOutcome> => {
      try {
        const result = await api.sendMessage({
          subject: record.subject,
          clientMessageId,
          ...(record.draft.text ? { text: record.draft.text } : {}),
          ...(record.draft.files?.length ? { files: record.draft.files } : {}),
        })
        sentRecords.current.delete(clientMessageId)
        if (result.outcome === 'sent') dispatch({ type: 'sendConfirmed', clientMessageId, message: result.message })
        else dispatch({ type: 'pendingRemoved', clientMessageId })
        return result.outcome === 'sent' ? 'sent' : 'queued'
      } catch {
        dispatch({ type: 'pendingFailed', clientMessageId })
        return 'failed'
      }
    },
    [api],
  )

  const send = useCallback(
    async (draft: ParticipantSendDraft): Promise<ParticipantSendOutcome> => {
      const clientMessageId = crypto.randomUUID()
      const record: SentRecord = { subject: stableSubject, draft }
      sentRecords.current.set(clientMessageId, record)
      const attachments = describeAttachments(draft.files)
      dispatch({
        type: 'pendingAdded',
        pending: {
          clientMessageId,
          subject: stableSubject,
          createdAt: new Date().toISOString(),
          state: 'sending',
          ...(draft.text ? { text: draft.text } : {}),
          ...(attachments?.length ? { attachments } : {}),
        },
      })
      return dispatchSend(clientMessageId, record)
    },
    [dispatchSend, stableSubject],
  )

  const retry = useCallback(
    async (clientMessageId: string): Promise<void> => {
      const record = sentRecords.current.get(clientMessageId)
      if (!record) return
      dispatch({ type: 'pendingRetrying', clientMessageId })
      await dispatchSend(clientMessageId, record)
    },
    [dispatchSend],
  )

  useEffect(() => {
    activeSubjectKey.current = `${subjectType}:${subjectId}`
    dispatch({ type: 'reset' })
    void refresh()
  }, [refresh, subjectType, subjectId])

  useParticipantRevalidation(api, (event) => {
    if (isForSubject(event, stableSubject)) void refresh()
  })

  const messageCount = state.messages.length
  useEffect(() => {
    const shouldMark = shouldMarkParticipantRead({
      selected: stableSubject,
      subject: stableSubject,
      visibilityState: document.visibilityState,
      unreadCount,
    })
    if (!shouldMark) return
    void api.markRead(stableSubject).then(() => onMarkedRead?.(stableSubject), () => undefined)
  }, [api, stableSubject, unreadCount, messageCount, onMarkedRead])

  return { ...state, confirmsRead, refresh, loadOlder, send, retry }
}

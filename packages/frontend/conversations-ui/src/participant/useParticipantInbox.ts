import { useCallback, useEffect, useReducer } from 'react'

import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ParticipantConversationsApi } from './participantApi.types'
import { INITIAL_PARTICIPANT_INBOX_STATE, participantInboxReducer, type ParticipantInboxState } from './participantInboxState'
import { useParticipantRevalidation } from './useParticipantRevalidation'

export type UseParticipantInboxResult = ParticipantInboxState & {
  readonly hasMore: boolean
  readonly refresh: () => Promise<void>
  readonly loadMore: () => Promise<void>
  readonly markSubjectRead: (subject: ParticipantSubjectRef) => void
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error'
}

export function useParticipantInbox(api: ParticipantConversationsApi): UseParticipantInboxResult {
  const [state, dispatch] = useReducer(participantInboxReducer, INITIAL_PARTICIPANT_INBOX_STATE)

  const refresh = useCallback(async (): Promise<void> => {
    dispatch({ type: 'started' })
    try {
      const page = await api.listConversations()
      dispatch({ type: 'loaded', conversations: page.data, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) })
    } catch (error) {
      dispatch({ type: 'failed', error: describeError(error) })
    }
  }, [api])

  const { nextCursor } = state
  const loadMore = useCallback(async (): Promise<void> => {
    if (!nextCursor) return
    try {
      const page = await api.listConversations({ cursor: nextCursor })
      dispatch({ type: 'appended', conversations: page.data, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) })
    } catch (error) {
      dispatch({ type: 'failed', error: describeError(error) })
    }
  }, [api, nextCursor])

  const markSubjectRead = useCallback((subject: ParticipantSubjectRef): void => {
    dispatch({ type: 'markedRead', subject })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useParticipantRevalidation(api, () => {
    void refresh()
  })

  return { ...state, hasMore: nextCursor !== undefined, refresh, loadMore, markSubjectRead }
}

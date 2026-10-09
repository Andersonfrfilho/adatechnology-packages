import { useCallback, useRef, type MutableRefObject } from 'react'

import type { ParticipantMessage, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ParticipantConversationsApi } from './participantApi.types'
import type { ParticipantSendContent } from './participantDrafts'
import {
  createParticipantSendEntry,
  findFailedEntry,
  type ParticipantSendAction,
  type ParticipantSendEntry,
} from './participantSendController'

export type ParticipantSendOutcome = 'sent' | 'queued' | 'failed'

export type UseParticipantSendParams = {
  readonly apiRef: MutableRefObject<ParticipantConversationsApi>
  readonly subject: ParticipantSubjectRef
  readonly entries: readonly ParticipantSendEntry[]
  readonly dispatchSend: (action: ParticipantSendAction) => void
  readonly onSentMessage: (message: ParticipantMessage) => void
}

export type UseParticipantSendResult = {
  readonly send: (content: ParticipantSendContent) => Promise<ParticipantSendOutcome>
  readonly retry: (clientMessageId: string) => Promise<void>
}

export function useParticipantSend(params: UseParticipantSendParams): UseParticipantSendResult {
  const { apiRef, subject, dispatchSend, onSentMessage } = params
  const entriesRef = useRef(params.entries)
  entriesRef.current = params.entries

  const deliver = useCallback(
    async (entry: ParticipantSendEntry): Promise<ParticipantSendOutcome> => {
      const { clientMessageId } = entry
      try {
        const result = await apiRef.current.sendMessage({
          subject: entry.subject,
          clientMessageId,
          ...(entry.text ? { text: entry.text } : {}),
          ...(entry.files.length > 0 ? { files: entry.files } : {}),
        })
        if (result.outcome === 'sent') {
          onSentMessage(result.message)
          dispatchSend({ type: 'confirmed', clientMessageId })
          return 'sent'
        }
        dispatchSend({ type: 'queued', clientMessageId })
        return 'queued'
      } catch {
        dispatchSend({ type: 'failed', clientMessageId })
        return 'failed'
      }
    },
    [apiRef, dispatchSend, onSentMessage],
  )

  const send = useCallback(
    async (content: ParticipantSendContent): Promise<ParticipantSendOutcome> => {
      const entry = createParticipantSendEntry({
        clientMessageId: crypto.randomUUID(),
        subject,
        content,
        createdAt: new Date().toISOString(),
      })
      dispatchSend({ type: 'started', entry })
      return deliver(entry)
    },
    [deliver, dispatchSend, subject],
  )

  const retry = useCallback(
    async (clientMessageId: string): Promise<void> => {
      const entry = findFailedEntry(entriesRef.current, clientMessageId)
      if (!entry) return
      dispatchSend({ type: 'retried', clientMessageId })
      await deliver({ ...entry, state: 'sending' })
    },
    [deliver, dispatchSend],
  )

  return { send, retry }
}

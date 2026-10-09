import { useEffect, type MutableRefObject } from 'react'

import type { ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import type { ParticipantConversationsApi } from './participantApi.types'
import { shouldMarkParticipantRead } from './shouldMarkRead'
import { useDocumentVisibility } from './useDocumentVisibility'

export type UseParticipantMarkReadParams = {
  readonly apiRef: MutableRefObject<ParticipantConversationsApi>
  readonly subject: ParticipantSubjectRef
  readonly unreadCount: number
  /** Marking again when a message arrives while the screen stays open. */
  readonly messageCount: number
  readonly onMarkedRead?: (subject: ParticipantSubjectRef) => void
}

export function useParticipantMarkRead(params: UseParticipantMarkReadParams): void {
  const { apiRef, subject, unreadCount, messageCount, onMarkedRead } = params
  const visibilityState = useDocumentVisibility()

  useEffect(() => {
    if (!shouldMarkParticipantRead({ selected: subject, subject, visibilityState, unreadCount })) return
    void apiRef.current.markRead(subject).then(() => onMarkedRead?.(subject), () => undefined)
  }, [apiRef, subject, visibilityState, unreadCount, messageCount, onMarkedRead])
}

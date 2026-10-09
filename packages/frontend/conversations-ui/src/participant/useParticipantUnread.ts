import { useCallback, useRef, useState } from 'react'

import type { ParticipantMessage, ParticipantSubjectRef } from '@adatechnology/conversation-contracts'

import { countOtherSideMessages, resolveViewerUnread, type ParticipantPerspective } from './participantPerspective'

export type UseParticipantUnreadParams = {
  readonly messages: readonly ParticipantMessage[]
  /** Absent keeps the count the inbox reported, which is how the list-driven screen works. */
  readonly perspective?: ParticipantPerspective
  readonly reportedUnreadCount: number
  readonly onMarkedRead?: (subject: ParticipantSubjectRef) => void
}

export type UseParticipantUnreadResult = {
  readonly unreadCount: number
  readonly handleMarkedRead: (subject: ParticipantSubjectRef) => void
}

/** A single conversation has no inbox, so what the viewer has not read is derived from the messages themselves. */
export function useParticipantUnread(params: UseParticipantUnreadParams): UseParticipantUnreadResult {
  const { messages, perspective, reportedUnreadCount, onMarkedRead } = params
  const [acknowledgedCount, setAcknowledgedCount] = useState(0)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const handleMarkedRead = useCallback(
    (subject: ParticipantSubjectRef): void => {
      if (perspective) setAcknowledgedCount(countOtherSideMessages(messagesRef.current, perspective))
      onMarkedRead?.(subject)
    },
    [perspective, onMarkedRead],
  )
  const unreadCount = perspective
    ? resolveViewerUnread({ messages, perspective, acknowledgedCount })
    : reportedUnreadCount
  return { unreadCount, handleMarkedRead }
}

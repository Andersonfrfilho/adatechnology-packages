import { useEffect, useRef } from 'react'

import type { ParticipantTranscription } from '@adatechnology/conversation-contracts'

import { useAnnounceCopy } from './ParticipantCopyAnnouncer'

export type TranscriptionReadyAnnouncementParams = {
  readonly attachmentId: string
  readonly status: ParticipantTranscription['status'] | undefined
  readonly text: string
}

/** Speaks through the thread's existing live region, only for a pending to ready change seen by this mount. */
export function useTranscriptionReadyAnnouncement({ attachmentId, status, text }: TranscriptionReadyAnnouncementParams): void {
  const announce = useAnnounceCopy()
  const previous = useRef({ attachmentId, status })

  useEffect(() => {
    const before = previous.current
    previous.current = { attachmentId, status }
    if (before.attachmentId !== attachmentId) return
    if (before.status === 'pending' && status === 'ready') announce(text)
  }, [announce, attachmentId, status, text])
}

import { useEffect, useReducer } from 'react'

import { useAnnounceCopy } from './ParticipantCopyAnnouncer'
import { INITIAL_PROTOCOL_COPY_STATE, copyProtocolToClipboard, protocolCopyReducer } from './participantProtocolCopy'

const COPIED_FEEDBACK_MS = 2000

export type CopyFeedback = {
  readonly isCopied: boolean
  readonly copy: (value: string, announcement: string) => void
}

/** Copied state is local to each token; a clipboard failure is silent and shows nothing. */
export function useParticipantCopyFeedback(): CopyFeedback {
  const [state, dispatch] = useReducer(protocolCopyReducer, INITIAL_PROTOCOL_COPY_STATE)
  const announce = useAnnounceCopy()
  const { isCopied, copyCount } = state

  useEffect(() => {
    if (!isCopied) return undefined
    const timer = setTimeout(() => dispatch({ type: 'expired' }), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [isCopied, copyCount])

  async function copyValue(value: string, announcement: string): Promise<void> {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (!(await copyProtocolToClipboard(value, clipboard))) return
    dispatch({ type: 'copied' })
    announce(announcement)
  }

  return { isCopied, copy: (value, announcement) => void copyValue(value, announcement) }
}

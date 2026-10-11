import { useCallback, useRef } from 'react'

import type { ParticipantSendContent } from './participantDrafts'

/**
 * Sends a recorded audio as its own message through the attachment path. The file itself is the
 * lock: send generates a new client id per call, so the server idempotency would not stop a double tap.
 */
export function useParticipantSendAudio(send: (content: ParticipantSendContent) => Promise<unknown>): (file: File) => void {
  const sendRef = useRef(send)
  sendRef.current = send
  const inFlightRef = useRef(new Set<File>())

  return useCallback((file: File): void => {
    const inFlight = inFlightRef.current
    if (inFlight.has(file)) return
    inFlight.add(file)
    void (async () => {
      try {
        await sendRef.current({ files: [file] })
      } finally {
        inFlight.delete(file)
      }
    })()
  }, [])
}

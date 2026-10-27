import { useEffect, useRef } from 'react'

import type { ParticipantConversationEvent, ParticipantConversationsApi } from './participantApi.types'

type RevalidationHandler = (event?: ParticipantConversationEvent) => void

/** Subscribes to the host when it can push events (still revalidating on reconnection, when an event may have been lost); otherwise also on focus and visibility. */
export function useParticipantRevalidation(api: ParticipantConversationsApi, onRevalidate: RevalidationHandler): void {
  const handlerRef = useRef(onRevalidate)
  handlerRef.current = onRevalidate

  useEffect(() => {
    function handleFocus(): void {
      handlerRef.current()
    }
    if (api.subscribe) {
      const unsubscribe = api.subscribe((event) => handlerRef.current(event))
      window.addEventListener('online', handleFocus)
      return () => {
        unsubscribe()
        window.removeEventListener('online', handleFocus)
      }
    }
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'visible') handlerRef.current()
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [api])
}

import { useEffect, useRef } from 'react'

import type { ParticipantConversationEvent, ParticipantConversationsApi } from './participantApi.types'

type RevalidationHandler = (event?: ParticipantConversationEvent) => void

/** Subscribes to the host when it can push events; otherwise revalidates on window focus, visibility and reconnection. */
export function useParticipantRevalidation(api: ParticipantConversationsApi, onRevalidate: RevalidationHandler): void {
  const handlerRef = useRef(onRevalidate)
  handlerRef.current = onRevalidate

  useEffect(() => {
    if (api.subscribe) return api.subscribe((event) => handlerRef.current(event))

    function handleFocus(): void {
      handlerRef.current()
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
